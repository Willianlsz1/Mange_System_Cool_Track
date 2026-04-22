import { describe, it, expect, vi, beforeEach } from 'vitest';

async function loadAuthScreen() {
  vi.resetModules();

  const Auth = {
    isValidEmail: vi.fn(() => true),
    signIn: vi.fn().mockResolvedValue({ id: 'u' }),
    signUp: vi.fn().mockResolvedValue({ id: 'u' }),
    signInWithGoogle: vi.fn().mockResolvedValue({ ok: true }),
  };
  const Toast = { warning: vi.fn(), error: vi.fn() };
  const runAsyncAction = vi.fn(async (_b, _o, fn) => fn());
  const PasswordRecoveryModal = { openPasswordResetEmailModal: vi.fn() };
  const trackEvent = vi.fn();

  vi.doMock('../core/auth.js', () => ({ Auth }));
  vi.doMock('../core/toast.js', () => ({ Toast }));
  vi.doMock('../core/telemetry.js', () => ({ trackEvent }));
  vi.doMock('../ui/components/actionFeedback.js', () => ({ runAsyncAction }));
  vi.doMock('../ui/components/passwordRecoveryModal.js', () => ({ PasswordRecoveryModal }));

  const { AuthScreen } = await import('../ui/components/authscreen.js');
  return { AuthScreen };
}

describe('AuthScreen V2Refined redesign', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
  });

  it('renders demo card at top with "Abrir" guest button', async () => {
    const { AuthScreen } = await loadAuthScreen();
    AuthScreen.show();

    const demo = document.querySelector('.auth-demo');
    expect(demo).toBeTruthy();
    expect(demo.textContent).toContain('Testar sem criar conta');
    expect(demo.textContent).toContain('Entre no app com dados de exemplo');
    expect(document.querySelector('#btn-guest')?.textContent.trim()).toBe('Abrir');
  });

  it('Google button is primary (signin) with unified copy', async () => {
    const { AuthScreen } = await loadAuthScreen();
    AuthScreen.show();

    const btn = document.querySelector('#btn-google-signin');
    expect(btn).toBeTruthy();
    expect(btn.classList.contains('auth-btn-google')).toBe(true);
    expect(btn.textContent).toContain('Continuar com Google');
  });

  it('Google button shows guest-save copy under guest-save intent', async () => {
    const { AuthScreen } = await loadAuthScreen();
    AuthScreen.show({ intent: 'guest-save' });

    const btn = document.querySelector('#btn-google-signin');
    expect(btn.textContent).toContain('Salvar meus dados com Google');
    expect(btn.textContent).not.toContain('Continuar com Google');
  });

  it('headline is solid — no <em> highlight (login sóbrio)', async () => {
    const { AuthScreen } = await loadAuthScreen();
    AuthScreen.show();

    const headline = document.querySelector('.auth-brand__headline');
    expect(headline).toBeTruthy();
    expect(headline.querySelector('em')).toBeNull();
    expect(headline.textContent).toContain('Controle total');
  });

  it('signup panel renders strength meter and updated hint', async () => {
    const { AuthScreen } = await loadAuthScreen();
    AuthScreen.show();
    document.getElementById('tab-signup').click();

    const meter = document.querySelector('#signup-strength');
    expect(meter).toBeTruthy();
    expect(meter.getAttribute('role')).toBe('progressbar');
    expect(meter.querySelectorAll('.auth-strength__seg').length).toBe(3);

    // Hint operacional do plano gratuito sem promessa enganosa.
    const hint = document.querySelector('#auth-form-signup .auth-hint');
    expect(hint?.textContent).toContain('PDF com marca d');
    expect(hint?.textContent).not.toContain('cancele');
  });

  it('strength meter updates colors live as password is typed', async () => {
    const { AuthScreen } = await loadAuthScreen();
    AuthScreen.show();
    document.getElementById('tab-signup').click();

    const pw = document.getElementById('signup-password');
    const label = document.querySelector('.auth-strength__label');

    // <8 chars → Muito curta (red)
    pw.value = 'abc';
    pw.dispatchEvent(new Event('input'));
    expect(label.textContent).toBe('Muito curta');

    // 8+ no digit/symbol → Fraca (gold)
    pw.value = 'abcdefgh';
    pw.dispatchEvent(new Event('input'));
    expect(label.textContent).toBe('Fraca');

    // 8+ with digit → Forte (green)
    pw.value = 'tecnico2026';
    pw.dispatchEvent(new Event('input'));
    expect(label.textContent).toBe('Forte');
  });

  it('brand panel has role=complementary (NOT aria-hidden)', async () => {
    const { AuthScreen } = await loadAuthScreen();
    AuthScreen.show();

    const brand = document.querySelector('.auth-brand');
    expect(brand.getAttribute('role')).toBe('complementary');
    expect(brand.hasAttribute('aria-hidden')).toBe(false);
  });

  it('labels are sentence-case (not uppercase)', async () => {
    const { AuthScreen } = await loadAuthScreen();
    AuthScreen.show();

    const emailLabel = document.querySelector('label[for="signin-email"]');
    // "Email" — sentence case, not "EMAIL"
    expect(emailLabel.textContent.trim()).toBe('Email');
  });

  it('feature icons are SVG, not emoji', async () => {
    const { AuthScreen } = await loadAuthScreen();
    AuthScreen.show();

    const icons = document.querySelectorAll('.auth-brand__feat-icon');
    expect(icons.length).toBe(3);
    icons.forEach((el) => {
      expect(el.querySelector('svg')).toBeTruthy();
      // No emoji chars
      expect(/[\u{1F300}-\u{1FAFF}]/u.test(el.textContent)).toBe(false);
    });
  });
});
