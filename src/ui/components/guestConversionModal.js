import { trackEvent } from '../../core/telemetry.js';
import { AuthScreen } from './authscreen.js';

const MODAL_ID = 'guest-conversion-modal';

function removeModal() {
  document.getElementById(MODAL_ID)?.remove();
}

function buildReasonMessage(reason) {
  if (reason === 'limit_equipamentos')
    return 'Você atingiu o limite do plano Free para equipamentos.';
  if (reason === 'limit_registros') return 'Você atingiu o limite do plano Free para registros.';
  return 'Crie sua conta para não perder seus registros e continuar gerenciando seus equipamentos';
}

export const GuestConversionModal = {
  open({ reason = 'save_attempt', source = 'unknown' } = {}) {
    removeModal();

    const overlay = document.createElement('div');
    overlay.id = MODAL_ID;
    overlay.className = 'guest-conv-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'guest-conv-title');

    overlay.innerHTML = `
      <div class="guest-conv-card">
        <h3 id="guest-conv-title">Salve seus dados e continue usando</h3>
        <p>${buildReasonMessage(reason)}</p>
        <div class="guest-conv-plan">
          <strong>Plano Free</strong>
          <span>Até 5 equipamentos • Até 10 registros</span>
          <strong>Plano Pro</strong>
          <span>Ilimitado • Histórico completo • Relatórios</span>
        </div>
        <div class="guest-conv-actions">
          <button type="button" class="landing-btn landing-btn--primary" data-action="google">
            Salvar com Google
          </button>
          <button type="button" class="landing-btn landing-btn--ghost" data-action="email">
            Criar conta com e-mail
          </button>
        </div>
      </div>
    `;

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) removeModal();
    });

    overlay.querySelector('[data-action="google"]')?.addEventListener('click', () => {
      removeModal();
      AuthScreen.show({ intent: 'guest-save', initialTab: 'signin' });
    });

    overlay.querySelector('[data-action="email"]')?.addEventListener('click', () => {
      removeModal();
      AuthScreen.show({ intent: 'guest-save', initialTab: 'signup' });
    });

    document.body.appendChild(overlay);
    trackEvent('guest_conversion_open', { reason, source });
  },

  close() {
    removeModal();
  },
};
