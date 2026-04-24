/**
 * CoolTrack Pro — signatureStorage
 *
 * Persiste assinaturas do cliente no Supabase Storage (bucket compartilhado
 * `registro-fotos`, path `{userId}/registros/{recordId}/assinatura.png`).
 *
 * Shape de referência (shape armazenado em `registros.assinatura`):
 *   {
 *     version: 1,
 *     provider: 'supabase-storage',
 *     bucket: 'registro-fotos',
 *     path: '<userId>/registros/<recordId>/assinatura.png',
 *     url: '<signed>',
 *     urlExpiresAt: '<iso>',
 *     mimeType: 'image/png',
 *     size: <bytes>,
 *     uploadedAt: '<iso>',
 *   }
 *
 * Shape legacy (mantido pra compat com dados antigos em localStorage):
 *   { version: 1, legacy: true, dataUrl: '<data-url>' }
 *
 * Queue offline:
 *   `cooltrack-sig-pending-upload` em localStorage guarda captures que ainda
 *   não subiram pro Storage. `flushPendingSignatures()` processa quando voltar
 *   online (chamado no mesmo ponto que `uploadPendingPhotos`).
 */

import { supabase } from './supabase.js';
import { AppError, ErrorCodes } from './errors.js';
import { dataUrlToBlob, createSignedUrl } from './photoStorage.js';

const DEFAULT_BUCKET = import.meta.env.VITE_SUPABASE_PHOTOS_BUCKET || 'registro-fotos';
const SIGNATURE_REF_VERSION = 1;
const PENDING_QUEUE_KEY = 'cooltrack-sig-pending-upload';
const MAX_PENDING_QUEUE = 50;

const DATA_URL_REGEX = /^data:image\/[a-z0-9.+-]+;base64,/i;

function isString(v) {
  return typeof v === 'string';
}

function buildSignaturePath({ userId, recordId }) {
  const safeUser = String(userId || '').replace(/[^a-zA-Z0-9-]/g, '_');
  const safeRecord = String(recordId || 'registro').replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${safeUser}/registros/${safeRecord}/assinatura.png`;
}

// ─── Upload ─────────────────────────────────────────────────────────────

export async function uploadSignatureDataUrl(dataUrl, { userId, recordId } = {}) {
  if (!isString(dataUrl) || !DATA_URL_REGEX.test(dataUrl.trim())) {
    throw new AppError(
      'Assinatura inválida — esperado data URL de imagem.',
      ErrorCodes.VALIDATION_ERROR,
      'warning',
      { action: 'signatureStorage.uploadSignatureDataUrl' },
    );
  }
  if (!userId || !recordId) {
    throw new AppError(
      'Upload de assinatura requer userId e recordId.',
      ErrorCodes.VALIDATION_ERROR,
      'warning',
      {
        action: 'signatureStorage.uploadSignatureDataUrl',
        hasUserId: !!userId,
        hasRecordId: !!recordId,
      },
    );
  }

  const blob = await dataUrlToBlob(dataUrl);
  const mimeType = blob.type || 'image/png';
  const path = buildSignaturePath({ userId, recordId });

  // upsert:true porque o path é fixo por registro — se técnico refizer a
  // assinatura (ex: cliente pediu pra refazer), sobrescreve o objeto anterior.
  const { error: uploadError } = await supabase.storage.from(DEFAULT_BUCKET).upload(path, blob, {
    upsert: true,
    contentType: mimeType,
    cacheControl: '31536000',
  });

  if (uploadError) {
    throw new AppError(
      'Falha ao enviar assinatura para o armazenamento.',
      ErrorCodes.SYNC_FAILED,
      'warning',
      {
        action: 'signatureStorage.uploadSignatureDataUrl',
        bucket: DEFAULT_BUCKET,
        path,
        detail: uploadError.message,
      },
    );
  }

  const signed = await createSignedUrl(DEFAULT_BUCKET, path);
  return {
    version: SIGNATURE_REF_VERSION,
    provider: 'supabase-storage',
    bucket: DEFAULT_BUCKET,
    path,
    url: signed.url,
    urlExpiresAt: signed.expiresAt,
    mimeType,
    size: blob.size,
    uploadedAt: new Date().toISOString(),
  };
}

// ─── Signed URL ─────────────────────────────────────────────────────────

export async function getSignatureSignedUrl(reference) {
  const normalized = normalizeSignatureEntry(reference);
  if (!normalized || normalized.legacy) return null;
  if (!normalized.path || !normalized.bucket) return null;
  return createSignedUrl(normalized.bucket, normalized.path);
}

// ─── Normalizer ─────────────────────────────────────────────────────────

export function normalizeSignatureEntry(value) {
  if (value == null) return null;

  if (isString(value)) {
    const trimmed = value.trim();
    if (!trimmed) return null;

    // String JSON (caso coluna `registros.assinatura` seja `text` e o JS
    // serializou o objeto ao inserir — PostgREST faz isso).
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === 'object') {
          return normalizeSignatureEntry(parsed);
        }
      } catch (_err) {
        /* cai pra data URL abaixo */
      }
    }

    if (DATA_URL_REGEX.test(trimmed)) {
      return { version: SIGNATURE_REF_VERSION, legacy: true, dataUrl: trimmed };
    }

    return null;
  }

  if (typeof value !== 'object') return null;

  if (
    value.legacy === true &&
    isString(value.dataUrl) &&
    DATA_URL_REGEX.test(value.dataUrl.trim())
  ) {
    return { version: SIGNATURE_REF_VERSION, legacy: true, dataUrl: value.dataUrl.trim() };
  }

  if (isString(value.path) && value.path.trim()) {
    const bucket =
      isString(value.bucket) && value.bucket.trim() ? value.bucket.trim() : DEFAULT_BUCKET;
    return {
      version: Number(value.version) || SIGNATURE_REF_VERSION,
      provider: isString(value.provider) ? value.provider : 'supabase-storage',
      bucket,
      path: value.path.trim(),
      url: isString(value.url) ? value.url : undefined,
      urlExpiresAt: isString(value.urlExpiresAt) ? value.urlExpiresAt : undefined,
      mimeType: isString(value.mimeType) ? value.mimeType : undefined,
      size: Number.isFinite(value.size) ? value.size : undefined,
      uploadedAt: isString(value.uploadedAt) ? value.uploadedAt : undefined,
    };
  }

  return null;
}

// ─── Pending queue (localStorage) ───────────────────────────────────────

function readPendingQueue() {
  try {
    const raw = localStorage.getItem(PENDING_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_err) {
    return [];
  }
}

function writePendingQueue(list) {
  try {
    localStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(list));
  } catch (_err) {
    /* storage cheio / indisponível — falha silenciosa */
  }
}

export function enqueuePendingSignature(registroId, dataUrl) {
  if (!registroId || !isString(dataUrl) || !DATA_URL_REGEX.test(dataUrl.trim())) {
    return 0;
  }
  const existing = readPendingQueue();
  // Remove entry duplicada pro mesmo registroId — sempre mantém a mais nova.
  const filtered = existing.filter((e) => e && e.registroId !== registroId);
  filtered.push({
    registroId: String(registroId),
    dataUrl: dataUrl.trim(),
    queuedAt: Date.now(),
  });
  // Limite duro: se ultrapassar MAX_PENDING_QUEUE, descarta os mais antigos.
  const trimmed =
    filtered.length > MAX_PENDING_QUEUE ? filtered.slice(-MAX_PENDING_QUEUE) : filtered;
  writePendingQueue(trimmed);
  return trimmed.length;
}

export function listPendingSignatures() {
  return readPendingQueue().filter(
    (e) => e && typeof e === 'object' && e.registroId && isString(e.dataUrl),
  );
}

export function clearPendingSignature(registroId) {
  const existing = readPendingQueue();
  const filtered = existing.filter((e) => e && e.registroId !== String(registroId));
  if (filtered.length !== existing.length) {
    writePendingQueue(filtered);
  }
}

export function getPendingQueueSize() {
  return readPendingQueue().length;
}

/**
 * Processa a queue de assinaturas pendentes (capturadas offline ou após falha
 * de upload no fluxo de save). Pra cada entry: faz upload pro Storage e
 * atualiza `registros.assinatura` com o reference. Se a atualização falhar
 * (registro ainda não sincronizado, RLS, erro de rede), o entry permanece
 * na queue pra próxima rodada — upsert:true no upload garante idempotência.
 *
 * @returns {Promise<{processed:number, failed:number, skipped:number}>}
 */
export async function flushPendingSignatures() {
  const pending = listPendingSignatures();
  if (pending.length === 0) {
    return { processed: 0, failed: 0, skipped: 0 };
  }

  // Resolve userId uma vez pra toda a batch.
  let userId = null;
  try {
    const { data } = await supabase.auth.getUser();
    userId = data?.user?.id || null;
  } catch (_err) {
    /* sem auth — skip batch toda abaixo */
  }
  if (!userId) {
    return { processed: 0, failed: 0, skipped: pending.length };
  }

  let processed = 0;
  let failed = 0;

  for (const entry of pending) {
    try {
      const reference = await uploadSignatureDataUrl(entry.dataUrl, {
        userId,
        recordId: entry.registroId,
      });
      if (!reference) {
        failed += 1;
        continue;
      }

      const { error } = await supabase
        .from('registros')
        .update({ assinatura: reference })
        .eq('id', entry.registroId)
        .eq('user_id', userId);

      if (error) {
        // Registro pode ainda não existir no Supabase (sync pendente do
        // próprio registro). Mantém na queue pra próxima rodada.
        failed += 1;
        continue;
      }

      clearPendingSignature(entry.registroId);
      processed += 1;
    } catch (_err) {
      failed += 1;
    }
  }

  return { processed, failed, skipped: 0 };
}
