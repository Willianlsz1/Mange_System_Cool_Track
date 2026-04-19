import { beforeEach, describe, expect, it, vi } from 'vitest';

const getUser = vi.fn();
vi.mock('../core/auth.js', () => ({
  Auth: { getUser },
}));

const fetchMyProfileBilling = vi.fn();
vi.mock('../core/monetization.js', () => ({
  fetchMyProfileBilling,
}));

const getEffectivePlan = vi.fn();
vi.mock('../core/subscriptionPlans.js', () => ({
  getEffectivePlan,
  PLAN_CODE_FREE: 'free',
  PLAN_CODE_PLUS: 'plus',
  PLAN_CODE_PRO: 'pro',
}));

const getMonthlyLimitForPlan = vi.fn();
const getMonthlyUsageSnapshot = vi.fn();
vi.mock('../core/usageLimits.js', () => ({
  USAGE_RESOURCE_PDF_EXPORT: 'pdf_export',
  getMonthlyLimitForPlan,
  getMonthlyUsageSnapshot,
}));

describe('PdfQuotaBadge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML =
      '<div id="toolbar"><button data-action="export-pdf">Exportar PDF</button></div>';
  });

  it('hides for guest users (no badge rendered)', async () => {
    const { PdfQuotaBadge } = await import('../ui/components/pdfQuotaBadge.js');
    getUser.mockResolvedValueOnce(null);

    const result = await PdfQuotaBadge.refresh();

    expect(result).toBeNull();
    expect(document.getElementById('pdf-quota-badge')).toBeNull();
  });

  it('hides for Pro users (unlimited)', async () => {
    const { PdfQuotaBadge } = await import('../ui/components/pdfQuotaBadge.js');
    getUser.mockResolvedValueOnce({ id: 'u1' });
    fetchMyProfileBilling.mockResolvedValueOnce({
      profile: { id: 'u1', plan_code: 'pro' },
    });
    getEffectivePlan.mockReturnValueOnce('pro');
    getMonthlyUsageSnapshot.mockResolvedValueOnce({ pdf_export: 0 });

    const result = await PdfQuotaBadge.refresh();

    expect(result).toBeNull();
    expect(document.getElementById('pdf-quota-badge')).toBeNull();
  });

  it('renders label "X/Y PDFs este mês · restam Z (Free)" for Free', async () => {
    const { PdfQuotaBadge } = await import('../ui/components/pdfQuotaBadge.js');
    getUser.mockResolvedValueOnce({ id: 'u1' });
    fetchMyProfileBilling.mockResolvedValueOnce({
      profile: { id: 'u1', plan_code: 'free' },
    });
    getEffectivePlan.mockReturnValueOnce('free');
    getMonthlyLimitForPlan.mockReturnValueOnce(5);
    getMonthlyUsageSnapshot.mockResolvedValueOnce({ pdf_export: 2 });

    await PdfQuotaBadge.refresh();

    const badge = document.getElementById('pdf-quota-badge');
    expect(badge).not.toBeNull();
    expect(badge.textContent).toBe('2/5 PDFs este mês · restam 3 (Free)');
    // 2/5 = 40% → sem tom de alerta
    expect(badge.className).toBe('pdf-quota-badge');
  });

  it('applies warning tone at >=80% usage', async () => {
    const { PdfQuotaBadge } = await import('../ui/components/pdfQuotaBadge.js');
    getUser.mockResolvedValueOnce({ id: 'u1' });
    fetchMyProfileBilling.mockResolvedValueOnce({
      profile: { id: 'u1', plan_code: 'free' },
    });
    getEffectivePlan.mockReturnValueOnce('free');
    getMonthlyLimitForPlan.mockReturnValueOnce(5);
    getMonthlyUsageSnapshot.mockResolvedValueOnce({ pdf_export: 4 });

    await PdfQuotaBadge.refresh();

    const badge = document.getElementById('pdf-quota-badge');
    expect(badge.className).toContain('pdf-quota-badge--warning');
  });

  it('applies danger tone and "Limite atingido" label at 100%', async () => {
    const { PdfQuotaBadge } = await import('../ui/components/pdfQuotaBadge.js');
    getUser.mockResolvedValueOnce({ id: 'u1' });
    fetchMyProfileBilling.mockResolvedValueOnce({
      profile: { id: 'u1', plan_code: 'plus' },
    });
    getEffectivePlan.mockReturnValueOnce('plus');
    getMonthlyLimitForPlan.mockReturnValueOnce(100);
    getMonthlyUsageSnapshot.mockResolvedValueOnce({ pdf_export: 100 });

    await PdfQuotaBadge.refresh();

    const badge = document.getElementById('pdf-quota-badge');
    expect(badge.className).toContain('pdf-quota-badge--danger');
    expect(badge.textContent).toBe('Limite atingido: 100/100 PDFs (Plus)');
  });

  it('fails silently on network error (no badge rendered)', async () => {
    const { PdfQuotaBadge } = await import('../ui/components/pdfQuotaBadge.js');
    getUser.mockRejectedValueOnce(new Error('offline'));

    const result = await PdfQuotaBadge.refresh();

    expect(result).toBeNull();
    expect(document.getElementById('pdf-quota-badge')).toBeNull();
  });

  it('is idempotent — calling refresh twice replaces the badge', async () => {
    const { PdfQuotaBadge } = await import('../ui/components/pdfQuotaBadge.js');
    getUser.mockResolvedValue({ id: 'u1' });
    fetchMyProfileBilling.mockResolvedValue({
      profile: { id: 'u1', plan_code: 'free' },
    });
    getEffectivePlan.mockReturnValue('free');
    getMonthlyLimitForPlan.mockReturnValue(5);
    getMonthlyUsageSnapshot
      .mockResolvedValueOnce({ pdf_export: 1 })
      .mockResolvedValueOnce({ pdf_export: 2 });

    await PdfQuotaBadge.refresh();
    await PdfQuotaBadge.refresh();

    const badges = document.querySelectorAll('#pdf-quota-badge');
    expect(badges).toHaveLength(1);
    expect(badges[0].textContent).toBe('2/5 PDFs este mês · restam 3 (Free)');
  });

  it('remove() clears the badge from DOM', async () => {
    const { PdfQuotaBadge } = await import('../ui/components/pdfQuotaBadge.js');
    getUser.mockResolvedValueOnce({ id: 'u1' });
    fetchMyProfileBilling.mockResolvedValueOnce({
      profile: { id: 'u1', plan_code: 'free' },
    });
    getEffectivePlan.mockReturnValueOnce('free');
    getMonthlyLimitForPlan.mockReturnValueOnce(5);
    getMonthlyUsageSnapshot.mockResolvedValueOnce({ pdf_export: 1 });

    await PdfQuotaBadge.refresh();
    expect(document.getElementById('pdf-quota-badge')).not.toBeNull();

    PdfQuotaBadge.remove();
    expect(document.getElementById('pdf-quota-badge')).toBeNull();
  });
});
