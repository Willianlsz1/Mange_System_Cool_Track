/**
 * CoolTrack Pro — Signature Storage (core layer)
 *
 * Armazenamento local de imagens de assinatura vinculadas a um registro.
 * Movido de `ui/components/signature/signature-storage.js` para respeitar a
 * arquitetura em camadas: a camada domain/ (ex.: geração de PDF) importa daqui,
 * nunca de ui/.
 */

import { Toast } from './toast.js';

const SIG_STORAGE_PREFIX = 'cooltrack-sig-';
const SIG_CLEANUP_SESSION_KEY = 'cooltrack-sig-cleanup-done';

function getSignatureStorageKey(registroId) {
  return `${SIG_STORAGE_PREFIX}${registroId}`;
}

export function saveSignatureForRecord(registroId, dataUrl) {
  if (!dataUrl) return;
  try {
    localStorage.setItem(getSignatureStorageKey(registroId), dataUrl);
  } catch (_error) {
    Toast.warning('Assinatura não pôde ser salva localmente (armazenamento cheio).');
  }
}

export function getSignatureForRecord(registroId) {
  return localStorage.getItem(getSignatureStorageKey(registroId)) || null;
}

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
