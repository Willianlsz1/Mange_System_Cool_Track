import { Auth } from '../../core/auth.js';
import { Toast } from '../../core/toast.js';
import { trackEvent } from '../../core/telemetry.js';
import { runAsyncAction } from './actionFeedback.js';
import { PasswordRecoveryModal } from './passwordRecoveryModal.js';

const POST_AUTH_REDIRECT_KEY = 'cooltrack-post-auth-redirect';

const GUEST_DATA_KEYS = [
  'cooltrack_v3',
  'cooltrack-sync-dirty-v1',
  'cooltrack-sync-deletions-v1',
  'cooltrack-cache-owner-v1',
];

function clearGuestDemoData() {
  GUEST_DATA_KEYS.forEach((k) => localStorage.removeItem(k));
}

function persistPostAuthRedirect(redirect) {
  if (!redirect?.route) return;
  localStorage.setItem(POST_AUTH_REDIRECT_KEY, JSON.stringify(redirect));
}

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

function handleAuthSuccess(overlay, postAuthRedirect) {
  const wasGuest = localStorage.getItem('cooltrack-guest-mode') === '1';
  if (wasGuest) clearGuestDemoData();
  localStorage.removeItem('cooltrack-guest-mode');
  persistPostAuthRedirect(postAuthRedirect);
  overlay.remove();
  window.location.reload();
}

/** Ativa o toggle de mostrar/esconder senha em todos os .auth-input-wrap dentro de um container */
function bindPasswordToggles(container) {
  container.querySelectorAll('.auth-input-wrap').forEach((wrap) => {
    const input = wrap.querySelector('input[type="password"], input.auth-pwd-input');
    const btn = wrap.querySelector('.auth-pwd-toggle');
    if (!input || !btn) return;

    btn.addEventListener('click', () => {
      const isHidden = input.type === 'password';
      input.type = isHidden ? 'text' : 'password';
      btn.setAttribute('aria-label', isHidden ? 'Ocultar senha' : 'Mostrar senha');
      btn.innerHTML = isHidden ? eyeOffSVG() : eyeSVG();
    });
  });
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

function passwordInputHTML(id, placeholder, autocomplete) {
  return `
    <div class="auth-input-wrap">
      <input class="auth-input auth-pwd-input" id="${id}" type="password"
        placeholder="${placeholder}" autocomplete="${autocomplete}" />
      <button type="button" class="auth-pwd-toggle" aria-label="Mostrar senha" tabindex="-1">
        ${eyeSVG()}
      </button>
    </div>`;
}

export const AuthScreen = {
  show(options = {}) {
    const intent = options.intent || 'default';
    const initialTab = options.initialTab === 'signup' ? 'signup' : 'signin';
    const postAuthRedirect = options.postAuthRedirect?.route ? options.postAuthRedirect : null;
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
      <style>
        /* ── Auth screen layout ── */
        .auth-screen {
          position: fixed; inset: 0; z-index: 9000;
          display: flex; align-items: stretch;
          background: #070c14;
          font-family: var(--font, system-ui, sans-serif);
        }

        /* ── Left branding panel ── */
        .auth-brand {
          flex: 0 0 46%;
          display: flex; flex-direction: column; justify-content: center;
          padding: 56px 52px;
          background: linear-gradient(145deg, #080f1c 0%, #0b1525 60%, #091828 100%);
          border-right: 1px solid rgba(0,200,232,0.08);
          position: relative; overflow: hidden;
        }
        .auth-brand::before {
          content: '';
          position: absolute; top: -80px; right: -80px;
          width: 380px; height: 380px; border-radius: 50%;
          background: radial-gradient(circle, rgba(0,200,232,0.07) 0%, transparent 70%);
          pointer-events: none;
        }
        .auth-brand::after {
          content: '';
          position: absolute; bottom: -120px; left: -60px;
          width: 320px; height: 320px; border-radius: 50%;
          background: radial-gradient(circle, rgba(0,150,180,0.05) 0%, transparent 70%);
          pointer-events: none;
        }

        .auth-brand__logo {
          display: flex; align-items: center; gap: 10px;
          margin-bottom: 44px;
        }
        .auth-brand__logo-icon {
          width: 36px; height: 36px; border-radius: 8px;
          background: rgba(0,200,232,0.1); border: 1px solid rgba(0,200,232,0.25);
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .auth-brand__logo-text {
          font-size: 20px; font-weight: 700; color: #e8f4fc; letter-spacing: -0.3px;
        }
        .auth-brand__logo-badge {
          font-size: 10px; font-weight: 700; color: #00c8e8; letter-spacing: 1px;
          background: rgba(0,200,232,0.12); border: 1px solid rgba(0,200,232,0.3);
          padding: 2px 6px; border-radius: 4px; align-self: flex-start; margin-top: 2px;
        }

        .auth-brand__headline {
          font-size: 28px; font-weight: 700; color: #e8f4fc;
          line-height: 1.25; letter-spacing: -0.5px;
          margin-bottom: 12px;
        }
        .auth-brand__headline em {
          font-style: normal; color: #00c8e8;
        }
        .auth-brand__sub {
          font-size: 15px; color: #5a7a96; line-height: 1.5;
          margin-bottom: 44px;
        }

        .auth-brand__features {
          display: flex; flex-direction: column; gap: 20px;
          margin-bottom: 48px;
        }
        .auth-brand__feat {
          display: flex; align-items: flex-start; gap: 14px;
        }
        .auth-brand__feat-icon {
          width: 36px; height: 36px; border-radius: 8px; flex-shrink: 0;
          background: rgba(0,200,232,0.08); border: 1px solid rgba(0,200,232,0.15);
          display: flex; align-items: center; justify-content: center;
          font-size: 16px;
        }
        .auth-brand__feat-body {}
        .auth-brand__feat-title {
          font-size: 14px; font-weight: 600; color: #c8dce8; margin-bottom: 2px;
        }
        .auth-brand__feat-desc {
          font-size: 12px; color: #4a6880; line-height: 1.45;
        }

        .auth-brand__stats {
          display: flex; gap: 28px;
          padding-top: 32px; border-top: 1px solid rgba(255,255,255,0.05);
        }
        .auth-brand__stat {}
        .auth-brand__stat-num {
          font-size: 22px; font-weight: 700; color: #00c8e8; letter-spacing: -0.5px;
        }
        .auth-brand__stat-label {
          font-size: 11px; color: #3a5870; text-transform: uppercase; letter-spacing: 0.5px;
          margin-top: 2px;
        }

        /* ── Right form panel ── */
        .auth-form-panel {
          flex: 1;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          padding: 40px 24px;
          overflow-y: auto;
          background: #070c14;
        }
        .auth-card {
          width: 100%; max-width: 400px;
        }
        .auth-card-header {
          text-align: center; margin-bottom: 28px;
          display: none;
        }

        /* ── Tabs ── */
        .auth-tabs {
          display: flex; gap: 0;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 10px; padding: 4px;
          margin-bottom: 24px;
        }
        .auth-tab {
          flex: 1; padding: 9px 0; border: none; cursor: pointer;
          background: transparent; color: #4a6880;
          font-size: 14px; font-weight: 500; font-family: inherit;
          border-radius: 7px; transition: all .18s;
        }
        .auth-tab.active {
          background: rgba(0,200,232,0.12);
          color: #00c8e8;
          border: 1px solid rgba(0,200,232,0.2);
        }

        /* ── Google button ── */
        .auth-btn-google {
          width: 100%; padding: 12px; margin-bottom: 16px;
          border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.04);
          color: #c8dce8; font-size: 14px; font-weight: 500; font-family: inherit;
          cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;
          transition: border-color .18s, background .18s;
        }
        .auth-btn-google:hover { border-color: rgba(0,200,232,0.3); background: rgba(0,200,232,0.06); }
        .auth-btn-google--primary {
          background: rgba(0,200,232,0.1); border-color: rgba(0,200,232,0.25); color: #00c8e8;
        }
        .auth-btn-google--primary:hover { background: rgba(0,200,232,0.16); border-color: rgba(0,200,232,0.4); }

        /* ── Divider ── */
        .auth-divider {
          display: flex; align-items: center; gap: 10px;
          font-size: 12px; color: #2a4258; margin-bottom: 16px;
        }
        .auth-divider::before, .auth-divider::after {
          content: ''; flex: 1; height: 1px; background: rgba(255,255,255,0.06);
        }

        /* ── Labels + inputs ── */
        .auth-label {
          display: block; font-size: 10px; font-weight: 700; letter-spacing: 0.8px;
          color: #3a5870; margin-bottom: 5px; margin-top: 14px;
          text-transform: uppercase;
        }
        .auth-input {
          width: 100%; box-sizing: border-box;
          padding: 11px 14px; border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.03);
          color: #d8eaf6; font-size: 14px; font-family: inherit;
          outline: none; transition: border-color .18s;
        }
        .auth-input:focus { border-color: rgba(0,200,232,0.35); background: rgba(0,200,232,0.04); }
        .auth-input::placeholder { color: #2a4258; }

        /* ── Password wrap (input + olho) ── */
        .auth-input-wrap {
          position: relative; display: flex; align-items: center;
        }
        .auth-input-wrap .auth-input {
          padding-right: 42px;
        }
        .auth-pwd-toggle {
          position: absolute; right: 10px;
          background: none; border: none; cursor: pointer; padding: 4px;
          color: #3a5870; display: flex; align-items: center;
          transition: color .18s;
        }
        .auth-pwd-toggle:hover { color: #7aaccc; }

        /* ── Primary CTA ── */
        .auth-btn {
          width: 100%; margin-top: 20px; padding: 13px;
          border-radius: 8px; border: none; cursor: pointer; font-family: inherit;
          font-size: 15px; font-weight: 600;
          background: linear-gradient(135deg, #00c8e8 0%, #0090c8 100%);
          color: #06101e; transition: opacity .18s, transform .12s;
        }
        .auth-btn:hover { opacity: .92; transform: translateY(-1px); }
        .auth-btn:active { transform: translateY(0); }

        /* ── Forgot / hints ── */
        .auth-actions-center { text-align: center; margin-top: 10px; }
        .auth-btn-forgot {
          background: none; border: none; cursor: pointer; font-family: inherit;
          font-size: 12px; color: #3a5870; padding: 4px 8px;
        }
        .auth-btn-forgot:hover { color: #6a9ab8; }

        .auth-hint {
          font-size: 12px; color: #2a4258; text-align: center;
          margin-top: 14px; line-height: 1.5;
        }
        .auth-hint--tight { margin-top: 4px; }

        /* ── Guest panel ── */
        .auth-guest-panel {
          margin-top: 20px; padding-top: 16px;
          border-top: 1px solid rgba(255,255,255,0.05);
          text-align: center;
        }
        .auth-btn-guest {
          background: none; border: none; cursor: pointer; font-family: inherit;
          font-size: 13px; color: #4a6880; padding: 4px 0;
          transition: color .18s;
        }
        .auth-btn-guest:hover { color: #7aaccc; }

        /* ── Responsive ── */
        @media (max-width: 768px) {
          .auth-brand { display: none; }
          .auth-form-panel { padding: 24px 16px; }
          .auth-card-header { display: block; }
        }
      </style>

      <!-- LEFT: Branding panel -->
      <aside class="auth-brand" aria-hidden="true">
        <div class="auth-brand__logo">
          <div class="auth-brand__logo-icon">
            <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="1" width="14" height="14" rx="2" stroke="#00C8E8" stroke-width="1.2"/>
              <circle cx="8" cy="8" r="2.5" stroke="#00C8E8" stroke-width="1.2"/>
              <path d="M8 1v2.5M8 12.5V15M1 8h2.5M12.5 8H15" stroke="#00C8E8" stroke-width="1.2" stroke-linecap="round"/>
            </svg>
          </div>
          <span class="auth-brand__logo-text">CoolTrack</span>
          <span class="auth-brand__logo-badge">PRO</span>
        </div>

        <h1 class="auth-brand__headline">
          Controle total sobre<br><em>cada equipamento</em><br>que você atende
        </h1>
        <p class="auth-brand__sub">
          Gestão de manutenção para técnicos de climatização.<br>
          Do diagnóstico ao relatório PDF — tudo em um só lugar.
        </p>

        <div class="auth-brand__features">
          <div class="auth-brand__feat">
            <div class="auth-brand__feat-icon">🧊</div>
            <div class="auth-brand__feat-body">
              <div class="auth-brand__feat-title">Histórico completo de cada equipamento</div>
              <div class="auth-brand__feat-desc">Todas as manutenções, peças trocadas e anomalias — organizadas por equipamento.</div>
            </div>
          </div>
          <div class="auth-brand__feat">
            <div class="auth-brand__feat-icon">📋</div>
            <div class="auth-brand__feat-body">
              <div class="auth-brand__feat-title">Relatórios PDF com sua assinatura</div>
              <div class="auth-brand__feat-desc">Gere laudos profissionais em segundos, prontos para enviar ao cliente via WhatsApp.</div>
            </div>
          </div>
          <div class="auth-brand__feat">
            <div class="auth-brand__feat-icon">🚨</div>
            <div class="auth-brand__feat-body">
              <div class="auth-brand__feat-title">Alertas inteligentes de preventivas</div>
              <div class="auth-brand__feat-desc">Nunca perca um prazo. O sistema avisa quais equipamentos precisam de atenção hoje.</div>
            </div>
          </div>
        </div>

        <div class="auth-brand__stats">
          <div class="auth-brand__stat">
            <div class="auth-brand__stat-num">100%</div>
            <div class="auth-brand__stat-label">Offline ready</div>
          </div>
          <div class="auth-brand__stat">
            <div class="auth-brand__stat-num">PDF</div>
            <div class="auth-brand__stat-label">Instantâneo</div>
          </div>
          <div class="auth-brand__stat">
            <div class="auth-brand__stat-num">∞</div>
            <div class="auth-brand__stat-label">Histórico</div>
          </div>
        </div>
      </aside>

      <!-- RIGHT: Form panel -->
      <div class="auth-form-panel">
        <div class="auth-card">

          <!-- Mobile-only logo -->
          <div class="auth-card-header">
            <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:6px">
              <div style="width:28px;height:28px;border-radius:6px;background:rgba(0,200,232,0.1);border:1px solid rgba(0,200,232,0.2);display:flex;align-items:center;justify-content:center;">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <rect x="1" y="1" width="14" height="14" rx="2" stroke="#00C8E8" stroke-width="1.2"/>
                  <circle cx="8" cy="8" r="2.5" stroke="#00C8E8" stroke-width="1.2"/>
                  <path d="M8 1v2.5M8 12.5V15M1 8h2.5M12.5 8H15" stroke="#00C8E8" stroke-width="1.2" stroke-linecap="round"/>
                </svg>
              </div>
              <span id="auth-title" style="font-size:17px;font-weight:700;color:#e8f4fc">CoolTrack</span>
              <span style="font-size:9px;font-weight:700;color:#00c8e8;background:rgba(0,200,232,0.1);border:1px solid rgba(0,200,232,0.25);padding:2px 5px;border-radius:4px;letter-spacing:1px">PRO</span>
            </div>
            <div style="font-size:13px;color:#3a5870">Gestão de manutenção para técnicos de climatização</div>
          </div>

          <div class="auth-tabs" role="tablist" aria-label="Acesso">
            <button class="auth-tab active" id="tab-signin" type="button" role="tab" aria-selected="true" aria-controls="auth-form-signin">Entrar</button>
            <button class="auth-tab" id="tab-signup" type="button" role="tab" aria-selected="false" aria-controls="auth-form-signup">Criar conta</button>
          </div>

          <!-- Sign In panel -->
          <div id="auth-form-signin" role="tabpanel" aria-labelledby="tab-signin">
            <button class="auth-btn-google auth-btn-google--primary" id="btn-google-signin" type="button">
              <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
                <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
              </svg>
              ${intentOptions.highlightCopy}
            </button>
            <div class="auth-divider">ou com email e senha</div>
            <label class="auth-label" for="signin-email">EMAIL</label>
            <input class="auth-input" id="signin-email" type="email" placeholder="seu@email.com" autocomplete="email" />
            <label class="auth-label" for="signin-password">SENHA</label>
            ${passwordInputHTML('signin-password', '••••••••', 'current-password')}
            <button class="auth-btn" id="btn-signin" type="button">Acessar meu painel →</button>
            <div class="auth-actions-center">
              <button class="auth-btn-forgot" id="btn-forgot" type="button">Esqueci minha senha</button>
            </div>
            <div class="auth-guest-panel">
              <button class="auth-btn-guest" id="btn-guest" type="button">Ver demo interativa sem cadastro →</button>
              <div class="auth-hint auth-hint--tight">Dados de exemplo · Nada é salvo na nuvem</div>
            </div>
          </div>

          <!-- Sign Up panel -->
          <div id="auth-form-signup" role="tabpanel" aria-labelledby="tab-signup" hidden>
            <button class="auth-btn-google" id="btn-google-signup" type="button">
              <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
                <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
              </svg>
              Criar conta com Google
            </button>
            <div class="auth-divider">ou com email e senha</div>
            <label class="auth-label" for="signup-nome">SEU NOME</label>
            <input class="auth-input" id="signup-nome" type="text" placeholder="Carlos Figueiredo" autocomplete="name" />
            <label class="auth-label" for="signup-email">EMAIL</label>
            <input class="auth-input" id="signup-email" type="email" placeholder="seu@email.com" autocomplete="email" />
            <label class="auth-label" for="signup-password">SENHA</label>
            ${passwordInputHTML('signup-password', 'mínimo 8 caracteres', 'new-password')}
            <label class="auth-label" for="signup-confirm">CONFIRMAR SENHA</label>
            ${passwordInputHTML('signup-confirm', 'repita a senha', 'new-password')}
            <button class="auth-btn" id="btn-signup" type="button">Começar a usar gratuitamente →</button>
            <div class="auth-hint">Plano gratuito · Sem cartão · Cancele quando quiser</div>
          </div>

        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Ativa todos os botões de olho
    bindPasswordToggles(overlay);

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
        const wasGuest = localStorage.getItem('cooltrack-guest-mode') === '1';

        if (wasGuest) {
          clearGuestDemoData();
          localStorage.removeItem('cooltrack-guest-mode');
        }

        const result = await Auth.signInWithGoogle({
          source: intentOptions.source,
          wasGuest: intentOptions.wasGuest,
        });

        if (!result?.ok) {
          if (wasGuest) localStorage.setItem('cooltrack-guest-mode', '1');
          if (result?.message) Toast.error(result.message);
          return;
        }

        persistPostAuthRedirect(postAuthRedirect);
      });
    };

    tabSignin?.addEventListener('click', () => setTab('signin'));
    tabSignup?.addEventListener('click', () => setTab('signup'));

    overlay.querySelector('#btn-google-signin')?.addEventListener('click', async () => {
      const button = overlay.querySelector('#btn-google-signin');
      if (!button) return;
      await triggerGoogleAuth(button);
    });

    overlay.querySelector('#btn-google-signup')?.addEventListener('click', async () => {
      const button = overlay.querySelector('#btn-google-signup');
      if (!button) return;
      await triggerGoogleAuth(button);
    });

    overlay.querySelector('#btn-signin')?.addEventListener('click', async () => {
      const btn = overlay.querySelector('#btn-signin');
      if (!btn) return;
      const email = overlay.querySelector('#signin-email').value.trim();
      const password = overlay.querySelector('#signin-password').value;

      if (!email || !password) return Toast.warning('Informe email e senha para entrar.');
      if (!Auth.isValidEmail(email)) return Toast.warning('Digite um email válido.');

      await runAsyncAction(btn, { loadingLabel: 'Entrando...' }, async () => {
        const user = await Auth.signIn(email, password);
        if (!user) return;
        handleAuthSuccess(overlay, postAuthRedirect);
      });
    });

    overlay.querySelector('#btn-forgot')?.addEventListener('click', () => {
      const email = overlay.querySelector('#signin-email').value.trim();
      PasswordRecoveryModal.openPasswordResetEmailModal(email);
    });

    overlay.querySelector('#btn-signup')?.addEventListener('click', async () => {
      const btn = overlay.querySelector('#btn-signup');
      if (!btn) return;
      const nome = overlay.querySelector('#signup-nome').value.trim();
      const email = overlay.querySelector('#signup-email').value.trim();
      const password = overlay.querySelector('#signup-password').value;
      const confirm = overlay.querySelector('#signup-confirm').value;

      if (!nome || !email || !password || !confirm) {
        return Toast.warning('Preencha todos os campos para criar a conta.');
      }
      if (!Auth.isValidEmail(email)) return Toast.warning('Digite um email válido.');
      if (password.length < 8) {
        Toast.error('Senha deve ter no mínimo 8 caracteres.');
        return;
      }
      if (password !== confirm) {
        Toast.error('As senhas não conferem. Verifique e tente novamente.');
        overlay.querySelector('#signup-confirm').focus();
        return;
      }

      await runAsyncAction(btn, { loadingLabel: 'Criando conta...' }, async () => {
        const user = await Auth.signUp(email, password, nome);
        if (!user) return;
        handleAuthSuccess(overlay, postAuthRedirect);
      });
    });

    overlay.querySelector('#btn-guest')?.addEventListener('click', () => {
      localStorage.setItem('cooltrack-guest-mode', '1');
      overlay.remove();
      window.location.reload();
    });

    setTab(initialTab);
  },
};
