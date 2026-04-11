import { trackEvent } from '../../core/telemetry.js';
import { AuthScreen } from './authscreen.js';
import { Utils } from '../../core/utils.js';

const MODAL_ID = 'guest-conversion-modal';

function removeModal() {
  document.getElementById(MODAL_ID)?.remove();
}

function closeModal({ converted = false, dismissEvent = '', trigger = 'unknown' } = {}) {
  removeModal();
  if (!converted) {
    trackEvent('guest_modal_abandoned', { trigger });
  }
  if (dismissEvent) {
    trackEvent(dismissEvent, { trigger });
  }
}

function buildReasonMessage(reason) {
  if (reason === 'limit_equipamentos')
    return 'Você atingiu o limite do plano Free para equipamentos.';
  if (reason === 'limit_registros') return 'Você atingiu o limite do plano Free para registros.';
  if (reason === 'limit_pdf')
    return 'Você gerou 3 relatórios este mês. O plano Pro tem relatórios ilimitados.';
  if (reason === 'limit_whatsapp')
    return 'Você atingiu o limite mensal de compartilhamentos no plano Free.';
  return 'Crie sua conta para não perder seus registros e continuar gerenciando seus equipamentos';
}

function buildPreviewHtml(preview) {
  if (!preview || !Array.isArray(preview.items) || preview.items.length === 0) return '';
  const lines = preview.items
    .map((item, index) => {
      const label = Utils.escapeHtml(item?.label || 'Campo');
      const value = Utils.escapeHtml(item?.value || '—');
      const blurred = index >= 2 ? ' guest-conv-preview__line--blur' : '';
      return `<div class="guest-conv-preview__line${blurred}"><span>${label}</span><strong>${value}</strong></div>`;
    })
    .join('');
  return `<div class="guest-conv-preview" aria-label="Prévia do relatório">
    <div class="guest-conv-preview__title">${Utils.escapeHtml(preview.title || 'Prévia do relatório')}</div>
    ${lines}
  </div>`;
}

export const GuestConversionModal = {
  open({
    reason = 'save_attempt',
    source = 'unknown',
    title = '',
    message = '',
    preview = null,
  } = {}) {
    removeModal();
    const trigger = source;
    const isUpgrade = reason === 'limit_pdf' || reason === 'limit_whatsapp';
    const resolvedTitle =
      title || (isUpgrade ? 'Faça upgrade para o plano Pro' : 'Salve seus dados e continue usando');
    const resolvedMessage = message || buildReasonMessage(reason);

    const overlay = document.createElement('div');
    overlay.id = MODAL_ID;
    overlay.className = 'guest-conv-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'guest-conv-title');

    overlay.innerHTML = `
      <div class="guest-conv-card">
        <h3 id="guest-conv-title">${Utils.escapeHtml(resolvedTitle)}</h3>
        <p>${Utils.escapeHtml(resolvedMessage)}</p>
        ${buildPreviewHtml(preview)}
        <div class="guest-conv-plan">
          <strong>Plano Free</strong>
          <span>Até 5 equipamentos &bull; Até 10 registros</span>
          <strong>Plano Pro</strong>
          <span>Ilimitado &bull; Histórico completo &bull; Relatórios</span>
        </div>
        <div class="guest-conv-actions">
          ${
            isUpgrade
              ? `<button type="button" class="landing-btn landing-btn--primary" data-action="pricing">Ver planos Pro</button>
                 <button type="button" class="landing-btn landing-btn--ghost" data-action="dismiss">Agora não</button>`
              : `<button type="button" class="landing-btn landing-btn--primary" data-action="google">Salvar com Google</button>
                 <button type="button" class="landing-btn landing-btn--ghost" data-action="email">Criar conta com e-mail</button>`
          }
        </div>
      </div>
    `;

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        closeModal({ converted: false, trigger });
      }
    });

    if (isUpgrade) {
      overlay.querySelector('[data-action="pricing"]')?.addEventListener('click', async () => {
        closeModal({ converted: true, trigger });
        const { goTo } = await import('../../core/router.js');
        goTo('pricing');
      });
      overlay.querySelector('[data-action="dismiss"]')?.addEventListener('click', () => {
        closeModal({ converted: false, dismissEvent: 'guest_modal_dismissed', trigger });
      });
    } else {
      const shouldPromotePro =
        reason === 'limit_pdf' ||
        reason === 'limit_whatsapp' ||
        source === 'pdf_export_attempt' ||
        source === 'whatsapp_share_attempt';

      overlay.querySelector('[data-action="google"]')?.addEventListener('click', () => {
        closeModal({ converted: true, trigger });
        AuthScreen.show({
          intent: 'guest-save',
          initialTab: 'signin',
          postAuthRedirect: shouldPromotePro
            ? { route: 'pricing', params: { highlightPlan: 'pro' } }
            : null,
        });
      });

      overlay.querySelector('[data-action="email"]')?.addEventListener('click', () => {
        closeModal({ converted: true, trigger });
        AuthScreen.show({
          intent: 'guest-save',
          initialTab: 'signup',
          postAuthRedirect: shouldPromotePro
            ? { route: 'pricing', params: { highlightPlan: 'pro' } }
            : null,
        });
      });

      overlay.querySelector('[data-action="login"]')?.addEventListener('click', () => {
        closeModal({ converted: false, dismissEvent: 'guest_modal_login_clicked', trigger });
      });

      overlay.querySelector('[data-action="continue-guest"]')?.addEventListener('click', () => {
        closeModal({ converted: false, dismissEvent: 'guest_modal_dismissed', trigger });
      });
    }

    document.body.appendChild(overlay);
    trackEvent('guest_conversion_open', { reason, source });
  },

  close() {
    closeModal({ converted: false });
  },
};
