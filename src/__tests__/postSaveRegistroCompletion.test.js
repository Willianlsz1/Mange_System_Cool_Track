import { describe, it, expect, vi, beforeEach } from 'vitest';

const attachDialogA11yMock = vi.fn(() => vi.fn());

vi.mock('../core/modal.js', () => ({
  attachDialogA11y: (...args) => attachDialogA11yMock(...args),
}));

describe('PostSaveRegistroCompletion', () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = '';
    attachDialogA11yMock.mockClear();
  });

  it('renderiza resumo e executa ação principal', async () => {
    const onWhatsapp = vi.fn();
    const { PostSaveRegistroCompletion } =
      await import('../ui/components/postSaveRegistroCompletion.js');

    PostSaveRegistroCompletion.show({
      equipName: 'Split recepção',
      statusLabel: 'Operando normalmente',
      nextMaintenance: '2026-05-20',
      onWhatsapp,
      onDownloadPdf: vi.fn(),
      onViewReport: vi.fn(),
      onClose: vi.fn(),
    });

    expect(document.body.textContent).toContain('Serviço salvo com sucesso');
    expect(document.body.textContent).toContain('Split recepção');
    expect(document.body.textContent).toContain('PDF pronto para envio');

    const actionBtn = Array.from(document.querySelectorAll('button')).find(
      (btn) => btn.textContent === 'Enviar PDF no WhatsApp',
    );
    actionBtn.click();

    expect(onWhatsapp).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.modal-overlay')).toBeNull();
  });

  it('fecha no clique do overlay e chama onClose', async () => {
    const onClose = vi.fn();
    const { PostSaveRegistroCompletion } =
      await import('../ui/components/postSaveRegistroCompletion.js');

    const overlay = PostSaveRegistroCompletion.show({
      equipName: 'Split recepção',
      statusLabel: 'Operando normalmente',
      nextMaintenance: '',
      onWhatsapp: vi.fn(),
      onDownloadPdf: vi.fn(),
      onViewReport: vi.fn(),
      onClose,
    });

    overlay.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
