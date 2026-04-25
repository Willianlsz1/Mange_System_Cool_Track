/**
 * CoolTrack Pro - Cliente Handlers (Fase 2 PMOC, abr/2026)
 *
 * Handlers de actions globais relacionados a clientes:
 *   - open-cliente-modal       (data-mode="create"|"edit", data-id?)
 *   - edit-cliente             (data-id)
 *   - cliente-card-menu        (data-id) — abre menu kebab no card
 *   - delete-cliente           (data-id)
 *
 * Padrão similar ao kebab dos cards de setor (equipmentHandlers): só um menu
 * aberto por vez, fecha ao clicar fora ou pressionar Esc.
 */

import { on } from '../../../core/events.js';
import { ClienteModal } from '../../components/clienteModal.js';
import {
  renderClientes,
  confirmDeleteCliente,
  openClienteModalForId,
} from '../../views/clientes.js';

let _openMenuId = null;

function closeOpenMenu() {
  if (!_openMenuId) return;
  const existing = document.getElementById(`cliente-menu-${_openMenuId}`);
  if (existing) existing.remove();
  const trigger = document.querySelector(
    `[data-action="cliente-card-menu"][data-id="${_openMenuId}"]`,
  );
  if (trigger) trigger.setAttribute('aria-expanded', 'false');
  _openMenuId = null;
}

function openMenuFor(triggerEl, id) {
  closeOpenMenu();
  if (!triggerEl || !id) return;

  // Cria popover ad-hoc ancorado ao botão
  const menu = document.createElement('div');
  menu.id = `cliente-menu-${id}`;
  menu.className = 'cliente-card__popover';
  menu.setAttribute('role', 'menu');
  menu.innerHTML = `
    <button type="button" class="cliente-card__popover-item"
            data-action="edit-cliente" data-id="${id}" role="menuitem">
      Editar
    </button>
    <button type="button" class="cliente-card__popover-item cliente-card__popover-item--danger"
            data-action="delete-cliente" data-id="${id}" role="menuitem">
      Apagar
    </button>
  `;

  // Posiciona próximo do trigger (relativo ao card)
  const card = triggerEl.closest('.cliente-card');
  if (card) {
    card.style.position = card.style.position || 'relative';
    card.appendChild(menu);
  } else {
    document.body.appendChild(menu);
  }

  triggerEl.setAttribute('aria-expanded', 'true');
  _openMenuId = id;
}

export function bindClienteHandlers() {
  // Listeners globais (idempotentes) pra fechar menu ao clicar fora / Esc / nav
  if (typeof document !== 'undefined' && !document.body.dataset.clienteMenuBound) {
    document.body.dataset.clienteMenuBound = '1';

    document.addEventListener('click', (e) => {
      if (!_openMenuId) return;
      const insideMenu = e.target.closest('.cliente-card__popover');
      const insideTrigger = e.target.closest('[data-action="cliente-card-menu"]');
      if (insideMenu || insideTrigger) return;
      closeOpenMenu();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && _openMenuId) {
        closeOpenMenu();
      }
    });

    document.addEventListener('app:route-changed', () => {
      if (_openMenuId) closeOpenMenu();
    });
  }

  // Abre modal de cadastro/edição. data-mode="create" → novo. Sem mode → edita data-id.
  on('open-cliente-modal', (el) => {
    const mode = el?.dataset?.mode;
    const id = el?.dataset?.id;
    if (mode === 'create' || !id) {
      ClienteModal.openCreate({ onSaved: () => renderClientes() });
      return;
    }
    openClienteModalForId(id);
  });

  on('edit-cliente', (el) => {
    closeOpenMenu();
    const id = el?.dataset?.id;
    if (!id) return;
    openClienteModalForId(id);
  });

  on('cliente-card-menu', (el) => {
    const id = el?.dataset?.id;
    if (!id) return;
    if (_openMenuId === id) {
      closeOpenMenu();
      return;
    }
    openMenuFor(el, id);
  });

  on('delete-cliente', async (el) => {
    closeOpenMenu();
    const id = el?.dataset?.id;
    if (!id) return;
    await confirmDeleteCliente(id);
  });
}
