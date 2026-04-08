import { on } from '../../../core/events.js';
import { CustomConfirm } from '../../../core/modal.js';
import { ErrorCodes, handleError } from '../../../core/errors.js';
import { saveEquip, viewEquip, deleteEquip } from '../../views/equipamentos.js';
import { runAsyncAction } from '../../components/actionFeedback.js';

export function bindEquipmentHandlers() {
  on('save-equip', async (el) => {
    try {
      await runAsyncAction(el, { loadingLabel: 'Salvando...' }, () => saveEquip());
    } catch (error) {
      handleError(error, {
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Nao foi possivel salvar o equipamento.',
        context: { action: 'controller.save-equip' },
      });
    }
  });

  on('view-equip', async (el) => {
    try {
      await viewEquip(el.dataset.id);
    } catch (error) {
      handleError(error, {
        code: ErrorCodes.NETWORK_ERROR,
        message: 'Nao foi possivel abrir o equipamento selecionado.',
        context: { action: 'controller.view-equip', id: el.dataset.id },
      });
    }
  });

  on('delete-equip', async (el) => {
    try {
      const ok = await CustomConfirm.show(
        'Excluir Equipamento',
        'Isso remove o equipamento e todo o historico vinculado. Essa acao nao pode ser desfeita.',
        {
          confirmLabel: 'Excluir equipamento',
          cancelLabel: 'Manter equipamento',
          tone: 'danger',
        },
      );
      if (ok) await deleteEquip(el.dataset.id);
    } catch (error) {
      handleError(error, {
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Nao foi possivel confirmar a exclusao do equipamento.',
        context: { action: 'controller.delete-equip', id: el.dataset.id },
      });
    }
  });
}
