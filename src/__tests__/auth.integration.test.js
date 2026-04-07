function createAuthSupabaseMock() {
  const onAuthStateChange = vi.fn();
  const profilesInsert = vi.fn().mockResolvedValue({ data: {}, error: null });

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u-1', email: 'a@b.com' } } }),
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
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

  vi.doMock('../core/supabase.js', () => ({ supabase: supabaseMock }));
  vi.doMock('../core/toast.js', () => ({ Toast: toastMock }));

  const { Auth } = await import('../core/auth.js');
  return { Auth, supabaseMock, toastMock };
}

describe('Auth integration wrapper', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('handles signUp happy path and profile creation', async () => {
    const { Auth, supabaseMock } = await loadAuthModule();
    supabaseMock.auth.signUp.mockResolvedValue({ data: { user: { id: 'new-1' } }, error: null });

    const user = await Auth.signUp('new@user.com', 'secret123', 'Novo Usuário');

    expect(user).toEqual({ id: 'new-1' });
    expect(supabaseMock.auth.signUp).toHaveBeenCalledWith({ email: 'new@user.com', password: 'secret123' });
    expect(supabaseMock.from).toHaveBeenCalledWith('profiles');
    expect(supabaseMock.profilesInsert).toHaveBeenCalledWith({ id: 'new-1', nome: 'Novo Usuário' });
  });

  it('returns current user from session', async () => {
    const { Auth } = await loadAuthModule();
    const user = await Auth.getUser();
    expect(user).toMatchObject({ id: 'u-1', email: 'a@b.com' });
  });

  it('handles signUp errors', async () => {
    const { Auth, supabaseMock, toastMock } = await loadAuthModule();
    supabaseMock.auth.signUp.mockResolvedValue({ data: { user: null }, error: { message: 'signup failed' } });

    const user = await Auth.signUp('bad@user.com', '123456', 'Bad');

    expect(user).toBeNull();
    expect(toastMock.error).toHaveBeenCalledWith('signup failed');
  });

  it('handles signIn success and failure', async () => {
    const { Auth, supabaseMock, toastMock } = await loadAuthModule();

    supabaseMock.auth.signInWithPassword.mockResolvedValueOnce({ data: { user: { id: 'u-7' } }, error: null });
    await expect(Auth.signIn('a@b.com', '123456')).resolves.toEqual({ id: 'u-7' });

    supabaseMock.auth.signInWithPassword.mockResolvedValueOnce({ data: { user: null }, error: { message: 'invalid' } });
    await expect(Auth.signIn('a@b.com', 'wrong')).resolves.toBeNull();
    expect(toastMock.error).toHaveBeenCalledWith('Email ou senha incorretos.');
  });

  it('handles signOut flow', async () => {
    const { Auth, supabaseMock } = await loadAuthModule();
    const reloadSpy = vi.spyOn(window.location, 'reload').mockImplementation(() => {});

    await Auth.signOut();

    expect(supabaseMock.auth.signOut).toHaveBeenCalled();
    expect(reloadSpy).toHaveBeenCalled();
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
      expect.objectContaining({ redirectTo: expect.stringContaining('Mange_System_Cool_Track') })
    );

    supabaseMock.auth.resetPasswordForEmail.mockResolvedValueOnce({ error: { message: 'reset failed' } });
    const fail = await Auth.requestPasswordReset('user@mail.com');
    expect(fail).toEqual({ ok: false, message: 'reset failed' });
  });

  it('handles password recovery hash flow success and error cases', async () => {
    const { Auth, supabaseMock, toastMock } = await loadAuthModule();
    const replaceSpy = vi.spyOn(history, 'replaceState').mockImplementation(() => {});

    window.location.hash = '#type=recovery';

    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValueOnce('123').mockReturnValueOnce('123456');

    const shortPwd = await Auth.tryHandlePasswordRecovery();
    expect(shortPwd).toBe(true);
    expect(toastMock.error).toHaveBeenCalledWith('Senha deve ter no mínimo 6 caracteres.');

    supabaseMock.auth.updateUser.mockResolvedValueOnce({ error: { message: 'boom' } });
    const failed = await Auth.tryHandlePasswordRecovery();
    expect(failed).toBe(true);
    expect(toastMock.error).toHaveBeenCalledWith('Não foi possível redefinir a senha. Tente novamente pelo link do email.');

    promptSpy.mockReturnValueOnce('nova123');
    supabaseMock.auth.updateUser.mockResolvedValueOnce({ error: null });
    const success = await Auth.tryHandlePasswordRecovery();
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
