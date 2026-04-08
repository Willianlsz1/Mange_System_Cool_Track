import { Auth } from '../../core/auth.js';
import { Toast } from '../../core/toast.js';
import { runAsyncAction } from './actionFeedback.js';

function focusFirstField(container, selector) {
  container.querySelector(selector)?.focus();
}

export const AuthScreen = {
  show() {
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
            <button class="auth-btn-guest" id="btn-guest" type="button">Explorar sem conta &rarr;</button>
            <div class="auth-hint auth-hint--tight">Dados de exemplo &middot; Nada e salvo</div>
          </div>
        </div>

        <div id="auth-form-signup" role="tabpanel" aria-labelledby="tab-signup" hidden>
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

    tabSignin.addEventListener('click', () => setTab('signin'));
    tabSignup.addEventListener('click', () => setTab('signup'));

    overlay.querySelector('#btn-signin').addEventListener('click', async () => {
      const btn = overlay.querySelector('#btn-signin');
      const email = overlay.querySelector('#signin-email').value.trim();
      const password = overlay.querySelector('#signin-password').value;

      if (!email || !password) return Toast.warning('Informe email e senha para entrar.');
      if (!Auth.isValidEmail(email)) return Toast.warning('Digite um email valido.');

      await runAsyncAction(btn, { loadingLabel: 'Entrando...' }, async () => {
        const user = await Auth.signIn(email, password);
        if (!user) return;
        overlay.remove();
        window.location.reload();
      });
    });

    overlay.querySelector('#btn-forgot').addEventListener('click', async () => {
      const btn = overlay.querySelector('#btn-forgot');
      const email = overlay.querySelector('#signin-email').value.trim();

      if (!email) return Toast.warning('Digite seu email primeiro.');

      await runAsyncAction(btn, { loadingLabel: 'Enviando...' }, async () => {
        const result = await Auth.requestPasswordReset(email);
        if (result.ok) {
          Toast.success('Email de recuperacao enviado. Abra o link para definir uma nova senha.');
        } else {
          Toast.error(result.message || 'Erro ao enviar email. Verifique o endereco digitado.');
        }
      });
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
        overlay.remove();
        window.location.reload();
      });
    });

    overlay.querySelector('#btn-guest').addEventListener('click', () => {
      localStorage.setItem('cooltrack-guest-mode', '1');
      overlay.remove();
      window.location.reload();
    });

    focusFirstField(overlay, '#signin-email');
  },
};
