import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ───────────────────────────────────────────────────────────────────
// router.goTo e trackEvent são os dois side-effects que o toast dispara.
// Mockamos pra poder assertar payload e não navegar de verdade no jsdom.
const goTo = vi.fn();
vi.mock('../core/router.js', () => ({
  goTo,
  registerRoute: vi.fn(),
}));

const trackEvent = vi.fn();
vi.mock('../core/telemetry.js', () => ({
  trackEvent,
}));

beforeEach(() => {
  document.body.innerHTML = '';
  vi.useFakeTimers();
  goTo.mockClear();
  trackEvent.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('PostSaveRegistroToast', () => {
  it('não renderiza quando equipId está ausente (sem CTAs válidos)', async () => {
    const { PostSaveRegistroToast } = await import('../ui/components/postSaveRegistroToast.js');
    const result = PostSaveRegistroToast.show({ equipName: 'Split 3' });
    expect(result).toBeNull();
    expect(document.querySelector('.share-success-toast')).toBeNull();
  });

  it('renderiza com título personalizado quando equipName é fornecido', async () => {
    const { PostSaveRegistroToast } = await import('../ui/components/postSaveRegistroToast.js');
    PostSaveRegistroToast.show({ equipId: 'eq-42', equipName: 'Split 3' });

    const toast = document.querySelector('.share-success-toast');
    expect(toast).toBeTruthy();
    expect(toast.classList.contains('share-success-toast--with-actions')).toBe(true);
    expect(toast.getAttribute('role')).toBe('status');
    expect(toast.getAttribute('aria-live')).toBe('polite');
    expect(toast.textContent).toContain('Serviço registrado em Split 3');
    expect(toast.textContent).toContain('Mandar o relatório pro cliente?');
  });

  it('cai no título genérico quando equipName é null mas equipId existe', async () => {
    const { PostSaveRegistroToast } = await import('../ui/components/postSaveRegistroToast.js');
    PostSaveRegistroToast.show({ equipId: 'eq-42', equipName: null });

    const toast = document.querySelector('.share-success-toast');
    expect(toast).toBeTruthy();
    expect(toast.textContent).toContain('Serviço registrado com sucesso.');
  });

  it('renderiza dois CTAs: Gerar PDF (primary) + WhatsApp (outline)', async () => {
    const { PostSaveRegistroToast } = await import('../ui/components/postSaveRegistroToast.js');
    PostSaveRegistroToast.show({ equipId: 'eq-42', equipName: 'Fan coil' });

    const actions = document.querySelectorAll('.share-success-toast__action');
    expect(actions.length).toBe(2);

    const pdfBtn = document.querySelector('.share-success-toast__action--pdf');
    const whatsBtn = document.querySelector('.share-success-toast__action--whatsapp');
    expect(pdfBtn).toBeTruthy();
    expect(whatsBtn).toBeTruthy();
    expect(pdfBtn.textContent).toMatch(/Gerar PDF/i);
    expect(whatsBtn.textContent).toMatch(/WhatsApp/i);
    expect(pdfBtn.dataset.destination).toBe('pdf');
    expect(whatsBtn.dataset.destination).toBe('whatsapp');
  });

  it('CTA PDF: dispara telemetria com destination=pdf e navega pra relatório pré-filtrado', async () => {
    const { PostSaveRegistroToast } = await import('../ui/components/postSaveRegistroToast.js');
    PostSaveRegistroToast.show({ equipId: 'eq-42', equipName: 'Split 3' });

    const pdfBtn = document.querySelector('.share-success-toast__action--pdf');
    pdfBtn.click();

    expect(trackEvent).toHaveBeenCalledWith('post_save_export_cta_clicked', {
      destination: 'pdf',
    });
    expect(goTo).toHaveBeenCalledWith('relatorio', {
      equipId: 'eq-42',
      intent: 'pdf',
    });
  });

  it('CTA WhatsApp: dispara telemetria com destination=whatsapp e navega pra relatório pré-filtrado', async () => {
    const { PostSaveRegistroToast } = await import('../ui/components/postSaveRegistroToast.js');
    PostSaveRegistroToast.show({ equipId: 'eq-99', equipName: 'Câmara fria' });

    const whatsBtn = document.querySelector('.share-success-toast__action--whatsapp');
    whatsBtn.click();

    expect(trackEvent).toHaveBeenCalledWith('post_save_export_cta_clicked', {
      destination: 'whatsapp',
    });
    expect(goTo).toHaveBeenCalledWith('relatorio', {
      equipId: 'eq-99',
      intent: 'whatsapp',
    });
  });

  it('dismissa automaticamente depois do timeout padrão (8s)', async () => {
    const { PostSaveRegistroToast } = await import('../ui/components/postSaveRegistroToast.js');
    PostSaveRegistroToast.show({ equipId: 'eq-42', equipName: 'Split 3' });

    // Antes de 8s: toast ainda está lá
    vi.advanceTimersByTime(7000);
    expect(document.querySelector('.share-success-toast')).toBeTruthy();

    // Depois de 8s: inicia transição de saída
    vi.advanceTimersByTime(1500);
    const toast = document.querySelector('.share-success-toast');
    expect(toast.classList.contains('share-success-toast--hiding')).toBe(true);

    // Transition end remove do DOM
    toast.dispatchEvent(new Event('transitionend'));
    expect(document.querySelector('.share-success-toast')).toBeNull();
  });

  it('dismissa imediatamente após clique em CTA (não espera timeout)', async () => {
    const { PostSaveRegistroToast } = await import('../ui/components/postSaveRegistroToast.js');
    PostSaveRegistroToast.show({ equipId: 'eq-42', equipName: 'Split 3' });

    const pdfBtn = document.querySelector('.share-success-toast__action--pdf');
    pdfBtn.click();

    const toast = document.querySelector('.share-success-toast');
    expect(toast.classList.contains('share-success-toast--hiding')).toBe(true);
  });

  it('substitui toast anterior em show() consecutivo', async () => {
    const { PostSaveRegistroToast } = await import('../ui/components/postSaveRegistroToast.js');
    PostSaveRegistroToast.show({ equipId: 'eq-1', equipName: 'Primeiro' });
    PostSaveRegistroToast.show({ equipId: 'eq-2', equipName: 'Segundo' });

    const toasts = document.querySelectorAll('.share-success-toast');
    const titles = Array.from(toasts).map((t) => t.textContent);
    expect(titles.some((t) => t.includes('Segundo'))).toBe(true);
  });

  it('respeita dismissMs customizado', async () => {
    const { PostSaveRegistroToast } = await import('../ui/components/postSaveRegistroToast.js');
    PostSaveRegistroToast.show({
      equipId: 'eq-42',
      equipName: 'Split 3',
      dismissMs: 2000,
    });

    vi.advanceTimersByTime(1500);
    expect(
      document
        .querySelector('.share-success-toast')
        .classList.contains('share-success-toast--hiding'),
    ).toBe(false);

    vi.advanceTimersByTime(700);
    expect(
      document
        .querySelector('.share-success-toast')
        .classList.contains('share-success-toast--hiding'),
    ).toBe(true);
  });
});
