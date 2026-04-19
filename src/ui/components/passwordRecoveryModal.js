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
    <style>
      .auth-input-wrap {
        position: relative; display: flex; align-items: center;
      }
      .auth-input-wrap .auth-input {
        padding-right: 42px;
      }
      .auth-pwd-toggle {
        position: absolute; right: 10px;
        background: none; border: none; cursor: pointer; padding: 4px;
        color: var(--muted); display: flex; align-items: center;
        transition: color .18s;
      }
      .auth-pwd-toggle:hover { color: var(--text-2); }
    </style>
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

  // Ativa os botões de olho após inserir no DOM
  overlay.querySelectorAll('.auth-input-wrap').forEach((wrap) => {
    const input = wrap.querySelector('input');
    const btn = wrap.querySelector('.auth-pwd-toggle');
    if (!input || !btn) return;
    btn.addEventListener('click', () => {
      const isHidden = input.type === 'password';
      input.type = isHidden ? 'text' : 'password';
      btn.setAttribute('aria-label', isHidden ? 'Ocultar senha' : 'Mostrar senha');
      btn.innerHTML = isHidden ? eyeOffSVG() : eyeSVG();
    });
  });

  return overlay;
}

function eyeSVG() {
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>`;
}

function eyeOffSVG() {
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>`;
}

function passwordWrapHTML(id, placeholder, autocomplete) {
  return `
    <div class="auth-input-wrap">
      <input class="auth-input" id="${id}" type="password"
        placeholder="${placeholder}" autocomplete="${autocomplete}" />
      <button type="button" class="auth-pwd-toggle" aria-label="Mostrar senha" tabindex="-1">
        ${eyeSVG()}
      </button>
    </div>`;
}

export function openPasswordResetEmailModal(initialEmail = '') {
  closeModalById(RESET_EMAIL_MODAL_ID);

  const overlay = createOverlay(
    RESET_EMAIL_MODAL_ID,
    'Recuperar senha',
    `
      <label class="auth-label" for="reset-email-input">Email</label>
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
        <label class="auth-label" for="recovery-password-input">Nova senha</label>
        ${passwordWrapHTML('recovery-password-input', 'mínimo 8 caracteres', 'new-password')}
        <label class="auth-label" for="recovery-confirm-input">Confirmar nova senha</label>
        ${passwordWrapHTML('recovery-confirm-input', 'repita a nova senha', 'new-password')}
        <div class="auth-recovery-modal__actions">
          <button type="button" class="btn btn--outline" id="btn-recovery-cancel">Cancelar</button>
          <button type="button" class="auth-btn" id="btn-recovery-save">Atualizar senha</button>
        </div>
      `,
    );

    document.body.appendChild(overlay);

    const passwordInput = overlay.querySelector('#recovery-password-input');
    const confirmInput = overlay.querySelector('#recovery-confirm-input');
    const cancelBtn = overlay.querySelector('#btn-recovery-cancel');
    const saveBtn = overlay.querySelector('#btn-recovery-save');

    const cleanup = (value) => {
      overlay.remove();
      resolve(value);
    };

    if (passwordInput) passwordInput.focus();

    cancelBtn?.addEventListener('click', () => cleanup(null));

    saveBtn?.addEventListener('click', () => {
      const pwd = passwordInput?.value || '';
      const confirm = confirmInput?.value || '';

      if (pwd.length < 8) {
        Toast.error('Senha deve ter no mínimo 8 caracteres.');
        passwordInput?.focus();
        return;
      }
      if (pwd !== confirm) {
        Toast.error('As senhas não conferem. Verifique e tente novamente.');
        confirmInput?.focus();
        return;
      }

      cleanup(pwd);
    });
  });
}

export const PasswordRecoveryModal = {
  openPasswordResetEmailModal,
  openPasswordRecoveryModal,
  closeAllRecoveryModals,
};
