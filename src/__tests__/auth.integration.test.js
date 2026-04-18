import { describe, it, expect, vi, beforeEach } from 'vitest';

function createAuthSupabaseMock() {
  const onAuthStateChange = vi.fn();
  const profilesInsert = vi.fn().mockResolvedValue({ data: {}, error: null });

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u-1', email: 'a@b.com' } } }),
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      signInWithOAuth: vi.fn().mockResolvedValue({ data: {}, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      resetPasswordForEmail: vi.fn(),
      updateUser: vi.fn(),
      onAuthStateChange,
    },
    from: vi.fn(() => ({ insert: profilesInsert })),
    profilesInsert,
    onAuthStateChange,
  };
}

async function loadAuthModule() {
  vi.resetModules();
  const supabaseMock = createAuthSupabaseMock();
  const toastMock = { error: vi.fn(), success: vi.fn(), warning: vi.fn(), info: vi.fn() };
  const telemetryMock = { trackEvent: vi.fn() };

  vi.doMock('../core/supabase.js', () => ({ supabase: supabaseMock }));
  vi.doMock('../core/toast.js', () => ({ Toast: toastMock }));
  vi.doMock('../core/telemetry.js', () => telemetryMock);

  const { Auth } = await import('../core/auth.js');
  return { Auth, supabaseMock, toastMock, telemetryMock };
}

describe('Auth integration wrapper', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    history.replaceState(null, '', '/');
  });

  it('handles signUp happy path delegating profile creation to DB trigger', async () => {
    const { Auth, supabaseMock } = await loadAuthModule();
    supabaseMock.auth.signUp.mockResolvedValue({ data: { user: { id: 'new-1' } }, error: null });

    const user = await Auth.signUp('new@user.com', 'secret123', 'Novo Usuário');

    expect(user).toEqual({ id: 'new-1' });
    // Agora o nome vai via raw_user_meta_data; o trigger on_auth_user_created
    // cria o profile no banco, então não fazemos mais INSERT manual aqui.
    expect(supabaseMock.auth.signUp).toHaveBeenCalledWith({
      email: 'new@user.com',
      password: 'secret123',
      options: {
        data: { nome: 'Novo Usuário' },
      },
    });
    expect(supabaseMock.from).not.toHaveBeenCalledWith('profiles');
    expect(supabaseMock.profilesInsert).not.toHaveBeenCalled();
  });

  it('returns current user from session', async () => {
    const { Auth } = await loadAuthModule();
    const user = await Auth.getUser();
    expect(user).toMatchObject({ id: 'u-1', email: 'a@b.com' });
  });

  it('handles signUp errors', async () => {
    const { Auth, supabaseMock, toastMock } = await loadAuthModule();
    supabaseMock.auth.signUp.mockResolvedValue({
      data: { user: null },
      error: { message: 'signup failed' },
    });

    const user = await Auth.signUp('bad@user.com', '123456', 'Bad');

    expect(user).toBeNull();
    expect(toastMock.warning).toHaveBeenCalledWith('Não foi possível criar sua conta.');
  });

  it('handles signIn success and failure', async () => {
    const { Auth, supabaseMock, toastMock } = await loadAuthModule();

    supabaseMock.auth.signInWithPassword.mockResolvedValueOnce({
      data: { user: { id: 'u-7' } },
      error: null,
    });
    await expect(Auth.signIn('a@b.com', '123456')).resolves.toEqual({ id: 'u-7' });

    supabaseMock.auth.signInWithPassword.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'invalid' },
    });
    await expect(Auth.signIn('a@b.com', 'wrong')).resolves.toBeNull();
    expect(toastMock.warning).toHaveBeenCalledWith('Email ou senha incorretos.');
  });

  it('starts google oauth with redirect and pending context', async () => {
    const { Auth, supabaseMock } = await loadAuthModule();

    const result = await Auth.signInWithGoogle({ source: 'auth-screen', wasGuest: true });

    expect(result).toEqual({ ok: true });
    expect(supabaseMock.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: expect.objectContaining({
        redirectTo: expect.stringMatching(/^https?:\/\/localhost:\d+\/?/),
      }),
    });
    expect(localStorage.getItem('cooltrack-oauth-pending-v1')).toContain('auth-screen');
  });

  it('finalizes oauth success and conversion telemetry', async () => {
    const { Auth, telemetryMock, toastMock } = await loadAuthModule();
    localStorage.setItem(
      'cooltrack-oauth-pending-v1',
      JSON.stringify({ provider: 'google', source: 'guest-save', wasGuest: true }),
    );
    history.replaceState(null, '', '/?code=abc&state=def');

    Auth.finalizeOAuthRedirect({ id: 'u-1' });

    expect(telemetryMock.trackEvent).toHaveBeenCalledWith(
      'google_login_success',
      expect.objectContaining({ source: 'guest-save', wasGuest: true }),
    );
    expect(telemetryMock.trackEvent).toHaveBeenCalledWith(
      'auth_google_completed',
      expect.objectContaining({ source: 'guest-save', wasGuest: true }),
    );
    expect(telemetryMock.trackEvent).toHaveBeenCalledWith(
      'guest_conversion_success',
      expect.objectContaining({ method: 'google', source: 'guest-save' }),
    );
    expect(telemetryMock.trackEvent).toHaveBeenCalledWith(
      'guest_converted_to_account',
      expect.objectContaining({ method: 'google', source: 'guest-save' }),
    );
    expect(toastMock.success).toHaveBeenCalledWith('Seus dados foram salvos com segurança');
    expect(toastMock.success).toHaveBeenCalledWith(
      'Agora você pode acessar seus registros de qualquer lugar',
    );
    expect(window.location.search).toBe('');
  });

  it('handles signOut flow', async () => {
    const { Auth, supabaseMock } = await loadAuthModule();

    await Auth.signOut();

    expect(supabaseMock.auth.signOut).toHaveBeenCalled();
  });

  it('handles password reset request validation and API responses', async () => {
    const { Auth, supabaseMock } = await loadAuthModule();

    const invalid = await Auth.requestPasswordReset('x');
    expect(invalid.ok).toBe(false);

    supabaseMock.auth.resetPasswordForEmail.mockResolvedValueOnce({ error: null });
    const ok = await Auth.requestPasswordReset('User@Mail.com ');
    expect(ok).toEqual({ ok: true });
    expect(supabaseMock.auth.resetPasswordForEmail).toHaveBeenCalledWith(
      'user@mail.com',
      expect.objectContaining({
        redirectTo: expect.stringMatching(/^https?:\/\/localhost:\d+\/?/),
      }),
    );

    supabaseMock.auth.resetPasswordForEmail.mockResolvedValueOnce({
      error: { message: 'reset failed' },
    });
    const fail = await Auth.requestPasswordReset('user@mail.com');
    expect(fail).toEqual({ ok: false, message: 'Não foi possível enviar o email de recuperação.' });
  });

  it('handles password recovery hash flow success and error cases', async () => {
    const { Auth, supabaseMock, toastMock } = await loadAuthModule();
    const replaceSpy = vi.spyOn(history, 'replaceState').mockImplementation(() => {});

    window.location.hash = '#type=recovery';

    const shortPwd = await Auth.tryHandlePasswordRecovery(async () => '123');
    expect(shortPwd).toBe(true);
    expect(toastMock.error).toHaveBeenCalledWith('Senha deve ter no mínimo 8 caracteres.');

    supabaseMock.auth.updateUser.mockResolvedValueOnce({ error: { message: 'boom' } });
    const failed = await Auth.tryHandlePasswordRecovery(async () => '1234567890');
    expect(failed).toBe(true);
    expect(toastMock.error).toHaveBeenCalledWith(
      'Não foi possível redefinir a senha. Tente novamente pelo link do email.',
    );

    supabaseMock.auth.updateUser.mockResolvedValueOnce({ error: null });
    const success = await Auth.tryHandlePasswordRecovery(async () => 'nova1234');
    expect(success).toBe(true);
    expect(toastMock.success).toHaveBeenCalled();
    expect(replaceSpy).toHaveBeenCalled();
  });

  it('returns false when not in recovery mode and exposes session changes via callback', async () => {
    const { Auth, supabaseMock } = await loadAuthModule();

    window.location.hash = '#other=1';
    await expect(Auth.tryHandlePasswordRecovery()).resolves.toBe(false);

    const cb = vi.fn();
    Auth.onAuthChange(cb);
    const handler = supabaseMock.auth.onAuthStateChange.mock.calls[0][0];
    handler('SIGNED_IN', { user: { id: 'session-user' } });

    expect(cb).toHaveBeenCalledWith({ id: 'session-user' });
  });
});
