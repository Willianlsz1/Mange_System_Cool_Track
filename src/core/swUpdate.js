/**
 * CoolTrack Pro - Service Worker Update Flow v1.0
 * Detecta quando uma nova versão do SW está "waiting" e mostra um banner
 * oferecendo recarregar. Ao confirmar, posta SKIP_WAITING pro SW, aguarda
 * controllerchange e recarrega a página.
 *
 * Idempotente: seguro chamar múltiplas vezes.
 */

import { Toast } from './toast.js';

const BOUND_FLAG = '__cooltrackSwUpdateBound';
const BANNER_ID = 'sw-update-banner';

function showUpdateBanner(onAccept) {
  if (typeof document === 'undefined') return;
  // Remove banner anterior se existir pra evitar duplicatas
  document.getElementById(BANNER_ID)?.remove();

  const banner = document.createElement('div');
  banner.id = BANNER_ID;
  banner.className = 'sw-update-banner';
  banner.setAttribute('role', 'status');
  banner.setAttribute('aria-live', 'polite');
  banner.innerHTML = `
    <div class="sw-update-banner__inner">
      <span class="sw-update-banner__icon" aria-hidden="true">🔄</span>
      <span class="sw-update-banner__text">Nova versão disponível.</span>
      <button type="button" class="sw-update-banner__btn" data-action="accept">
        Recarregar
      </button>
      <button type="button" class="sw-update-banner__dismiss" aria-label="Dispensar">
        ✕
      </button>
    </div>
  `;
  document.body.appendChild(banner);
  requestAnimationFrame(() => banner.classList.add('is-visible'));

  banner.querySelector('[data-action="accept"]')?.addEventListener('click', () => {
    banner.classList.remove('is-visible');
    onAccept();
  });
  banner.querySelector('.sw-update-banner__dismiss')?.addEventListener('click', () => {
    banner.classList.remove('is-visible');
    setTimeout(() => banner.remove(), 260);
  });
}

function notifyUserOfUpdate(waitingWorker) {
  showUpdateBanner(() => {
    if (!waitingWorker) {
      window.location.reload();
      return;
    }
    // Pede pro SW waiting ativar imediatamente
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  });
}

function bindControllerChangeReload() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    // Pequeno delay para o usuário ver o fade-out do banner.
    setTimeout(() => window.location.reload(), 120);
  });
}

function trackInstallingWorker(registration) {
  const newWorker = registration.installing;
  if (!newWorker) return;
  newWorker.addEventListener('statechange', () => {
    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
      // Nova versão pronta, mas a página ainda é controlada pela antiga.
      notifyUserOfUpdate(registration.waiting || newWorker);
    }
  });
}

/**
 * Inicia o monitoramento de updates do SW. Chamar após a registration
 * estar disponível (tipicamente via navigator.serviceWorker.getRegistration()).
 *
 * Se já houver um worker em `waiting` no momento da inicialização,
 * o banner é exibido imediatamente.
 */
export function initSwUpdate(registration) {
  if (typeof window === 'undefined') return;
  if (window[BOUND_FLAG]) return;
  if (!registration) return;

  window[BOUND_FLAG] = true;

  bindControllerChangeReload();

  // Caso já haja uma nova versão esperando desde que a página foi aberta.
  if (registration.waiting && navigator.serviceWorker.controller) {
    notifyUserOfUpdate(registration.waiting);
  }

  registration.addEventListener('updatefound', () => {
    trackInstallingWorker(registration);
  });

  // Dispara uma checagem passiva ao voltar o foco pra garantir pegar
  // updates enquanto o usuário ficou com o tab aberto.
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        registration.update?.().catch(() => {
          /* silencioso — offline ou CDN temporariamente fora */
        });
      }
    });
  }
}

/**
 * Helper opcional para disparar manualmente — por exemplo a partir de
 * um botão de debug. Usa Toast como fallback caso o banner falhe.
 */
export function notifyUpdateAvailable(waitingWorker) {
  if (typeof document === 'undefined') {
    Toast.info('Nova versão disponível. Recarregue para atualizar.');
    return;
  }
  notifyUserOfUpdate(waitingWorker || null);
}
