import { on } from '../../../core/events.js';
import { CustomConfirm } from '../../../core/modal.js';
import { ErrorCodes, handleError } from '../../../core/errors.js';
import { saveRegistro, clearRegistro, applyQuickTemplate } from '../../views/registro.js';
import { deleteReg } from '../../views/historico.js';
import { runAsyncAction } from '../../components/actionFeedback.js';

export function bindRegistroHandlers() {
  on('save-registro', async (el) => {
    try {
      await runAsyncAction(el, { loadingLabel: 'Salvando...' }, async () => {
        const saved = await saveRegistro();
        if (!saved) return;
      });
    } catch (error) {
      handleError(error, {
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Não foi possível salvar o registro.',
        context: { action: 'controller.save-registro' },
      });
    }
  });
  on('clear-registro', () => clearRegistro());
  on('quick-service-template', (el) => applyQuickTemplate(el.dataset.template, el));

  on('delete-reg', async (el) => {
    try {
      const ok = await CustomConfirm.show(
        'Excluir Registro',
        'Este registro sera removido do historico e pode alterar o status atual do equipamento.',
        {
          confirmLabel: 'Excluir registro',
          cancelLabel: 'Cancelar',
          tone: 'danger',
        },
      );
      if (ok) await Promise.resolve(deleteReg(el.dataset.id));
    } catch (error) {
      handleError(error, {
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Não foi possível confirmar a exclusao do registro.',
        context: { action: 'controller.delete-reg', id: el.dataset.id },
      });
    }
  });
}
