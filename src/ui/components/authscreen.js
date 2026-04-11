import { Auth } from '../../core/auth.js';
import { Toast } from '../../core/toast.js';
import { trackEvent } from '../../core/telemetry.js';
import { runAsyncAction } from './actionFeedback.js';
import { PasswordRecoveryModal } from './passwordRecoveryModal.js';

function focusFirstField(container, selector) {
  container.querySelector(selector)?.focus();
}

function getDefaultIntentOptions(intent) {
  if (intent === 'guest-save') {
    return {
      highlightCopy: 'Salvar meus dados com Google',
      source: 'guest-save',
      wasGuest: true,
    };
  }

  return {
    highlightCopy: 'Continuar com Google',
    source: 'auth-screen',
    wasGuest: localStorage.getItem('cooltrack-guest-mode') === '1',
  };
}

export const AuthScreen = {
  show(options = {}) {
    const intent = options.intent || 'default';
    const initialTab = options.initialTab === 'signup' ? 'signup' : 'signin';
    const intentOptions = getDefaultIntentOptions(intent);
    const existing = document.getElementById('auth-overlay');
    if (existing) {
      focusFirstField(existing, '.auth-input');
      return;
    }

    const overlay = document.createElement('div');
    overlay.id = 'auth-overlay';
    overlay.className = 'auth-screen';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'auth-title');

    overlay.innerHTML = `
      <div class="auth-card">
        <div class="auth-logo">
          <div class="auth-logo-icon">
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="1" width="14" height="14" rx="2" stroke="#00C8E8" stroke-width="1.2"/>
              <circle cx="8" cy="8" r="2.5" stroke="#00C8E8" stroke-width="1.2"/>
              <path d="M8 1v2.5M8 12.5V15M1 8h2.5M12.5 8H15" stroke="#00C8E8" stroke-width="1.2" stroke-linecap="round"/>
            </svg>
          </div>
          <span class="auth-logo-text" id="auth-title">CoolTrack</span>
          <span class="auth-logo-pro">PRO</span>
        </div>

        <div class="auth-tabs" role="tablist" aria-label="Acesso">
          <button
            class="auth-tab active"
            id="tab-signin"
            type="button"
            role="tab"
            aria-selected="true"
            aria-controls="auth-form-signin"
          >
            Entrar
          </button>
          <button
            class="auth-tab"
            id="tab-signup"
            type="button"
            role="tab"
            aria-selected="false"
            aria-controls="auth-form-signup"
          >
            Criar conta
          </button>
        </div>

        <div id="auth-form-signin" role="tabpanel" aria-labelledby="tab-signin">
          <button class="auth-btn-google auth-btn-google--primary" id="btn-google-signin" type="button">
            ${intentOptions.highlightCopy}
          </button>
          <div class="auth-divider">ou com email e senha</div>
          <label class="auth-label" for="signin-email">EMAIL</label>
          <input class="auth-input" id="signin-email" type="email" placeholder="seu@email.com" autocomplete="email" />
          <label class="auth-label" for="signin-password">SENHA</label>
          <input class="auth-input" id="signin-password" type="password" placeholder="********" autocomplete="current-password" />
          <button class="auth-btn" id="btn-signin" type="button">Entrar &rarr;</button>
          <div class="auth-actions-center">
            <button class="auth-btn-forgot" id="btn-forgot" type="button">Esqueci minha senha</button>
          </div>
          <div class="auth-hint">Seus dados ficam salvos na nuvem,<br>acessiveis de qualquer dispositivo.</div>
          <div class="auth-guest-panel">
            <button class="auth-btn-guest" id="btn-guest" type="button">Ver demo interativa &rarr;</button>
            <div id="guest-lead-form" hidden>
              <label class="auth-label" for="guest-lead-email" style="margin-top:10px">Receba dicas de manutencao + acesso a demo</label>
              <input class="auth-input" id="guest-lead-email" type="email" placeholder="seu@email.com" autocomplete="email" />
              <button class="auth-btn-guest" id="btn-guest-start" type="button">Iniciar demo &rarr;</button>
            </div>
            <div class="auth-hint auth-hint--tight">Dados de exemplo &middot; Nada e salvo</div>
          </div>
        </div>

        <div id="auth-form-signup" role="tabpanel" aria-labelledby="tab-signup" hidden>
          <button class="auth-btn-google" id="btn-google-signup" type="button">Continuar com Google</button>
          <div class="auth-divider">ou crie com email e senha</div>
          <label class="auth-label" for="signup-nome">SEU NOME</label>
          <input class="auth-input" id="signup-nome" type="text" placeholder="Carlos Figueiredo" autocomplete="name" />
          <label class="auth-label" for="signup-email">EMAIL</label>
          <input class="auth-input" id="signup-email" type="email" placeholder="seu@email.com" autocomplete="email" />
          <label class="auth-label" for="signup-password">SENHA</label>
          <input class="auth-input" id="signup-password" type="password" placeholder="min. 6 caracteres" autocomplete="new-password" />
          <button class="auth-btn" id="btn-signup" type="button">Criar conta gratis &rarr;</button>
          <div class="auth-hint">Gratis para sempre para 1 tecnico.<br>Sem cartao de credito.</div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const tabSignin = overlay.querySelector('#tab-signin');
    const tabSignup = overlay.querySelector('#tab-signup');
    const formSignin = overlay.querySelector('#auth-form-signin');
    const formSignup = overlay.querySelector('#auth-form-signup');

    const setTab = (tab) => {
      const showSignin = tab === 'signin';
      tabSignin.classList.toggle('active', showSignin);
      tabSignup.classList.toggle('active', !showSignin);
      tabSignin.setAttribute('aria-selected', String(showSignin));
      tabSignup.setAttribute('aria-selected', String(!showSignin));
      formSignin.hidden = !showSignin;
      formSignup.hidden = showSignin;
      focusFirstField(overlay, showSignin ? '#signin-email' : '#signup-nome');
    };

    const triggerGoogleAuth = async (button) => {
      trackEvent('auth_google_clicked', {
        source: intentOptions.source,
        wasGuest: intentOptions.wasGuest,
      });

      await runAsyncAction(button, { loadingLabel: 'Redirecionando...' }, async () => {
        const result = await Auth.signInWithGoogle({
          source: intentOptions.source,
          wasGuest: intentOptions.wasGuest,
        });
        if (!result?.ok && result?.message) Toast.error(result.message);
      });
    };

    tabSignin.addEventListener('click', () => setTab('signin'));
    tabSignup.addEventListener('click', () => setTab('signup'));

    overlay.querySelector('#btn-google-signin').addEventListener('click', async () => {
      await triggerGoogleAuth(overlay.querySelector('#btn-google-signin'));
    });

    overlay.querySelector('#btn-google-signup').addEventListener('click', async () => {
      await triggerGoogleAuth(overlay.querySelector('#btn-google-signup'));
    });

    overlay.querySelector('#btn-signin').addEventListener('click', async () => {
      const btn = overlay.querySelector('#btn-signin');
      const email = overlay.querySelector('#signin-email').value.trim();
      const password = overlay.querySelector('#signin-password').value;

      if (!email || !password) return Toast.warning('Informe email e senha para entrar.');
      if (!Auth.isValidEmail(email)) return Toast.warning('Digite um email valido.');

      await runAsyncAction(btn, { loadingLabel: 'Entrando...' }, async () => {
        const user = await Auth.signIn(email, password);
        if (!user) return;
        localStorage.removeItem('cooltrack-guest-mode');
        overlay.remove();
        window.location.reload();
      });
    });

    overlay.querySelector('#btn-forgot').addEventListener('click', () => {
      const email = overlay.querySelector('#signin-email').value.trim();
      PasswordRecoveryModal.openPasswordResetEmailModal(email);
    });

    overlay.querySelector('#btn-signup').addEventListener('click', async () => {
      const btn = overlay.querySelector('#btn-signup');
      const nome = overlay.querySelector('#signup-nome').value.trim();
      const email = overlay.querySelector('#signup-email').value.trim();
      const password = overlay.querySelector('#signup-password').value;

      if (!nome || !email || !password) {
        return Toast.warning('Preencha nome, email e senha para criar a conta.');
      }
      if (!Auth.isValidEmail(email)) return Toast.warning('Digite um email valido.');
      if (password.length < 6) {
        Toast.error('Senha deve ter no minimo 6 caracteres.');
        return;
      }

      await runAsyncAction(btn, { loadingLabel: 'Criando conta...' }, async () => {
        const user = await Auth.signUp(email, password, nome);
        if (!user) return;
        localStorage.removeItem('cooltrack-guest-mode');
        overlay.remove();
        window.location.reload();
      });
    });

    overlay.querySelector('#btn-guest').addEventListener('click', () => {
      const guestLeadForm = overlay.querySelector('#guest-lead-form');
      guestLeadForm.hidden = false;
      overlay.querySelector('#guest-lead-email')?.focus();
    });

    overlay.querySelector('#btn-guest-start').addEventListener('click', () => {
      const email = overlay.querySelector('#guest-lead-email').value.trim();
      if (!email) return Toast.warning('Informe seu email para acessar a demo.');
      if (!Auth.isValidEmail(email)) return Toast.warning('Digite um email valido.');

      localStorage.setItem('cooltrack-lead-email', email);
      localStorage.setItem('cooltrack-guest-mode', '1');
      overlay.remove();
      window.location.reload();
    });

    setTab(initialTab);
  },
};
