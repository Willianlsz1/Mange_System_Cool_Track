/**
 * CoolTrack Pro — signature-storage
 *
 * Camada de UI sobre `src/core/signatureStorage.js`. Três modos de uso:
 *
 * 1. `saveSignatureForRecord(registroId, dataUrl, opts)` (async) — chamado no
 *    fluxo de salvar registro. Grava em localStorage (cache) + faz upload pro
 *    Supabase Storage. Se offline/falha, enfileira pra upload posterior e
 *    retorna `null` (caller salva registro sem reference; reconcile depois
 *    preenche `registros.assinatura`).
 *
 * 2. `resolveSignatureForRecord(registro)` (async) — resolve a assinatura pra
 *    data URL pronta de renderizar (img / PDF). Ordem: reference remoto
 *    (`registro.assinatura`) → cache local → null.
 *
 * 3. `getSignatureForRecord(registroId)` (sync) — acesso síncrono ao cache
 *    local. Mantido pra backward compat com callers que ainda não migraram
 *    pro fluxo async (ex.: pipelines de PDF legados).
 */

import { Toast } from '../../../core/toast.js';
import { supabase } from '../../../core/supabase.js';
import {
  uploadSignatureDataUrl,
  getSignatureSignedUrl,
  normalizeSignatureEntry,
  enqueuePendingSignature,
} from '../../../core/signatureStorage.js';

const SIG_STORAGE_PREFIX = 'cooltrack-sig-';
const SIG_CLEANUP_SESSION_KEY = 'cooltrack-sig-cleanup-done';

function getSignatureStorageKey(registroId) {
  return `${SIG_STORAGE_PREFIX}${registroId}`;
}

/**
 * Cache local síncrono. Continua útil pra:
 *   - fallback quando remote está offline
 *   - callers que ainda não migraram pra `resolveSignatureForRecord`
 */
export function getSignatureForRecord(registroId) {
  if (!registroId) return null;
  try {
    return localStorage.getItem(getSignatureStorageKey(registroId)) || null;
  } catch (_err) {
    return null;
  }
}

/**
 * Persiste assinatura no Supabase Storage e no cache local.
 *
 * @param {string} registroId
 * @param {string} dataUrl — data URL PNG/JPG vinda do canvas
 * @param {{ userId?: string }} [opts]
 * @returns {Promise<object|null>} reference do Storage OU null quando offline.
 *   Quando null, a captura ficou na queue `cooltrack-sig-pending-upload` e
 *   será sincronizada pelo flush online.
 */
export async function saveSignatureForRecord(registroId, dataUrl, opts = {}) {
  if (!registroId || !dataUrl) return null;

  // 1. Cache local imediato — garante preview instantâneo mesmo sem rede.
  try {
    localStorage.setItem(getSignatureStorageKey(registroId), dataUrl);
  } catch (_err) {
    Toast.warning('Assinatura não pôde ser salva localmente (armazenamento cheio).');
  }

  // 2. Resolve userId. Prefer o passado no opts (caller já tem do fluxo de
  //    save do registro); cai pra supabase.auth.getUser() se ausente.
  let userId = opts.userId;
  if (!userId) {
    try {
      const { data } = await supabase.auth.getUser();
      userId = data?.user?.id || null;
    } catch (_err) {
      userId = null;
    }
  }

  if (!userId) {
    // Sem auth — enfileira pra reconcile quando logar.
    enqueuePendingSignature(registroId, dataUrl);
    return null;
  }

  // 3. Tenta upload. Erro de rede/storage → enfileira + retorna null.
  try {
    const reference = await uploadSignatureDataUrl(dataUrl, { userId, recordId: registroId });
    return reference;
  } catch (_err) {
    enqueuePendingSignature(registroId, dataUrl);
    return null;
  }
}

/**
 * Resolve assinatura pra exibição (data URL renderizável em `<img>` ou PDF).
 *
 * Ordem:
 *   1. `registro.assinatura` legacy (dataUrl inline) → retorna direto.
 *   2. `registro.assinatura` reference (Storage) → fetch + convert.
 *   3. Cache local (`getSignatureForRecord`) → fallback.
 *   4. null.
 *
 * @param {{ id: string, assinatura?: any }} registro
 * @returns {Promise<string|null>} data URL PNG/JPG pronta pra uso
 */
export async function resolveSignatureForRecord(registro) {
  if (!registro || !registro.id) return null;

  const normalized = normalizeSignatureEntry(registro.assinatura);

  if (normalized?.legacy && normalized.dataUrl) {
    return normalized.dataUrl;
  }

  if (normalized && !normalized.legacy && normalized.path) {
    try {
      const signed = await getSignatureSignedUrl(normalized);
      if (signed?.url) {
        const dataUrl = await fetchAsDataUrl(signed.url);
        if (dataUrl) return dataUrl;
      }
    } catch (_err) {
      // Cai pro fallback local abaixo.
    }
  }

  const localDataUrl = getSignatureForRecord(registro.id);

  // Migração on-demand: se achou no cache local mas o registro NÃO tem
  // reference remoto (só flag boolean ou null), faz upload em background
  // e atualiza a coluna. Fire-and-forget — não bloqueia o retorno.
  // `normalized?.path` protege contra re-migrar registros que já têm
  // reference mas falharam o fetch (ex.: offline momentâneo).
  if (localDataUrl && !normalized?.path) {
    // Sem await: migração corre no background.
    tryMigrateLegacySignature(registro, localDataUrl);
  }

  return localDataUrl;
}

// Dedup de migrações em andamento pro mesmo registroId. Se o viewer é aberto
// 2x rápido ou o PDF pipeline dispara N paralelos, só 1 migração efetiva.
const _migrationInFlight = new Set();

async function tryMigrateLegacySignature(registro, dataUrl) {
  if (!registro?.id || !dataUrl) return;
  if (_migrationInFlight.has(registro.id)) return;
  _migrationInFlight.add(registro.id);

  try {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) return;

    const reference = await uploadSignatureDataUrl(dataUrl, {
      userId,
      recordId: registro.id,
    });
    if (!reference) return;

    // Update da coluna `registros.assinatura` com reference. Se falhar
    // (offline, RLS, etc.), o objeto no Storage continua lá mas a coluna
    // segue como boolean/null. Próxima abertura do mesmo registro detecta
    // o mismatch e tenta migrar de novo — upsert:true no upload garante
    // idempotência.
    await supabase
      .from('registros')
      .update({ assinatura: reference })
      .eq('id', registro.id)
      .eq('user_id', userId);
  } catch (_err) {
    // Silent — migração é best-effort. Não acumula na queue pendente
    // porque a lógica de pending é para capturas novas offline, não pra
    // retrofit de dados legacy. Só loga em dev.
    if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
      console.debug('[signature] legacy migration failed for', registro?.id, _err);
    }
  } finally {
    _migrationInFlight.delete(registro.id);
  }
}

async function fetchAsDataUrl(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await blobToDataUrl(blob);
  } catch (_err) {
    return null;
  }
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('FileReader error ao converter blob.'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Remove do cache local assinaturas cujo `registroId` não consta mais na lista
 * de registros válidos (ex.: após delete). Rodado uma vez por sessão pra não
 * custar performance.
 */
export function cleanupOrphanSignatures(validRegistroIds = []) {
  if (sessionStorage.getItem(SIG_CLEANUP_SESSION_KEY) === '1') return;
  const validIds = new Set((validRegistroIds || []).map((id) => String(id)));

  try {
    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(SIG_STORAGE_PREFIX)) continue;
      const registroId = key.slice(SIG_STORAGE_PREFIX.length);
      if (!validIds.has(registroId)) {
        localStorage.removeItem(key);
      }
    }
  } finally {
    sessionStorage.setItem(SIG_CLEANUP_SESSION_KEY, '1');
  }
}
