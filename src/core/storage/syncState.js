/**
 * CoolTrack Pro - Storage / syncState
 * Estado mutável de sincronização: owner do cache, dirty flag,
 * fila de deleções pendentes e status agregado (event + getter).
 *
 * Concentra os únicos bits de estado realmente globais do módulo de
 * storage para que `storage.js` e `remote.js` não os dupliquem.
 */

import {
  STORAGE_SYNC_DIRTY_KEY,
  STORAGE_SYNC_DELETIONS_KEY,
  STORAGE_CACHE_OWNER_KEY,
  SYNC_STATUS_EVENT,
} from './constants.js';

let _syncRunning = false;
let _queuedState = null;
let _syncStatus = {
  state: 'idle',
  message: '',
  pendingOps: 0,
  updatedAt: new Date().toISOString(),
};

export function isSyncRunning() {
  return _syncRunning;
}

export function setSyncRunning(value) {
  _syncRunning = Boolean(value);
}

export function getQueuedState() {
  return _queuedState;
}

export function setQueuedState(state) {
  _queuedState = state;
}

export function consumeQueuedState() {
  const snapshot = _queuedState;
  _queuedState = null;
  return snapshot;
}

export function getCacheOwner() {
  return localStorage.getItem(STORAGE_CACHE_OWNER_KEY);
}

export function setCacheOwner(userId) {
  if (!userId) return;
  localStorage.setItem(STORAGE_CACHE_OWNER_KEY, String(userId));
}

export function markDirty() {
  localStorage.setItem(STORAGE_SYNC_DIRTY_KEY, '1');
}

export function clearDirty() {
  localStorage.removeItem(STORAGE_SYNC_DIRTY_KEY);
}

export function isDirty() {
  return localStorage.getItem(STORAGE_SYNC_DIRTY_KEY) === '1';
}

export function parseDeletionQueue() {
  try {
    const raw = localStorage.getItem(STORAGE_SYNC_DELETIONS_KEY);
    if (!raw) return { equipamentos: [], registros: [] };
    const parsed = JSON.parse(raw);
    const equipamentos = Array.isArray(parsed?.equipamentos)
      ? [...new Set(parsed.equipamentos.map(String).filter(Boolean))]
      : [];
    const registros = Array.isArray(parsed?.registros)
      ? [...new Set(parsed.registros.map(String).filter(Boolean))]
      : [];
    return { equipamentos, registros };
  } catch (_error) {
    return { equipamentos: [], registros: [] };
  }
}

export function saveDeletionQueue(queue) {
  const sanitized = {
    equipamentos: [...new Set((queue?.equipamentos || []).map(String).filter(Boolean))],
    registros: [...new Set((queue?.registros || []).map(String).filter(Boolean))],
  };
  if (!sanitized.equipamentos.length && !sanitized.registros.length) {
    localStorage.removeItem(STORAGE_SYNC_DELETIONS_KEY);
    return sanitized;
  }
  localStorage.setItem(STORAGE_SYNC_DELETIONS_KEY, JSON.stringify(sanitized));
  return sanitized;
}

export function queueDeletions({ equipamentos = [], registros = [] } = {}) {
  const current = parseDeletionQueue();
  const next = {
    equipamentos: [...current.equipamentos, ...equipamentos.map(String).filter(Boolean)],
    registros: [...current.registros, ...registros.map(String).filter(Boolean)],
  };
  const saved = saveDeletionQueue(next);
  updateSyncStatus();
  return saved;
}

export function clearSyncMetadata() {
  clearDirty();
  localStorage.removeItem(STORAGE_SYNC_DELETIONS_KEY);
  _queuedState = null;
  updateSyncStatus({ state: 'idle', message: '' });
}

export function getPendingOpsCount() {
  const queue = parseDeletionQueue();
  let count = queue.equipamentos.length + queue.registros.length;
  if (isDirty()) count += 1;
  if (_queuedState) count += 1;
  return count;
}

function emitSyncStatus() {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
  window.dispatchEvent(new CustomEvent(SYNC_STATUS_EVENT, { detail: { ..._syncStatus } }));
}

export function updateSyncStatus(patch = {}) {
  _syncStatus = {
    ..._syncStatus,
    ...patch,
    pendingOps: getPendingOpsCount(),
    updatedAt: new Date().toISOString(),
  };
  emitSyncStatus();
}

export function getSyncStatus() {
  return { ..._syncStatus, pendingOps: getPendingOpsCount() };
}

export function hasPendingSync() {
  const queue = parseDeletionQueue();
  return Boolean(
    isDirty() ||
    _queuedState ||
    queue.equipamentos.length ||
    queue.registros.length ||
    _syncRunning,
  );
}
