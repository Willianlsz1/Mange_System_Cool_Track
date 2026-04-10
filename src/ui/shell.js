import { renderShellHeader } from './shell/templates/header.js';
import { renderShellNav } from './shell/templates/nav.js';
import { renderShellViews } from './shell/templates/views.js';
import { renderShellModals } from './shell/templates/modals.js';

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
}
