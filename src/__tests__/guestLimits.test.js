import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = { equipamentos: [], registros: [], tecnicos: [] };
const authGetUser = vi.fn();
const maybeSingle = vi.fn();
const eq = vi.fn(() => ({ maybeSingle }));
const select = vi.fn(() => ({ eq }));
const from = vi.fn(() => ({ select }));

vi.mock('../core/state.js', () => ({
  getState: vi.fn(() => mockState),
}));

vi.mock('../core/supabase.js', () => ({
  supabase: {
    auth: { getUser: authGetUser },
    from,
  },
}));

describe('guestLimits', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mockState.equipamentos = [];
    mockState.registros = [];

    authGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    maybeSingle.mockResolvedValue({
      data: { plan: 'free', subscription_status: 'inactive', is_dev: false },
      error: null,
    });
  });

  it('blocks authenticated free users when equipamentos reaches free limit (3)', async () => {
    mockState.equipamentos = Array.from({ length: 3 }, (_, i) => ({ id: `e-${i}` }));

    const { checkPlanLimit } = await import('../core/guestLimits.js');
    const result = await checkPlanLimit('equipamentos');

    expect(result.blocked).toBe(true);
    expect(result.limit).toBe(3);
    expect(result.current).toBe(3);
    expect(result.isGuest).toBe(false);
    expect(result.planCode).toBe('free');
  });

  it('supports explicit current equipment count in checkPlanLimit call', async () => {
    mockState.equipamentos = [];

    const { checkPlanLimit } = await import('../core/guestLimits.js');
    const result = await checkPlanLimit('equipamentos', 3);

    expect(result.blocked).toBe(true);
    expect(result.limit).toBe(3);
    expect(result.current).toBe(3);
    expect(result.planCode).toBe('free');
  });

  it('does not block logged pro users with active subscription on equipamentos limit', async () => {
    mockState.equipamentos = Array.from({ length: 8 }, (_, i) => ({ id: `e-${i}` }));
    maybeSingle.mockResolvedValue({
      data: { plan: 'pro', subscription_status: 'active', is_dev: false },
      error: null,
    });

    const { checkPlanLimit } = await import('../core/guestLimits.js');
    const result = await checkPlanLimit('equipamentos');

    expect(result.blocked).toBe(false);
    expect(result.planCode).toBe('pro');
    expect(result.limit).toBe(30);
  });

  it('treats is_dev users as pro even without active subscription', async () => {
    mockState.equipamentos = Array.from({ length: 10 }, (_, i) => ({ id: `e-${i}` }));
    maybeSingle.mockResolvedValue({
      data: { plan: 'free', subscription_status: 'inactive', is_dev: true },
      error: null,
    });

    const { checkPlanLimit } = await import('../core/guestLimits.js');
    const result = await checkPlanLimit('equipamentos');

    expect(result.blocked).toBe(false);
    expect(result.planCode).toBe('pro');
  });

  it('keeps pro without active status on free rule fallback', async () => {
    mockState.equipamentos = Array.from({ length: 3 }, (_, i) => ({ id: `e-${i}` }));
    maybeSingle.mockResolvedValue({
      data: { plan: 'pro', subscription_status: 'trialing', is_dev: false },
      error: null,
    });

    const { checkPlanLimit } = await import('../core/guestLimits.js');
    const result = await checkPlanLimit('equipamentos');

    expect(result.blocked).toBe(true);
    expect(result.planCode).toBe('free');
    expect(result.limit).toBe(3);
  });

  it('blocks guest when registros reaches free limit', async () => {
    localStorage.setItem('cooltrack-guest-mode', '1');
    mockState.registros = Array.from({ length: 10 }, (_, i) => ({ id: `r-${i}` }));

    const { checkGuestLimit, checkPlanLimit } = await import('../core/guestLimits.js');
    const guestResult = checkGuestLimit('registros');
    const planResult = await checkPlanLimit('registros');

    expect(guestResult.blocked).toBe(true);
    expect(guestResult.limit).toBe(10);
    expect(planResult.blocked).toBe(true);
    expect(planResult.isGuest).toBe(true);
    expect(planResult.planCode).toBe('free');
  });
});
