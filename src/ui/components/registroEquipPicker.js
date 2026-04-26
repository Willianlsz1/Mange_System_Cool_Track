/**
 * registroEquipPicker — picker fullscreen com search pro select de
 * equipamento em /registro. Resolve o gargalo UX onde tecnico com 50+
 * equips rolava o select nativo procurando.
 *
 * Estrutura:
 *   - Trigger card no markup (ja existe: r-equip-trigger)
 *   - Hidden <select id="r-equip"> preserva state (saveRegistro le dele)
 *   - Picker abre fullscreen em mobile, modal em desktop
 *   - Search por nome + tag + setor + cliente (cobre 99% dos casos)
 *   - Items mostram contexto: "Split AC-001 · Recepcao · Hotel Vila Nova"
 *
 * Uso: initRegistroEquipPicker() no boot do controller.
 *      Re-popula automaticamente quando state muda (subscribe ao state).
 */

import { Utils } from '../../core/utils.js';
import { getState, findSetor } from '../../core/state.js';

const PICKER_ID = 'registro-equip-picker';
let _bound = false;
let _isOpen = false;
let _searchTerm = '';

/* ─────────────────── helpers ──────────────────────────────────────── */

function _equipMeta(eq, state) {
  const parts = [];
  if (eq.tag) parts.push(eq.tag);
  if (eq.setorId) {
    const setor = state.setores?.find((s) => s.id === eq.setorId);
    if (setor?.nome) parts.push(setor.nome);
  } else if (eq.local) {
    parts.push(eq.local);
  }
  if (eq.clienteId) {
    const cliente = state.clientes?.find((c) => c.id === eq.clienteId);
    if (cliente?.nome) parts.push(cliente.nome);
  }
  return parts.join(' · ');
}

function _equipMatchesSearch(eq, state, term) {
  if (!term) return true;
  const setor = eq.setorId ? state.setores?.find((s) => s.id === eq.setorId) : null;
  const cliente = eq.clienteId ? state.clientes?.find((c) => c.id === eq.clienteId) : null;
  const haystack = [eq.nome, eq.tag, eq.local, eq.tipo, setor?.nome, cliente?.nome]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(term.toLowerCase());
}

/* ─────────────────── sync trigger label ───────────────────────────── */

export function syncRegistroEquipLabel() {
  const select = document.getElementById('r-equip');
  const nameEl = document.getElementById('r-equip-name');
  const metaEl = document.getElementById('r-equip-meta');
  if (!select || !nameEl) return;

  const id = select.value;
  if (!id) {
    nameEl.textContent = 'Selecione o equipamento...';
    nameEl.classList.add('registro-equip-trigger__name--placeholder');
    if (metaEl) {
      metaEl.hidden = true;
      metaEl.textContent = '';
    }
    return;
  }
  const state = getState();
  const eq = (state.equipamentos || []).find((e) => e.id === id);
  if (!eq) {
    nameEl.textContent = 'Equipamento removido';
    nameEl.classList.remove('registro-equip-trigger__name--placeholder');
    if (metaEl) {
      metaEl.hidden = true;
    }
    return;
  }
  nameEl.textContent = eq.nome;
  nameEl.classList.remove('registro-equip-trigger__name--placeholder');
  if (metaEl) {
    const meta = _equipMeta(eq, state);
    if (meta) {
      metaEl.textContent = meta;
      metaEl.hidden = false;
    } else {
      metaEl.hidden = true;
    }
  }
}

/* ─────────────────── render do picker ─────────────────────────────── */

function _renderItems(equipamentos, state, currentVal) {
  const filtered = equipamentos.filter((eq) => _equipMatchesSearch(eq, state, _searchTerm));
  if (!filtered.length) {
    return `
      <div class="registro-equip-picker__empty">
        ${
          _searchTerm
            ? `Nenhum equipamento encontrado para "${Utils.escapeHtml(_searchTerm)}".`
            : 'Nenhum equipamento cadastrado ainda.'
        }
      </div>`;
  }

  // Agrupa por setor pra navegacao mais rapida (especialmente quando
  // tecnico tem muitos equips espalhados).
  const grouped = new Map();
  filtered.forEach((eq) => {
    const setor = eq.setorId ? state.setores?.find((s) => s.id === eq.setorId) : null;
    const key = setor?.nome || 'Sem setor';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(eq);
  });

  // Se ha search ativa, nao agrupa (lista achatada eh mais util)
  if (_searchTerm) {
    return filtered.map((eq) => _renderItem(eq, state, currentVal)).join('');
  }

  return Array.from(grouped.entries())
    .map(
      ([groupName, items]) => `
        <div class="registro-equip-picker__group">
          <div class="registro-equip-picker__group-label">${Utils.escapeHtml(groupName)} (${items.length})</div>
          ${items.map((eq) => _renderItem(eq, state, currentVal)).join('')}
        </div>`,
    )
    .join('');
}

function _renderItem(eq, state, currentVal) {
  const safeId = Utils.escapeAttr(eq.id);
  const safeName = Utils.escapeHtml(eq.nome);
  const meta = _equipMeta(eq, state);
  const isSelected = String(currentVal) === String(eq.id);

  // Status dot — indica saude visualmente
  const statusClass =
    eq.status === 'danger' ? 'is-danger' : eq.status === 'warn' ? 'is-warn' : 'is-ok';

  return `
    <button type="button" class="registro-equip-picker__item ${isSelected ? 'is-selected' : ''}"
      data-r-equip-pick="${safeId}" role="option" aria-selected="${isSelected}">
      <span class="registro-equip-picker__status ${statusClass}" aria-hidden="true"></span>
      <span class="registro-equip-picker__item-body">
        <span class="registro-equip-picker__item-name">${safeName}</span>
        ${meta ? `<span class="registro-equip-picker__item-meta">${Utils.escapeHtml(meta)}</span>` : ''}
      </span>
      ${
        isSelected
          ? '<svg class="registro-equip-picker__check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>'
          : ''
      }
    </button>`;
}

function _renderPicker() {
  const state = getState();
  const equipamentos = state.equipamentos || [];
  const select = document.getElementById('r-equip');
  const currentVal = select?.value || '';

  const overlay = document.createElement('div');
  overlay.id = PICKER_ID;
  overlay.className = 'registro-equip-picker';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'registro-equip-picker-title');

  overlay.innerHTML = `
    <div class="registro-equip-picker__backdrop" data-r-action="close-equip-picker" aria-hidden="true"></div>
    <div class="registro-equip-picker__sheet" role="document">
      <div class="registro-equip-picker__head">
        <h2 class="registro-equip-picker__title" id="registro-equip-picker-title">Escolher equipamento</h2>
        <button type="button" class="registro-equip-picker__close"
          data-r-action="close-equip-picker" aria-label="Fechar">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <div class="registro-equip-picker__search-wrap">
        <svg class="registro-equip-picker__search-icon" width="16" height="16" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
          stroke-linejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>
        </svg>
        <input type="search" class="registro-equip-picker__search" id="registro-equip-picker-search"
          placeholder="Buscar por nome, TAG, setor ou cliente..."
          aria-label="Buscar equipamento" autocomplete="off" autofocus
          value="${Utils.escapeAttr(_searchTerm)}" />
      </div>
      <div class="registro-equip-picker__list" id="registro-equip-picker-list" role="listbox">
        ${_renderItems(equipamentos, state, currentVal)}
      </div>
      ${
        equipamentos.length === 0
          ? `<div class="registro-equip-picker__footer">
            <button type="button" class="registro-equip-picker__create"
              data-action="open-modal" data-id="modal-add-eq">
              + Cadastrar primeiro equipamento
            </button>
          </div>`
          : ''
      }
    </div>`;

  document.body.appendChild(overlay);
  return overlay;
}

/* ─────────────────── open / close / select ────────────────────────── */

function _openPicker() {
  if (_isOpen) return;
  _isOpen = true;
  document.getElementById(PICKER_ID)?.remove();
  const overlay = _renderPicker();

  const trigger = document.getElementById('r-equip-trigger');
  if (trigger) trigger.setAttribute('aria-expanded', 'true');

  // Bloqueia scroll do body
  document.body.classList.add('has-equip-picker-open');

  // Focus na search apos animacao
  requestAnimationFrame(() => {
    const search = document.getElementById('registro-equip-picker-search');
    if (search) {
      search.focus();
      search.addEventListener('input', () => {
        _searchTerm = search.value || '';
        const list = document.getElementById('registro-equip-picker-list');
        if (list) {
          const state = getState();
          const select = document.getElementById('r-equip');
          list.innerHTML = _renderItems(state.equipamentos || [], state, select?.value || '');
        }
      });
    }
  });

  // Bind ESC pra fechar (one-shot)
  const onKey = (e) => {
    if (e.key === 'Escape') {
      _closePicker();
      document.removeEventListener('keydown', onKey);
    }
  };
  document.addEventListener('keydown', onKey);
}

function _closePicker() {
  if (!_isOpen) return;
  _isOpen = false;
  document.getElementById(PICKER_ID)?.remove();
  document.body.classList.remove('has-equip-picker-open');
  const trigger = document.getElementById('r-equip-trigger');
  if (trigger) trigger.setAttribute('aria-expanded', 'false');
  // Reset search pra proxima abertura comecar limpa
  _searchTerm = '';
}

function _selectEquip(equipId) {
  const select = document.getElementById('r-equip');
  if (!select) return;
  // Garante que ha uma option pra esse id (pra select.value funcionar)
  const exists = Array.from(select.options).some((o) => o.value === equipId);
  if (!exists) {
    const opt = document.createElement('option');
    opt.value = equipId;
    select.appendChild(opt);
  }
  select.value = equipId;
  // Dispara change pra hooks downstream (validation, progress meter, etc)
  select.dispatchEvent(new Event('change', { bubbles: true }));
  syncRegistroEquipLabel();
  _closePicker();
}

/* ─────────────────── bind global (idempotente) ────────────────────── */

export function initRegistroEquipPicker() {
  syncRegistroEquipLabel();
  if (_bound) return;
  _bound = true;

  document.addEventListener('click', (event) => {
    // Click no trigger abre
    const trigger = event.target.closest?.('[data-r-action="open-equip-picker"]');
    if (trigger) {
      event.preventDefault();
      _openPicker();
      return;
    }
    // Click no botao close OU backdrop fecha
    const close = event.target.closest?.('[data-r-action="close-equip-picker"]');
    if (close) {
      event.preventDefault();
      _closePicker();
      return;
    }
    // Click num item seleciona
    const item = event.target.closest?.('[data-r-equip-pick]');
    if (item) {
      event.preventDefault();
      _selectEquip(item.dataset.rEquipPick);
    }
  });
}
