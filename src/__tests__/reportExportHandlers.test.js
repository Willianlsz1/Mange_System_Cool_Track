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

describe('reportExportHandlers', () => {
  beforeEach(async () => {
    handlers.clear();
    vi.clearAllMocks();
    localStorage.clear();
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
        preview: expect.objectContaining({ title: 'Prévia do relatório' }),
      }),
    );
    expect(trackEvent).toHaveBeenCalledWith('pdf_export_blocked', { reason: 'guest' });
  });

  it('allows authenticated free users to export PDF under monthly limit', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-15T12:00:00Z'));
    getUser.mockResolvedValueOnce({ id: 'u1' });
    generateMaintenanceReport.mockResolvedValueOnce('relatorio.pdf');
    localStorage.setItem('cooltrack-plan', 'free');

    await handlers.get('export-pdf')({});

    expect(generateMaintenanceReport).toHaveBeenCalledTimes(1);
    expect(success).toHaveBeenCalledWith('PDF gerado: relatorio.pdf');
    expect(localStorage.getItem('cooltrack-pdf-count-2026-04')).toBe('1');
    vi.useRealTimers();
  });

  it('blocks whatsapp share for free users above monthly limit', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-15T12:00:00Z'));
    getUser.mockResolvedValue({ id: 'u1' });
    localStorage.setItem('cooltrack-plan', 'free');
    localStorage.setItem('cooltrack-whatsapp-count-2026-04', '10');

    await handlers.get('whatsapp-export')({});

    expect(send).not.toHaveBeenCalled();
    expect(open).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'limit_whatsapp',
        source: 'whatsapp_share_limit',
      }),
    );
    expect(trackEvent).toHaveBeenCalledWith('whatsapp_share_blocked', { reason: 'limit_reached' });
    vi.useRealTimers();
  });
});
