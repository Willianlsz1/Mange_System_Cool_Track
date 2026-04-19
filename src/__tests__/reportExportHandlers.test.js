import { beforeEach, describe, expect, it, vi } from 'vitest';

const handlers = new Map();

vi.mock('../core/events.js', () => ({
  on: vi.fn((action, handler) => {
    handlers.set(action, handler);
  }),
}));

const runAsyncAction = vi.fn(async (_el, _opts, fn) => fn());
vi.mock('../ui/components/actionFeedback.js', () => ({
  runAsyncAction,
}));

const getUser = vi.fn();
vi.mock('../core/auth.js', () => ({
  Auth: { getUser },
}));

const generateMaintenanceReport = vi.fn();
vi.mock('../domain/pdf.js', () => ({
  PDFGenerator: { generateMaintenanceReport },
}));

const send = vi.fn();
vi.mock('../domain/whatsapp.js', () => ({
  WhatsAppExport: { send },
}));

const open = vi.fn();
vi.mock('../ui/components/guestConversionModal.js', () => ({
  GuestConversionModal: { open },
}));

const trackEvent = vi.fn();
vi.mock('../core/telemetry.js', () => ({
  trackEvent,
}));

const success = vi.fn();
const error = vi.fn();
const warning = vi.fn();
vi.mock('../core/toast.js', () => ({
  Toast: { success, error, warning },
}));

const show = vi.fn();
vi.mock('../ui/components/shareSuccessToast.js', () => ({
  ShareSuccessToast: { show },
}));

const pdfToastShow = vi.fn();
vi.mock('../ui/components/pdfSuccessToast.js', () => ({
  PdfSuccessToast: { show: pdfToastShow },
}));

const pdfBadgeRefresh = vi.fn();
vi.mock('../ui/components/pdfQuotaBadge.js', () => ({
  PdfQuotaBadge: { refresh: pdfBadgeRefresh, remove: vi.fn() },
}));

const fetchMyProfileBilling = vi.fn();
vi.mock('../core/monetization.js', () => ({
  fetchMyProfileBilling,
}));

const getPlanCodeForUserId = vi.fn();
const getEffectivePlan = vi.fn();
vi.mock('../core/subscriptionPlans.js', () => ({
  getPlanCodeForUserId,
  getEffectivePlan,
  PLAN_CODE_FREE: 'free',
  PLAN_CODE_PLUS: 'plus',
  PLAN_CODE_PRO: 'pro',
}));

const getMonthlyUsageSnapshot = vi.fn();
const getMonthlyLimitForPlan = vi.fn();
const hasReachedMonthlyLimit = vi.fn();
const incrementMonthlyUsage = vi.fn();

vi.mock('../core/usageLimits.js', () => ({
  USAGE_RESOURCE_PDF_EXPORT: 'pdf_export',
  USAGE_RESOURCE_WHATSAPP_SHARE: 'whatsapp_share',
  getMonthlyUsageSnapshot,
  getMonthlyLimitForPlan,
  hasReachedMonthlyLimit,
  incrementMonthlyUsage,
}));

describe('reportExportHandlers', () => {
  beforeEach(async () => {
    handlers.clear();
    vi.clearAllMocks();
    localStorage.clear();

    getPlanCodeForUserId.mockResolvedValue('free');
    getEffectivePlan.mockReturnValue('free');

    fetchMyProfileBilling.mockResolvedValue({
      profile: { id: 'u1', plan_code: 'free', subscription_status: 'inactive', is_dev: false },
    });

    getMonthlyUsageSnapshot.mockResolvedValue({
      monthStart: '2026-04-01',
      pdf_export: 0,
      whatsapp_share: 0,
    });
    getMonthlyLimitForPlan.mockImplementation((planCode, resource) => {
      if (resource === 'pdf_export') {
        if (planCode === 'free') return 5;
        if (planCode === 'plus') return 100;
        return Number.POSITIVE_INFINITY;
      }
      if (resource === 'whatsapp_share') {
        if (planCode === 'free') return 10;
        if (planCode === 'plus') return 50;
        return Number.POSITIVE_INFINITY;
      }
      return Number.POSITIVE_INFINITY;
    });
    hasReachedMonthlyLimit.mockReturnValue(false);
    incrementMonthlyUsage.mockResolvedValue(1);

    document.body.innerHTML = `
      <select id="rel-equip"><option value="eq-1" selected>eq-1</option></select>
      <input id="rel-de" value="2026-04-01" />
      <input id="rel-ate" value="2026-04-30" />
    `;

    const mod = await import('../ui/controller/handlers/reportExportHandlers.js');
    mod.bindReportExportHandlers();
  });

  it('blocks PDF for guests and opens conversion modal with preview', async () => {
    getUser.mockResolvedValueOnce(null);

    await handlers.get('export-pdf')({});

    expect(generateMaintenanceReport).not.toHaveBeenCalled();
    expect(open).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'pdf_export_attempt',
        preview: expect.objectContaining({ title: 'Previa do relatorio' }),
      }),
    );
    expect(trackEvent).toHaveBeenCalledWith('pdf_export_blocked', { reason: 'guest' });
  });

  it('allows Free users under the monthly PDF quota and passes planCode to generator', async () => {
    getUser.mockResolvedValueOnce({ id: 'u1' });
    generateMaintenanceReport.mockResolvedValueOnce('relatorio.pdf');

    await handlers.get('export-pdf')({});

    expect(generateMaintenanceReport).toHaveBeenCalledTimes(1);
    // planCode passado como contexto pra o PDF aplicar marca d'água no Free
    expect(generateMaintenanceReport).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ planCode: 'free' }),
    );
    expect(incrementMonthlyUsage).toHaveBeenCalledWith('u1', 'pdf_export');
    expect(pdfToastShow).toHaveBeenCalledWith(
      expect.objectContaining({ fileName: 'relatorio.pdf', limit: 5, used: 1 }),
    );
    expect(pdfBadgeRefresh).toHaveBeenCalled();
  });

  it('blocks Free users once they hit the monthly PDF quota with Plus/Pro nudge', async () => {
    getUser.mockResolvedValueOnce({ id: 'u1' });
    hasReachedMonthlyLimit.mockImplementation(({ resource }) => resource === 'pdf_export');

    await handlers.get('export-pdf')({});

    expect(generateMaintenanceReport).not.toHaveBeenCalled();
    expect(open).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'limit_pdf',
        source: 'pdf_export_limit',
      }),
    );
    // Mensagem deve guiar Free → Plus/Pro, não "plano Plus" genérico
    const callArg = open.mock.calls[0][0];
    expect(callArg.message).toMatch(/Plus/);
  });

  it('allows authenticated Pro users to export PDF without incrementing quota', async () => {
    getUser.mockResolvedValueOnce({ id: 'u1' });
    getEffectivePlan.mockReturnValueOnce('pro');
    fetchMyProfileBilling.mockResolvedValueOnce({
      profile: { id: 'u1', plan: 'pro', subscription_status: 'active', is_dev: false },
    });
    generateMaintenanceReport.mockResolvedValueOnce('relatorio.pdf');

    await handlers.get('export-pdf')({});

    expect(generateMaintenanceReport).toHaveBeenCalledTimes(1);
    expect(generateMaintenanceReport).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ planCode: 'pro' }),
    );
    // Pro é ilimitado → não incrementa contagem
    expect(incrementMonthlyUsage).not.toHaveBeenCalled();
    // Pro não tem quota finita → toast sem contador
    expect(pdfToastShow).toHaveBeenCalledWith(
      expect.objectContaining({ fileName: 'relatorio.pdf' }),
    );
    expect(pdfToastShow.mock.calls[0][0]).not.toHaveProperty('used');
  });

  it('blocks whatsapp share for free users above monthly limit', async () => {
    getUser.mockResolvedValue({ id: 'u1' });
    hasReachedMonthlyLimit.mockImplementation(({ resource }) => resource === 'whatsapp_share');

    await handlers.get('whatsapp-export')({});

    expect(send).not.toHaveBeenCalled();
    expect(open).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'limit_whatsapp',
        source: 'whatsapp_share_limit',
      }),
    );
    expect(trackEvent).toHaveBeenCalledWith(
      'whatsapp_share_blocked',
      expect.objectContaining({ reason: 'limit_reached' }),
    );
    expect(incrementMonthlyUsage).not.toHaveBeenCalledWith('u1', 'whatsapp_share');
  });
});
