/**
 * InstallAppPrompt — captura o beforeinstallprompt do Chrome/Edge e
 * expõe um banner pra o usuário instalar o PWA.
 * ─────────────────────────────────────────────────────────────────
 * Por que importa: quando o app é instalado (PWA na tela inicial),
 * notificações push aparecem como NATIVAS do Android (sem prefixo
 * "Chrome • CoolTrack"), com o ícone do app, badge na status bar etc.
 * Sem instalar, push funciona mas com cara de "extensão do browser".
 *
 * Compatibilidade:
 *   - Android Chrome/Edge/Samsung: dispara beforeinstallprompt → temos
 *     o evento e podemos chamar prompt() em resposta a interação do user.
 *   - iOS Safari: NÃO dispara beforeinstallprompt. Mostramos instrução
 *     manual ("Toque em Compartilhar → Adicionar à Tela de Início").
 *   - Desktop Chrome: também dispara — instala como app standalone.
 *
 * Estados:
 *   - hidden: navegador não suporta OU user já instalou OU dismissou perma
 *   - available: pode instalar (Chrome/Edge) → mostra botão CTA
 *   - ios: iOS sem app instalado → mostra instrução manual
 */

import { trackEvent } from '../../core/telemetry.js';

const DISMISS_KEY = 'ct:install-prompt-dismissed';
const REMIND_DAYS = 7; // depois de dispensar, lembra de novo em 7 dias

let _deferredPrompt = null;
let _isStandalone = false;
let _isIos = false;

function _isAppInstalled() {
  // Já está rodando como PWA standalone — nada pra fazer.
  if (typeof window === 'undefined') return true;
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  if (window.navigator.standalone === true) return true; // iOS PWA
  return false;
}

function _detectIos() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  // iOS Safari (iPhone/iPad/iPod) sem ser Chrome iOS (que tem CriOS) —
  // o Safari iOS é o único que precisa do fluxo "Adicionar à Tela de Início".
  return /iphone|ipad|ipod/i.test(ua) && !/crios|fxios/i.test(ua);
}

function _isDismissedRecent() {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const dismissedAt = Number(raw);
    if (!Number.isFinite(dismissedAt)) return false;
    const ageDays = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);
    return ageDays < REMIND_DAYS;
  } catch {
    return false;
  }
}

function _markDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    /* localStorage indisponível — segue sem persistir */
  }
}

/**
 * Inicializa os listeners no boot. Chamar 1x cedo no app.js, ANTES de
 * qualquer interação do usuário — beforeinstallprompt dispara cedo.
 */
export function captureInstallEvent() {
  if (typeof window === 'undefined') return;
  _isStandalone = _isAppInstalled();
  _isIos = _detectIos();

  window.addEventListener('beforeinstallprompt', (e) => {
    // Previne o mini-infobar do Chrome — vamos mostrar nosso próprio CTA.
    e.preventDefault();
    _deferredPrompt = e;
    trackEvent('install_prompt_available', {});
  });

  window.addEventListener('appinstalled', () => {
    _deferredPrompt = null;
    _isStandalone = true;
    trackEvent('install_prompt_accepted', {});
    // Limpa banner se estiver renderizado
    const card = document.querySelector('.install-card');
    if (card) card.remove();
  });
}

function _state() {
  if (_isStandalone) return 'hidden';
  if (_isDismissedRecent()) return 'hidden';
  if (_deferredPrompt) return 'available';
  if (_isIos) return 'ios';
  return 'hidden';
}

function _renderHtml(state) {
  if (state === 'available') {
    return `
      <article class="install-card" role="region" aria-label="Instalar aplicativo">
        <span class="install-card__icon" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <rect x="5" y="2" width="14" height="20" rx="2"/>
            <line x1="12" y1="18" x2="12.01" y2="18"/>
          </svg>
        </span>
        <div class="install-card__body">
          <p class="install-card__title">Instale o CoolTrack como app</p>
          <p class="install-card__sub">
            Notificações nativas no celular, ícone na tela inicial, abre offline.
          </p>
        </div>
        <button type="button" class="btn btn--primary btn--sm install-card__cta"
          data-action="install-app-prompt">
          Instalar
        </button>
        <button type="button" class="install-card__close" data-action="install-app-dismiss"
          aria-label="Dispensar">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </article>`;
  }

  if (state === 'ios') {
    return `
      <article class="install-card install-card--ios" role="region"
        aria-label="Instalar aplicativo no iPhone">
        <span class="install-card__icon" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
            <polyline points="16 6 12 2 8 6"/>
            <line x1="12" y1="2" x2="12" y2="15"/>
          </svg>
        </span>
        <div class="install-card__body">
          <p class="install-card__title">Adicione o app à Tela de Início</p>
          <p class="install-card__sub">
            No Safari, toque em <strong>Compartilhar</strong> e depois em
            <strong>Adicionar à Tela de Início</strong> — assim as notificações
            funcionam como app nativo.
          </p>
        </div>
        <button type="button" class="install-card__close" data-action="install-app-dismiss"
          aria-label="Dispensar">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </article>`;
  }

  return '';
}

export const InstallAppPrompt = {
  /**
   * Renderiza o banner no host fornecido. Idempotente.
   * @param {HTMLElement|string} host
   * @returns {boolean} true se algo foi renderizado, false se silencioso
   */
  render(host) {
    const el = typeof host === 'string' ? document.getElementById(host) : host;
    if (!el) return false;
    const state = _state();
    const stale = el.querySelector('.install-card');
    if (stale) stale.remove();
    if (state === 'hidden') return false;
    el.insertAdjacentHTML('afterbegin', _renderHtml(state));
    return true;
  },

  /**
   * Dispara o prompt nativo do navegador. Só funciona em resposta a
   * uma interação do usuário (click). Resolve com 'accepted' ou 'dismissed'.
   */
  async prompt() {
    if (!_deferredPrompt) return 'unavailable';
    try {
      _deferredPrompt.prompt();
      const choice = await _deferredPrompt.userChoice;
      _deferredPrompt = null;
      trackEvent('install_prompt_choice', { outcome: choice?.outcome || 'unknown' });
      return choice?.outcome || 'unknown';
    } catch (err) {
      console.warn('[InstallAppPrompt] prompt failed:', err);
      return 'error';
    }
  },

  dismiss() {
    _markDismissed();
    trackEvent('install_prompt_dismissed', {});
    const card = document.querySelector('.install-card');
    if (card) card.remove();
  },

  /**
   * Permite reabrir o banner antes do prazo de "lembrar em 7 dias".
   * Útil pra um link "Instalar app" no menu de Ajuda.
   */
  resetDismiss() {
    try {
      localStorage.removeItem(DISMISS_KEY);
    } catch {
      /* no-op */
    }
  },
};
