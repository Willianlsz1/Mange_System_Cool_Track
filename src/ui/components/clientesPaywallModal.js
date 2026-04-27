import { goTo } from '../../core/router.js';

const OVERLAY_ID = 'clientes-paywall-overlay';
let _bound = false;

function close() {
  document.getElementById(OVERLAY_ID)?.remove();
}

function bindOnce() {
  if (_bound) return;
  _bound = true;
  document.addEventListener('click', (event) => {
    const btn = event.target.closest?.('[data-clientes-lock-action]');
    if (!btn) return;
    const action = btn.dataset.clientesLockAction;
    if (action === 'pricing') {
      event.preventDefault();
      close();
      goTo('pricing');
      return;
    }
    if (action === 'continue') {
      event.preventDefault();
      close();
      goTo('inicio');
    }
  });
}

export const ClientesPaywallModal = {
  open() {
    close();
    bindOnce();

    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.className = 'modal-overlay is-open';
    overlay.dataset.dismissRoute = 'inicio';
    overlay.dataset.dismissFromRoute = 'clientes';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'clientes-lock-title');

    overlay.innerHTML = `
      <div class="modal" style="max-width:420px">
        <div class="modal-head">
          <h3 class="modal-title" id="clientes-lock-title">Clientes é do plano Pro.</h3>
        </div>
        <div class="modal-body" style="display:grid;gap:10px">
          <button type="button" class="btn btn--primary" data-clientes-lock-action="pricing">Ver planos</button>
          <button type="button" class="btn btn--secondary" data-clientes-lock-action="continue">Continuar no app</button>
        </div>
      </div>`;

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        close();
        goTo('inicio');
      }
    });

    document.body.appendChild(overlay);
  },
  close,
};
