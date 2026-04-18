import { supabase } from './supabase.js';
import { AppError, ErrorCodes } from './errors.js';

const DEFAULT_BUCKET = import.meta.env.VITE_SUPABASE_PHOTOS_BUCKET || 'registro-fotos';
const DEFAULT_SIGNED_URL_TTL_SECONDS = 60 * 60 * 24;

function parseSignedUrlTtlSeconds(rawValue) {
  const parsed = Number.parseInt(String(rawValue || ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_SIGNED_URL_TTL_SECONDS;
  return parsed;
}

const SIGNED_URL_TTL_SECONDS = parseSignedUrlTtlSeconds(
  import.meta.env.VITE_SUPABASE_PHOTO_URL_TTL,
);
const PHOTO_REF_VERSION = 1;

function isString(value) {
  return typeof value === 'string';
}

function isDataUrl(value) {
  return isString(value) && /^data:image\/[a-z0-9.+-]+;base64,/i.test(value.trim());
}

function normalizeRecordId(value) {
  return String(value || 'registro').replace(/[^a-zA-Z0-9_-]/g, '_');
}

function mimeToExtension(mimeType) {
  const normalized = String(mimeType || '').toLowerCase();
  if (normalized.includes('png')) return 'png';
  if (normalized.includes('webp')) return 'webp';
  if (normalized.includes('jpg') || normalized.includes('jpeg')) return 'jpg';
  return 'jpg';
}

function buildObjectPath({ userId, recordId, index, mimeType }) {
  const safeRecordId = normalizeRecordId(recordId);
  const ext = mimeToExtension(mimeType);
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${index}`;
  return `${userId}/registros/${safeRecordId}/${unique}.${ext}`;
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Falha ao converter blob para data URL.'));
    reader.readAsDataURL(blob);
  });
}

async function dataUrlToBlob(dataUrl) {
  const match = /^data:([^;,]+)?(?:;charset=[^;,]+)?(;base64)?,(.*)$/i.exec(
    String(dataUrl || '').trim(),
  );
  if (!match) {
    throw new Error('Data URL invalida para upload de foto.');
  }

  const mimeType = match[1] || 'application/octet-stream';
  const encodedPayload = match[3] || '';
  const isBase64 = Boolean(match[2]);

  let binary;
  if (isBase64) {
    if (typeof atob === 'function') {
      binary = atob(encodedPayload);
    } else if (typeof globalThis.Buffer !== 'undefined') {
      binary = globalThis.Buffer.from(encodedPayload, 'base64').toString('binary');
    } else {
      throw new Error('Ambiente sem decodificador base64 para data URL.');
    }
  } else {
    binary = decodeURIComponent(encodedPayload);
  }

  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new Blob([bytes], { type: mimeType });
}

async function createSignedUrl(bucket, path, ttlSeconds = SIGNED_URL_TTL_SECONDS) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, ttlSeconds);
  if (error || !data?.signedUrl) {
    throw new AppError(
      'Não foi possível obter URL assinada da foto.',
      ErrorCodes.SYNC_FAILED,
      'warning',
      {
        action: 'photoStorage.createSignedUrl',
        bucket,
        path,
        detail: error?.message,
      },
    );
  }
  return {
    url: data.signedUrl,
    expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
  };
}

async function getAuthenticatedUserId() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id || null;
}

function isValidPhotoRefObject(photo) {
  if (!photo || typeof photo !== 'object') return false;
  return Boolean(photo.path || photo.url || photo.signedUrl || photo.publicUrl);
}

export function normalizePhotoEntry(photo) {
  if (isString(photo)) {
    const value = photo.trim();
    return value || null;
  }

  if (!isValidPhotoRefObject(photo)) return null;

  const bucket =
    isString(photo.bucket) && photo.bucket.trim() ? photo.bucket.trim() : DEFAULT_BUCKET;
  const path = isString(photo.path) ? photo.path.trim() : '';
  const directUrl = isString(photo.url)
    ? photo.url.trim()
    : isString(photo.signedUrl)
      ? photo.signedUrl.trim()
      : isString(photo.publicUrl)
        ? photo.publicUrl.trim()
        : '';

  return {
    version: Number(photo.version) || PHOTO_REF_VERSION,
    provider: 'supabase-storage',
    bucket,
    path,
    url: directUrl || undefined,
    urlExpiresAt: isString(photo.urlExpiresAt) ? photo.urlExpiresAt : undefined,
    mimeType: isString(photo.mimeType) ? photo.mimeType : undefined,
    size: Number(photo.size) || undefined,
    uploadedAt: isString(photo.uploadedAt) ? photo.uploadedAt : undefined,
  };
}

export function normalizePhotoList(photoList) {
  if (!Array.isArray(photoList)) return [];
  return photoList.map(normalizePhotoEntry).filter(Boolean);
}

export function hasInlineLegacyPhotos(photoList) {
  return Array.isArray(photoList) && photoList.some((photo) => isDataUrl(photo));
}

async function uploadDataUrlPhoto(dataUrl, { userId, recordId, index, bucket = DEFAULT_BUCKET }) {
  const blob = await dataUrlToBlob(dataUrl);
  const mimeType = blob.type || 'image/jpeg';
  const path = buildObjectPath({ userId, recordId, index, mimeType });

  const { error: uploadError } = await supabase.storage.from(bucket).upload(path, blob, {
    upsert: false,
    contentType: mimeType,
    cacheControl: '31536000',
  });

  if (uploadError) {
    throw new AppError(
      'Falha ao enviar foto para o armazenamento.',
      ErrorCodes.SYNC_FAILED,
      'warning',
      {
        action: 'photoStorage.uploadDataUrlPhoto',
        bucket,
        path,
        detail: uploadError.message,
      },
    );
  }

  const signed = await createSignedUrl(bucket, path);
  return {
    version: PHOTO_REF_VERSION,
    provider: 'supabase-storage',
    bucket,
    path,
    url: signed.url,
    urlExpiresAt: signed.expiresAt,
    mimeType,
    size: blob.size,
    uploadedAt: new Date().toISOString(),
  };
}

export async function uploadPendingPhotos(
  photos,
  { recordId, userId = null, bucket = DEFAULT_BUCKET } = {},
) {
  const source = Array.isArray(photos) ? photos : [];
  if (!source.length) return { photos: [], uploadedCount: 0, failedCount: 0 };

  const authUserId = userId || (await getAuthenticatedUserId());
  if (!authUserId) {
    throw new AppError(
      'Usuário não autenticado para upload de fotos.',
      ErrorCodes.AUTH_FAILED,
      'warning',
      { action: 'photoStorage.uploadPendingPhotos' },
    );
  }

  const result = [];
  let uploadedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < source.length; i += 1) {
    const photo = source[i];

    if (isDataUrl(photo)) {
      try {
        const uploaded = await uploadDataUrlPhoto(photo, {
          userId: authUserId,
          recordId,
          index: i,
          bucket,
        });
        result.push(uploaded);
        uploadedCount += 1;
      } catch (_err) {
        // fallback: preserva o dataURL no registro para não perder evidência
        result.push(photo);
        failedCount += 1;
      }
      continue;
    }

    const normalized = normalizePhotoEntry(photo);
    if (normalized) result.push(normalized);
  }

  return { photos: normalizePhotoList(result), uploadedCount, failedCount };
}

export async function migrateLegacyPhotosForRegistros(
  registros,
  { userId = null, bucket = DEFAULT_BUCKET } = {},
) {
  const source = Array.isArray(registros) ? registros : [];
  if (!source.length) return { registros: source, migratedCount: 0, failedCount: 0 };

  const authUserId = userId || (await getAuthenticatedUserId());
  if (!authUserId) return { registros: source, migratedCount: 0, failedCount: 0 };

  const nextRegistros = [];
  let migratedCount = 0;
  let failedCount = 0;

  for (const registro of source) {
    const fotos = normalizePhotoList(registro?.fotos || []);
    if (!hasInlineLegacyPhotos(fotos)) {
      nextRegistros.push({ ...registro, fotos });
      continue;
    }

    const migrated = await uploadPendingPhotos(fotos, {
      userId: authUserId,
      recordId: registro.id,
      bucket,
    });

    migratedCount += migrated.uploadedCount;
    failedCount += migrated.failedCount;
    nextRegistros.push({ ...registro, fotos: migrated.photos });
  }

  return { registros: nextRegistros, migratedCount, failedCount };
}

function hasValidCachedUrl(photoRef) {
  if (!photoRef?.url || !photoRef?.urlExpiresAt) return Boolean(photoRef?.url);
  return new Date(photoRef.urlExpiresAt).getTime() > Date.now() + 10_000;
}

export async function resolvePhotoDisplayUrl(photo) {
  if (isString(photo)) return photo;

  const normalized = normalizePhotoEntry(photo);
  if (!normalized) return null;

  if (hasValidCachedUrl(normalized)) return normalized.url;
  if (!normalized.path) return normalized.url || null;

  try {
    const signed = await createSignedUrl(normalized.bucket, normalized.path);
    return signed.url;
  } catch (_err) {
    return normalized.url || null;
  }
}

export async function resolvePhotoDataUrlForPdf(photo) {
  if (isDataUrl(photo)) return photo;

  const displayUrl = await resolvePhotoDisplayUrl(photo);
  if (!displayUrl) return null;
  if (isDataUrl(displayUrl)) return displayUrl;

  try {
    const response = await fetch(displayUrl);
    if (!response.ok) return null;
    const blob = await response.blob();
    const dataUrl = await blobToDataUrl(blob);
    return isString(dataUrl) ? dataUrl : null;
  } catch (_err) {
    return null;
  }
}
