import { beforeEach, describe, expect, it, vi } from 'vitest';

function createSupabaseMock({
  session = { access_token: 'token' },
  sessionError = null,
  functionResponse = { data: { url: 'https://checkout.stripe.com/test' }, error: null },
  user = { id: 'user-1' },
  userError = null,
  profile = {
    id: 'user-1',
    plan_code: 'pro',
    plan: 'pro',
    subscription_status: 'active',
    is_dev: false,
  },
  profileError = null,
} = {}) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: profile, error: profileError });
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));

  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session }, error: sessionError }),
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: userError }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    from,
    functions: {
      invoke: vi.fn().mockResolvedValue(functionResponse),
    },
    mocks: { maybeSingle, eq, select, from },
  };
}

async function loadMonetizationWithMock(mock) {
  vi.resetModules();
  vi.doMock('../core/supabase.js', () => ({ supabase: mock }));
  return import('../core/plans/monetization.js');
}

describe('monetization', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('isProUser follows strict effective-plan rules and allows is_dev', async () => {
    const mod = await loadMonetizationWithMock(createSupabaseMock());

    expect(mod.isProUser({ plan_code: 'pro', subscription_status: 'active' })).toBe(true);
    // trialing conta como status pago ativo (checkout Stripe com trial)
    expect(mod.isProUser({ plan: 'pro', subscription_status: 'trialing' })).toBe(true);
    expect(mod.isProUser({ plan_code: 'pro', subscription_status: 'past_due' })).toBe(false);
    expect(mod.isProUser({ plan_code: 'free', subscription_status: 'active' })).toBe(false);
    expect(mod.isProUser({ is_dev: true })).toBe(true);
  });

  it('canUsePremiumFeature: PDF liberado para todos (quota controla), equipamentos extra gated Plus+', async () => {
    const mod = await loadMonetizationWithMock(createSupabaseMock());
    const proProfile = { plan_code: 'pro', subscription_status: 'active' };
    const plusProfile = { plan_code: 'plus', subscription_status: 'active' };
    const freeProfile = { plan_code: 'free', subscription_status: 'active' };

    // PDF export: Phase 1 libera pra Free também (com marca d'água + cota de 5/mês).
    // A quota vive em usageLimits, não mais como feature binária.
    expect(mod.canUsePremiumFeature(proProfile, mod.PREMIUM_FEATURE_PDF_EXPORT)).toBe(true);
    expect(mod.canUsePremiumFeature(plusProfile, mod.PREMIUM_FEATURE_PDF_EXPORT)).toBe(true);
    expect(mod.canUsePremiumFeature(freeProfile, mod.PREMIUM_FEATURE_PDF_EXPORT)).toBe(true);

    // Equipamentos extras continuam gated Plus+
    expect(mod.canUsePremiumFeature(proProfile, mod.PREMIUM_FEATURE_EQUIPAMENTOS)).toBe(true);
    expect(mod.canUsePremiumFeature(plusProfile, mod.PREMIUM_FEATURE_EQUIPAMENTOS)).toBe(true);
    expect(mod.canUsePremiumFeature(freeProfile, mod.PREMIUM_FEATURE_EQUIPAMENTOS)).toBe(false);
  });

  it('fetchMyProfileBilling selects billing profile with is_dev and falls back to free profile', async () => {
    const supabaseMock = createSupabaseMock({ profile: null });
    const mod = await loadMonetizationWithMock(supabaseMock);

    const result = await mod.fetchMyProfileBilling();

    expect(result.profile).toMatchObject({
      id: 'user-1',
      plan: 'free',
      plan_code: 'free',
      subscription_status: 'inactive',
      is_dev: false,
    });

    expect(supabaseMock.mocks.select).toHaveBeenCalledWith('*');
  });

  it('startCheckout fails without session', async () => {
    const mod = await loadMonetizationWithMock(
      createSupabaseMock({ session: null, functionResponse: { data: null, error: null } }),
    );

    await expect(mod.startCheckout()).rejects.toMatchObject({ code: 'NO_SESSION' });
  });

  it('startCheckout maps 401 invalid jwt', async () => {
    const mod = await loadMonetizationWithMock(
      createSupabaseMock({
        functionResponse: { data: null, error: { status: 401, message: 'Invalid JWT' } },
      }),
    );

    await expect(mod.startCheckout()).rejects.toMatchObject({ code: 'INVALID_JWT' });
  });

  it('startCheckout returns checkout url on success and keeps checkout flow untouched', async () => {
    const mock = createSupabaseMock({
      functionResponse: { data: { url: 'https://checkout.stripe.com/pay/cs_test' }, error: null },
    });

    const mod = await loadMonetizationWithMock(mock);
    const url = await mod.startCheckout({ plan: 'pro' });

    expect(url).toBe('https://checkout.stripe.com/pay/cs_test');
    expect(mock.functions.invoke).toHaveBeenCalledWith('create-checkout-session', {
      body: { plan: 'pro' },
      headers: { Authorization: 'Bearer token' },
    });
  });
});
