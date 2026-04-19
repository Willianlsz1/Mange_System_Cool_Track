/**
 * CoolTrack Pro - Storage v5.0
 * localStorage como cache + Supabase como fonte de verdade
 * Offline first: salva local imediatamente, sincroniza com Supabase em background
 */

import { STORAGE_KEY, Utils } from './utils.js';
import { Toast } from './toast.js';
import { supabase } from './supabase.js';
import { migrateLegacyPhotosForRegistros, normalizePhotoList } from './photoStorage.js';
import { AppError, ErrorCodes, handleError } from './errors.js';
import {
  normalizeCriticidade,
  normalizePrioridadeOperacional,
  normalizePeriodicidadePreventivaDias,
} from '../domain/maintenance.js';
import {
  sanitizePersistedEquipamento,
  sanitizePersistedRegistro,
  sanitizePersistedSetor,
} from './inputValidation.js';

const STORAGE_WARN_BYTES = 4 * 1024 * 1024;
const STORAGE_LIMIT_BYTES = 5 * 1024 * 1024;
const STORAGE_SYNC_DIRTY_KEY = 'cooltrack-sync-dirty-v1';
const STORAGE_SYNC_DELETIONS_KEY = 'cooltrack-sync-deletions-v1';
const STORAGE_CACHE_OWNER_KEY = 'cooltrack-cache-owner-v1';
const SYNC_STATUS_EVENT = 'cooltrack:sync-status';

let _syncRunning = false;
let _queuedState = null;
let _syncStatus = {
  state: 'idle',
  message: '',
  pendingOps: 0,
  updatedAt: new Date().toISOString(),
};

/* Normalizacao (mantida igual) */
function normalizeEquip(e) {
  if (!e || typeof e !== 'object') return null;
  if (!e.id) return null;

  const sanitized = sanitizePersistedEquipamento({
    nome: e.nome,
    local: e.local,
    tag: e.tag,
    modelo: e.modelo,
  });
  if (!sanitized) return null;

  const setorIdRaw = e.setorId ?? e.setor_id ?? null;
  const setorId = setorIdRaw ? String(setorIdRaw) : null;

  return {
    id: String(e.id),
    nome: sanitized.nome,
    local: sanitized.local,
    status: ['ok', 'warn', 'danger'].includes(e.status) ? e.status : 'ok',
    tag: sanitized.tag,
    tipo: String(e.tipo || 'Outro'),
    modelo: sanitized.modelo,
    fluido: String(e.fluido || ''),
    criticidade: normalizeCriticidade(e.criticidade),
    prioridadeOperacional: normalizePrioridadeOperacional(e.prioridadeOperacional || e.prioridade),
    periodicidadePreventivaDias: normalizePeriodicidadePreventivaDias(
      e.periodicidadePreventivaDias,
      e.tipo,
      e.criticidade,
    ),
    setorId,
    // Feature Plus+: foto real do equipamento. Mesmo shape de `registros.fotos`.
    fotos: normalizePhotoList(e.fotos),
  };
}

function isLegacyEquipmentSchemaError(error) {
  const message = String(error?.message || '').toLowerCase();
  return (
    message.includes('column') &&
    (message.includes('criticidade') ||
      message.includes('prioridade_operacional') ||
      message.includes('periodicidade_preventiva_dias') ||
      message.includes('fotos'))
  );
}

function mapEquipamentoRow(equipamento, userId, { legacy = false } = {}) {
  const row = {
    id: equipamento.id,
    user_id: userId,
    nome: equipamento.nome,
    local: equipamento.local,
    status: equipamento.status,
    tag: equipamento.tag,
    tipo: equipamento.tipo,
    modelo: equipamento.modelo,
    fluido: equipamento.fluido,
    setor_id: equipamento.setorId ?? null,
  };
  if (legacy) return row;
  return {
    ...row,
    criticidade: normalizeCriticidade(equipamento.criticidade),
    prioridade_operacional: normalizePrioridadeOperacional(equipamento.prioridadeOperacional),
    periodicidade_preventiva_dias: normalizePeriodicidadePreventivaDias(
      equipamento.periodicidadePreventivaDias,
      equipamento.tipo,
      equipamento.criticidade,
    ),
    // Mesma semântica de `registros.fotos` (jsonb). Fallback pra legacy acima
    // se a coluna ainda não existir no schema (isLegacyEquipmentSchemaError).
    fotos: normalizePhotoList(equipamento.fotos),
  };
}

function isMissingSetorSchemaError(error) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('setor') || (message.includes('column') && message.includes('setor_id'));
}

function normalizeRegistro(r, equipamentoIds) {
  if (!r || typeof r !== 'object') return null;
  if (!r.id || !r.equipId || !equipamentoIds.has(String(r.equipId))) return null;

  const sanitized = sanitizePersistedRegistro(
    {
      equipId: String(r.equipId),
      data: r.data,
      tipo: r.tipo,
      obs: r.obs,
      status: r.status,
      pecas: r.pecas,
      proxima: r.proxima,
      tecnico: r.tecnico,
      custoPecas: r.custoPecas,
      custoMaoObra: r.custoMaoObra,
    },
    {
      existingEquipamentos: [{ id: String(r.equipId) }],
    },
  );
  if (!sanitized) return null;

  return {
    id: String(r.id),
    equipId: sanitized.equipId,
    data: sanitized.data,
    tipo: sanitized.tipo,
    obs: sanitized.obs,
    status: sanitized.status,
    pecas: sanitized.pecas,
    proxima: sanitized.proxima,
    fotos: normalizePhotoList(r.fotos),
    tecnico: sanitized.tecnico,
    custoPecas: sanitized.custoPecas,
    custoMaoObra: sanitized.custoMaoObra,
    assinatura: Boolean(r.assinatura),
  };
}

async function migrateLegacyPhotosInState(state, userId) {
  if (!state?.registros?.length) {
    return { state, migratedCount: 0, failedCount: 0 };
  }

  const migration = await migrateLegacyPhotosForRegistros(state.registros, { userId });
  if (!migration.migratedCount && !migration.failedCount) {
    return { state, migratedCount: 0, failedCount: 0 };
  }

  const migratedState = { ...state, registros: migration.registros };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(migratedState));
  } catch (_err) {
    // cache local é opcional nessa etapa
  }

  return {
    state: migratedState,
    migratedCount: migration.migratedCount,
    failedCount: migration.failedCount,
  };
}

function getCacheOwner() {
  return localStorage.getItem(STORAGE_CACHE_OWNER_KEY);
}

function setCacheOwner(userId) {
  if (!userId) return;
  localStorage.setItem(STORAGE_CACHE_OWNER_KEY, String(userId));
}

function markDirty() {
  localStorage.setItem(STORAGE_SYNC_DIRTY_KEY, '1');
}

function clearDirty() {
  localStorage.removeItem(STORAGE_SYNC_DIRTY_KEY);
}

function isDirty() {
  return localStorage.getItem(STORAGE_SYNC_DIRTY_KEY) === '1';
}

function parseDeletionQueue() {
  try {
    const raw = localStorage.getItem(STORAGE_SYNC_DELETIONS_KEY);
    if (!raw) return { equipamentos: [], registros: [], setores: [] };
    const parsed = JSON.parse(raw);
    const equipamentos = Array.isArray(parsed?.equipamentos)
      ? [...new Set(parsed.equipamentos.map(String).filter(Boolean))]
      : [];
    const registros = Array.isArray(parsed?.registros)
      ? [...new Set(parsed.registros.map(String).filter(Boolean))]
      : [];
    const setores = Array.isArray(parsed?.setores)
      ? [...new Set(parsed.setores.map(String).filter(Boolean))]
      : [];
    return { equipamentos, registros, setores };
  } catch (_error) {
    return { equipamentos: [], registros: [], setores: [] };
  }
}

function saveDeletionQueue(queue) {
  const sanitized = {
    equipamentos: [...new Set((queue?.equipamentos || []).map(String).filter(Boolean))],
    registros: [...new Set((queue?.registros || []).map(String).filter(Boolean))],
    setores: [...new Set((queue?.setores || []).map(String).filter(Boolean))],
  };
  if (!sanitized.equipamentos.length && !sanitized.registros.length && !sanitized.setores.length) {
    localStorage.removeItem(STORAGE_SYNC_DELETIONS_KEY);
    return sanitized;
  }
  localStorage.setItem(STORAGE_SYNC_DELETIONS_KEY, JSON.stringify(sanitized));
  return sanitized;
}

function queueDeletions({ equipamentos = [], registros = [], setores = [] } = {}) {
  const current = parseDeletionQueue();
  const next = {
    equipamentos: [...current.equipamentos, ...equipamentos.map(String).filter(Boolean)],
    registros: [...current.registros, ...registros.map(String).filter(Boolean)],
    setores: [...current.setores, ...setores.map(String).filter(Boolean)],
  };
  const saved = saveDeletionQueue(next);
  updateSyncStatus();
  return saved;
}

function clearSyncMetadata() {
  clearDirty();
  localStorage.removeItem(STORAGE_SYNC_DELETIONS_KEY);
  _queuedState = null;
  updateSyncStatus({ state: 'idle', message: '' });
}

function getPendingOpsCount() {
  const queue = parseDeletionQueue();
  let count = queue.equipamentos.length + queue.registros.length + queue.setores.length;
  if (isDirty()) count += 1;
  if (_queuedState) count += 1;
  return count;
}

function emitSyncStatus() {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
  window.dispatchEvent(new CustomEvent(SYNC_STATUS_EVENT, { detail: { ..._syncStatus } }));
}

function updateSyncStatus(patch = {}) {
  _syncStatus = {
    ..._syncStatus,
    ...patch,
    pendingOps: getPendingOpsCount(),
    updatedAt: new Date().toISOString(),
  };
  emitSyncStatus();
}

function splitIntoChunks(values, chunkSize = 100) {
  const list = Array.isArray(values) ? values : [];
  const chunks = [];
  for (let i = 0; i < list.length; i += chunkSize) {
    chunks.push(list.slice(i, i + chunkSize));
  }
  return chunks;
}

/* â”€â”€ Supabase helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
async function getUserId() {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch (error) {
    handleError(error, {
      code: ErrorCodes.AUTH_FAILED,
      message: 'Não foi possível identificar o usuário logado.',
      context: { action: 'storage.getUserId' },
      showToast: false,
    });
    return null;
  }
}

async function pushEquipamentos(equipamentos, userId) {
  if (!equipamentos.length) return;
  try {
    const rows = equipamentos.map((equipamento) => mapEquipamentoRow(equipamento, userId));
    let { error } = await supabase.from('equipamentos').upsert(rows, { onConflict: 'id' });
    if (error && isLegacyEquipmentSchemaError(error)) {
      const legacyRows = equipamentos.map((equipamento) =>
        mapEquipamentoRow(equipamento, userId, { legacy: true }),
      );
      ({ error } = await supabase.from('equipamentos').upsert(legacyRows, { onConflict: 'id' }));
    }
    if (error) throw error;
  } catch (error) {
    throw new AppError('Falha ao sincronizar equipamentos.', ErrorCodes.SYNC_FAILED, 'warning', {
      action: 'pushEquipamentos',
      quantidade: equipamentos.length,
      userId,
      cause: error?.message,
    });
  }
}

async function pushRegistros(registros, userId) {
  if (!registros.length) return;
  try {
    const rows = registros.map((r) => ({
      id: r.id,
      user_id: userId,
      equip_id: r.equipId,
      data: r.data,
      tipo: r.tipo,
      obs: r.obs,
      status: r.status,
      pecas: r.pecas,
      proxima: r.proxima,
      tecnico: r.tecnico,
      custo_pecas: r.custoPecas,
      custo_mao_obra: r.custoMaoObra,
      assinatura: r.assinatura,
      fotos: normalizePhotoList(r.fotos),
    }));
    const { error } = await supabase.from('registros').upsert(rows, { onConflict: 'id' });
    if (error) throw error;
  } catch (error) {
    throw new AppError('Falha ao sincronizar registros.', ErrorCodes.SYNC_FAILED, 'warning', {
      action: 'pushRegistros',
      quantidade: registros.length,
      userId,
      cause: error?.message,
    });
  }
}

async function pushTecnicos(tecnicos, userId) {
  if (!tecnicos.length) return;
  try {
    const rows = [...new Set(tecnicos.map(String).filter(Boolean))].map((nome) => ({
      user_id: userId,
      nome,
    }));
    if (!rows.length) return;
    const { error } = await supabase.from('tecnicos').upsert(rows, { onConflict: 'user_id,nome' });
    if (error) throw error;
  } catch (error) {
    throw new AppError('Falha ao sincronizar técnicos.', ErrorCodes.SYNC_FAILED, 'warning', {
      action: 'pushTecnicos',
      quantidade: tecnicos.length,
      userId,
      cause: error?.message,
    });
  }
}

async function pushSetores(setores, userId) {
  if (!setores?.length) return;
  try {
    const rows = setores
      .map((s) => sanitizePersistedSetor(s))
      .filter(Boolean)
      .map((s) => ({
        id: s.id,
        user_id: userId,
        nome: s.nome,
        cor: s.cor,
      }));
    if (!rows.length) return;
    const { error } = await supabase.from('setores').upsert(rows, { onConflict: 'id' });
    if (error) {
      // Schema antigo sem tabela setores — loga mas não quebra sync
      if (isMissingSetorSchemaError(error)) return;
      throw error;
    }
  } catch (error) {
    if (isMissingSetorSchemaError(error)) return;
    throw new AppError('Falha ao sincronizar setores.', ErrorCodes.SYNC_FAILED, 'warning', {
      action: 'pushSetores',
      quantidade: setores.length,
      userId,
      cause: error?.message,
    });
  }
}

async function deleteRemoteRegistros(ids, userId) {
  const uniqueIds = [...new Set((ids || []).map(String).filter(Boolean))];
  if (!uniqueIds.length) return;
  for (const chunk of splitIntoChunks(uniqueIds, 100)) {
    const { error } = await supabase
      .from('registros')
      .delete()
      .eq('user_id', userId)
      .in('id', chunk);
    if (error) throw error;
  }
}

async function deleteRemoteEquipamentos(ids, userId) {
  const uniqueIds = [...new Set((ids || []).map(String).filter(Boolean))];
  if (!uniqueIds.length) return;
  for (const chunk of splitIntoChunks(uniqueIds, 100)) {
    const { error } = await supabase
      .from('equipamentos')
      .delete()
      .eq('user_id', userId)
      .in('id', chunk);
    if (error) throw error;
  }
}

async function deleteRemoteSetores(ids, userId) {
  const uniqueIds = [...new Set((ids || []).map(String).filter(Boolean))];
  if (!uniqueIds.length) return;
  for (const chunk of splitIntoChunks(uniqueIds, 100)) {
    const { error } = await supabase.from('setores').delete().eq('user_id', userId).in('id', chunk);
    if (error) {
      // Tabela ainda não migrada — não bloqueia sync
      if (isMissingSetorSchemaError(error)) return;
      throw error;
    }
  }
}

async function flushPendingDeletions(userId) {
  const queue = parseDeletionQueue();
  if (!queue.equipamentos.length && !queue.registros.length && !queue.setores.length) return;

  const remaining = {
    ...queue,
    equipamentos: [...queue.equipamentos],
    registros: [...queue.registros],
    setores: [...queue.setores],
  };

  if (queue.registros.length) {
    await deleteRemoteRegistros(queue.registros, userId);
    remaining.registros = [];
  }
  if (queue.equipamentos.length) {
    await deleteRemoteEquipamentos(queue.equipamentos, userId);
    remaining.equipamentos = [];
  }
  if (queue.setores.length) {
    // ON DELETE SET NULL no FK garante que equipamentos continuam existindo
    // mesmo se os setores forem deletados primeiro.
    await deleteRemoteSetores(queue.setores, userId);
    remaining.setores = [];
  }

  saveDeletionQueue(remaining);
}

async function pullFromSupabase(userId) {
  let eqRes;
  let regRes;
  let tecRes;
  let setRes;
  try {
    [eqRes, regRes, tecRes, setRes] = await Promise.all([
      supabase.from('equipamentos').select('*').eq('user_id', userId),
      supabase.from('registros').select('*').eq('user_id', userId),
      supabase.from('tecnicos').select('nome').eq('user_id', userId),
      // Setores é opcional — se a tabela ainda não existir (schema antigo),
      // o erro é absorvido e seguimos com lista vazia.
      supabase.from('setores').select('id, nome, cor').eq('user_id', userId),
    ]);
    if (eqRes.error || regRes.error || tecRes.error) {
      throw new Error(
        eqRes.error?.message || regRes.error?.message || tecRes.error?.message || 'select failed',
      );
    }
  } catch (error) {
    throw new AppError('Falha ao carregar dados da nuvem.', ErrorCodes.NETWORK_ERROR, 'warning', {
      action: 'pullFromSupabase',
      userId,
      cause: error?.message,
    });
  }

  const equipamentos = (eqRes.data || []).map((e) => ({
    id: e.id,
    nome: e.nome,
    local: e.local,
    status: e.status,
    tag: e.tag || '',
    tipo: e.tipo || 'Outro',
    modelo: e.modelo || '',
    fluido: e.fluido || '',
    criticidade: normalizeCriticidade(e.criticidade),
    prioridadeOperacional: normalizePrioridadeOperacional(
      e.prioridade_operacional || e.prioridadeOperacional,
    ),
    periodicidadePreventivaDias: normalizePeriodicidadePreventivaDias(
      e.periodicidade_preventiva_dias,
      e.tipo,
      e.criticidade,
    ),
    setorId: e.setor_id ? String(e.setor_id) : null,
    // Feature Plus+: pode vir null de schema antigo ou array vazio.
    fotos: normalizePhotoList(e.fotos),
  }));

  const equipIds = new Set(equipamentos.map((e) => e.id));

  const registros = (regRes.data || [])
    .map((r) => ({
      id: r.id,
      equipId: r.equip_id,
      data: r.data,
      tipo: r.tipo,
      obs: r.obs || '',
      status: r.status || 'ok',
      pecas: r.pecas || '',
      proxima: r.proxima || '',
      tecnico: r.tecnico || '',
      custoPecas: parseFloat(r.custo_pecas || 0),
      custoMaoObra: parseFloat(r.custo_mao_obra || 0),
      assinatura: Boolean(r.assinatura),
      fotos: normalizePhotoList(r.fotos),
    }))
    .filter((r) => equipIds.has(r.equipId));

  const tecnicos = (tecRes.data || []).map((t) => t.nome);

  // Setores: absorve erro se tabela ainda não existe
  const setores = setRes?.error
    ? []
    : (setRes?.data || []).map((s) => sanitizePersistedSetor(s)).filter(Boolean);

  return { equipamentos, registros, tecnicos, setores };
}

/* Migracao automatica localStorage -> Supabase */
async function migrateIfNeeded(userId) {
  const MIGRATED_KEY = `cooltrack-migrated-${userId}`;
  if (localStorage.getItem(MIGRATED_KEY)) return;

  const cacheOwner = getCacheOwner();
  if (cacheOwner && cacheOwner !== userId) {
    localStorage.setItem(MIGRATED_KEY, '1');
    return;
  }

  // Não migra se o usuário estava no modo guest — dados são do seed
  const isGuestMode = localStorage.getItem('cooltrack-guest-mode') === '1';
  if (isGuestMode) {
    localStorage.setItem(MIGRATED_KEY, '1');
    return;
  }

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    localStorage.setItem(MIGRATED_KEY, '1');
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.equipamentos?.length) {
      localStorage.setItem(MIGRATED_KEY, '1');
      return;
    }

    Toast.info('Migrando seus dados para a nuvem...');
    // Setores primeiro para satisfazer FK
    await pushSetores(parsed.setores || [], userId);
    await pushEquipamentos(parsed.equipamentos, userId);
    await pushRegistros(parsed.registros || [], userId);
    await pushTecnicos(parsed.tecnicos || [], userId);
    localStorage.setItem(MIGRATED_KEY, '1');
    Toast.success('Dados migrados com sucesso.');
  } catch (_) {
    // falha silenciosa — tenta na próxima vez
  }
}

/* API publica */
export const Storage = {
  async loadFromSupabase() {
    const userId = await getUserId();
    if (!userId) return null;

    const cacheOwner = getCacheOwner();
    const sameOwner = !cacheOwner || cacheOwner === userId;
    const localSnapshot = this._loadLocal();

    if (!sameOwner) {
      clearSyncMetadata();
    }

    if (sameOwner && localSnapshot && this.hasPendingSync()) {
      const synced = await this._syncToSupabase(localSnapshot, {
        silent: true,
        context: 'loadFromSupabase.pendingFlush',
      });
      if (!synced) {
        updateSyncStatus({
          state: 'pending',
          message: 'Sem conexão com a nuvem. Exibindo dados locais.',
        });
        return localSnapshot;
      }
    }

    try {
      await migrateIfNeeded(userId);
    } catch (error) {
      handleError(error, {
        code: ErrorCodes.SYNC_FAILED,
        message: 'Falha ao preparar migração de dados.',
        context: { action: 'loadFromSupabase.migrate' },
      });
    }

    try {
      const state = await pullFromSupabase(userId);
      // Atualiza cache local
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      setCacheOwner(userId);
      clearDirty();
      updateSyncStatus({ state: 'synced', message: 'Dados sincronizados.' });

      // Migração gradual de fotos legadas (base64) para Storage sem bloquear o bootstrap
      this._migrateLegacyPhotosAsync(state, userId);
      return state;
    } catch (err) {
      handleError(err, {
        code: ErrorCodes.SYNC_FAILED,
        severity: 'warning',
        message: 'Sincronização pendente. Seus dados estão salvos localmente.',
        context: { action: 'loadFromSupabase.pull' },
      });
      updateSyncStatus({
        state: 'pending',
        message: 'Sincronização pendente. Seus dados estão salvos localmente.',
      });
      return sameOwner ? localSnapshot : null;
    }
  },

  load(defaultState) {
    return this._loadLocal() || defaultState;
  },

  _loadLocal() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      const setores = (Array.isArray(parsed.setores) ? parsed.setores : [])
        .map(sanitizePersistedSetor)
        .filter(Boolean);
      const setorIds = new Set(setores.map((s) => s.id));
      const equipamentos = (Array.isArray(parsed.equipamentos) ? parsed.equipamentos : [])
        .map(normalizeEquip)
        .filter(Boolean)
        .map((e) => ({
          ...e,
          // Se o setor foi removido, descola o equipamento (mesmo comportamento do FK ON DELETE SET NULL).
          setorId: e.setorId && setorIds.has(e.setorId) ? e.setorId : null,
        }));
      const equipIds = new Set(equipamentos.map((e) => e.id));
      const registros = (Array.isArray(parsed.registros) ? parsed.registros : [])
        .map((r) => normalizeRegistro(r, equipIds))
        .filter(Boolean);
      const tecnicos = Array.isArray(parsed.tecnicos)
        ? [
            ...new Set(parsed.tecnicos.filter((t) => typeof t === 'string').map((t) => t.trim())),
          ].filter(Boolean)
        : [];
      return { equipamentos, registros, tecnicos, setores };
    } catch (err) {
      handleError(err, {
        code: ErrorCodes.DATA_CORRUPT,
        message: 'Falha ao carregar dados locais.',
        context: { action: '_loadLocal' },
        showToast: false,
      });
      return null;
    }
  },

  save(state) {
    const isGuestMode = localStorage.getItem('cooltrack-guest-mode') === '1';
    // 1. Salva local imediatamente (offline first)
    try {
      const serialized = JSON.stringify(state);
      const byteSize = serialized.length * 2;
      if (byteSize >= STORAGE_LIMIT_BYTES) {
        Toast.error(`Armazenamento cheio. Remova registros antigos com fotos.`);
        return false;
      }
      if (byteSize >= STORAGE_WARN_BYTES) {
        Toast.warning(`Uso de armazenamento elevado: ${Utils.formatBytes(byteSize)} / 5 MB.`);
      }
      localStorage.setItem(STORAGE_KEY, serialized);
      if (!isGuestMode) {
        markDirty();
      }
    } catch (error) {
      handleError(error, {
        code: ErrorCodes.STORAGE_QUOTA,
        message: 'Falha ao salvar localmente.',
        context: { action: 'save' },
      });
      return false;
    }

    // 2. Sincroniza com Supabase em background (não bloqueia UI)
    if (!isGuestMode) {
      this._scheduleSync(state);
    }
    return true;
  },

  _scheduleSync(state) {
    _queuedState = state;
    if (_syncRunning) {
      updateSyncStatus({ state: 'pending', message: 'Sincronização em fila.' });
      return;
    }
    _syncRunning = true;
    updateSyncStatus({ state: 'syncing', message: 'Sincronizando alterações...' });
    void this._drainSyncQueue();
  },

  async _drainSyncQueue() {
    try {
      while (_queuedState) {
        const snapshot = _queuedState;
        _queuedState = null;
        const ok = await this._syncToSupabase(snapshot, {
          silent: false,
          context: 'storage._drainSyncQueue',
        });
        if (!ok) break;
      }
    } finally {
      _syncRunning = false;
      if (!this.hasPendingSync()) {
        updateSyncStatus({ state: 'synced', message: 'Dados sincronizados.' });
      }
    }
  },

  async _syncToSupabase(state, { silent = false, context = '_syncToSupabase' } = {}) {
    if (localStorage.getItem('cooltrack-guest-mode') === '1') {
      clearSyncMetadata();
      return false;
    }

    const userId = await getUserId();
    if (!userId) {
      updateSyncStatus({
        state: 'pending',
        message: 'Faça login para sincronizar os dados.',
      });
      return false;
    }

    updateSyncStatus({ state: 'syncing', message: 'Sincronizando alterações...' });

    try {
      await flushPendingDeletions(userId);

      const migration = await migrateLegacyPhotosInState(state, userId);
      const syncState = migration.state;

      // IMPORTANTE: push setores ANTES de equipamentos para não violar FK.
      // (equipamentos.setor_id referencia setores.id)
      await pushSetores(syncState.setores || [], userId);
      await pushEquipamentos(syncState.equipamentos, userId);
      await pushRegistros(syncState.registros, userId);
      await pushTecnicos(syncState.tecnicos, userId);

      if (migration.failedCount > 0) {
        Toast.warning(
          'Algumas fotos não foram enviadas para a nuvem e permaneceram salvas localmente.',
        );
      }
      clearDirty();
      setCacheOwner(userId);
      updateSyncStatus({ state: 'synced', message: 'Dados sincronizados.' });
      return true;
    } catch (err) {
      handleError(err, {
        code: ErrorCodes.SYNC_FAILED,
        severity: 'warning',
        message: 'Sincronização pendente. Seus dados estão salvos localmente.',
        context: { action: context },
        showToast: !silent,
      });
      updateSyncStatus({
        state: 'pending',
        message: 'Sincronização pendente. Tentaremos novamente automaticamente.',
      });
      return false;
    }
  },

  async _migrateLegacyPhotosAsync(state, userId) {
    try {
      const migration = await migrateLegacyPhotosInState(state, userId);
      if (!migration.migratedCount) return;

      await pushRegistros(migration.state.registros, userId);
      if (migration.failedCount > 0) {
        Toast.warning('Algumas fotos antigas não puderam ser migradas e seguem salvas localmente.');
      }
    } catch (error) {
      handleError(error, {
        code: ErrorCodes.SYNC_FAILED,
        severity: 'warning',
        message: 'Migração de fotos pendente. Tentaremos novamente automaticamente.',
        context: { action: 'storage._migrateLegacyPhotosAsync' },
        showToast: false,
      });
    }
  },

  markRegistroDeleted(id) {
    if (localStorage.getItem('cooltrack-guest-mode') === '1') return;
    queueDeletions({ registros: [id] });
    markDirty();
  },

  markEquipDeleted(equipId, registroIds = []) {
    if (localStorage.getItem('cooltrack-guest-mode') === '1') return;
    queueDeletions({ equipamentos: [equipId], registros: registroIds });
    markDirty();
  },

  markSetorDeleted(id) {
    if (localStorage.getItem('cooltrack-guest-mode') === '1') return;
    queueDeletions({ setores: [id] });
    markDirty();
  },

  hasPendingSync() {
    const queue = parseDeletionQueue();
    return Boolean(
      isDirty() ||
      _queuedState ||
      queue.equipamentos.length ||
      queue.registros.length ||
      queue.setores.length ||
      _syncRunning,
    );
  },

  getSyncStatus() {
    return { ..._syncStatus, pendingOps: getPendingOpsCount() };
  },

  usage() {
    const used = Utils.getStorageBytes();
    return {
      used,
      total: STORAGE_LIMIT_BYTES,
      percent: Math.min(100, Math.round((used / STORAGE_LIMIT_BYTES) * 100)),
    };
  },
};
