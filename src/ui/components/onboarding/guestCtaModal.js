import { AuthScreen } from '../authscreen.js';
import { GuestTracker } from '../../../core/guestTracker.js';

function getGuestWarningMessage(count) {
  if (count >= 20) {
    return `🚨 ${count} ações perdidas em andamento. Última chance de salvar seu trabalho.`;
  }
  if (count >= 12) {
    return `⚠️ ${count} ações não salvas. Seus dados vão desaparecer ao fechar o navegador.`;
  }
  if (count >= 7) {
    return `Você já fez ${count} ações sem salvar. Crie sua conta para não perder nada.`;
  }
  return `Você já registrou ${count} ações sem salvar`;
}

export const GuestCtaModal = {
  open() {
    document.getElementById('guest-cta-overlay')?.remove();
    const guestActions = GuestTracker.getCount();
    const warningMessage = getGuestWarningMessage(guestActions);
    const guestOverlay = document.createElement('div');
    guestOverlay.id = 'guest-cta-overlay';
    guestOverlay.className = 'modal-overlay is-open';
    guestOverlay.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" style="align-self:center;padding:0;overflow:hidden;max-width:420px;width:100%;border-radius:var(--premier-radius)">
        <div style="
          background:linear-gradient(135deg,rgba(0,212,255,0.12),rgba(0,212,255,0.03));
          border-bottom:1px solid rgba(255,255,255,0.07);
          padding:28px 28px 24px;
          text-align:center
        ">
          <div style="font-size:32px;margin-bottom:12px">👁</div>
          <div style="font-size:16px;font-weight:600;color:#E8F2FA;margin-bottom:6px">Modo visitante</div>
          <div style="font-size:13px;color:#E8F2FA;line-height:1.5;margin-bottom:6px">
            ${warningMessage}
          </div>
          <div style="font-size:13px;color:#4A6880;line-height:1.5">
            Você está explorando sem conta.<br>Seus dados não estão sendo salvos.
          </div>
          <div style="font-size:12px;color:#FF8A8A;line-height:1.5;margin-top:8px">
            Seus dados serão perdidos ao fechar o navegador.
          </div>
        </div>
        <div style="padding:16px;display:flex;flex-direction:column;gap:8px">
          <button id="guest-signup-btn" style="
            width:100%;background:linear-gradient(135deg,#00C8E8,#00A8FF);
            border:none;border-radius:8px;padding:14px 16px;
            color:#07111F;font-size:15px;font-weight:600;
            font-family:inherit;cursor:pointer;
          ">Salvar meus dados com Google</button>
          <button id="guest-email-btn" style="
            width:100%;background:transparent;
            border:1px solid rgba(255,255,255,0.08);
            border-radius:8px;padding:12px 16px;
            color:#8AAAC8;font-size:14px;font-family:inherit;cursor:pointer;
          ">Salvar meus dados agora</button>
          <button id="guest-signin-btn" style="
            width:100%;background:transparent;
            border:1px solid rgba(255,255,255,0.08);
            border-radius:8px;padding:12px 16px;
            color:#8AAAC8;font-size:14px;font-family:inherit;cursor:pointer;
          ">Já tenho conta</button>
          <button id="guest-continue-btn" style="
            width:100%;background:transparent;border:none;
            color:#4A6880;font-size:12px;font-family:inherit;cursor:pointer;padding:8px;
          ">Continuar no modo visitante</button>
        </div>
      </div>`;

    document.body.appendChild(guestOverlay);

    guestOverlay.querySelector('#guest-signup-btn')?.addEventListener('click', () => {
      guestOverlay.remove();
      AuthScreen.show({
        intent: 'guest-save',
        postAuthRedirect: { route: 'pricing', params: { highlightPlan: 'pro' } },
      });
      document.getElementById('tab-signup')?.click();
    });

    guestOverlay.querySelector('#guest-email-btn')?.addEventListener('click', () => {
      guestOverlay.remove();
      AuthScreen.show({
        intent: 'guest-save',
        initialTab: 'signup',
        postAuthRedirect: { route: 'pricing', params: { highlightPlan: 'pro' } },
      });
    });

    guestOverlay.querySelector('#guest-signin-btn')?.addEventListener('click', () => {
      guestOverlay.remove();
      AuthScreen.show({ intent: 'guest-save' });
    });

    guestOverlay.querySelector('#guest-continue-btn')?.addEventListener('click', () => {
      guestOverlay.remove();
    });
  },
};

export const GuestCtaModalInternal = {
  getGuestWarningMessage,
};
