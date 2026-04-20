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
    expect(result.limit).toBe(Number.POSITIVE_INFINITY);
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

  it('degrada pro com status past_due pra regras do Free (proteção contra inadimplência)', async () => {
    mockState.equipamentos = Array.from({ length: 3 }, (_, i) => ({ id: `e-${i}` }));
    maybeSingle.mockResolvedValue({
      data: { plan: 'pro', subscription_status: 'past_due', is_dev: false },
      error: null,
    });

    const { checkPlanLimit } = await import('../core/guestLimits.js');
    const result = await checkPlanLimit('equipamentos');

    expect(result.blocked).toBe(true);
    expect(result.planCode).toBe('free');
    expect(result.limit).toBe(3);
  });

  it('blocks guest when registros reaches free limit (monthly window)', async () => {
    localStorage.setItem('cooltrack-guest-mode', '1');
    const now = new Date();
    const iso = (day) =>
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T10:00`;
    // 5 registros no mês corrente — bate o teto mensal do Free.
    mockState.registros = Array.from({ length: 5 }, (_, i) => ({
      id: `r-${i}`,
      data: iso((i % 28) + 1),
    }));

    const { checkGuestLimit, checkPlanLimit } = await import('../core/guestLimits.js');
    const guestResult = checkGuestLimit('registros');
    const planResult = await checkPlanLimit('registros');

    expect(guestResult.blocked).toBe(true);
    expect(guestResult.limit).toBe(5);
    expect(planResult.blocked).toBe(true);
    expect(planResult.isGuest).toBe(true);
    expect(planResult.planCode).toBe('free');
  });

  it('blocks authenticated free users when monthly registros reaches free limit (5)', async () => {
    const now = new Date();
    const iso = (day) =>
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T10:00`;
    mockState.registros = Array.from({ length: 5 }, (_, i) => ({
      id: `r-${i}`,
      data: iso((i % 28) + 1),
    }));

    const { checkPlanLimit } = await import('../core/guestLimits.js');
    const result = await checkPlanLimit('registros');

    expect(result.blocked).toBe(true);
    expect(result.limit).toBe(5);
    expect(result.current).toBe(5);
    expect(result.isGuest).toBe(false);
    expect(result.planCode).toBe('free');
  });

  it('does not count registros from previous months toward free monthly limit', async () => {
    const now = new Date();
    // 20 registros no mês anterior + 3 no mês corrente → current deve ser 3, não 23.
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15);
    const prevIso = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}-15T10:00`;
    const curIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01T10:00`;
    mockState.registros = [
      ...Array.from({ length: 20 }, (_, i) => ({ id: `old-${i}`, data: prevIso })),
      ...Array.from({ length: 3 }, (_, i) => ({ id: `new-${i}`, data: curIso })),
    ];

    const { checkPlanLimit, countRegistrosThisMonth } = await import('../core/guestLimits.js');
    const result = await checkPlanLimit('registros');

    expect(countRegistrosThisMonth(mockState.registros, now)).toBe(3);
    expect(result.current).toBe(3);
    expect(result.blocked).toBe(false);
  });

  it('does not block authenticated plus users on registros (unlimited)', async () => {
    const now = new Date();
    const iso = (day) =>
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T10:00`;
    mockState.registros = Array.from({ length: 50 }, (_, i) => ({
      id: `r-${i}`,
      data: iso((i % 28) + 1),
    }));
    maybeSingle.mockResolvedValue({
      data: { plan: 'plus', subscription_status: 'active', is_dev: false },
      error: null,
    });

    const { checkPlanLimit } = await import('../core/guestLimits.js');
    const result = await checkPlanLimit('registros');

    expect(result.blocked).toBe(false);
    expect(result.planCode).toBe('plus');
  });
});
