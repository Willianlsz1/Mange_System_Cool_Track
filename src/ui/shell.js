import { renderShellHeader } from './shell/templates/header.js';
import { renderShellNav } from './shell/templates/nav.js';
import { renderShellViews } from './shell/templates/views.js';
import { renderShellModals } from './shell/templates/modals.js';

const HEADER_TOTAL_HEIGHT_VAR = '--app-header-total-height';
const HEADER_HEIGHT_ALIAS_VAR = '--app-header-height';

let headerMetricsObserver = null;
let headerMetricsFrame = 0;
let observedHeader = null;
let headerMetricsListenersBound = false;

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

function applyHeaderMetrics() {
  const header = getHeaderElement();
  if (!header) return;

  const totalHeight = Math.max(0, Math.ceil(header.getBoundingClientRect().height));
  const rootStyle = document.documentElement?.style;

  if (!rootStyle) return;

  rootStyle.setProperty(HEADER_TOTAL_HEIGHT_VAR, `${totalHeight}px`);
  rootStyle.setProperty(HEADER_HEIGHT_ALIAS_VAR, `${totalHeight}px`);
}

function scheduleHeaderMetricsUpdate() {
  if (typeof window === 'undefined') return;

  if (headerMetricsFrame) {
    window.cancelAnimationFrame(headerMetricsFrame);
  }

  headerMetricsFrame = window.requestAnimationFrame(() => {
    headerMetricsFrame = 0;
    applyHeaderMetrics();
  });
}

function bindHeaderMetrics() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const header = getHeaderElement();
  if (!header) return;

  applyHeaderMetrics();

  if (typeof ResizeObserver !== 'undefined') {
    if (!headerMetricsObserver) {
      headerMetricsObserver = new ResizeObserver(() => {
        scheduleHeaderMetricsUpdate();
      });
    }

    if (observedHeader !== header) {
      headerMetricsObserver.disconnect();
      headerMetricsObserver.observe(header);
      observedHeader = header;
    }
  }

  if (!headerMetricsListenersBound) {
    window.addEventListener('resize', scheduleHeaderMetricsUpdate, { passive: true });
    window.addEventListener('orientationchange', scheduleHeaderMetricsUpdate, { passive: true });
    headerMetricsListenersBound = true;
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

  bindHeaderMetrics();
}
