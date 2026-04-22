import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

  it('renderiza dois CTAs: Gerar PDF + WhatsApp', async () => {
    const { PostSaveRegistroToast } = await import('../ui/components/postSaveRegistroToast.js');
    PostSaveRegistroToast.show({ equipId: 'eq-42', equipName: 'Fan coil' });

    const actions = document.querySelectorAll('.share-success-toast__action');
    expect(actions.length).toBe(2);
    expect(actions[0].textContent).toMatch(/Gerar PDF/i);
    expect(actions[1].textContent).toMatch(/WhatsApp/i);
  });

  it('CTA PDF: executa callback onAction com equipId', async () => {
    const { PostSaveRegistroToast } = await import('../ui/components/postSaveRegistroToast.js');
    const onAction = vi.fn().mockResolvedValue(true);
    PostSaveRegistroToast.show({ equipId: 'eq-42', equipName: 'Split 3', onAction });

    const pdfBtn = document.querySelector('.share-success-toast__action--pdf');
    await pdfBtn.click();

    expect(trackEvent).toHaveBeenCalledWith('post_save_export_cta_clicked', { destination: 'pdf' });
    expect(onAction).toHaveBeenCalledWith({ destination: 'pdf', equipId: 'eq-42' });
    expect(goTo).not.toHaveBeenCalled();
  });

  it('CTA WhatsApp: executa callback onAction com equipId', async () => {
    const { PostSaveRegistroToast } = await import('../ui/components/postSaveRegistroToast.js');
    const onAction = vi.fn().mockResolvedValue(true);
    PostSaveRegistroToast.show({ equipId: 'eq-99', equipName: 'Câmara fria', onAction });

    const whatsBtn = document.querySelector('.share-success-toast__action--whatsapp');
    await whatsBtn.click();

    expect(trackEvent).toHaveBeenCalledWith('post_save_export_cta_clicked', {
      destination: 'whatsapp',
    });
    expect(onAction).toHaveBeenCalledWith({ destination: 'whatsapp', equipId: 'eq-99' });
    expect(goTo).not.toHaveBeenCalled();
  });

  it('mantém toast aberto quando ação não conclui (onAction retorna false)', async () => {
    const { PostSaveRegistroToast } = await import('../ui/components/postSaveRegistroToast.js');
    const onAction = vi.fn().mockResolvedValue(false);
    PostSaveRegistroToast.show({ equipId: 'eq-42', equipName: 'Split 3', onAction });

    const pdfBtn = document.querySelector('.share-success-toast__action--pdf');
    await pdfBtn.click();

    expect(document.querySelector('.share-success-toast')).toBeTruthy();
    expect(pdfBtn.disabled).toBe(false);
  });

  it('fallback customizado: em erro, chama onFallback injetado', async () => {
    const { PostSaveRegistroToast } = await import('../ui/components/postSaveRegistroToast.js');
    const onAction = vi.fn().mockRejectedValue(new Error('boom'));
    const onFallback = vi.fn();
    PostSaveRegistroToast.show({ equipId: 'eq-42', equipName: 'Split 3', onAction, onFallback });

    const pdfBtn = document.querySelector('.share-success-toast__action--pdf');
    await pdfBtn.click();

    expect(onFallback).toHaveBeenCalledWith({ destination: 'pdf', equipId: 'eq-42' });
  });

  it('fallback padrão: em erro, navega para relatório manual', async () => {
    const { PostSaveRegistroToast } = await import('../ui/components/postSaveRegistroToast.js');
    const onAction = vi.fn().mockRejectedValue(new Error('boom'));
    PostSaveRegistroToast.show({ equipId: 'eq-42', equipName: 'Split 3', onAction });

    const pdfBtn = document.querySelector('.share-success-toast__action--pdf');
    await pdfBtn.click();

    expect(goTo).toHaveBeenCalledWith('relatorio', { equipId: 'eq-42', intent: 'pdf' });
  });
});
