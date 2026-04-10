import { renderShellHeader } from './shell/templates/header.js';
import { renderShellNav } from './shell/templates/nav.js';
import { renderShellViews } from './shell/templates/views.js';
import { renderShellModals } from './shell/templates/modals.js';

const HEADER_TOTAL_HEIGHT_VAR = '--app-header-total-height';
const HEADER_HEIGHT_ALIAS_VAR = '--app-header-height';
const NAV_HEIGHT_VAR = '--app-nav-height';

let shellMetricsObserver = null;
let shellMetricsFrame = 0;
let observedShellNodes = [];
let shellMetricsListenersBound = false;

function renderShellMainLayout() {
  return String.raw`
    <div class="app-content">

${renderShellNav()}

      <!-- MAIN -->
      <main id="main-content" tabindex="-1">

${renderShellViews()}

      </main>
    </div>
`;
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
