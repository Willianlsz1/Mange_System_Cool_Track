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
  openEditSetor,
  clearSetorEditingState,
} from '../../views/equipamentos.js';
import { runAsyncAction } from '../../components/actionFeedback.js';

/**
 * Kebab menu do card de setor — controla estado de abertura dos dropdowns.
 * Design: só um menu pode estar aberto por vez. Clique fora ou Esc fecha.
 */
let openSetorMenuId = null;

function closeAllSetorMenus() {
  if (!openSetorMenuId) return;
  const menu = document.getElementById(`setor-menu-${openSetorMenuId}`);
  const kebab = document.querySelector(`.setor-card__kebab[data-id="${openSetorMenuId}"]`);
  if (menu) menu.hidden = true;
  if (kebab) kebab.setAttribute('aria-expanded', 'false');
  openSetorMenuId = null;
}

function toggleSetorMenu(id) {
  if (openSetorMenuId === id) {
    closeAllSetorMenus();
    return;
  }
  // Fecha o que estava aberto antes de abrir o novo
  closeAllSetorMenus();
  const menu = document.getElementById(`setor-menu-${id}`);
  const kebab = document.querySelector(`.setor-card__kebab[data-id="${id}"]`);
  if (!menu || !kebab) return;
  menu.hidden = false;
  kebab.setAttribute('aria-expanded', 'true');
  openSetorMenuId = id;
}

export function bindEquipmentHandlers() {
  // Listeners globais (só uma vez) pra fechar o kebab dropdown ao
  // clicar fora, pressionar Esc ou mudar de rota.
  if (typeof document !== 'undefined' && !document.body.dataset.setorKebabBound) {
    document.body.dataset.setorKebabBound = '1';

    document.addEventListener('click', (e) => {
      if (!openSetorMenuId) return;
      const insideKebab = e.target.closest('.setor-card__kebab');
      const insideMenu = e.target.closest('.setor-card__menu');
      if (insideKebab || insideMenu) return;
      closeAllSetorMenus();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && openSetorMenuId) {
        closeAllSetorMenus();
        // Devolve foco pro kebab pra não perder contexto
        const kebab = document.querySelector(`.setor-card__kebab[data-id="${openSetorMenuId}"]`);
        kebab?.focus?.();
      }
    });

    document.addEventListener('app:route-changed', closeAllSetorMenus);
  }

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

  on('toggle-setor-menu', (el, event) => {
    event?.stopPropagation?.(); // evita drill-down do setor ao clicar no kebab
    toggleSetorMenu(el.dataset.id);
  });

  on('delete-setor', async (el, event) => {
    event?.stopPropagation?.(); // evita abrir o setor ao clicar em excluir
    closeAllSetorMenus(); // fecha o kebab antes de abrir o confirm
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

  on('edit-setor', async (el, event) => {
    event?.stopPropagation?.(); // evita drill-down do setor ao clicar em editar
    closeAllSetorMenus(); // fecha o kebab antes de abrir o modal de edição
    try {
      openEditSetor(el.dataset.id);
      initSetorColorPicker();
    } catch (error) {
      handleError(error, {
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Não foi possível abrir a edição do setor.',
        context: { action: 'controller.edit-setor', id: el.dataset.id },
      });
    }
  });

  // Abre modal de criar setor e inicializa color picker
  on('open-setor-modal', async () => {
    try {
      // Garante que não estamos em modo edição quando clicar em "+ Novo setor"
      clearSetorEditingState();
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
