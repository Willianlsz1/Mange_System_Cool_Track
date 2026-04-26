/**
 * ClientesPaywallModal — modal exibido quando Free/Plus tenta acessar /clientes.
 *
 * Estrutura: hero visual (mockup ilustrativo da feature) + 3 perks principais
 * + CTA primario "Fazer upgrade pra Pro" (vai pra /pricing) + ghost "Cancelar".
 *
 * Uso:
 *   import { ClientesPaywallModal } from '.../clientesPaywallModal.js';
 *   ClientesPaywallModal.open();
 */

import { goTo } from '../../core/router.js';

const OVERLAY_ID = 'clientes-paywall-overlay';

const ICON_USERS = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
const ICON_FILE = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/><line x1="9" y1="11" x2="15" y2="11"/></svg>`;
const ICON_BRIEFCASE = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><path d="M3 13h18"/></svg>`;
const ICON_CROWN = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7l4 4 5-7 5 7 4-4-2 12H5L3 7z"/></svg>`;
const ICON_LOCK = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>`;
const ICON_CLOSE = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

let _bound = false;

function _close() {
  document.getElementById(OVERLAY_ID)?.remove();
}

function _renderMockup() {
  // Mockup ilustrativo: 3 cards de cliente num grid mini, dando uma previa
  // do que o user ganha. SVG inline pra não depender de imagem externa.
  return `
    <div class="clientes-paywall__mockup" aria-hidden="true">
      <div class="clientes-paywall__mockup-card">
        <div class="clientes-paywall__mockup-icon clientes-paywall__mockup-icon--orange">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/><path d="M3 4h2l2.7 11.4a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.6L21 8H6.5"/></svg>
        </div>
        <div class="clientes-paywall__mockup-line clientes-paywall__mockup-line--lg"></div>
        <div class="clientes-paywall__mockup-line clientes-paywall__mockup-line--sm"></div>
      </div>
      <div class="clientes-paywall__mockup-card">
        <div class="clientes-paywall__mockup-icon clientes-paywall__mockup-icon--blue">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M9 8h.01M15 8h.01M9 12h.01M15 12h.01"/></svg>
        </div>
        <div class="clientes-paywall__mockup-line clientes-paywall__mockup-line--lg"></div>
        <div class="clientes-paywall__mockup-line clientes-paywall__mockup-line--sm"></div>
      </div>
      <div class="clientes-paywall__mockup-card">
        <div class="clientes-paywall__mockup-icon clientes-paywall__mockup-icon--teal">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M12 8v8M8 12h8"/></svg>
        </div>
        <div class="clientes-paywall__mockup-line clientes-paywall__mockup-line--lg"></div>
        <div class="clientes-paywall__mockup-line clientes-paywall__mockup-line--sm"></div>
      </div>
    </div>`;
}

function _renderPerk({ icon, title, desc, tint }) {
  return `
    <div class="clientes-paywall__perk">
      <span class="clientes-paywall__perk-icon clientes-paywall__perk-icon--${tint}" aria-hidden="true">${icon}</span>
      <div class="clientes-paywall__perk-body">
        <div class="clientes-paywall__perk-title">${title}</div>
        <div class="clientes-paywall__perk-desc">${desc}</div>
      </div>
    </div>`;
}

export const ClientesPaywallModal = {
  open() {
    _close();
    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.className = 'modal-overlay is-open clientes-paywall-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'clientes-paywall-title');

    overlay.innerHTML = `
      <div class="modal clientes-paywall">
        <button type="button" class="clientes-paywall__close"
          data-paywall-action="close" aria-label="Fechar">${ICON_CLOSE}</button>

        <div class="clientes-paywall__hero">
          <span class="clientes-paywall__hero-orb clientes-paywall__hero-orb--a" aria-hidden="true"></span>
          <span class="clientes-paywall__hero-orb clientes-paywall__hero-orb--b" aria-hidden="true"></span>

          <span class="clientes-paywall__badge">
            <span aria-hidden="true">${ICON_LOCK}</span>
            EXCLUSIVO PRO
          </span>

          ${_renderMockup()}

          <h2 class="clientes-paywall__title" id="clientes-paywall-title">
            Carteira de clientes
          </h2>
          <p class="clientes-paywall__sub">
            Organize seus equipamentos por cliente, gere PMOC formal e tenha
            o cabeçalho oficial nos PDFs que você envia.
          </p>
        </div>

        <div class="clientes-paywall__perks">
          ${_renderPerk({
            icon: ICON_USERS,
            tint: 'cyan',
            title: 'Carteira de clientes organizada',
            desc: 'Cadastre clientes com CNPJ, endereco e contato. Vincule equipamentos e veja tudo agrupado por carteira.',
          })}
          ${_renderPerk({
            icon: ICON_FILE,
            tint: 'amber',
            title: 'PMOC formal automático',
            desc: 'Gere o documento PMOC anual conforme NBR 13971 com 1 clique - cadastro técnico, cronograma e termo de RT inclusos.',
          })}
          ${_renderPerk({
            icon: ICON_BRIEFCASE,
            tint: 'teal',
            title: 'Cabeçalho oficial nos relatórios',
            desc: 'Os PDFs de serviço sairao com nome e CNPJ do cliente no cabeçalho - aspecto profissional para entregar.',
          })}
        </div>

        <div class="clientes-paywall__actions">
          <button type="button" class="clientes-paywall__cancel"
            data-paywall-action="close">Agora não</button>
          <button type="button" class="clientes-paywall__upgrade"
            data-paywall-action="upgrade">
            <span aria-hidden="true">${ICON_CROWN}</span>
            <span>Fazer upgrade pra Pro</span>
          </button>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    if (!_bound) {
      _bound = true;
      // Delegacao no body — overlays são recreados a cada open(), mas o
      // listener delegado captura por dataset.
      document.addEventListener('click', (event) => {
        const target = event.target.closest?.('[data-paywall-action]');
        if (!target) return;
        const action = target.dataset.paywallAction;
        if (action === 'close') {
          event.preventDefault();
          _close();
        } else if (action === 'upgrade') {
          event.preventDefault();
          _close();
          goTo('pricing');
        }
      });
    }

    // Click no overlay (fora do modal) também fecha
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) _close();
    });

    // Esc fecha
    const onKey = (event) => {
      if (event.key === 'Escape') {
        _close();
        document.removeEventListener('keydown', onKey);
      }
    };
    document.addEventListener('keydown', onKey);
  },

  close: _close,
};
