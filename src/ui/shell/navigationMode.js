import { goTo } from '../../core/router.js';
import { getCachedPlan } from '../../core/plans/planCache.js';
import { PLAN_CODE_PRO } from '../../core/plans/subscriptionPlans.js';

export const NAV_MODE_KEY = 'cooltrack_nav_mode';
export const NAV_MODE_RAPIDO = 'rapido';
export const NAV_MODE_EMPRESA = 'empresa';

const VALID_MODES = new Set([NAV_MODE_RAPIDO, NAV_MODE_EMPRESA]);

export const NAV_LAYOUT_BY_MODE = {
  [NAV_MODE_RAPIDO]: {
    mobilePrimary: ['inicio', 'equipamentos', 'registro', 'historico', 'relatorio'],
    mobileSecondary: ['clientes'],
    sidebarPrimary: ['equipamentos', 'registro', 'historico', 'relatorio'],
    sidebarSecondary: ['clientes'],
  },
  [NAV_MODE_EMPRESA]: {
    mobilePrimary: ['clientes', 'equipamentos', 'registro', 'historico', 'relatorio'],
    mobileSecondary: [],
    sidebarPrimary: ['clientes', 'equipamentos', 'registro', 'historico', 'relatorio'],
    sidebarSecondary: [],
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
    /* storage indisponivel */
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

function canUseEmpresaMode() {
  return getCachedPlan() === PLAN_CODE_PRO;
}

function iconBriefcase() {
  return `
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <rect x="3" y="7" width="18" height="13" rx="2"/>
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
      <path d="M3 12h18"/>
    </svg>`;
}

function iconTool() {
  return `
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="m14.7 6.3 3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 0 3 3l6.91-6.91a6 6 0 0 0 7.94-7.94l-3.77 3.77-3-3Z"/>
    </svg>`;
}

function iconUsers() {
  return `
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>`;
}

function iconCheck() {
  return `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5"/>
    </svg>`;
}

function renderModeChoices() {
  return `
    <div class="modal nav-mode-dialog">
      <div class="nav-mode-dialog__header">
        <span class="nav-mode-dialog__eyebrow">Prefer&ecirc;ncia de uso</span>
        <h3 class="nav-mode-dialog__title" id="navigation-mode-title">
          Como voc&ecirc; quer organizar o CoolTrack?
        </h3>
        <p class="nav-mode-dialog__lead" id="navigation-mode-desc">
          Modo organiza a interface. Plano libera recursos. Voc&ecirc; pode mudar isso depois.
        </p>
      </div>

      <div class="nav-mode-dialog__body" aria-describedby="navigation-mode-desc">
        <button type="button" class="nav-mode-card" data-nav-mode="${NAV_MODE_RAPIDO}">
          <span class="nav-mode-card__icon">${iconTool()}</span>
          <span class="nav-mode-card__content">
            <span class="nav-mode-card__title">T&eacute;cnico aut&ocirc;nomo</span>
            <span class="nav-mode-card__desc">
              Mant&eacute;m atalhos de campo em primeiro plano: equipamentos, registro, hist&oacute;rico e relat&oacute;rio.
            </span>
            <span class="nav-mode-card__meta">Recomendado para Free e Plus</span>
          </span>
        </button>

        <button type="button" class="nav-mode-card nav-mode-card--empresa" data-nav-mode="${NAV_MODE_EMPRESA}">
          <span class="nav-mode-card__icon">${iconBriefcase()}</span>
          <span class="nav-mode-card__content">
            <span class="nav-mode-card__title">Empresa</span>
            <span class="nav-mode-card__desc">
              Prioriza gest&atilde;o por Clientes para equipes, contratos e carteiras com v&aacute;rios locais.
            </span>
            <span class="nav-mode-card__meta">Clientes e setores completos no Pro</span>
          </span>
        </button>
      </div>
    </div>`;
}

function renderClientesIntro() {
  const benefits = [
    'Carteira de clientes organizada por nome, local e hist&oacute;rico.',
    'Equipamentos agrupados por cliente para reduzir retrabalho.',
    'Navega&ccedil;&atilde;o de empresa sem esconder as rotas que voc&ecirc; j&aacute; usa.',
  ];

  return `
    <div class="modal nav-mode-dialog nav-mode-dialog--paywall">
      <div class="nav-mode-dialog__header">
        <span class="nav-mode-dialog__icon">${iconUsers()}</span>
        <span class="nav-mode-dialog__eyebrow">Plano Pro</span>
        <h3 class="nav-mode-dialog__title" id="navigation-mode-title">
          Clientes organiza o fluxo de empresa
        </h3>
        <p class="nav-mode-dialog__lead" id="navigation-mode-desc">
          O modo Empresa coloca Clientes no centro da navega&ccedil;&atilde;o. No seu plano atual,
          esse recurso fica bloqueado; voc&ecirc; pode ver os planos ou continuar com a
          interface de t&eacute;cnico.
        </p>
      </div>

      <div class="nav-mode-benefits" aria-label="Beneficios de Clientes">
        ${benefits
          .map(
            (benefit) => `
              <div class="nav-mode-benefit">
                <span class="nav-mode-benefit__icon">${iconCheck()}</span>
                <span>${benefit}</span>
              </div>`,
          )
          .join('')}
      </div>

      <div class="nav-mode-actions">
        <button type="button" class="btn btn--primary btn--full" data-nav-mode-action="pricing">
          Ver planos
        </button>
        <button type="button" class="btn btn--outline btn--full" data-nav-mode-action="continue-rapido">
          Continuar como t&eacute;cnico
        </button>
      </div>
    </div>`;
}

function keepSafeRouteAfterRapidoMode() {
  if (window.location.hash === '#clientes') {
    goTo('equipamentos');
  }
}

function openPrompt() {
  if (typeof document === 'undefined') return;
  closePrompt();

  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.className = 'modal-overlay nav-mode-overlay is-open';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'navigation-mode-title');
  overlay.setAttribute('aria-describedby', 'navigation-mode-desc');
  overlay.innerHTML = renderModeChoices();

  overlay.addEventListener('click', (event) => {
    const actionBtn = event.target.closest?.('[data-nav-mode-action]');
    if (actionBtn?.dataset.navModeAction === 'pricing') {
      closePrompt();
      goTo('pricing', { highlightPlan: 'pro' });
      return;
    }
    if (actionBtn?.dataset.navModeAction === 'continue-rapido') {
      setNavigationMode(NAV_MODE_RAPIDO);
      closePrompt();
      keepSafeRouteAfterRapidoMode();
      return;
    }

    const btn = event.target.closest?.('[data-nav-mode]');
    if (!btn) return;

    const requestedMode = normalizeMode(btn.dataset.navMode);
    if (requestedMode === NAV_MODE_EMPRESA && !canUseEmpresaMode()) {
      overlay.innerHTML = renderClientesIntro();
      return;
    }

    const mode = setNavigationMode(requestedMode);
    closePrompt();
    if (mode !== NAV_MODE_EMPRESA) {
      keepSafeRouteAfterRapidoMode();
    }
  });

  document.body.appendChild(overlay);
}

export function ensureNavigationModePreference() {
  if (hasNavigationModePreference()) return getNavigationMode();
  openPrompt();
  return NAV_MODE_RAPIDO;
}
