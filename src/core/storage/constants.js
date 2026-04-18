/**
 * CoolTrack Pro - Storage / constants
 * Limites de armazenamento, chaves de localStorage usadas pelo Storage
 * e nome do CustomEvent de status de sincronização.
 */

export const STORAGE_WARN_BYTES = 4 * 1024 * 1024;
export const STORAGE_LIMIT_BYTES = 5 * 1024 * 1024;
export const STORAGE_SYNC_DIRTY_KEY = 'cooltrack-sync-dirty-v1';
export const STORAGE_SYNC_DELETIONS_KEY = 'cooltrack-sync-deletions-v1';
export const STORAGE_CACHE_OWNER_KEY = 'cooltrack-cache-owner-v1';
export const SYNC_STATUS_EVENT = 'cooltrack:sync-status';
