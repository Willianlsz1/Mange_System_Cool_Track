import { goTo } from '../../core/router.js';

export const NAV_MODE_KEY = 'cooltrack_nav_mode';
export const NAV_MODE_RAPIDO = 'rapido';
export const NAV_MODE_EMPRESA = 'empresa';

const VALID_MODES = new Set([NAV_MODE_RAPIDO, NAV_MODE_EMPRESA]);

export const NAV_LAYOUT_BY_MODE = {
  [NAV_MODE_RAPIDO]: {
    mobilePrimary: ['equipamentos', 'registro', 'historico', 'relatorio'],
    mobileSecondary: ['clientes'],
    sidebarPrimary: ['equipamentos', 'registro', 'historico', 'relatorio'],
    sidebarSecondary: ['clientes'],
  },
  [NAV_MODE_EMPRESA]: {
    mobilePrimary: ['clientes', 'equipamentos', 'historico', 'relatorio'],
    mobileSecondary: ['registro'],
    sidebarPrimary: ['clientes', 'equipamentos', 'historico', 'relatorio'],
    sidebarSecondary: ['registro'],
  },
};

function normalizeMode(raw) {
  return VALID_MODES.has(raw) ? raw : NAV_MODE_RAPIDO;
}

export function getNavigationMode() {
  try {
    return normalizeMode(localStorage.getItem(NAV_MODE_KEY));
  } catch {
    return NAV_MODE_RAPIDO;
  }
}

export function hasNavigationModePreference() {
  try {
    return VALID_MODES.has(localStorage.getItem(NAV_MODE_KEY));
  } catch {
    return false;
  }
}

export function setNavigationMode(mode, { emit = true } = {}) {
  const next = normalizeMode(mode);
  try {
    localStorage.setItem(NAV_MODE_KEY, next);
  } catch {
    /* storage indisponível */
  }
  if (emit && typeof document !== 'undefined') {
    document.dispatchEvent(
      new CustomEvent('cooltrack:navigation-mode-changed', { detail: { mode: next } }),
    );
  }
  return next;
}

export function getNavigationLayout(mode = getNavigationMode()) {
  return NAV_LAYOUT_BY_MODE[normalizeMode(mode)];
}

const OVERLAY_ID = 'navigation-mode-overlay';

function closePrompt() {
  document.getElementById(OVERLAY_ID)?.remove();
}

function openPrompt() {
  if (typeof document === 'undefined') return;
  closePrompt();

  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.className = 'modal-overlay is-open';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'navigation-mode-title');

  overlay.innerHTML = `
    <div class="modal" style="max-width:420px">
      <div class="modal-head">
        <h3 class="modal-title" id="navigation-mode-title">Como você usa o Cool Track?</h3>
      </div>
      <div class="modal-body" style="display:grid;gap:10px">
        <button type="button" class="btn btn--secondary" data-nav-mode="${NAV_MODE_RAPIDO}">
          Sou técnico autônomo
        </button>
        <button type="button" class="btn btn--primary" data-nav-mode="${NAV_MODE_EMPRESA}">
          Atendo clientes/empresa
        </button>
      </div>
    </div>`;

  overlay.addEventListener('click', (event) => {
    const btn = event.target.closest?.('[data-nav-mode]');
    if (!btn) return;
    const mode = setNavigationMode(btn.dataset.navMode);
    closePrompt();
    // Ajuste simples de fluxo inicial para não cair em rota bloqueada.
    if (mode === NAV_MODE_EMPRESA) {
      return;
    }
    if (window.location.hash === '#clientes') {
      goTo('equipamentos');
    }
  });

  document.body.appendChild(overlay);
}

export function ensureNavigationModePreference() {
  if (hasNavigationModePreference()) return getNavigationMode();
  openPrompt();
  return NAV_MODE_RAPIDO;
}
