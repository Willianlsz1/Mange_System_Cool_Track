import { beforeEach, describe, expect, it, vi } from 'vitest';

async function loadSubscriptionPlans({ profile = { plan: 'free' }, error = null } = {}) {
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

  it('normalizes invalid plan codes to free', async () => {
    const { normalizePlanCode, PLAN_CODE_FREE, PLAN_CODE_PRO } = await loadSubscriptionPlans();

    expect(normalizePlanCode('enterprise')).toBe(PLAN_CODE_FREE);
    expect(normalizePlanCode(PLAN_CODE_PRO)).toBe(PLAN_CODE_PRO);
  });

  it('resolves effective plan using is_dev and active subscription status', async () => {
    const { getEffectivePlan, PLAN_CODE_FREE, PLAN_CODE_PRO } = await loadSubscriptionPlans();

    expect(getEffectivePlan({ is_dev: true })).toBe(PLAN_CODE_PRO);
    expect(getEffectivePlan({ plan: 'pro', subscription_status: 'active' })).toBe(PLAN_CODE_PRO);
    expect(getEffectivePlan({ plan_code: 'pro', subscription_status: 'trialing' })).toBe(
      PLAN_CODE_FREE,
    );
    expect(getEffectivePlan({ plan: 'free', subscription_status: 'active' })).toBe(PLAN_CODE_FREE);
    expect(getEffectivePlan(null)).toBe(PLAN_CODE_FREE);
  });

  it('exposes hasProAccess and assertProAccess consistently', async () => {
    const { assertProAccess, hasProAccess } = await loadSubscriptionPlans();

    expect(hasProAccess({ plan: 'pro', subscription_status: 'active' })).toBe(true);
    expect(() => assertProAccess({ plan: 'pro', subscription_status: 'active' }, 'pdf_export')).not
      .toThrow;

    expect(hasProAccess({ plan: 'pro', subscription_status: 'past_due' })).toBe(false);
    expect(() =>
      assertProAccess({ plan: 'pro', subscription_status: 'past_due' }, 'pdf_export'),
    ).toThrow(/exclusiva do plano Pro/i);
  });

  it('enforces free equipment limit at 3 and keeps pro unlimited', async () => {
    const { canCreateEquipment } = await loadSubscriptionPlans();

    expect(canCreateEquipment({ plan: 'free' }, 2)).toMatchObject({
      allowed: true,
      limit: 3,
      current: 2,
      planCode: 'free',
    });

    expect(canCreateEquipment({ plan: 'free' }, 3)).toMatchObject({
      allowed: false,
      limit: 3,
      current: 3,
      planCode: 'free',
    });

    expect(canCreateEquipment({ plan: 'pro', subscription_status: 'active' }, 20)).toMatchObject({
      allowed: true,
      limit: Number.POSITIVE_INFINITY,
      current: 20,
      planCode: 'pro',
    });
  });

  it('reads user profile from Supabase and applies effective plan fallback', async () => {
    const { getPlanCodeForUserId, PLAN_CODE_FREE, PLAN_CODE_PRO, mocks } =
      await loadSubscriptionPlans({
        profile: { plan: 'pro', subscription_status: 'active', is_dev: false },
      });

    await expect(getPlanCodeForUserId('user-1')).resolves.toBe(PLAN_CODE_PRO);
    expect(mocks.from).toHaveBeenCalledWith('profiles');

    mocks.maybeSingle.mockResolvedValueOnce({
      data: { plan: 'pro', subscription_status: 'incomplete', is_dev: false },
      error: null,
    });
    await expect(getPlanCodeForUserId('user-1')).resolves.toBe(PLAN_CODE_FREE);

    mocks.maybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });
    await expect(getPlanCodeForUserId('user-1')).resolves.toBe(PLAN_CODE_FREE);
  });
});
