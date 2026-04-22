import { trackEvent } from '../../core/telemetry.js';
import { AuthScreen } from './authscreen.js';
import { Utils } from '../../core/utils.js';
import { attachDialogA11y } from '../../core/modal.js';
import { Toast } from '../../core/toast.js';

const MODAL_ID = 'guest-conversion-modal';
// Handle do cleanup do focus trap / Escape do overlay atual.
let _a11yCleanup = null;

function removeModal() {
  if (_a11yCleanup) {
    _a11yCleanup();
    _a11yCleanup = null;
  }
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
  if (reason === 'limit_free_equipamentos')
    return 'Você já cadastrou 3 equipamentos — o limite do plano Free. Faça upgrade para o Plus e cadastre até 15.';
  if (reason === 'limit_free_registros')
    return 'Seu plano atual já permite registros ilimitados. Faça upgrade quando precisar de mais escala.';
  if (reason === 'limit_pdf')
    return 'No plano Gratuito os relatórios saem com marca d’água. No Plus/Pro você gera PDFs profissionais sem marca d’água.';
  if (reason === 'limit_whatsapp')
    return 'Você atingiu o limite mensal de compartilhamentos no plano Free.';
  if (reason === 'limit_pro_equipamentos')
    return 'Você atingiu o limite de equipamentos disponível para sua conta atual. Para ampliar sua operação, fale com nosso suporte.';
  return 'Crie sua conta para não perder seus registros e continuar gerenciando seus equipamentos';
}

function resolveUpgradePlan(reason) {
  if (reason === 'limit_free_equipamentos') return 'plus';
  return 'pro';
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
    const isProLimit = reason === 'limit_pro_equipamentos';
    // "isUpgrade": usuário JÁ tem conta (não é guest). Mostra flow de upgrade
    // para o Pro em vez do flow de "salve seus dados" (criar conta).
    // Inclui: PDF/WhatsApp mensais + limites do Free autenticado (registros/equipamentos).
    const isUpgrade =
      !isProLimit &&
      (reason === 'limit_pdf' ||
        reason === 'limit_whatsapp' ||
        reason === 'premium_pdf' ||
        reason === 'limit_free_equipamentos' ||
        reason === 'limit_free_registros');

    const upgradePlan = resolveUpgradePlan(reason);
    const upgradePlanLabel = upgradePlan === 'plus' ? 'Plus' : 'Pro';
    const resolvedTitle =
      title ||
      (isProLimit
        ? 'Limite do plano Pro atingido'
        : isUpgrade
          ? `Faça upgrade para o plano ${upgradePlanLabel}`
          : 'Salve seus dados e continue usando');
    const resolvedMessage = message || buildReasonMessage(reason);

    const overlay = document.createElement('div');
    overlay.id = MODAL_ID;
    overlay.className = 'guest-conv-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'guest-conv-title');

    // Bloco de comparação de planos — não exibe para usuários Pro no limite
    const planComparisonHtml = isProLimit
      ? `<div class="guest-conv-pro-limit-info">
           <div class="guest-conv-pro-limit-info__row">
             <span class="guest-conv-pro-limit-info__label">Plano atual</span>
             <span class="guest-conv-pro-limit-info__value guest-conv-pro-limit-info__value--pro">CoolTrack Pro</span>
           </div>
           <div class="guest-conv-pro-limit-info__row">
             <span class="guest-conv-pro-limit-info__label">Equipamentos cadastrados</span>
             <span class="guest-conv-pro-limit-info__value">Limite operacional atingido</span>
           </div>
           <div class="guest-conv-pro-limit-info__row">
             <span class="guest-conv-pro-limit-info__label">Próximo passo</span>
             <span class="guest-conv-pro-limit-info__value">Plano Empresa <span class="guest-conv-pro-limit-info__badge">Em breve</span></span>
           </div>
         </div>`
      : `<div class="guest-conv-plan">
           <div class="guest-conv-plan__card">
             <span class="guest-conv-plan__label">Plano Free</span>
             <ul class="guest-conv-plan__list">
               <li>Até 3 equipamentos</li>
               <li>Registros de serviço ilimitados</li>
               <li>Histórico dos últimos 15 dias</li>
             </ul>
           </div>
           <div class="guest-conv-plan__card guest-conv-plan__card--pro">
             <span class="guest-conv-plan__label guest-conv-plan__label--pro">Plano ${upgradePlanLabel}</span>
             <ul class="guest-conv-plan__list">
               ${
                 upgradePlan === 'plus'
                   ? `<li>Até 15 equipamentos</li>
               <li>Registros de serviço ilimitados</li>
               <li>Todo o histórico de manutenções</li>
               <li>PDF profissional sem marca d'água</li>`
                   : `<li>Equipamentos ilimitados</li>
               <li>Registros de serviço ilimitados</li>
               <li>Todo o histórico de manutenções</li>
               <li>PDF, WhatsApp e setores</li>`
               }
             </ul>
           </div>
         </div>`;

    overlay.innerHTML = `
      <div class="guest-conv-card">
        <h3 id="guest-conv-title">${Utils.escapeHtml(resolvedTitle)}</h3>
        <p>${Utils.escapeHtml(resolvedMessage)}</p>
        ${buildPreviewHtml(preview)}
        ${planComparisonHtml}
        <div class="guest-conv-actions">
          ${
            isProLimit
              ? `<button type="button" class="landing-btn landing-btn--ghost" data-action="dismiss">Entendido</button>`
              : isUpgrade
                ? `<button type="button" class="landing-btn landing-btn--primary" data-action="pricing">Fazer upgrade para o ${upgradePlanLabel}</button>
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

    if (isProLimit) {
      overlay.querySelector('[data-action="dismiss"]')?.addEventListener('click', () => {
        closeModal({ converted: false, dismissEvent: 'pro_limit_dismissed', trigger });
      });
    } else if (isUpgrade) {
      overlay.querySelector('[data-action="pricing"]')?.addEventListener('click', async () => {
        closeModal({ converted: true, trigger });
        const { goTo } = await import('../../core/router.js');
        goTo('pricing', { highlightPlan: upgradePlan });
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

      const openAuthScreenSafe = (initialTab) => {
        try {
          AuthScreen.show({
            intent: 'guest-save',
            initialTab,
            postAuthRedirect: shouldPromotePro
              ? { route: 'pricing', params: { highlightPlan: 'pro' } }
              : null,
          });
        } catch (err) {
          console.error('[guestConversionModal] Falha ao abrir AuthScreen', err);
          Toast.error('Não foi possível abrir a tela de login. Tente novamente.');
          trackEvent('guest_modal_auth_open_failed', {
            trigger,
            initialTab,
            error: err?.message || 'unknown',
          });
        }
      };

      overlay.querySelector('[data-action="google"]')?.addEventListener('click', () => {
        closeModal({ converted: true, trigger });
        openAuthScreenSafe('signin');
      });

      overlay.querySelector('[data-action="email"]')?.addEventListener('click', () => {
        closeModal({ converted: true, trigger });
        openAuthScreenSafe('signup');
      });

      overlay.querySelector('[data-action="login"]')?.addEventListener('click', () => {
        closeModal({ converted: false, dismissEvent: 'guest_modal_login_clicked', trigger });
      });

      overlay.querySelector('[data-action="continue-guest"]')?.addEventListener('click', () => {
        closeModal({ converted: false, dismissEvent: 'guest_modal_dismissed', trigger });
      });
    }

    document.body.appendChild(overlay);
    _a11yCleanup = attachDialogA11y(overlay, {
      onDismiss: () =>
        closeModal({ converted: false, dismissEvent: 'guest_modal_dismissed', trigger }),
    });
    trackEvent('guest_conversion_open', { reason, source });
  },

  close() {
    closeModal({ converted: false });
  },
};
