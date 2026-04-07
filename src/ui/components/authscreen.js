import { Auth } from '../../core/auth.js';
import { Toast } from '../../core/toast.js';

export const AuthScreen = {
  show() {
    const overlay = document.createElement('div');
    overlay.id = 'auth-overlay';
    overlay.style.cssText = `
      position:fixed;inset:0;z-index:300;
      background:#07111F;
      display:flex;align-items:center;justify-content:center;
      padding:16px;
    `;

    overlay.innerHTML = `
      <style>
        .auth-card {
          background:#0C1929;
          border:1px solid rgba(0,200,232,0.15);
          border-radius:16px;
          width:100%;max-width:420px;
          padding:32px;
        }
        .auth-logo {
          display:flex;align-items:center;gap:8px;
          margin-bottom:28px;
        }
        .auth-logo-icon {
          width:36px;height:36px;
          background:rgba(0,200,232,0.1);
          border:1px solid rgba(0,200,232,0.2);
          border-radius:8px;
          display:flex;align-items:center;justify-content:center;
        }
        .auth-logo-text { font-size:16px;font-weight:600;color:#E8F2FA; }
        .auth-logo-pro {
          font-size:9px;font-weight:600;letter-spacing:.1em;
          color:#00C8E8;background:rgba(0,200,232,0.1);
          border:1px solid rgba(0,200,232,0.2);
          padding:2px 6px;border-radius:4px;
        }
        .auth-tabs {
          display:flex;gap:0;
          background:rgba(255,255,255,0.04);
          border-radius:8px;padding:3px;
          margin-bottom:24px;
        }
        .auth-tab {
          flex:1;padding:9px;
          background:none;border:none;
          border-radius:6px;
          font-size:14px;font-weight:500;
          color:#8AAAC8;cursor:pointer;
          font-family:inherit;
          transition:background .15s,color .15s;
        }
        .auth-tab.active {
          background:#0C1929;color:#E8F2FA;
        }
        .auth-label {
          font-size:11px;font-weight:600;
          letter-spacing:.06em;color:#6A8BA8;
          display:block;margin-bottom:6px;
        }
        .auth-input {
          width:100%;
          background:rgba(255,255,255,0.05);
          border:1px solid rgba(255,255,255,0.1);
          border-radius:8px;padding:12px 14px;
          font-size:15px;color:#E8F2FA;
          font-family:inherit;outline:none;
          margin-bottom:14px;
          transition:border-color .15s;
        }
        .auth-input:focus { border-color:rgba(0,200,232,0.5); }
        .auth-input::placeholder { color:rgba(138,170,200,0.4); }
        .auth-btn {
          width:100%;background:#00C8E8;color:#07111F;
          border:none;border-radius:10px;
          padding:14px;font-size:15px;font-weight:600;
          font-family:inherit;cursor:pointer;
          transition:opacity .15s;
          margin-top:4px;
        }
        .auth-btn:hover { opacity:.9; }
        .auth-btn:disabled { opacity:.4;cursor:not-allowed; }
        .auth-hint {
          font-size:12px;color:#4A6880;
          text-align:center;margin-top:14px;
          line-height:1.5;
        }
        .auth-btn-guest {
            background:none;
            border:1px solid rgba(255,255,255,0.1);
            border-radius:10px;
            padding:12px 24px;
            font-size:14px;color:#8AAAC8;
            font-family:inherit;cursor:pointer;
            width:100%;
            transition:border-color .15s, color .15s;
            }
        .auth-btn-guest:hover { border-color:rgba(255,255,255,0.2);color:#E8F2FA; }
        .auth-btn-forgot {
          background: none;
          border: none;
          color: #4A6880;
          font-size: 13px;
          font-family: inherit;
          cursor: pointer;
          transition: color .15s;
          }
        .auth-btn-forgot:hover { color: #8AAAC8; }
      </style>

      <div class="auth-card">
        <div class="auth-logo">
          <div class="auth-logo-icon">
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="1" width="14" height="14" rx="2" stroke="#00C8E8" stroke-width="1.2"/>
              <circle cx="8" cy="8" r="2.5" stroke="#00C8E8" stroke-width="1.2"/>
              <path d="M8 1v2.5M8 12.5V15M1 8h2.5M12.5 8H15" stroke="#00C8E8" stroke-width="1.2" stroke-linecap="round"/>
            </svg>
          </div>
          <span class="auth-logo-text">CoolTrack</span>
          <span class="auth-logo-pro">PRO</span>
        </div>

        <div class="auth-tabs">
          <button class="auth-tab active" id="tab-signin">Entrar</button>
          <button class="auth-tab" id="tab-signup">Criar conta</button>
        </div>

        <div id="auth-form-signin">
            <label class="auth-label">EMAIL</label>
            <input class="auth-input" id="signin-email" type="email" placeholder="seu@email.com"/>
            <label class="auth-label">SENHA</label>
            <input class="auth-input" id="signin-password" type="password" placeholder="••••••••"/>
            <button class="auth-btn" id="btn-signin">Entrar →</button>
            <div style="text-align:center;margin-top:12px">
            <button class="auth-btn-forgot" id="btn-forgot">Esqueci minha senha</button>
            </div>
            <div class="auth-hint">Seus dados ficam salvos na nuvem,<br>acessíveis de qualquer dispositivo.</div>
            <div style="margin-top:20px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.06);text-align:center">
            <button class="auth-btn-guest" id="btn-guest">Explorar sem conta →</button>
            <div class="auth-hint" style="margin-top:8px">Dados de exemplo · Nada é salvo</div>
            </div>
        </div>

        <div id="auth-form-signup" style="display:none">
          <label class="auth-label">SEU NOME</label>
          <input class="auth-input" id="signup-nome" type="text" placeholder="Carlos Figueiredo"/>
          <label class="auth-label">EMAIL</label>
          <input class="auth-input" id="signup-email" type="email" placeholder="seu@email.com"/>
          <label class="auth-label">SENHA</label>
          <input class="auth-input" id="signup-password" type="password" placeholder="mín. 6 caracteres"/>
          <button class="auth-btn" id="btn-signup">Criar conta grátis →</button>
          <div class="auth-hint">Grátis para sempre para 1 técnico.<br>Sem cartão de crédito.</div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Tabs
    overlay.querySelector('#tab-signin').addEventListener('click', () => {
      overlay.querySelector('#tab-signin').classList.add('active');
      overlay.querySelector('#tab-signup').classList.remove('active');
      overlay.querySelector('#auth-form-signin').style.display = 'block';
      overlay.querySelector('#auth-form-signup').style.display = 'none';
    });

    overlay.querySelector('#tab-signup').addEventListener('click', () => {
      overlay.querySelector('#tab-signup').classList.add('active');
      overlay.querySelector('#tab-signin').classList.remove('active');
      overlay.querySelector('#auth-form-signup').style.display = 'block';
      overlay.querySelector('#auth-form-signin').style.display = 'none';
    });

    // Sign in
    overlay.querySelector('#btn-signin').addEventListener('click', async () => {
      const btn = overlay.querySelector('#btn-signin');
      const email = overlay.querySelector('#signin-email').value.trim();
      const password = overlay.querySelector('#signin-password').value;
      if (!email || !password) return;
      btn.disabled = true;
      btn.textContent = 'Entrando...';
      const user = await Auth.signIn(email, password);
      if (user) {
        overlay.remove();
        window.location.reload();
      } else {
        btn.disabled = false;
        btn.textContent = 'Entrar →';
      }
    });

    overlay.querySelector('#btn-forgot').addEventListener('click', async () => {
      const btn = overlay.querySelector('#btn-forgot');
      const email = overlay.querySelector('#signin-email').value.trim();
      if (!email) return Toast.warning('Digite seu email primeiro.');

      btn.disabled = true;
      btn.textContent = 'Enviando...';
      const result = await Auth.requestPasswordReset(email);
      btn.disabled = false;
      btn.textContent = 'Esqueci minha senha';

      if (result.ok) {
        Toast.success('Email de recuperação enviado. Abra o link para definir uma nova senha.');
      } else {
        Toast.error(result.message || 'Erro ao enviar email. Verifique o endereço digitado.');
      }
    });

    // Sign up
    overlay.querySelector('#btn-signup').addEventListener('click', async () => {
      const btn = overlay.querySelector('#btn-signup');
      const nome = overlay.querySelector('#signup-nome').value.trim();
      const email = overlay.querySelector('#signup-email').value.trim();
      const password = overlay.querySelector('#signup-password').value;
      if (!nome || !email || !password) return;
      if (password.length < 6) {
        Toast.error('Senha deve ter no mínimo 6 caracteres.');
        return;
      }
      btn.disabled = true;
      btn.textContent = 'Criando conta...';
      const user = await Auth.signUp(email, password, nome);
      if (user) {
        overlay.remove();
        window.location.reload();
      } else {
        btn.disabled = false;
        btn.textContent = 'Criar conta grátis →';
      }
    });

    overlay.querySelector('#btn-guest').addEventListener('click', () => {
      localStorage.setItem('cooltrack-guest-mode', '1');
      overlay.remove();
      window.location.reload();
    });
  },
};
