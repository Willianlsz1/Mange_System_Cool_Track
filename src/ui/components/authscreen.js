import { Auth } from '../../core/auth.js';
import { Toast } from '../../core/toast.js';
import { trackEvent } from '../../core/telemetry.js';
import { runAsyncAction } from './actionFeedback.js';
import { PasswordRecoveryModal } from './passwordRecoveryModal.js';

const POST_AUTH_REDIRECT_KEY = 'cooltrack-post-auth-redirect';

function persistPostAuthRedirect(redirect) {
  if (!redirect?.route) return;
  localStorage.setItem(POST_AUTH_REDIRECT_KEY, JSON.stringify(redirect));
}

function focusFirstField(container, selector) {
  container.querySelector(selector)?.focus();
}

function getDefaultIntentOptions() {
  return {
    highlightCopy: 'Continuar com Google',
    source: 'auth-screen',
  };
}

function handleAuthSuccess(overlay, postAuthRedirect) {
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

// Score 0–3: 0=vazia, 1=<8 chars (danger), 2=8+ sem dígito (warning), 3=8+ com dígito/símbolo (success)
// Cores aplicadas via CSS custom properties — resolvem automaticamente em light/dark.
function scorePassword(pw) {
  if (!pw) return { score: 0, label: '', color: 'var(--text-3)' };
  if (pw.length < 8) return { score: 1, label: 'Muito curta', color: 'var(--danger)' };
  const hasDigitOrSym = /[\d\W_]/.test(pw);
  if (!hasDigitOrSym) return { score: 2, label: 'Fraca', color: 'var(--warning)' };
  return { score: 3, label: 'Forte', color: 'var(--success)' };
}

function bindStrengthMeter(container) {
  const pwInput = container.querySelector('#signup-password');
  const meter = container.querySelector('#signup-strength');
  if (!pwInput || !meter) return;

  const segs = meter.querySelectorAll('.auth-strength__seg');
  const label = meter.querySelector('.auth-strength__label');

  const update = () => {
    const { score, label: text, color } = scorePassword(pwInput.value);
    segs.forEach((seg, i) => {
      seg.style.background = i < score ? color : 'rgba(255,255,255,0.06)';
    });
    label.textContent = text;
    label.style.color = color;
    meter.setAttribute('aria-valuenow', String(score));
    meter.setAttribute('aria-label', `Força da senha: ${text || 'vazia'}`);
  };

  pwInput.addEventListener('input', update);
  update();
}

function eyeSVG() {
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>`;
}

function eyeOffSVG() {
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
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

// Inline SVGs — CoolTrack snowflake dentro do squircle (6 arms com V-tips)
const ICON_LOGO = `<svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true" style="display:block">
  <rect x="2" y="2" width="28" height="28" rx="7" fill="rgba(0,200,232,0.10)" stroke="#00c8e8" stroke-width="1.6"/>
  <g stroke="#00c8e8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <g>
      <line x1="16" y1="7" x2="16" y2="25"/>
      <polyline points="13.5,9 16,7 18.5,9"/>
      <polyline points="13.5,23 16,25 18.5,23"/>
    </g>
    <g transform="rotate(60 16 16)">
      <line x1="16" y1="7" x2="16" y2="25"/>
      <polyline points="13.5,9 16,7 18.5,9"/>
      <polyline points="13.5,23 16,25 18.5,23"/>
    </g>
    <g transform="rotate(120 16 16)">
      <line x1="16" y1="7" x2="16" y2="25"/>
      <polyline points="13.5,9 16,7 18.5,9"/>
      <polyline points="13.5,23 16,25 18.5,23"/>
    </g>
  </g>
  <circle cx="16" cy="16" r="1.3" fill="#00c8e8"/>
</svg>`;

const ICON_LOGO_SM = `<svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true" style="display:block">
  <rect x="2" y="2" width="28" height="28" rx="7" fill="rgba(0,200,232,0.10)" stroke="#00c8e8" stroke-width="1.6"/>
  <g stroke="#00c8e8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <g>
      <line x1="16" y1="7" x2="16" y2="25"/>
      <polyline points="13.5,9 16,7 18.5,9"/>
      <polyline points="13.5,23 16,25 18.5,23"/>
    </g>
    <g transform="rotate(60 16 16)">
      <line x1="16" y1="7" x2="16" y2="25"/>
      <polyline points="13.5,9 16,7 18.5,9"/>
      <polyline points="13.5,23 16,25 18.5,23"/>
    </g>
    <g transform="rotate(120 16 16)">
      <line x1="16" y1="7" x2="16" y2="25"/>
      <polyline points="13.5,9 16,7 18.5,9"/>
      <polyline points="13.5,23 16,25 18.5,23"/>
    </g>
  </g>
  <circle cx="16" cy="16" r="1.3" fill="#00c8e8"/>
</svg>`;

const ICON_SNOWFLAKE = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <line x1="12" y1="2" x2="12" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/>
  <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/><line x1="19.07" y1="4.93" x2="4.93" y2="19.07"/>
  <polyline points="9 5 12 2 15 5"/><polyline points="9 19 12 22 15 19"/>
  <polyline points="5 9 2 12 5 15"/><polyline points="19 9 22 12 19 15"/>
</svg>`;

const ICON_FILETEXT = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
  <polyline points="14 2 14 8 20 8"/>
  <line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/>
</svg>`;

const ICON_BELL = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
</svg>`;

const ICON_ARROW_RIGHT = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
</svg>`;

// Google mark — colored official-style G (NOT monochrome, per spec)
const ICON_GOOGLE = `<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style="display:block;flex-shrink:0">
  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09 0-.73.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
</svg>`;

export const AuthScreen = {
  show(options = {}) {
    const initialTab = options.initialTab === 'signup' ? 'signup' : 'signin';
    const postAuthRedirect = options.postAuthRedirect?.route ? options.postAuthRedirect : null;
    const intentOptions = getDefaultIntentOptions();
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
        /* ── Auth screen layout (V2Refined — login sóbrio/transacional) ── */
        .auth-screen {
          position: fixed; inset: 0; z-index: 9000;
          display: flex; align-items: stretch;
          background: #070c14;
          font-family: var(--font, 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif);
          color: #e8f2fa;
        }
        .auth-screen button:focus-visible,
        .auth-screen input:focus-visible,
        .auth-screen [role="tab"]:focus-visible {
          outline: 2px solid #00c8e8; outline-offset: 2px;
        }

        /* ── Left branding panel ── */
        .auth-brand {
          flex: 0 0 46%;
          display: flex; flex-direction: column;
          padding: 56px 52px;
          background: linear-gradient(145deg, #080f1c 0%, #0b1525 60%, #091828 100%);
          border-right: 1px solid rgba(0,200,232,0.08);
          position: relative; overflow: hidden;
          box-sizing: border-box;
        }
        /* Atmospheric orbs — 5–7% (NÃO é signature dual orb do accountModal) */
        .auth-brand::before {
          content: '';
          position: absolute; top: -120px; right: -100px;
          width: 360px; height: 360px; border-radius: 50%;
          background: radial-gradient(circle, rgba(0,200,232,0.07) 0%, transparent 65%);
          pointer-events: none;
        }
        .auth-brand::after {
          content: '';
          position: absolute; bottom: -140px; left: -120px;
          width: 400px; height: 400px; border-radius: 50%;
          background: radial-gradient(circle, rgba(0,200,232,0.05) 0%, transparent 65%);
          pointer-events: none;
        }

        .auth-brand__logo {
          display: flex; align-items: center; gap: 10px;
          position: relative; z-index: 1;
        }
        .auth-brand__logo-text {
          font-size: 19px; font-weight: 700; color: #e8f2fa; letter-spacing: -0.2px;
        }
        .auth-brand__logo-badge {
          font-size: 10px; font-weight: 700; color: #e8b94a; letter-spacing: 0.6px;
          background: rgba(232,185,74,0.12);
          padding: 3px 7px; border-radius: 4px;
        }

        /* Headline sólido — SEM grad word (login é sóbrio) */
        .auth-brand__headline {
          font-size: 28px; font-weight: 700; color: #e8f2fa;
          line-height: 1.15; letter-spacing: -0.5px;
          margin: 40px 0 16px;
          text-wrap: balance;
          position: relative; z-index: 1;
        }
        .auth-brand__sub {
          font-size: 15px; color: #8aaac8; line-height: 1.5;
          margin: 0; max-width: 440px;
          position: relative; z-index: 1;
        }

        .auth-brand__features {
          display: flex; flex-direction: column; gap: 20px;
          margin-top: 40px;
          position: relative; z-index: 1;
        }
        .auth-brand__feat {
          display: flex; align-items: flex-start; gap: 14px;
        }
        .auth-brand__feat-icon {
          width: 36px; height: 36px; border-radius: 8px; flex-shrink: 0;
          background: rgba(0,200,232,0.08);
          border: 1px solid rgba(0,200,232,0.15);
          color: #00c8e8;
          display: flex; align-items: center; justify-content: center;
        }
        .auth-brand__feat-title {
          font-size: 14px; font-weight: 600; color: #e8f2fa; margin-bottom: 3px;
        }
        .auth-brand__feat-desc {
          font-size: 13px; font-weight: 400; color: #8aaac8; line-height: 1.45;
        }

        .auth-brand__stats {
          margin-top: auto;
          padding-top: 32px; border-top: 1px solid rgba(255,255,255,0.05);
          display: flex; gap: 28px;
          position: relative; z-index: 1;
        }
        .auth-brand__stat-num {
          font-size: 22px; font-weight: 700; color: #00c8e8;
          letter-spacing: -0.5px; line-height: 1;
        }
        .auth-brand__stat-label {
          font-size: 11px; font-weight: 500; color: #6a8ba8;
          letter-spacing: 0.5px; text-transform: uppercase;
          margin-top: 6px;
        }

        /* ── Right form panel ── */
        .auth-form-panel {
          flex: 1;
          display: flex; align-items: center; justify-content: center;
          padding: 40px 24px;
          overflow-y: auto;
          background: #07111f;
          box-sizing: border-box;
        }
        .auth-card {
          width: 100%; max-width: 400px;
        }
        .auth-card-header {
          text-align: center; margin-bottom: 24px;
          display: none;
        }
        .auth-card-header__brand {
          display: inline-flex; align-items: center; gap: 10px; margin-bottom: 10px;
        }
        .auth-card-header__sub {
          font-size: 13px; color: #8aaac8; line-height: 1.5;
        }

        /* ── Tabs (sem border no active — fix #9) ── */
        .auth-tabs {
          display: flex; gap: 4; padding: 4px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 10px;
          margin-bottom: 20px;
        }
        .auth-tab {
          flex: 1; padding: 9px 0; border: none; cursor: pointer;
          background: transparent; color: #6a8ba8;
          font-size: 14px; font-weight: 500; font-family: inherit;
          border-radius: 7px;
          transition: background .18s, color .18s, font-weight .18s;
        }
        .auth-tab.active {
          background: rgba(0,200,232,0.12);
          color: #00c8e8;
          font-weight: 600;
          box-shadow: 0 1px 2px rgba(0,0,0,0.3);
        }

        /* ── Google button = PRIMARY (gradient 52px) ── */
        .auth-btn-google {
          width: 100%; height: 52px; border-radius: 12px;
          background: linear-gradient(135deg, var(--primary) 0%, var(--primary-strong) 100%);
          color: #06101e;
          font-size: 15px; font-weight: 700; font-family: inherit;
          display: flex; align-items: center; justify-content: center;
          gap: 12px; border: none; cursor: pointer;
          box-shadow: 0 1px 0 rgba(255,255,255,0.15) inset;
          transition: opacity .18s, transform .12s;
        }
        .auth-btn-google:hover { opacity: .95; transform: translateY(-1px); }
        .auth-btn-google:active { transform: translateY(0); }

        /* ── Divider "ou com email e senha" ── */
        .auth-divider {
          display: flex; align-items: center; gap: 10px;
          margin: 18px 0 14px;
          font-size: 12px; font-weight: 400; color: #6a8ba8;
        }
        .auth-divider::before, .auth-divider::after {
          content: ''; flex: 1; height: 1px; background: rgba(255,255,255,0.06);
        }

        /* ── Labels (sentence-case 12/500 — fix #2) ── */
        .auth-label {
          display: block; font-size: 12px; font-weight: 500;
          color: #8aaac8; margin-bottom: 6px; margin-top: 14px;
          letter-spacing: 0;
        }
        .auth-label--first { margin-top: 0; }

        /* ── Inputs ── */
        .auth-input {
          width: 100%; box-sizing: border-box;
          padding: 12px 14px; border-radius: 8px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          color: #e8f2fa; font-size: 14px; font-weight: 400; font-family: inherit;
          min-height: 44px; outline: none;
          transition: border-color .18s, background .18s;
        }
        .auth-input:focus {
          border-color: rgba(0,200,232,0.35);
          background: rgba(0,200,232,0.04);
        }
        .auth-input::placeholder { color: #6a8ba8; }

        /* ── Password wrap (input + olho) ── */
        .auth-input-wrap {
          position: relative; display: flex; align-items: center;
        }
        .auth-input-wrap .auth-input { padding-right: 42px; }
        .auth-pwd-toggle {
          position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
          background: none; border: none; cursor: pointer; padding: 4px;
          color: #6a8ba8; display: flex; align-items: center;
          transition: color .18s;
        }
        .auth-pwd-toggle:hover { color: #8aaac8; }

        /* ── Strength meter ── */
        .auth-strength {
          display: flex; align-items: center; gap: 10px;
          margin-top: 8px;
        }
        .auth-strength__bars {
          display: flex; gap: 4px; flex: 1;
        }
        .auth-strength__seg {
          flex: 1; height: 4px; border-radius: 2px;
          background: rgba(255,255,255,0.06);
          transition: background .16s;
        }
        .auth-strength__label {
          font-size: 11px; font-weight: 500;
          min-width: 68px; text-align: right;
          color: #6a8ba8;
        }

        /* ── Secondary CTA (email submit, 48px outline cyan) ── */
        .auth-btn {
          width: 100%; height: 48px; margin-top: 20px;
          border-radius: 10px;
          background: transparent;
          border: 1px solid #00c8e8;
          color: #00c8e8;
          font-size: 15px; font-weight: 600; font-family: inherit;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 6px;
          transition: background .18s;
        }
        .auth-btn:hover { background: rgba(0,200,232,0.08); }

        /* ── Forgot / hints ── */
        .auth-actions-center { text-align: center; margin-top: 14px; }
        .auth-btn-forgot {
          background: none; border: none; cursor: pointer; font-family: inherit;
          font-size: 12px; font-weight: 400; color: #6a8ba8;
          padding: 4px 8px;
          transition: color .18s;
        }
        .auth-btn-forgot:hover { color: #8aaac8; }

        .auth-hint {
          font-size: 12px; font-weight: 400; color: #6a8ba8;
          text-align: center;
          margin-top: 14px; line-height: 1.5;
        }

        /* ── Responsive ── */
        @media (max-width: 768px) {
          .auth-brand { display: none; }
          .auth-form-panel {
            padding: 24px 16px 40px;
            align-items: flex-start;
          }
          .auth-card-header { display: block; }
        }
      </style>

      <!-- LEFT: Branding panel (role=complementary, NUNCA aria-hidden) -->
      <aside class="auth-brand" role="complementary">
        <div class="auth-brand__logo">
          ${ICON_LOGO}
          <span class="auth-brand__logo-text">CoolTrack</span>
          <span class="auth-brand__logo-badge">PRO</span>
        </div>

        <h1 class="auth-brand__headline">
          Controle total sobre cada equipamento que você atende.
        </h1>
        <p class="auth-brand__sub">
          Gestão de manutenção para técnicos de climatização. Do diagnóstico
          ao relatório PDF — tudo em um só lugar.
        </p>

        <div class="auth-brand__features">
          <div class="auth-brand__feat">
            <div class="auth-brand__feat-icon">${ICON_SNOWFLAKE}</div>
            <div>
              <div class="auth-brand__feat-title">Histórico completo de cada equipamento</div>
              <div class="auth-brand__feat-desc">Todas as manutenções, peças trocadas e anomalias — organizadas por equipamento.</div>
            </div>
          </div>
          <div class="auth-brand__feat">
            <div class="auth-brand__feat-icon">${ICON_FILETEXT}</div>
            <div>
              <div class="auth-brand__feat-title">Relatórios PDF com sua assinatura</div>
              <div class="auth-brand__feat-desc">Gere laudos profissionais em segundos, prontos para enviar ao cliente via WhatsApp.</div>
            </div>
          </div>
          <div class="auth-brand__feat">
            <div class="auth-brand__feat-icon">${ICON_BELL}</div>
            <div>
              <div class="auth-brand__feat-title">Alertas inteligentes de preventivas</div>
              <div class="auth-brand__feat-desc">Nunca perca um prazo. O sistema avisa quais equipamentos precisam de atenção hoje.</div>
            </div>
          </div>
        </div>

        <div class="auth-brand__stats">
          <div>
            <div class="auth-brand__stat-num">100%</div>
            <div class="auth-brand__stat-label">Offline ready</div>
          </div>
          <div>
            <div class="auth-brand__stat-num">PDF</div>
            <div class="auth-brand__stat-label">Instantâneo</div>
          </div>
          <div>
            <div class="auth-brand__stat-num">∞</div>
            <div class="auth-brand__stat-label">Histórico</div>
          </div>
        </div>
      </aside>

      <!-- RIGHT: Form panel -->
      <main class="auth-form-panel" aria-labelledby="auth-title">
        <div class="auth-card">

          <!-- Mobile-only logo -->
          <div class="auth-card-header">
            <div class="auth-card-header__brand">
              ${ICON_LOGO_SM}
              <span id="auth-title" style="font-size:18px;font-weight:700;color:#e8f2fa">CoolTrack</span>
              <span style="font-size:10px;font-weight:700;color:#e8b94a;background:rgba(232,185,74,0.12);padding:3px 7px;border-radius:4px;letter-spacing:0.6px">PRO</span>
            </div>
            <div class="auth-card-header__sub">Gestão de manutenção para técnicos de climatização.</div>
          </div>

          <!-- Tabs -->
          <div class="auth-tabs" role="tablist" aria-label="Acesso">
            <button class="auth-tab active" id="tab-signin" type="button" role="tab" aria-selected="true" aria-controls="auth-form-signin">Entrar</button>
            <button class="auth-tab" id="tab-signup" type="button" role="tab" aria-selected="false" aria-controls="auth-form-signup">Criar conta</button>
          </div>

          <!-- Sign In panel -->
          <div id="auth-form-signin" role="tabpanel" aria-labelledby="tab-signin">
            <button class="auth-btn-google" id="btn-google-signin" type="button">
              ${ICON_GOOGLE}
              ${intentOptions.highlightCopy}
            </button>
            <div class="auth-divider">ou com email e senha</div>
            <label class="auth-label auth-label--first" for="signin-email">Email</label>
            <input class="auth-input" id="signin-email" type="email" placeholder="seu@email.com" autocomplete="email" />
            <label class="auth-label" for="signin-password">Senha</label>
            ${passwordInputHTML('signin-password', 'Sua senha', 'current-password')}
            <button class="auth-btn" id="btn-signin" type="button">Acessar meu painel ${ICON_ARROW_RIGHT}</button>
            <div class="auth-actions-center">
              <button class="auth-btn-forgot" id="btn-forgot" type="button">Esqueci minha senha</button>
            </div>
          </div>

          <!-- Sign Up panel -->
          <div id="auth-form-signup" role="tabpanel" aria-labelledby="tab-signup" hidden>
            <button class="auth-btn-google" id="btn-google-signup" type="button">
              ${ICON_GOOGLE}
              Continuar com Google
            </button>
            <div class="auth-divider">ou com email e senha</div>
            <label class="auth-label auth-label--first" for="signup-nome">Seu nome</label>
            <input class="auth-input" id="signup-nome" type="text" placeholder="Carlos Figueiredo" autocomplete="name" />
            <label class="auth-label" for="signup-email">Email</label>
            <input class="auth-input" id="signup-email" type="email" placeholder="seu@email.com" autocomplete="email" />
            <label class="auth-label" for="signup-password">Senha</label>
            ${passwordInputHTML('signup-password', 'mínimo 8 caracteres', 'new-password')}
            <div class="auth-strength" id="signup-strength" role="progressbar"
                 aria-live="polite" aria-valuemin="0" aria-valuemax="3" aria-valuenow="0">
              <div class="auth-strength__bars">
                <div class="auth-strength__seg"></div>
                <div class="auth-strength__seg"></div>
                <div class="auth-strength__seg"></div>
              </div>
              <div class="auth-strength__label">&nbsp;</div>
            </div>
            <label class="auth-label" for="signup-confirm">Confirmar senha</label>
            ${passwordInputHTML('signup-confirm', 'repita a senha', 'new-password')}
            <button class="auth-btn" id="btn-signup" type="button">Começar gratuitamente ${ICON_ARROW_RIGHT}</button>
            <div class="auth-hint">Plano gratuito · Sem cartão · PDF com marca d’água</div>
          </div>

        </div>
      </main>
    `;

    document.body.appendChild(overlay);

    // Ativa todos os botões de olho
    bindPasswordToggles(overlay);

    // Strength meter no signup
    bindStrengthMeter(overlay);

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

      // Emite signup_started quando usuário muda pra aba de cadastro.
      // É o gate pra medir drop-off entre "abriu tela" e "completou signup".
      if (!showSignin) {
        trackEvent('signup_started', { source: intentOptions.source || 'auth-screen' });
      }
    };

    const triggerGoogleAuth = async (button) => {
      trackEvent('auth_google_clicked', { source: intentOptions.source });

      await runAsyncAction(button, { loadingLabel: 'Redirecionando...' }, async () => {
        const result = await Auth.signInWithGoogle({ source: intentOptions.source });

        if (!result?.ok) {
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
      const emailEl = overlay.querySelector('#signin-email');
      const passwordEl = overlay.querySelector('#signin-password');
      const email = emailEl.value.trim();
      const password = passwordEl.value;

      if (!email || !password) {
        Toast.warning('Informe email e senha para entrar.');
        (!email ? emailEl : passwordEl).focus();
        return;
      }
      if (!Auth.isValidEmail(email)) {
        Toast.warning('Digite um email válido.');
        emailEl.focus();
        return;
      }

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
      const nomeEl = overlay.querySelector('#signup-nome');
      const emailEl = overlay.querySelector('#signup-email');
      const passwordEl = overlay.querySelector('#signup-password');
      const confirmEl = overlay.querySelector('#signup-confirm');
      const nome = nomeEl.value.trim();
      const email = emailEl.value.trim();
      const password = passwordEl.value;
      const confirm = confirmEl.value;

      if (!nome || !email || !password || !confirm) {
        Toast.warning('Preencha todos os campos para criar a conta.');
        // Foca no primeiro campo vazio para orientar o usuário
        const firstEmpty = !nome ? nomeEl : !email ? emailEl : !password ? passwordEl : confirmEl;
        firstEmpty.focus();
        return;
      }
      if (!Auth.isValidEmail(email)) {
        Toast.warning('Digite um email válido.');
        emailEl.focus();
        return;
      }
      if (password.length < 8) {
        Toast.error('Senha deve ter no mínimo 8 caracteres.');
        passwordEl.focus();
        return;
      }
      if (password !== confirm) {
        Toast.error('As senhas não conferem. Verifique e tente novamente.');
        confirmEl.focus();
        return;
      }

      await runAsyncAction(btn, { loadingLabel: 'Criando conta...' }, async () => {
        const user = await Auth.signUp(email, password, nome);
        if (!user) return;
        handleAuthSuccess(overlay, postAuthRedirect);
      });
    });

    setTab(initialTab);
  },
};
