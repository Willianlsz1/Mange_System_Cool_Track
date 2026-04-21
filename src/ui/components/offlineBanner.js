/**
 * OfflineBanner — faixa fixa no topo exibida enquanto a conexão está offline.
 *
 * Complementa o Toast transiente disparado por core/onlineStatus.js: o toast
 * some em ~4s, mas o usuário pode continuar offline por minutos (subsolo,
 * elevador, área remota). O banner persistente deixa explícito que o estado
 * é anormal e que saves podem falhar até a conexão voltar.
 *
 * Integração: escuta o CustomEvent `cooltrack:online-status` emitido pelo
 * onlineStatus.js. No init, também lê o estado atual via navigator.onLine
 * pra cobrir o caso de boot já offline.
 *
 * Idempotente: mount() pode ser chamado múltiplas vezes sem duplicar DOM.
 */
import { ONLINE_STATUS_EVENT } from '../../core/onlineStatus.js';

const BANNER_ID = 'cooltrack-offline-banner';
const MOUNTED_FLAG = '__cooltrackOfflineBannerMounted';

function isOffline() {
  if (typeof navigator === 'undefined') return false;
  return navigator.onLine === false;
}

function ensureBanner() {
  if (typeof document === 'undefined') return null;
  let el = document.getElementById(BANNER_ID);
  if (el) return el;

  el = document.createElement('div');
  el.id = BANNER_ID;
  el.className = 'offline-banner';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.hidden = true;
  el.innerHTML = `
    <span class="offline-banner__dot" aria-hidden="true"></span>
    <span class="offline-banner__text">Sem conexão. Alterações podem falhar até a rede voltar.</span>
  `;
  // Inserido no início do body pra ficar sempre visível no topo.
  document.body.insertBefore(el, document.body.firstChild);
  return el;
}

function setBannerVisible(visible) {
  const el = ensureBanner();
  if (!el) return;
  el.hidden = !visible;
  document.body.classList.toggle('has-offline-banner', visible);
}

function handleStatus(event) {
  const online = event?.detail?.online;
  setBannerVisible(online === false);
}

export function mountOfflineBanner() {
  if (typeof window === 'undefined') return;
  if (window[MOUNTED_FLAG]) return;
  window[MOUNTED_FLAG] = true;

  ensureBanner();
  setBannerVisible(isOffline());

  window.addEventListener(ONLINE_STATUS_EVENT, handleStatus);
}

export const OfflineBanner = { mount: mountOfflineBanner };
