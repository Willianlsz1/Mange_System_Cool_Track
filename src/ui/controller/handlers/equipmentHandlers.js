import { on } from '../../../core/events.js';
import { CustomConfirm } from '../../../core/modal.js';
import { ErrorCodes, handleError } from '../../../core/errors.js';
import { GuestTracker } from '../../../core/guestTracker.js';
import {
  saveEquip,
  viewEquip,
  deleteEquip,
  openEditEquip,
  saveSetor,
  deleteSetor,
  setActiveSector,
  initSetorColorPicker,
} from '../../views/equipamentos.js';
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

  on('edit-equip', async (el) => {
    try {
      await openEditEquip(el.dataset.id);
    } catch (error) {
      handleError(error, {
        code: ErrorCodes.NETWORK_ERROR,
        message: 'Não foi possível abrir a edição do equipamento.',
        context: { action: 'controller.edit-equip', id: el.dataset.id },
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

  // ── Setores (PRO) ──────────────────────────────────────────────────────────

  on('open-setor', (el) => {
    setActiveSector(el.dataset.id);
  });

  on('back-to-setores', () => {
    setActiveSector(null);
  });

  on('save-setor', async (el) => {
    try {
      await runAsyncAction(el, { loadingLabel: 'Salvando...' }, async () => {
        await saveSetor();
      });
    } catch (error) {
      handleError(error, {
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Não foi possível salvar o setor.',
        context: { action: 'controller.save-setor' },
      });
    }
  });

  on('delete-setor', async (el, event) => {
    event?.stopPropagation?.(); // evita abrir o setor ao clicar em excluir
    try {
      const ok = await CustomConfirm.show(
        'Excluir Setor',
        'Os equipamentos deste setor serão movidos para "Sem setor". Esta ação não pode ser desfeita.',
        { confirmLabel: 'Excluir setor', cancelLabel: 'Cancelar', tone: 'danger' },
      );
      if (ok) await deleteSetor(el.dataset.id);
    } catch (error) {
      handleError(error, {
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Não foi possível excluir o setor.',
        context: { action: 'controller.delete-setor', id: el.dataset.id },
      });
    }
  });

  // Abre modal de criar setor e inicializa color picker
  on('open-setor-modal', async () => {
    try {
      const { Modal: M } = await import('../../../core/modal.js');
      M.open('modal-add-setor');
      initSetorColorPicker();
    } catch (error) {
      handleError(error, {
        code: ErrorCodes.NETWORK_ERROR,
        message: 'Não foi possível abrir o modal de setor.',
        context: { action: 'controller.open-setor-modal' },
      });
    }
  });
}
