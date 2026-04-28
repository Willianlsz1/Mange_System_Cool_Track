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

function buildMarkup() {
  return `
    <div class="clientes-paywall" role="document">
      <section class="clientes-paywall__hero" aria-hidden="true">
        <span class="clientes-paywall__hero-orb clientes-paywall__hero-orb--a"></span>
        <span class="clientes-paywall__hero-orb clientes-paywall__hero-orb--b"></span>
        <span class="clientes-paywall__badge">RECURSO PRO</span>

        <div class="clientes-paywall__mockup">
          <article class="clientes-paywall__mockup-card">
            <span class="clientes-paywall__mockup-icon clientes-paywall__mockup-icon--orange"></span>
            <span class="clientes-paywall__mockup-line clientes-paywall__mockup-line--lg"></span>
            <span class="clientes-paywall__mockup-line clientes-paywall__mockup-line--sm"></span>
          </article>
          <article class="clientes-paywall__mockup-card">
            <span class="clientes-paywall__mockup-icon clientes-paywall__mockup-icon--blue"></span>
            <span class="clientes-paywall__mockup-line clientes-paywall__mockup-line--lg"></span>
            <span class="clientes-paywall__mockup-line clientes-paywall__mockup-line--sm"></span>
          </article>
          <article class="clientes-paywall__mockup-card">
            <span class="clientes-paywall__mockup-icon clientes-paywall__mockup-icon--teal"></span>
            <span class="clientes-paywall__mockup-line clientes-paywall__mockup-line--lg"></span>
            <span class="clientes-paywall__mockup-line clientes-paywall__mockup-line--sm"></span>
          </article>
        </div>

        <h3 class="clientes-paywall__title" id="clientes-lock-title">Clientes e setores</h3>
        <p class="clientes-paywall__sub">Organize clientes, setores e equipamentos em um só lugar.</p>
      </section>

      <section class="clientes-paywall__perks" aria-label="Benefícios do recurso Clientes e setores">
        <article class="clientes-paywall__perk">
          <span class="clientes-paywall__perk-icon clientes-paywall__perk-icon--cyan" aria-hidden="true"></span>
          <div class="clientes-paywall__perk-body">
            <div class="clientes-paywall__perk-title">Separe equipamentos por cliente</div>
          </div>
        </article>

        <article class="clientes-paywall__perk">
          <span class="clientes-paywall__perk-icon clientes-paywall__perk-icon--amber" aria-hidden="true"></span>
          <div class="clientes-paywall__perk-body">
            <div class="clientes-paywall__perk-title">Controle setores e locais</div>
          </div>
        </article>

        <article class="clientes-paywall__perk">
          <span class="clientes-paywall__perk-icon clientes-paywall__perk-icon--teal" aria-hidden="true"></span>
          <div class="clientes-paywall__perk-body">
            <div class="clientes-paywall__perk-title">Gere relatórios por cliente</div>
          </div>
        </article>
      </section>

      <footer class="clientes-paywall__actions">
        <button type="button" class="clientes-paywall__cancel" data-clientes-lock-action="continue">
          Continuar no app
        </button>
        <button type="button" class="clientes-paywall__upgrade" data-clientes-lock-action="pricing">
          Ver planos
        </button>
      </footer>
    </div>`;
}

export const ClientesPaywallModal = {
  open() {
    close();
    bindOnce();

    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.className = 'clientes-paywall-overlay modal-overlay is-open';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'clientes-lock-title');
    overlay.innerHTML = buildMarkup();

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
