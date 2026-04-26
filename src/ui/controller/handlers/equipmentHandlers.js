import { on } from '../../../core/events.js';
import { CustomConfirm } from '../../../core/modal.js';
import { ErrorCodes, handleError } from '../../../core/errors.js';
import {
  saveEquip,
  viewEquip,
  deleteEquip,
  openEditEquip,
  openEquipPhotosEditor,
  saveEquipPhotos,
  saveSetor,
  deleteSetor,
  setActiveSector,
  setActiveQuickFilter,
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

// Seletor estável do kebab — agora ele é um __btn--icon com data-action.
// Usamos data-action pra evitar acoplar ao nome de classe visual.
const KEBAB_SELECTOR = '[data-action="toggle-setor-menu"]';

function kebabForId(id) {
  return document.querySelector(`${KEBAB_SELECTOR}[data-id="${id}"]`);
}

function closeAllSetorMenus() {
  if (!openSetorMenuId) return;
  const menu = document.getElementById(`setor-menu-${openSetorMenuId}`);
  const kebab = kebabForId(openSetorMenuId);
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
  const kebab = kebabForId(id);
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
      const insideKebab = e.target.closest(KEBAB_SELECTOR);
      const insideMenu = e.target.closest('.setor-card__menu');
      if (insideKebab || insideMenu) return;
      closeAllSetorMenus();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && openSetorMenuId) {
        closeAllSetorMenus();
        // Devolve foco pro kebab pra não perder contexto
        kebabForId(openSetorMenuId)?.focus?.();
      }
    });

    document.addEventListener('app:route-changed', closeAllSetorMenus);
  }

  on('save-equip', async (el) => {
    try {
      await runAsyncAction(el, { loadingLabel: 'Salvando...' }, async () => {
        const saved = await saveEquip();
        if (!saved) return;
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
      // focusField (opcional): permite triggers como "Adicionar TAG" abrir
      // o modal de edição já posicionados no input correspondente, com
      // highlight visual de 2s. Veja _focusEditField em equipamentos.js.
      const focusField = el.dataset.focusField || undefined;
      await openEditEquip(el.dataset.id, focusField ? { focusField } : undefined);
    } catch (error) {
      handleError(error, {
        code: ErrorCodes.NETWORK_ERROR,
        message: 'Não foi possível abrir a edição do equipamento.',
        context: {
          action: 'controller.edit-equip',
          id: el.dataset.id,
          focusField: el.dataset.focusField,
        },
      });
    }
  });

  // Toggle Lista ⇄ Grade da tela Equip. A lógica de aplicar a classe e
  // persistir em localStorage vive em `themeInitHelpers.setEquipViewMode`
  // (exposto via window.__setEquipViewMode pra ser único ponto de mudança).
  // Aqui só roteamos o click: previne warning "Sem handler" do delegator
  // global e padroniza o caminho data-action.
  on('equip-set-view-mode', (el) => {
    const mode = el.dataset.mode === 'grid' ? 'grid' : 'list';
    if (typeof window.__setEquipViewMode === 'function') {
      window.__setEquipViewMode(mode);
    }
  });

  // Kebab do footer do modal-eq-det — toggle do menu "Mais ações" que
  // esconde a ação destrutiva "Excluir" atrás de 1 clique extra. Tira a
  // lixeira vermelha sempre-visível que convidava click acidental.
  on('toggle-eq-detail-menu', (el) => {
    const id = el.dataset.id;
    if (!id) return;
    const menu = document.getElementById(`eq-detail-menu-${id}`);
    if (!menu) return;
    const isOpen = !menu.hidden;
    menu.hidden = isOpen;
    el.setAttribute('aria-expanded', String(!isOpen));
    if (!isOpen) {
      // Fecha ao clicar fora — listener one-shot montado quando abre.
      setTimeout(() => {
        const closeOnOutside = (e) => {
          if (!menu.contains(e.target) && !el.contains(e.target)) {
            menu.hidden = true;
            el.setAttribute('aria-expanded', 'false');
            document.removeEventListener('click', closeOnOutside);
          }
        };
        document.addEventListener('click', closeOnOutside);
      }, 0);
    }
  });

  // Abre o editor dedicado de fotos (modal-eq-photos) a partir do detail view.
  on('open-eq-photos-editor', async (el) => {
    try {
      await openEquipPhotosEditor(el.dataset.id);
    } catch (error) {
      handleError(error, {
        code: ErrorCodes.NETWORK_ERROR,
        message: 'Não foi possível abrir o editor de fotos.',
        context: { action: 'controller.open-eq-photos-editor', id: el.dataset.id },
      });
    }
  });

  on('save-eq-photos', async (el) => {
    try {
      await runAsyncAction(el, { loadingLabel: 'Salvando fotos...' }, async () => {
        await saveEquipPhotos();
      });
    } catch (error) {
      handleError(error, {
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Não foi possível salvar as fotos.',
        context: { action: 'controller.save-eq-photos' },
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

  // Quick filters do hero/chips — 'todos' limpa, outros setam o filtro ativo.
  on('equip-quickfilter', (el) => {
    const id = el.dataset.id || 'todos';
    setActiveQuickFilter(id === 'todos' ? null : id);
  });

  // Limpa o filtro "Cliente: X" aplicado quando o user vem de
  // /clientes → "Ver equipamentos". Volta pra view default sem filtro.
  on('equip-clear-cliente-filter', async () => {
    const { goTo } = await import('../../../core/router.js');
    goTo('equipamentos');
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

  // PR4 §12.3 · Toggle expand/collapse do idle-cluster (lista de idles
  // agrupados quando há ≥5). Pure DOM toggle — sem re-render. CSS cuida
  // de mostrar/esconder `.equip-idle-cluster__cards` via `[data-expanded]`.
  on('toggle-idle-cluster', (el) => {
    const cluster = el.closest('.equip-idle-cluster');
    if (!cluster) return;
    const willExpand = cluster.getAttribute('data-expanded') !== 'true';
    cluster.setAttribute('data-expanded', willExpand ? 'true' : 'false');
    const btn = cluster.querySelector('.equip-idle-cluster__summary');
    if (btn) btn.setAttribute('aria-expanded', willExpand ? 'true' : 'false');
    const ctaText = cluster.querySelector('.equip-idle-cluster__cta-text');
    if (ctaText) ctaText.textContent = willExpand ? 'Recolher' : 'Ver todos';
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
        message: 'Nao foi possivel abrir o modal de setor.',
        context: { action: 'controller.open-setor-modal' },
      });
    }
  });
}
