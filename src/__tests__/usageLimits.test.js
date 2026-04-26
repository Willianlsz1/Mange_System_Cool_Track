import { beforeEach, describe, expect, it, vi } from 'vitest';

async function loadUsageLimits({
  usageRows = [],
  selectError = null,
  rpcData = 3,
  rpcError = null,
} = {}) {
  vi.resetModules();

  const eqMonth = vi.fn().mockResolvedValue({ data: usageRows, error: selectError });
  const eqUser = vi.fn(() => ({ eq: eqMonth }));
  const select = vi.fn(() => ({ eq: eqUser }));
  const from = vi.fn(() => ({ select }));
  const rpc = vi.fn().mockResolvedValue({ data: rpcData, error: rpcError });

  vi.doMock('../core/supabase.js', () => ({
    supabase: { from, rpc },
  }));

  const module = await import('../core/usageLimits.js');
  return { ...module, mocks: { eqMonth, eqUser, select, from, rpc } };
}

describe('usageLimits', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('exposes plan limits and limit checks', async () => {
    const { getMonthlyLimitForPlan, hasReachedMonthlyLimit, USAGE_RESOURCE_PDF_EXPORT } =
      await loadUsageLimits();

    expect(getMonthlyLimitForPlan('free', USAGE_RESOURCE_PDF_EXPORT)).toBe(
      Number.POSITIVE_INFINITY,
    );
    expect(getMonthlyLimitForPlan('plus', USAGE_RESOURCE_PDF_EXPORT)).toBe(
      Number.POSITIVE_INFINITY,
    );
    expect(getMonthlyLimitForPlan('pro', USAGE_RESOURCE_PDF_EXPORT)).toBe(Number.POSITIVE_INFINITY);
    expect(
      hasReachedMonthlyLimit({
        planCode: 'free',
        resource: 'pdf_export',
        usedCount: 200,
      }),
    ).toBe(false);
    expect(
      hasReachedMonthlyLimit({
        planCode: 'free',
        resource: 'whatsapp_share',
        usedCount: 5,
      }),
    ).toBe(true);
  });

  it('aplica limites dimensionados por plano pra nameplate_analysis', async () => {
    // Motivação: Plus e Pro não podem ser "ilimitado" porque o custo da
    // análise é em USD (cauda longa vira sangria de margem). 30/mês no Plus
    // cobre técnico autônomo; 200/mês no Pro cobre equipe pequena.
    const { getMonthlyLimitForPlan, hasReachedMonthlyLimit, USAGE_RESOURCE_NAMEPLATE_ANALYSIS } =
      await loadUsageLimits();

    expect(getMonthlyLimitForPlan('free', USAGE_RESOURCE_NAMEPLATE_ANALYSIS)).toBe(1);
    expect(getMonthlyLimitForPlan('plus', USAGE_RESOURCE_NAMEPLATE_ANALYSIS)).toBe(30);
    expect(getMonthlyLimitForPlan('pro', USAGE_RESOURCE_NAMEPLATE_ANALYSIS)).toBe(200);

    // Plus bate o teto em 30
    expect(
      hasReachedMonthlyLimit({
        planCode: 'plus',
        resource: USAGE_RESOURCE_NAMEPLATE_ANALYSIS,
        usedCount: 30,
      }),
    ).toBe(true);
    expect(
      hasReachedMonthlyLimit({
        planCode: 'plus',
        resource: USAGE_RESOURCE_NAMEPLATE_ANALYSIS,
        usedCount: 29,
      }),
    ).toBe(false);

    // Pro bate o teto em 200
    expect(
      hasReachedMonthlyLimit({
        planCode: 'pro',
        resource: USAGE_RESOURCE_NAMEPLATE_ANALYSIS,
        usedCount: 200,
      }),
    ).toBe(true);
    expect(
      hasReachedMonthlyLimit({
        planCode: 'pro',
        resource: USAGE_RESOURCE_NAMEPLATE_ANALYSIS,
        usedCount: 199,
      }),
    ).toBe(false);
  });

  it('loads monthly usage snapshot from Supabase', async () => {
    const { getMonthlyUsageSnapshot, mocks } = await loadUsageLimits({
      usageRows: [
        { resource: 'pdf_export', used_count: 2 },
        { resource: 'whatsapp_share', used_count: 4 },
      ],
    });

    const snapshot = await getMonthlyUsageSnapshot('user-1', { monthStart: '2026-04-01' });

    expect(snapshot.pdf_export).toBe(2);
    expect(snapshot.whatsapp_share).toBe(4);
    expect(mocks.from).toHaveBeenCalledWith('usage_monthly');
    expect(mocks.eqUser).toHaveBeenCalledWith('user_id', 'user-1');
    expect(mocks.eqMonth).toHaveBeenCalledWith('month_start', '2026-04-01');
  });

  it('increments usage via rpc helper', async () => {
    const { incrementMonthlyUsage, USAGE_RESOURCE_PDF_EXPORT, mocks } = await loadUsageLimits({
      rpcData: 3,
    });

    const count = await incrementMonthlyUsage('user-1', USAGE_RESOURCE_PDF_EXPORT, {
      monthStart: '2026-04-01',
    });

    expect(count).toBe(3);
    expect(mocks.rpc).toHaveBeenCalledWith('increment_monthly_usage', {
      p_user_id: 'user-1',
      p_resource: USAGE_RESOURCE_PDF_EXPORT,
      p_month_start: '2026-04-01',
      p_delta: 1,
    });
  });
});
