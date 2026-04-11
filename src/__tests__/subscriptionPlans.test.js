import { beforeEach, describe, expect, it, vi } from 'vitest';

async function loadSubscriptionPlans({ profile = { plan_code: 'free' }, error = null } = {}) {
  vi.resetModules();

  const maybeSingle = vi.fn().mockResolvedValue({ data: profile, error });
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));

  vi.doMock('../core/supabase.js', () => ({
    supabase: { from },
  }));

  const module = await import('../core/subscriptionPlans.js');
  return { ...module, mocks: { maybeSingle, eq, select, from } };
}

describe('subscriptionPlans', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('defaults authenticated users to free plan when no explicit plan is provided', async () => {
    const { getPlanForUser, PLAN_CODE_FREE } = await loadSubscriptionPlans();
    expect(getPlanForUser({ isGuest: false }).key).toBe(PLAN_CODE_FREE);
  });

  it('keeps guest users on free plan', async () => {
    const { getPlanForUser, PLAN_CODE_FREE } = await loadSubscriptionPlans();
    expect(getPlanForUser({ isGuest: true }).key).toBe(PLAN_CODE_FREE);
  });

  it('normalizes invalid plan codes to free', async () => {
    const { normalizePlanCode, PLAN_CODE_FREE, PLAN_CODE_PRO } = await loadSubscriptionPlans();
    expect(normalizePlanCode('enterprise')).toBe(PLAN_CODE_FREE);
    expect(normalizePlanCode(PLAN_CODE_PRO)).toBe(PLAN_CODE_PRO);
  });

  it('reads user plan from Supabase profile', async () => {
    const { getPlanCodeForUserId, PLAN_CODE_PRO, mocks } = await loadSubscriptionPlans({
      profile: { plan_code: 'pro' },
    });

    const planCode = await getPlanCodeForUserId('user-1');

    expect(planCode).toBe(PLAN_CODE_PRO);
    expect(mocks.from).toHaveBeenCalledWith('profiles');
  });

  it('falls back to free plan when Supabase query fails', async () => {
    const { getPlanCodeForUserId, PLAN_CODE_FREE } = await loadSubscriptionPlans({
      profile: null,
      error: { message: 'boom' },
    });

    const planCode = await getPlanCodeForUserId('user-1');

    expect(planCode).toBe(PLAN_CODE_FREE);
  });
});
