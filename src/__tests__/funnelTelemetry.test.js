/**
 * Testes do funil completo de telemetria pós-click.
 *
 * Cobertura:
 *   - auth.signUp → signup_completed / signup_failed
 *   - auth.signIn → login_completed / login_failed
 *   - planCache.setCachedPlan → upgrade_completed (só em transição free → paid)
 *     e plan_changed (entre planos pagos)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Helpers compartilhados ------------------------------------------------

function createAuthSupabaseMock() {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      resetPasswordForEmail: vi.fn(),
      updateUser: vi.fn(),
      onAuthStateChange: vi.fn(),
    },
    from: vi.fn(),
  };
}

async function loadAuthModule() {
  vi.resetModules();
  const supabaseMock = createAuthSupabaseMock();
  const toastMock = { error: vi.fn(), success: vi.fn(), warning: vi.fn(), info: vi.fn() };
  const telemetryMock = { trackEvent: vi.fn(), TELEMETRY_EVENT: 'cooltrack:telemetry' };

  vi.doMock('../core/supabase.js', () => ({ supabase: supabaseMock }));
  vi.doMock('../core/toast.js', () => ({ Toast: toastMock }));
  vi.doMock('../core/telemetry.js', () => telemetryMock);

  const { Auth } = await import('../core/auth.js');
  return { Auth, supabaseMock, telemetryMock };
}

async function loadPlanCacheModule() {
  vi.resetModules();
  const telemetryMock = { trackEvent: vi.fn(), TELEMETRY_EVENT: 'cooltrack:telemetry' };
  vi.doMock('../core/telemetry.js', () => telemetryMock);

  const { setCachedPlan } = await import('../core/planCache.js');
  return { setCachedPlan, telemetryMock };
}

// Auth ------------------------------------------------------------------

describe('auth telemetry (signup/login)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('emite signup_completed ao criar conta com sucesso', async () => {
    const { Auth, supabaseMock, telemetryMock } = await loadAuthModule();
    supabaseMock.auth.signUp.mockResolvedValue({
      data: { user: { id: 'u-1', email: 'a@b.com' } },
      error: null,
    });

    const user = await Auth.signUp('a@b.com', 'senha1234', 'Nome Teste');

    expect(user).toEqual({ id: 'u-1', email: 'a@b.com' });
    expect(telemetryMock.trackEvent).toHaveBeenCalledWith('signup_completed', { method: 'email' });
    expect(telemetryMock.trackEvent).not.toHaveBeenCalledWith('signup_failed', expect.anything());
  });

  it('emite signup_failed quando supabase retorna erro', async () => {
    const { Auth, supabaseMock, telemetryMock } = await loadAuthModule();
    supabaseMock.auth.signUp.mockResolvedValue({
      data: null,
      error: { message: 'email already exists' },
    });

    const user = await Auth.signUp('a@b.com', 'senha1234', 'Nome');

    expect(user).toBeNull();
    expect(telemetryMock.trackEvent).toHaveBeenCalledWith('signup_failed', {
      reason: 'email already exists',
    });
    expect(telemetryMock.trackEvent).not.toHaveBeenCalledWith(
      'signup_completed',
      expect.anything(),
    );
  });

  it('emite login_completed ao fazer login com sucesso', async () => {
    const { Auth, supabaseMock, telemetryMock } = await loadAuthModule();
    supabaseMock.auth.signInWithPassword.mockResolvedValue({
      data: { user: { id: 'u-2', email: 'b@c.com' } },
      error: null,
    });

    const user = await Auth.signIn('b@c.com', 'senha1234');

    expect(user).toEqual({ id: 'u-2', email: 'b@c.com' });
    expect(telemetryMock.trackEvent).toHaveBeenCalledWith('login_completed', { method: 'email' });
  });

  it('emite login_failed quando credenciais inválidas', async () => {
    const { Auth, supabaseMock, telemetryMock } = await loadAuthModule();
    supabaseMock.auth.signInWithPassword.mockResolvedValue({
      data: null,
      error: { message: 'invalid credentials' },
    });

    const user = await Auth.signIn('b@c.com', 'errada');

    expect(user).toBeNull();
    expect(telemetryMock.trackEvent).toHaveBeenCalledWith('login_failed', {
      method: 'email',
      reason: 'invalid credentials',
    });
  });
});

// planCache -------------------------------------------------------------

describe('planCache telemetry (upgrade transitions)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('emite upgrade_completed ao subir de free pra pro', async () => {
    const { setCachedPlan, telemetryMock } = await loadPlanCacheModule();

    // Nenhum valor anterior em localStorage — simula primeiro upgrade.
    setCachedPlan('pro');

    expect(telemetryMock.trackEvent).toHaveBeenCalledWith('upgrade_completed', {
      from: 'unknown',
      to: 'pro',
    });
  });

  it('emite upgrade_completed ao subir de free pra plus', async () => {
    const { setCachedPlan, telemetryMock } = await loadPlanCacheModule();

    localStorage.setItem('cooltrack-cached-plan', 'free');
    setCachedPlan('plus');

    expect(telemetryMock.trackEvent).toHaveBeenCalledWith('upgrade_completed', {
      from: 'free',
      to: 'plus',
    });
  });

  it('NÃO emite upgrade_completed quando plano já era pago', async () => {
    const { setCachedPlan, telemetryMock } = await loadPlanCacheModule();

    localStorage.setItem('cooltrack-cached-plan', 'pro');
    setCachedPlan('pro');

    expect(telemetryMock.trackEvent).not.toHaveBeenCalledWith(
      'upgrade_completed',
      expect.anything(),
    );
  });

  it('NÃO emite nada quando plano continua free', async () => {
    const { setCachedPlan, telemetryMock } = await loadPlanCacheModule();

    localStorage.setItem('cooltrack-cached-plan', 'free');
    setCachedPlan('free');

    expect(telemetryMock.trackEvent).not.toHaveBeenCalled();
  });

  it('emite plan_changed ao trocar entre planos pagos (plus → pro)', async () => {
    const { setCachedPlan, telemetryMock } = await loadPlanCacheModule();

    localStorage.setItem('cooltrack-cached-plan', 'plus');
    setCachedPlan('pro');

    expect(telemetryMock.trackEvent).toHaveBeenCalledWith('plan_changed', {
      from: 'plus',
      to: 'pro',
    });
    expect(telemetryMock.trackEvent).not.toHaveBeenCalledWith(
      'upgrade_completed',
      expect.anything(),
    );
  });

  it('emite plan_changed também em downgrade pago (pro → plus)', async () => {
    const { setCachedPlan, telemetryMock } = await loadPlanCacheModule();

    localStorage.setItem('cooltrack-cached-plan', 'pro');
    setCachedPlan('plus');

    expect(telemetryMock.trackEvent).toHaveBeenCalledWith('plan_changed', {
      from: 'pro',
      to: 'plus',
    });
  });
});
