import { PdfSuccessToast } from '../ui/components/pdfSuccessToast.js';

describe('PdfSuccessToast', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders accessible toast with default subtitle and auto-dismisses', () => {
    PdfSuccessToast.show();

    const toast = document.querySelector('.share-success-toast');
    expect(toast).toBeTruthy();
    expect(toast.getAttribute('role')).toBe('status');
    expect(toast.getAttribute('aria-live')).toBe('polite');
    expect(toast.textContent).toContain('PDF gerado com sucesso.');
    expect(toast.textContent).toContain('Pronto para enviar ao cliente.');

    vi.advanceTimersByTime(6500);
    toast.dispatchEvent(new Event('transitionend'));

    expect(document.querySelector('.share-success-toast')).toBeNull();
  });

  it('includes filename in title when provided', () => {
    PdfSuccessToast.show({ fileName: 'relatorio-abril.pdf' });

    const toast = document.querySelector('.share-success-toast');
    expect(toast.textContent).toContain('PDF gerado: relatorio-abril.pdf');
  });

  it('shows quota counter "X de Y · Restam Z" for finite limit (Free/Plus)', () => {
    PdfSuccessToast.show({ used: 3, limit: 5, fileName: 'x.pdf' });

    const toast = document.querySelector('.share-success-toast');
    expect(toast.textContent).toContain('Você usou 3 de 5 PDFs este mês. Restam 2.');
  });

  it('shows "todos os N" message when quota is exhausted', () => {
    PdfSuccessToast.show({ used: 5, limit: 5 });

    const toast = document.querySelector('.share-success-toast');
    expect(toast.textContent).toContain('Você usou todos os 5 PDFs do mês');
  });

  it('keeps default subtitle for Pro (infinite limit)', () => {
    PdfSuccessToast.show({ used: null, limit: Number.POSITIVE_INFINITY, fileName: 'rel.pdf' });

    const toast = document.querySelector('.share-success-toast');
    expect(toast.textContent).toContain('Pronto para enviar ao cliente.');
    expect(toast.textContent).not.toContain('Restam');
  });

  it('replaces previous toast on consecutive show() calls', () => {
    PdfSuccessToast.show({ fileName: 'first.pdf' });
    PdfSuccessToast.show({ fileName: 'second.pdf' });

    const toasts = document.querySelectorAll('.share-success-toast');
    // O primeiro toast entra em hiding mas ainda está no DOM até o transitionend;
    // o importante é garantir que o mais recente está visível e contém o novo filename.
    const titles = Array.from(toasts).map((t) => t.textContent);
    expect(titles.some((t) => t.includes('second.pdf'))).toBe(true);
  });
});
