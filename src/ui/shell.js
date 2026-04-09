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

export const APP_SHELL_HTML = [
  renderShellHeader(),
  renderShellMainLayout(),
  renderShellModals(),
].join('\n\n');

export function initAppShell() {
  if (document.querySelector('.app-header')) return;

  const mount = document.getElementById('app');
  if (!mount) return;

  mount.innerHTML = APP_SHELL_HTML;
}
