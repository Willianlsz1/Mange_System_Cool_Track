import { renderShellHeader } from './shell/templates/header.js';
import { renderShellNav } from './shell/templates/nav.js';
import { renderShellSidebar } from './shell/templates/sidebar.js';
import { renderShellViews } from './shell/templates/views.js';
import { renderShellModals } from './shell/templates/modals.js';
import { Profile } from '../features/profile.js';
import { PLAN_CODE_PLUS, PLAN_CODE_PRO, PLAN_CODE_FREE } from '../core/plans/subscriptionPlans.js';
import { getCachedPlan } from '../core/plans/planCache.js';

const HEADER_TOTAL_HEIGHT_VAR = '--app-header-total-height';
const HEADER_HEIGHT_ALIAS_VAR = '--app-header-height';
const NAV_HEIGHT_VAR = '--app-nav-height';

let shellMetricsObserver = null;
let shellMetricsFrame = 0;
let observedShellNodes = [];
let shellMetricsListenersBound = false;

function renderShellMainLayout() {
  return String.raw`
    <!-- app-content vira grid 2-col em desktop (>=1024px) com sidebar a esquerda.
         Em mobile/tablet, sidebar esta hidden via CSS e bottom nav reaparece. -->
    <div class="app-content app-shell--with-sidebar">

${renderShellSidebar()}

${renderShellNav()}

      <!-- MAIN -->
      <main id="main-content" tabindex="-1">

${renderShellViews()}

      </main>
    </div>
`;
}

/**
 * Atualiza dinamicamente o footer da sidebar (user chip + plan card).
 * Chamado no bootstrap apos profile carregar; pode ser re-chamado quando
 * profile for editado (via custom event 'profile-updated' opcional).
 */
function _getInitials(name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) return 'U';
  return trimmed
    .split(/\s+/)
    .map((n) => n[0] || '')
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

const _PLAN_LABELS = {
  [PLAN_CODE_FREE]: { label: 'Plano Free', sub: 'Recursos basicos' },
  [PLAN_CODE_PLUS]: { label: 'Plano Plus', sub: 'Seu plano esta ativo' },
  [PLAN_CODE_PRO]: { label: 'Plano Pro', sub: 'Seu plano esta ativo' },
};

function _formatRenewBR(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function updateShellSidebar() {
  if (typeof document === 'undefined') return;

  const profile = Profile.get() || {};
  const name = String(profile.nome || profile.empresa || '').trim() || 'Tecnico';
  const initials = _getInitials(name);

  const avatarEl = document.getElementById('sidenav-user-avatar');
  if (avatarEl) avatarEl.textContent = initials;
  const nameEl = document.getElementById('sidenav-user-name');
  if (nameEl) nameEl.textContent = name;
  // Role: por enquanto fixo "Administrador" (single-user). Quando vier
  // multi-user (Pro), pode vir do profile.
  const roleEl = document.getElementById('sidenav-user-role');
  if (roleEl) roleEl.textContent = 'Administrador';

  // Plan card V3 — nome + status sub + (data se Plus/Pro) + CTA contextual.
  // Cache sync; data de renovacao vem do mesmo profile (subscription_current_period_end)
  // e so aparece pra planos pagos que tem essa info.
  const planCode = getCachedPlan()?.planCode || PLAN_CODE_FREE;
  const planMeta = _PLAN_LABELS[planCode] || _PLAN_LABELS[PLAN_CODE_FREE];

  const cardEl = document.getElementById('sidenav-plan-card');
  if (cardEl) cardEl.setAttribute('data-plan', planCode);
  const planNameEl = document.getElementById('sidenav-plan-name');
  if (planNameEl) planNameEl.textContent = planMeta.label;
  const planSubEl = document.getElementById('sidenav-plan-sub');
  if (planSubEl) planSubEl.textContent = planMeta.sub;

  // Linha de "Ate dd/mm/yyyy" so aparece pra planos pagos com data valida.
  const metaEl = document.getElementById('sidenav-plan-meta');
  const renewEl = document.getElementById('sidenav-plan-renew');
  const renewStr = _formatRenewBR(profile.subscription_current_period_end);
  if (metaEl && renewEl) {
    if (planCode !== PLAN_CODE_FREE && renewStr) {
      renewEl.textContent = `Ate ${renewStr}`;
      metaEl.hidden = false;
    } else {
      metaEl.hidden = true;
    }
  }

  const ctaLabelEl = document.getElementById('sidenav-plan-cta-label');
  if (ctaLabelEl) {
    ctaLabelEl.textContent = planCode === PLAN_CODE_FREE ? 'Conhecer planos' : 'Gerenciar plano';
  }
}

export const APP_SHELL_HEADER_HTML = renderShellHeader();
export const APP_SHELL_CONTENT_HTML = [renderShellMainLayout(), renderShellModals()].join('\n\n');
export const APP_SHELL_HTML = [APP_SHELL_HEADER_HTML, APP_SHELL_CONTENT_HTML].join('\n\n');

function getHeaderElement() {
  if (typeof document === 'undefined') return null;
  return document.querySelector('.app-header');
}

function getBottomNavElement() {
  if (typeof document === 'undefined') return null;
  return document.querySelector('.app-nav');
}

function applyShellMetrics() {
  const header = getHeaderElement();
  const nav = getBottomNavElement();
  const rootStyle = document.documentElement?.style;

  if (!rootStyle) return;

  if (header) {
    const headerHeight = Math.max(0, Math.ceil(header.getBoundingClientRect().height));
    rootStyle.setProperty(HEADER_TOTAL_HEIGHT_VAR, `${headerHeight}px`);
    rootStyle.setProperty(HEADER_HEIGHT_ALIAS_VAR, `${headerHeight}px`);
  }

  if (nav) {
    const navHeight = Math.max(0, Math.ceil(nav.getBoundingClientRect().height));
    rootStyle.setProperty(NAV_HEIGHT_VAR, `${navHeight}px`);
  }
}

function scheduleShellMetricsUpdate() {
  if (typeof window === 'undefined') return;

  if (shellMetricsFrame) {
    window.cancelAnimationFrame(shellMetricsFrame);
  }

  shellMetricsFrame = window.requestAnimationFrame(() => {
    shellMetricsFrame = 0;
    applyShellMetrics();
  });
}

function bindShellMetrics() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const shellNodes = [getHeaderElement(), getBottomNavElement()].filter(Boolean);
  if (!shellNodes.length) return;

  applyShellMetrics();

  if (typeof ResizeObserver !== 'undefined') {
    if (!shellMetricsObserver) {
      shellMetricsObserver = new ResizeObserver(() => {
        scheduleShellMetricsUpdate();
      });
    }

    const hasSameTargets =
      shellNodes.length === observedShellNodes.length &&
      shellNodes.every((node, idx) => node === observedShellNodes[idx]);

    if (!hasSameTargets) {
      shellMetricsObserver.disconnect();
      shellNodes.forEach((node) => shellMetricsObserver?.observe(node));
      observedShellNodes = shellNodes;
    }
  }

  if (!shellMetricsListenersBound) {
    window.addEventListener('resize', scheduleShellMetricsUpdate, { passive: true });
    window.addEventListener('orientationchange', scheduleShellMetricsUpdate, { passive: true });
    shellMetricsListenersBound = true;
  }
}

export function initAppShell() {
  const mount = document.getElementById('app');
  if (!mount) return;

  // Header fora do shell principal: evita que qualquer wrapper/scroll da view
  // afete o posicionamento fixo do topo global.
  if (!document.querySelector('.app-header')) {
    document.body.insertAdjacentHTML('afterbegin', APP_SHELL_HEADER_HTML);
  }

  if (!mount.querySelector('#main-content')) {
    mount.innerHTML = APP_SHELL_CONTENT_HTML;
  }

  bindShellMetrics();
}
