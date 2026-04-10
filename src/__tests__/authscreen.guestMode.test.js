import { describe, it, expect, vi, beforeEach } from 'vitest';

async function loadAuthScreen({ signInResult = { id: 'u-1' }, signUpResult = { id: 'u-2' } } = {}) {
  vi.resetModules();

  const Auth = {
    isValidEmail: vi.fn(() => true),
    signIn: vi.fn().mockResolvedValue(signInResult),
    signUp: vi.fn().mockResolvedValue(signUpResult),
  };

  const Toast = {
    warning: vi.fn(),
    error: vi.fn(),
  };

  const runAsyncAction = vi.fn(async (_btn, _opts, fn) => fn());

  const PasswordRecoveryModal = {
    openPasswordResetEmailModal: vi.fn(),
  };

  vi.doMock('../core/auth.js', () => ({ Auth }));
  vi.doMock('../core/toast.js', () => ({ Toast }));
  vi.doMock('../ui/components/actionFeedback.js', () => ({ runAsyncAction }));
  vi.doMock('../ui/components/passwordRecoveryModal.js', () => ({ PasswordRecoveryModal }));

  const { AuthScreen } = await import('../ui/components/authscreen.js');
  return { AuthScreen, Auth, runAsyncAction };
}

describe('AuthScreen guest-mode hygiene', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
  });

  it('removes guest mode when sign-in succeeds', async () => {
    const { AuthScreen, Auth } = await loadAuthScreen();
    localStorage.setItem('cooltrack-guest-mode', '1');

    AuthScreen.show();

    document.getElementById('signin-email').value = 'user@mail.com';
    document.getElementById('signin-password').value = '123456';
    document.getElementById('btn-signin').click();

    await Promise.resolve();
    await Promise.resolve();

    expect(Auth.signIn).toHaveBeenCalledWith('user@mail.com', '123456');
    expect(localStorage.getItem('cooltrack-guest-mode')).toBeNull();
  });

  it('removes guest mode when sign-up succeeds', async () => {
    const { AuthScreen, Auth } = await loadAuthScreen();
    localStorage.setItem('cooltrack-guest-mode', '1');

    AuthScreen.show();
    document.getElementById('tab-signup').click();

    document.getElementById('signup-nome').value = 'Teste';
    document.getElementById('signup-email').value = 'novo@mail.com';
    document.getElementById('signup-password').value = '123456';
    document.getElementById('btn-signup').click();

    await Promise.resolve();
    await Promise.resolve();

    expect(Auth.signUp).toHaveBeenCalledWith('novo@mail.com', '123456', 'Teste');
    expect(localStorage.getItem('cooltrack-guest-mode')).toBeNull();
  });
});
