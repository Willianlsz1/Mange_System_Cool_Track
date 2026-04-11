import { on } from '../../../core/events.js';
import { CustomConfirm } from '../../../core/modal.js';
import { ErrorCodes, handleError } from '../../../core/errors.js';
import { GuestTracker } from '../../../core/guestTracker.js';
import { saveEquip, viewEquip, deleteEquip } from '../../views/equipamentos.js';
import { runAsyncAction } from '../../components/actionFeedback.js';

export function bindEquipmentHandlers() {
  on('save-equip', async (el) => {
    try {
      await runAsyncAction(el, { loadingLabel: 'Salvando...' }, async () => {
        const saved = await saveEquip();
        if (!saved) return;
        GuestTracker.increment();
        if (GuestTracker.isGuest() && GuestTracker.shouldShowCta()) {
          const { GuestCtaModal } = await import('../../components/onboarding/guestCtaModal.js');
          setTimeout(() => GuestCtaModal.open(), 800);
        }
      });
    } catch (error) {
      handleError(error, {
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Não foi possível salvar o equipamento.',
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
        message: 'Não foi possível abrir o equipamento selecionado.',
        context: { action: 'controller.view-equip', id: el.dataset.id },
      });
    }
  });

  on('delete-equip', async (el) => {
    try {
      const ok = await CustomConfirm.show(
        'Excluir Equipamento',
        'Isso remove o equipamento e todo o historico vinculado. Essa acao não pode ser desfeita.',
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
        message: 'Não foi possível confirmar a exclusao do equipamento.',
        context: { action: 'controller.delete-equip', id: el.dataset.id },
      });
    }
  });
}
