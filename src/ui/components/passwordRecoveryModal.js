import { Auth } from '../../core/auth.js';
import { Toast } from '../../core/toast.js';
import { runAsyncAction } from './actionFeedback.js';

const RESET_EMAIL_MODAL_ID = 'password-reset-email-modal';
const NEW_PASSWORD_MODAL_ID = 'password-recovery-modal';

function closeModalById(id) {
  document.getElementById(id)?.remove();
}

function closeAllRecoveryModals() {
  closeModalById(RESET_EMAIL_MODAL_ID);
  closeModalById(NEW_PASSWORD_MODAL_ID);
}

function createOverlay(id, title, bodyHtml) {
  const overlay = document.createElement('div');
  overlay.id = id;
  overlay.className = 'modal-overlay is-open auth-recovery-modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', `${id}-title`);

  overlay.innerHTML = `
    <div class="modal auth-recovery-modal">
      <div class="auth-recovery-modal__header">
        <h3 id="${id}-title" class="auth-recovery-modal__title">${title}</h3>
      </div>
      <div class="auth-recovery-modal__body">${bodyHtml}</div>
    </div>
  `;

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) overlay.remove();
  });

  return overlay;
}

export function openPasswordResetEmailModal(initialEmail = '') {
  closeModalById(RESET_EMAIL_MODAL_ID);

  const overlay = createOverlay(
    RESET_EMAIL_MODAL_ID,
    'Recuperar senha',
    `
      <label class="auth-label" for="reset-email-input">EMAIL</label>
      <input class="auth-input" id="reset-email-input" type="email" placeholder="seu@email.com" autocomplete="email" />
      <div class="auth-recovery-modal__actions">
        <button type="button" class="btn btn--outline" id="btn-reset-cancel">Cancelar</button>
        <button type="button" class="auth-btn" id="btn-reset-submit">Enviar link</button>
      </div>
      <p class="auth-hint auth-hint--tight">Enviaremos um link para você definir uma nova senha.</p>
    `,
  );

  document.body.appendChild(overlay);

  const emailInput = overlay.querySelector('#reset-email-input');
  const cancelBtn = overlay.querySelector('#btn-reset-cancel');
  const submitBtn = overlay.querySelector('#btn-reset-submit');

  if (emailInput) {
    emailInput.value = String(initialEmail || '').trim();
    emailInput.focus();
  }

  cancelBtn?.addEventListener('click', () => overlay.remove());

  submitBtn?.addEventListener('click', async () => {
    const email = emailInput?.value.trim() || '';
    if (!email) {
      Toast.warning('Informe seu email para recuperar a senha.');
      emailInput?.focus();
      return;
    }
    if (!Auth.isValidEmail(email)) {
      Toast.warning('Digite um email válido.');
      emailInput?.focus();
      return;
    }

    await runAsyncAction(submitBtn, { loadingLabel: 'Enviando...' }, async () => {
      const result = await Auth.requestPasswordReset(email);
      if (result.ok) {
        Toast.success('Email de recuperação enviado. Verifique sua caixa de entrada.');
        overlay.remove();
      } else {
        Toast.error(result.message || 'Erro ao enviar email. Verifique o endereço digitado.');
      }
    });
  });
}

export function openPasswordRecoveryModal() {
  closeModalById(NEW_PASSWORD_MODAL_ID);

  return new Promise((resolve) => {
    const overlay = createOverlay(
      NEW_PASSWORD_MODAL_ID,
      'Definir nova senha',
      `
        <label class="auth-label" for="recovery-password-input">NOVA SENHA</label>
        <input class="auth-input" id="recovery-password-input" type="password" placeholder="mínimo 6 caracteres" autocomplete="new-password" />
        <div class="auth-recovery-modal__actions">
          <button type="button" class="btn btn--outline" id="btn-recovery-cancel">Cancelar</button>
          <button type="button" class="auth-btn" id="btn-recovery-save">Atualizar senha</button>
        </div>
      `,
    );

    document.body.appendChild(overlay);

    const passwordInput = overlay.querySelector('#recovery-password-input');
    const cancelBtn = overlay.querySelector('#btn-recovery-cancel');
    const saveBtn = overlay.querySelector('#btn-recovery-save');

    const cleanup = (value) => {
      overlay.remove();
      resolve(value);
    };

    if (passwordInput) passwordInput.focus();

    cancelBtn?.addEventListener('click', () => cleanup(null));
    saveBtn?.addEventListener('click', () => {
      cleanup(passwordInput?.value || '');
    });
  });
}

export const PasswordRecoveryModal = {
  openPasswordResetEmailModal,
  openPasswordRecoveryModal,
  closeAllRecoveryModals,
};
