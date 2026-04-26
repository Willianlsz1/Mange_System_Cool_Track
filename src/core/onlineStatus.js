/**
 * CoolTrack Pro - Online Status v1.0
 * Monitora conexão via navigator.onLine + eventos online/offline.
 * Mostra toasts ao perder e restaurar conexão para dar feedback claro
 * ao usuário. Idempotente: pode ser chamado várias vezes sem duplicar
 * listeners.
 */

import { Toast } from './toast.js';

const BOUND_FLAG = '__cooltrackOnlineStatusBound';
const ONLINE_STATUS_EVENT = 'cooltrack:online-status';

// Na inicialização, guardamos o estado atual para evitar disparar
// toasts falsos quando o listener é adicionado com a conexão já perdida.
let _lastKnownOnline = null;

function isBrowserOnline() {
  if (typeof navigator === 'undefined') return true;
  // navigator.onLine === false é confiável para detectar offline.
  // true pode significar "temos uma LAN" mesmo sem internet real,
  // mas para UX é bom o bastante.
  return navigator.onLine !== false;
}

function emitStatus(online) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(ONLINE_STATUS_EVENT, { detail: { online } }));
}

function handleOffline() {
  if (_lastKnownOnline === false) return;
  _lastKnownOnline = false;
  Toast.warning(
    'Você está offline. Alterações serão salvas localmente e sincronizadas quando voltar.',
  );
  emitStatus(false);
}

async function _attemptFlush() {
  // Lazy import pra evitar dependencia circular (storage importa toast,
  // toast importa onlineStatus em alguns flows). Fire-and-forget: se nao
  // ha pending o flushPending retorna false e nao faz nada.
  try {
    const { Storage } = await import('./storage.js');
    if (typeof Storage?.flushPending === 'function') {
      await Storage.flushPending();
    }
  } catch (_e) {
    // Falha silenciosa — o status do sync ja vai refletir via pill.
  }
}

function handleOnline() {
  if (_lastKnownOnline === true) return;
  // Só emitimos toast se já havia sinalizado offline antes — evita mostrar
  // "Conexão restaurada" no boot inicial quando tudo estava normal.
  const shouldToast = _lastKnownOnline === false;
  _lastKnownOnline = true;
  if (shouldToast) {
    Toast.success('Conexão restaurada. Sincronizando alterações pendentes...');
    // Dispara flush real da fila de sync (era so visual antes — toast prometia
    // sincronizar mas ninguem chamava o drain). Agora resolve de fato.
    _attemptFlush();
  }
  emitStatus(true);
}

/**
 * Instala listeners em window para online/offline. Idempotente.
 * Chamar uma vez no boot via controller.
 */
export function initOnlineStatus() {
  if (typeof window === 'undefined') return;
  if (window[BOUND_FLAG]) return;
  window[BOUND_FLAG] = true;

  _lastKnownOnline = isBrowserOnline();

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
}

export function isOffline() {
  return !isBrowserOnline();
}

export { ONLINE_STATUS_EVENT };
