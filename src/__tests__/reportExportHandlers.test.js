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

// Guest conversion modal foi removido quando o modo demo/guest saiu.
// Os fluxos de limite agora usam Toast.warning + goTo('pricing').

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
vi.mock('../core/plans/monetization.js', () => ({
  fetchMyProfileBilling,
}));

const getPlanCodeForUserId = vi.fn();
const getEffectivePlan = vi.fn();
vi.mock('../core/plans/subscriptionPlans.js', () => ({
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

vi.mock('../core/modal.js', () => ({
  Modal: { open: vi.fn(), close: vi.fn() },
}));

const goTo = vi.fn();
vi.mock('../core/router.js', () => ({
  goTo,
  currentRoute: vi.fn(),
  currentRouteParams: vi.fn(() => ({})),
  registerRoute: vi.fn(),
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
        if (planCode === 'free') return Number.POSITIVE_INFINITY;
        if (planCode === 'plus') return 120;
        return Number.POSITIVE_INFINITY;
      }
      if (resource === 'whatsapp_share') {
        if (planCode === 'free') return 5;
        if (planCode === 'plus') return 60;
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

  it('blocks PDF when there is no authenticated user (defensive)', async () => {
    getUser.mockResolvedValueOnce(null);

    await handlers.get('export-pdf')({});

    expect(generateMaintenanceReport).not.toHaveBeenCalled();
    expect(warning).toHaveBeenCalledWith(expect.stringMatching(/login/i));
    expect(trackEvent).toHaveBeenCalledWith('pdf_export_blocked', {
      reason: 'not_authenticated',
    });
  });

  it('buildReportFilters preserva registroId para fluxo pós-save', async () => {
    const { buildReportFilters } =
      await import('../ui/controller/handlers/reportExportHandlers.js');
    expect(
      buildReportFilters({
        registroId: 'reg-1',
        equipId: 'eq-2',
      }),
    ).toEqual({
      registroId: 'reg-1',
      filtEq: 'eq-2',
      de: '',
      ate: '',
    });
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
    expect(incrementMonthlyUsage).not.toHaveBeenCalledWith('u1', 'pdf_export');
    expect(pdfToastShow).toHaveBeenCalledWith(
      expect.objectContaining({ fileName: 'relatorio.pdf' }),
    );
    expect(pdfToastShow.mock.calls[0][0]).not.toHaveProperty('used');
    expect(pdfBadgeRefresh).toHaveBeenCalled();
  });

  it('blocks Free users once they hit the monthly PDF quota with Plus/Pro nudge', async () => {
    getUser.mockResolvedValueOnce({ id: 'u1' });
    hasReachedMonthlyLimit.mockImplementation(({ resource }) => resource === 'pdf_export');

    await handlers.get('export-pdf')({});

    expect(generateMaintenanceReport).not.toHaveBeenCalled();
    // Sem GuestConversionModal — agora mostra Toast com nudge pra Plus/Pro
    expect(warning).toHaveBeenCalled();
    const toastMsg = warning.mock.calls[warning.mock.calls.length - 1][0];
    expect(toastMsg).toMatch(/Plus/);
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

  it('print: handler não está mais registrado (botão Imprimir foi removido)', () => {
    // Regressão guard: se alguém trouxer o botão de volta sem pensar no
    // fluxo anti-bypass, este teste quebra e lembra da decisão de design.
    expect(handlers.has('print')).toBe(false);
  });

  it('whatsapp: abre wa.me diretamente com texto pronto e consome quota', async () => {
    getUser.mockResolvedValue({ id: 'u1' });
    send.mockReturnValue(true);

    await handlers.get('whatsapp-export')({});

    expect(send).toHaveBeenCalledTimes(1);
    expect(incrementMonthlyUsage).toHaveBeenCalledWith('u1', 'whatsapp_share');
    expect(show).toHaveBeenCalled();
  });

  it('blocks whatsapp share for free users above monthly limit', async () => {
    getUser.mockResolvedValue({ id: 'u1' });
    hasReachedMonthlyLimit.mockImplementation(({ resource }) => resource === 'whatsapp_share');

    await handlers.get('whatsapp-export')({});

    expect(send).not.toHaveBeenCalled();
    // Sem GuestConversionModal — Toast.warning + goTo('pricing')
    expect(warning).toHaveBeenCalled();
    expect(trackEvent).toHaveBeenCalledWith(
      'whatsapp_share_blocked',
      expect.objectContaining({ reason: 'limit_reached' }),
    );
    expect(incrementMonthlyUsage).not.toHaveBeenCalledWith('u1', 'whatsapp_share');
  });
});
