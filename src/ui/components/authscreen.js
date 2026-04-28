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

// Brand mark V2 — usa o snowflake real do app (mesmo SVG do header).
// Fundo amarelo da marca + stroke navy preserva identidade visual em vez do
// arco generico anterior. Importante: mesma forma que o icone do PWA/favicon.
function brandIconHTML(size = 32) {
  const inner = Math.round(size * 0.62);
  const radius = Math.round(size / 4);
  return `
    <span style="display:inline-grid;place-items:center;width:${size}px;height:${size}px;border-radius:${radius}px;background:#e8b94a;flex-shrink:0" aria-hidden="true">
      <svg width="${inner}" height="${inner}" viewBox="0 0 24 24" fill="none">
        <g stroke="#02131f" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <g><line x1="12" y1="3" x2="12" y2="21"/><polyline points="9.5,5 12,3 14.5,5"/><polyline points="9.5,19 12,21 14.5,19"/></g>
          <g transform="rotate(60 12 12)"><line x1="12" y1="3" x2="12" y2="21"/><polyline points="9.5,5 12,3 14.5,5"/><polyline points="9.5,19 12,21 14.5,19"/></g>
          <g transform="rotate(120 12 12)"><line x1="12" y1="3" x2="12" y2="21"/><polyline points="9.5,5 12,3 14.5,5"/><polyline points="9.5,19 12,21 14.5,19"/></g>
        </g>
        <circle cx="12" cy="12" r="1.4" fill="#02131f"/>
      </svg>
    </span>`;
}
const ICON_LOGO = brandIconHTML(32);
const ICON_LOGO_SM = brandIconHTML(22);

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

        /* ── V3: Audience pill no topo do brand ── */
        .auth-brand__audience {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 6px 12px;
          background: rgba(0,200,232,0.08);
          border: 1px solid rgba(0,200,232,0.22);
          border-radius: 999px;
          font-size: 11px; font-weight: 700; color: #00c8e8;
          letter-spacing: 0.06em; text-transform: uppercase;
          margin-top: 32px;
          align-self: flex-start;
          position: relative; z-index: 1;
        }

        /* ── V3: Trust line abaixo do botao Entrar (3 micro-promessas) ── */
        .auth-trust-line {
          display: flex; align-items: center; justify-content: center;
          gap: 14px; flex-wrap: wrap;
          margin-top: 16px;
          font-size: 11.5px; color: #8aaac8;
        }
        .auth-trust-line__item {
          display: inline-flex; align-items: center; gap: 5px;
        }
        .auth-trust-line__item svg {
          color: #00c8e8;
        }

        /* ── V3: Trust card — "Acesso seguro e criptografado" ── */
        .auth-trust-card {
          display: flex; align-items: center; gap: 12px;
          margin-top: 18px;
          padding: 12px 14px;
          background: rgba(0,200,232,0.04);
          border: 1px solid rgba(0,200,232,0.15);
          border-radius: 10px;
        }
        .auth-trust-card__icon {
          width: 32px; height: 32px; border-radius: 8px;
          background: rgba(0,200,232,0.12);
          display: flex; align-items: center; justify-content: center;
          color: #00c8e8; flex-shrink: 0;
        }
        .auth-trust-card__title {
          font-size: 13px; font-weight: 700; color: #e8f2fa; line-height: 1.3;
        }
        .auth-trust-card__sub {
          font-size: 11.5px; color: #8aaac8; margin-top: 2px;
        }

        /* ── V3: Social proof flutuante no rodape do form ── */
        .auth-social-proof {
          display: flex; align-items: center; gap: 12px;
          margin-top: 24px; padding: 12px 14px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 12px;
        }
        .auth-social-proof__avatars {
          display: flex; flex-shrink: 0;
        }
        .auth-social-proof__avatar {
          width: 28px; height: 28px; border-radius: 50%;
          border: 2px solid #07111f;
          display: flex; align-items: center; justify-content: center;
          color: #fff; font-size: 11px; font-weight: 700;
          margin-left: -8px;
        }
        .auth-social-proof__avatar:first-child { margin-left: 0; }
        .auth-social-proof__text {
          flex: 1; min-width: 0;
        }
        .auth-social-proof__num {
          font-size: 13px; font-weight: 700; color: #e8f2fa; line-height: 1.2;
        }
        .auth-social-proof__label {
          font-size: 11px; color: #8aaac8; line-height: 1.3;
        }

        /* ── V3: Phone mockup (3a coluna em FullHD) ── */
        .auth-phone-aside {
          flex: 0 0 320px;
          display: none;
          flex-direction: column; align-items: center; justify-content: center;
          padding: 40px 20px;
          background: linear-gradient(160deg, #07111f 0%, #060d18 100%);
          border-left: 1px solid rgba(255,255,255,0.04);
          position: relative; overflow: hidden;
          box-sizing: border-box;
        }
        .auth-phone-aside::before {
          content: '';
          position: absolute; top: 20%; right: -100px;
          width: 280px; height: 280px; border-radius: 50%;
          background: radial-gradient(circle, rgba(0,200,232,0.08) 0%, transparent 70%);
          pointer-events: none;
        }
        .auth-phone {
          width: 280px;
          background: #06101e;
          border: 8px solid #1a2333;
          border-radius: 36px;
          padding: 14px 12px;
          box-shadow: 0 24px 56px rgba(0,0,0,0.55), 0 0 0 1px rgba(0,200,232,0.08);
          position: relative; z-index: 1;
        }
        /* Notch superior do "celular" */
        .auth-phone::before {
          content: '';
          position: absolute; top: -4px; left: 50%;
          transform: translateX(-50%);
          width: 80px; height: 18px;
          background: #1a2333;
          border-radius: 0 0 14px 14px;
        }
        .auth-phone__topbar {
          display: flex; align-items: center; gap: 8px;
          padding: 6px 4px 12px;
        }
        .auth-phone__topbar-brand {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 11px; font-weight: 700; color: #e8f2fa;
        }
        .auth-phone__topbar-pro {
          font-size: 8px; font-weight: 700; color: #e8b94a;
          background: rgba(232,185,74,0.15);
          padding: 2px 5px; border-radius: 3px;
        }
        .auth-phone__topbar-spacer { flex: 1; }
        .auth-phone__sync-pill {
          display: inline-flex; align-items: center; gap: 4px;
          font-size: 8.5px; color: #5fe6b3;
          background: rgba(95,230,179,0.1);
          padding: 3px 6px; border-radius: 999px;
        }
        .auth-phone__sync-dot {
          width: 5px; height: 5px; border-radius: 50%;
          background: #5fe6b3;
          box-shadow: 0 0 6px rgba(95,230,179,0.6);
        }
        .auth-phone__hero {
          padding: 10px 8px;
          background: linear-gradient(135deg, rgba(232,185,74,0.08), rgba(0,200,232,0.04));
          border: 1px solid rgba(232,185,74,0.18);
          border-radius: 12px;
          margin-bottom: 10px;
        }
        .auth-phone__greeting {
          font-size: 12px; font-weight: 700; color: #e8f2fa;
          margin-bottom: 2px;
        }
        .auth-phone__sub {
          font-size: 9px; color: #8aaac8;
          margin-bottom: 8px;
        }
        .auth-phone__status-pill {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 3px 7px;
          background: rgba(95,230,179,0.12);
          border: 1px solid rgba(95,230,179,0.3);
          border-radius: 999px;
          font-size: 8.5px; font-weight: 700; color: #34d399;
          letter-spacing: 0.06em;
        }
        .auth-phone__kpis {
          display: grid; grid-template-columns: 1fr 1fr; gap: 6px;
          margin-bottom: 10px;
        }
        .auth-phone__kpi {
          padding: 8px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 8px;
        }
        .auth-phone__kpi-label {
          font-size: 7.5px; font-weight: 700; color: #6a8ba8;
          letter-spacing: 0.06em; text-transform: uppercase;
        }
        .auth-phone__kpi-value {
          font-size: 16px; font-weight: 700; color: #e8f2fa;
          margin-top: 2px; line-height: 1;
        }
        .auth-phone__kpi-sub {
          font-size: 8px; color: #5fe6b3; margin-top: 3px;
        }
        .auth-phone__card {
          padding: 8px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 8px;
          margin-bottom: 8px;
        }
        .auth-phone__card-label {
          font-size: 7.5px; font-weight: 700; color: #6a8ba8;
          letter-spacing: 0.06em; text-transform: uppercase;
          margin-bottom: 3px;
        }
        .auth-phone__card-title {
          font-size: 11px; font-weight: 700; color: #e8f2fa;
          margin-bottom: 1px;
        }
        .auth-phone__card-meta {
          font-size: 9px; color: #8aaac8;
        }
        .auth-phone__bottom-nav {
          display: flex; justify-content: space-around;
          padding: 8px 4px 4px;
          border-top: 1px solid rgba(255,255,255,0.05);
          margin: 6px -4px 0;
        }
        .auth-phone__nav-item {
          display: flex; flex-direction: column; align-items: center; gap: 2px;
          font-size: 7.5px; color: #6a8ba8;
        }
        .auth-phone__nav-item.is-active {
          color: #00c8e8;
        }
        .auth-phone__caption {
          margin-top: 18px;
          text-align: center;
          font-size: 11px; color: #8aaac8;
          line-height: 1.4;
          max-width: 240px;
          position: relative; z-index: 1;
        }
        .auth-phone__caption strong {
          color: #00c8e8;
        }

        /* ── Responsive ── */
        @media (max-width: 1280px) {
          .auth-phone-aside { display: none !important; }
        }
        @media (min-width: 1281px) {
          .auth-phone-aside { display: flex; }
          .auth-brand { flex: 0 0 38%; padding: 48px 44px; }
          .auth-form-panel { flex: 1 1 auto; }
        }
        @media (max-width: 768px) {
          .auth-brand { display: none; }
          .auth-form-panel {
            padding: 24px 16px 40px;
            align-items: flex-start;
          }
          .auth-card-header { display: block; }
          .auth-social-proof { padding: 10px 12px; }
          .auth-social-proof__num { font-size: 12px; }
        }
      </style>

      <!-- LEFT: Branding panel (role=complementary, NUNCA aria-hidden) -->
      <aside class="auth-brand" role="complementary">
        <div class="auth-brand__logo">
          ${ICON_LOGO}
          <span class="auth-brand__logo-text">CoolTrack</span>
          <span class="auth-brand__logo-badge">PRO</span>
        </div>

        <!-- V3: pill audiencia — qualifica em 1s "isso é pra mim" -->
        <span class="auth-brand__audience">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M9 12l2 2 4-4"/>
          </svg>
          Para técnicos de ar-condicionado
        </span>

        <h1 class="auth-brand__headline">
          Do serviço ao PDF, direto do celular.
        </h1>
        <p class="auth-brand__sub">
          Cadastre o equipamento, registre o serviço e envie o relatório no
          WhatsApp em menos de 1 minuto — sem sair do local.
        </p>

        <div class="auth-brand__features">
          <div class="auth-brand__feat">
            <div class="auth-brand__feat-icon">${ICON_SNOWFLAKE}</div>
            <div>
              <div class="auth-brand__feat-title">Cadastro por foto da placa</div>
              <div class="auth-brand__feat-desc">Tire foto, a IA preenche modelo, marca e dados técnicos.</div>
            </div>
          </div>
          <div class="auth-brand__feat">
            <div class="auth-brand__feat-icon">${ICON_FILETEXT}</div>
            <div>
              <div class="auth-brand__feat-title">Checklist rápido do serviço</div>
              <div class="auth-brand__feat-desc">Preventiva, corretiva, limpeza, carga de gás — em segundos.</div>
            </div>
          </div>
          <div class="auth-brand__feat">
            <div class="auth-brand__feat-icon">${ICON_BELL}</div>
            <div>
              <div class="auth-brand__feat-title">PDF no WhatsApp em um toque</div>
              <div class="auth-brand__feat-desc">Relatório pronto com sua logo, fotos e assinatura do cliente.</div>
            </div>
          </div>
        </div>

        <div class="auth-brand__stats">
          <div>
            <div class="auth-brand__stat-num">&lt;1min</div>
            <div class="auth-brand__stat-label">Relatório pronto</div>
          </div>
          <div>
            <div class="auth-brand__stat-num">&infin;</div>
            <div class="auth-brand__stat-label">Equipamentos no Pro</div>
          </div>
          <div>
            <div class="auth-brand__stat-num">100%</div>
            <div class="auth-brand__stat-label">Funciona offline</div>
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
            <div class="auth-card-header__sub">Do serviço ao PDF, direto do celular.</div>
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
            ${passwordInputHTML('signin-password', 'senha', 'current-password')}
            <button class="auth-btn" id="btn-signin" type="button">Entrar no app ${ICON_ARROW_RIGHT}</button>

            <div class="auth-trust-line">
              <span class="auth-trust-line__item">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <rect x="2" y="6" width="20" height="12" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
                </svg>
                Sem cartão
              </span>
              <span class="auth-trust-line__item">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/>
                  <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>
                </svg>
                Funciona offline
              </span>
              <span class="auth-trust-line__item">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/>
                </svg>
                Acesso imediato
              </span>
            </div>

            <div class="auth-trust-card">
              <div class="auth-trust-card__icon" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  <polyline points="9 12 11 14 15 10"/>
                </svg>
              </div>
              <div>
                <div class="auth-trust-card__title">Acesso seguro e criptografado</div>
                <div class="auth-trust-card__sub">Seus dados sempre protegidos.</div>
              </div>
            </div>

            <div class="auth-actions-center">
              <button class="auth-btn-forgot" id="btn-forgot" type="button">Esqueci minha senha</button>
            </div>

            <div class="auth-social-proof">
              <div class="auth-social-proof__avatars" aria-hidden="true">
                <span class="auth-social-proof__avatar" style="background:linear-gradient(135deg,#00c8e8,#0096b4)">CR</span>
                <span class="auth-social-proof__avatar" style="background:linear-gradient(135deg,#e8b94a,#c89a30)">FR</span>
                <span class="auth-social-proof__avatar" style="background:linear-gradient(135deg,#5fe6b3,#1fa370)">LO</span>
              </div>
              <div class="auth-social-proof__text">
                <div class="auth-social-proof__num">+500 relatórios já gerados</div>
                <div class="auth-social-proof__label">Beta em produção · técnicos ativos no Brasil</div>
              </div>
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
            <div class="auth-hint">Grátis pra sempre · Sem cartão · PDF com marca d’água no free</div>
          </div>

        </div>
      </main>

      <!-- V3: Phone mockup aside (>= 1281px). Mostra dashboard real do app. -->
      <aside class="auth-phone-aside" aria-hidden="true">
        <div class="auth-phone">
          <div class="auth-phone__topbar">
            <span class="auth-phone__topbar-brand">
              ${brandIconHTML(16)} CoolTrack
            </span>
            <span class="auth-phone__topbar-pro">PRO</span>
            <span class="auth-phone__topbar-spacer"></span>
            <span class="auth-phone__sync-pill">
              <span class="auth-phone__sync-dot"></span> Sincronizado
            </span>
          </div>

          <div class="auth-phone__hero">
            <div class="auth-phone__greeting">Olá, Carlos 👋</div>
            <div class="auth-phone__sub">Seu parque está saudável.</div>
            <span class="auth-phone__status-pill">● TUDO OPERANDO</span>
          </div>

          <div class="auth-phone__kpis">
            <div class="auth-phone__kpi">
              <div class="auth-phone__kpi-label">Equipamentos</div>
              <div class="auth-phone__kpi-value">12/12</div>
              <div class="auth-phone__kpi-sub">estável</div>
            </div>
            <div class="auth-phone__kpi">
              <div class="auth-phone__kpi-label">Eficiência</div>
              <div class="auth-phone__kpi-value">96%</div>
              <div class="auth-phone__kpi-sub">excelente</div>
            </div>
          </div>

          <div class="auth-phone__card">
            <div class="auth-phone__card-label">Próximo serviço</div>
            <div class="auth-phone__card-title">Limpeza preventiva</div>
            <div class="auth-phone__card-meta">Clínica Norte · Sala 02 · 28/04</div>
          </div>

          <div class="auth-phone__card">
            <div class="auth-phone__card-label">Último serviço</div>
            <div class="auth-phone__card-title">Limpeza de filtros</div>
            <div class="auth-phone__card-meta">há 2 dias · 12:49</div>
          </div>

          <div class="auth-phone__bottom-nav">
            <span class="auth-phone__nav-item is-active">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              </svg>
              Painel
            </span>
            <span class="auth-phone__nav-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.77 3.77z"/>
              </svg>
              Equip.
            </span>
            <span class="auth-phone__nav-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              Serviços
            </span>
            <span class="auth-phone__nav-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              </svg>
              Clientes
            </span>
          </div>
        </div>

        <p class="auth-phone__caption">
          Veja seu parque inteiro <strong>em tempo real</strong>, registre e envie em segundos.
        </p>
      </aside>
    `;

    document.body.appendChild(overlay);
    bindPasswordToggles(overlay);
    bindStrengthMeter(overlay);

    // Tabs
    const tabSignin = overlay.querySelector('#tab-signin');
    const tabSignup = overlay.querySelector('#tab-signup');
    const formSignin = overlay.querySelector('#auth-form-signin');
    const formSignup = overlay.querySelector('#auth-form-signup');
    const switchTab = (which) => {
      const isSignin = which === 'signin';
      tabSignin.classList.toggle('active', isSignin);
      tabSignup.classList.toggle('active', !isSignin);
      tabSignin.setAttribute('aria-selected', String(isSignin));
      tabSignup.setAttribute('aria-selected', String(!isSignin));
      formSignin.hidden = !isSignin;
      formSignup.hidden = isSignin;
      focusFirstField(isSignin ? formSignin : formSignup, '.auth-input');
    };
    tabSignin.addEventListener('click', () => switchTab('signin'));
    tabSignup.addEventListener('click', () => switchTab('signup'));
    if (initialTab === 'signup') switchTab('signup');

    // Sign In
    overlay.querySelector('#btn-signin').addEventListener('click', async (e) => {
      const email = overlay.querySelector('#signin-email').value.trim();
      const password = overlay.querySelector('#signin-password').value;
      if (!email || !password) {
        Toast.warning('Preencha email e senha pra entrar.');
        return;
      }
      await runAsyncAction(e.currentTarget, { loadingLabel: 'Entrando...' }, async () => {
        try {
          const user = await Auth.signIn(email, password);
          if (!user) throw new Error('AUTH_SIGNIN_FAILED');
          trackEvent('auth_signin_success', { method: 'email' });
          handleAuthSuccess(overlay, postAuthRedirect);
        } catch (err) {
          trackEvent('auth_signin_failed', { method: 'email' });
          Toast.error(err?.message || 'Não foi possível entrar. Verifique email e senha.');
        }
      });
    });

    // Sign Up
    overlay.querySelector('#btn-signup').addEventListener('click', async (e) => {
      const nome = overlay.querySelector('#signup-nome').value.trim();
      const email = overlay.querySelector('#signup-email').value.trim();
      const password = overlay.querySelector('#signup-password').value;
      const confirm = overlay.querySelector('#signup-confirm').value;
      if (!nome || !email || !password) {
        Toast.warning('Preencha nome, email e senha.');
        return;
      }
      if (password.length < 8) {
        Toast.warning('A senha precisa ter pelo menos 8 caracteres.');
        return;
      }
      if (password !== confirm) {
        Toast.warning('As senhas não conferem.');
        return;
      }
      await runAsyncAction(e.currentTarget, { loadingLabel: 'Criando...' }, async () => {
        try {
          const user = await Auth.signUp(email, password, { nome });
          if (!user) throw new Error('AUTH_SIGNUP_FAILED');
          trackEvent('auth_signup_success', { method: 'email' });
          handleAuthSuccess(overlay, postAuthRedirect);
        } catch (err) {
          trackEvent('auth_signup_failed', { method: 'email' });
          Toast.error(err?.message || 'Não foi possível criar a conta.');
        }
      });
    });

    // Google
    const googleHandler = (mode) => async (e) => {
      await runAsyncAction(e.currentTarget, { loadingLabel: 'Abrindo Google...' }, async () => {
        try {
          await Auth.signInWithGoogle();
          trackEvent(
            mode === 'signup' ? 'auth_signup_google_started' : 'auth_signin_google_started',
            {
              method: 'google',
            },
          );
        } catch (err) {
          Toast.error(err?.message || 'Não foi possível abrir o Google.');
        }
      });
    };
    overlay.querySelector('#btn-google-signin').addEventListener('click', googleHandler('signin'));
    overlay.querySelector('#btn-google-signup').addEventListener('click', googleHandler('signup'));

    // Forgot
    overlay.querySelector('#btn-forgot')?.addEventListener('click', () => {
      PasswordRecoveryModal.open();
    });

    focusFirstField(overlay, '.auth-input');
  },
};
