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

const getPlanCodeForUserId = vi.fn();
vi.mock('../core/subscriptionPlans.js', () => ({
  getPlanCodeForUserId,
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
    getMonthlyUsageSnapshot.mockResolvedValue({
      monthStart: '2026-04-01',
      pdf_export: 0,
      whatsapp_share: 0,
    });
    getMonthlyLimitForPlan.mockImplementation((_planCode, resource) =>
      resource === 'pdf_export' ? 3 : 10,
    );
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

  it('allows authenticated free users to export PDF under monthly limit', async () => {
    getUser.mockResolvedValueOnce({ id: 'u1' });
    generateMaintenanceReport.mockResolvedValueOnce('relatorio.pdf');

    await handlers.get('export-pdf')({});

    expect(getPlanCodeForUserId).toHaveBeenCalledWith('u1');
    expect(getMonthlyUsageSnapshot).toHaveBeenCalledWith('u1');
    expect(generateMaintenanceReport).toHaveBeenCalledTimes(1);
    expect(success).toHaveBeenCalledWith('PDF gerado: relatorio.pdf');
    expect(incrementMonthlyUsage).toHaveBeenCalledWith('u1', 'pdf_export');
    expect(localStorage.getItem('cooltrack-plan')).toBeNull();
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
    expect(trackEvent).toHaveBeenCalledWith('whatsapp_share_blocked', { reason: 'limit_reached' });
    expect(incrementMonthlyUsage).not.toHaveBeenCalledWith('u1', 'whatsapp_share');
  });
});
