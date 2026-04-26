/**
 * eqContextPicker — dropdown customizado para Setor + Cliente no modal de
 * cadastro de equipamento. Estrutura inspirada no design SaaS:
 *   - Trigger card style (ja no markup) com icon + label + value + chev
 *   - Panel anexado ao body com search + secoes (acoes/recentes) + criar inline
 *   - Hidden <select> nativo persiste o state (saveEquip continua funcionando)
 *
 * Uso:
 *   import { initEqContextPickers } from '.../eqContextPicker.js';
 *   initEqContextPickers();  // chamado quando o modal abre
 *
 *   syncSelectedLabels();  // re-sincroniza label apos mudanca externa (ex: edit)
 */

import { Utils } from '../../core/utils.js';
import { getState } from '../../core/state.js';

const PANEL_ID = 'eq-context-picker-panel';
let _bound = false;
let _activeKind = null; // 'setor' | 'cliente' | null

/* ─────────────────── helpers de seleção ──────────────────────────── */

function _getInitials(name) {
  const t = String(name || '').trim();
  if (!t) return '?';
  return t
    .split(/\s+/)
    .map((s) => s[0] || '')
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function _avatarColor(seed) {
  // Hash simples pra gerar cor consistente por cliente
  const colors = [
    { bg: 'rgba(45, 212, 164, 0.18)', fg: '#5fe6b3' },
    { bg: 'rgba(74, 163, 255, 0.18)', fg: '#6fbfff' },
    { bg: 'rgba(168, 132, 255, 0.18)', fg: '#b89eff' },
    { bg: 'rgba(232, 130, 32, 0.18)', fg: '#f59e3a' },
    { bg: 'rgba(232, 160, 32, 0.18)', fg: '#f5b54a' },
    { bg: 'rgba(224, 48, 64, 0.16)', fg: '#f47082' },
  ];
  let h = 0;
  const s = String(seed || '');
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return colors[h % colors.length];
}

/* ─────────────────── sync label do trigger com select ─────────────── */

/**
 * Atualiza o texto do trigger (eq-setor-value / eq-cliente-value) com o
 * label do option selecionado no hidden select. Idempotente.
 */
export function syncSelectedLabels() {
  const setorSelect = document.getElementById('eq-setor');
  const setorValueEl = document.getElementById('eq-setor-value');
  if (setorSelect && setorValueEl) {
    const opt = setorSelect.options[setorSelect.selectedIndex];
    setorValueEl.textContent = opt?.text || 'Sem setor';
    setorValueEl.classList.toggle('eq-context-card__value--placeholder', !setorSelect.value);
  }
  const cliSelect = document.getElementById('eq-cliente');
  const cliValueEl = document.getElementById('eq-cliente-value');
  if (cliSelect && cliValueEl) {
    const opt = cliSelect.options[cliSelect.selectedIndex];
    cliValueEl.textContent = opt?.text || 'Sem cliente';
    cliValueEl.classList.toggle('eq-context-card__value--placeholder', !cliSelect.value);
  }
}

/* ─────────────────── render do panel ─────────────────────────────── */

function _renderSetorOptions(currentVal) {
  const { setores } = getState();
  const list = (setores || []).filter(Boolean);

  const items = list
    .map((s) => {
      const safeId = Utils.escapeAttr(s.id);
      const safeNome = Utils.escapeHtml(s.nome);
      const isSelected = String(currentVal) === String(s.id);
      const cor = s.cor || '#00c8e8';
      return `
        <button type="button" class="eq-context-picker__item ${isSelected ? 'is-selected' : ''}"
          data-value="${safeId}" role="option" aria-selected="${isSelected}">
          <span class="eq-context-picker__swatch" style="background:${cor}" aria-hidden="true"></span>
          <span class="eq-context-picker__item-body">
            <span class="eq-context-picker__item-name">${safeNome}</span>
            ${s.descricao ? `<span class="eq-context-picker__item-meta">${Utils.escapeHtml(s.descricao)}</span>` : ''}
          </span>
          ${isSelected ? '<svg class="eq-context-picker__check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
        </button>`;
    })
    .join('');

  return `
    <div class="eq-context-picker__section">
      <div class="eq-context-picker__section-label">AÇÕES</div>
      <button type="button" class="eq-context-picker__item ${!currentVal ? 'is-selected' : ''}"
        data-value="" role="option" aria-selected="${!currentVal}">
        <span class="eq-context-picker__icon-tile" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </span>
        <span class="eq-context-picker__item-body">
          <span class="eq-context-picker__item-name">Sem setor atribuído</span>
          <span class="eq-context-picker__item-meta">Equipamento fica solto, sem grupo.</span>
        </span>
      </button>
    </div>
    ${
      list.length
        ? `
    <div class="eq-context-picker__section">
      <div class="eq-context-picker__section-label">SETORES (${list.length})</div>
      ${items}
    </div>`
        : `
    <div class="eq-context-picker__empty">
      Nenhum setor cadastrado ainda.
    </div>`
    }
    <div class="eq-context-picker__footer">
      <button type="button" class="eq-context-picker__create"
        data-action="open-setor-modal" data-after-save="select-in-eq-modal">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Criar novo setor
      </button>
    </div>`;
}

function _renderClienteOptions(currentVal, searchTerm = '') {
  const { clientes } = getState();
  const list = (clientes || []).filter(Boolean);
  const term = String(searchTerm || '')
    .trim()
    .toLowerCase();
  const filtered = term
    ? list.filter((c) => {
        const hay = [c.nome, c.razaoSocial, c.cnpj, c.endereco]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(term);
      })
    : list;

  // Recentes = ate 6 primeiros (ja vem ordenado por nome do loadClientes;
  // futuramente podemos ordenar por updatedAt desc)
  const recents = filtered.slice(0, 6);

  const items = recents
    .map((c) => {
      const safeId = Utils.escapeAttr(c.id);
      const safeNome = Utils.escapeHtml(c.nome);
      const initials = _getInitials(c.nome);
      const color = _avatarColor(c.id);
      const meta = [c.endereco].filter(Boolean).join(' · ');
      const isSelected = String(currentVal) === String(c.id);
      return `
        <button type="button" class="eq-context-picker__item ${isSelected ? 'is-selected' : ''}"
          data-value="${safeId}" role="option" aria-selected="${isSelected}">
          <span class="eq-context-picker__avatar" style="background:${color.bg};color:${color.fg}" aria-hidden="true">${initials}</span>
          <span class="eq-context-picker__item-body">
            <span class="eq-context-picker__item-name">${safeNome}</span>
            ${meta ? `<span class="eq-context-picker__item-meta">${Utils.escapeHtml(meta)}</span>` : ''}
          </span>
          ${isSelected ? '<svg class="eq-context-picker__check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
        </button>`;
    })
    .join('');

  return `
    <div class="eq-context-picker__search-wrap">
      <svg class="eq-context-picker__search-icon" width="14" height="14" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
        stroke-linejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>
      </svg>
      <input type="search" class="eq-context-picker__search" id="eq-context-picker-search"
        placeholder="Buscar cliente..." aria-label="Buscar cliente"
        value="${Utils.escapeAttr(searchTerm)}" autocomplete="off" />
    </div>

    <div class="eq-context-picker__section">
      <div class="eq-context-picker__section-label">AÇÕES</div>
      <button type="button" class="eq-context-picker__item ${!currentVal ? 'is-selected' : ''}"
        data-value="" role="option" aria-selected="${!currentVal}">
        <span class="eq-context-picker__icon-tile" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </span>
        <span class="eq-context-picker__item-body">
          <span class="eq-context-picker__item-name">Sem cliente vinculado</span>
          <span class="eq-context-picker__item-meta">Este equipamento não está vinculado a nenhum cliente.</span>
        </span>
      </button>
    </div>

    ${
      recents.length
        ? `
    <div class="eq-context-picker__section">
      <div class="eq-context-picker__section-label">${term ? `RESULTADOS (${recents.length})` : `CLIENTES RECENTES`}</div>
      ${items}
    </div>`
        : `
    <div class="eq-context-picker__empty">
      ${term ? 'Nenhum cliente encontrado.' : 'Nenhum cliente cadastrado ainda.'}
    </div>`
    }

    <div class="eq-context-picker__footer">
      <button type="button" class="eq-context-picker__create"
        data-action="open-cliente-modal" data-mode="create"
        data-after-save="select-in-eq-modal">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Criar novo cliente
      </button>
    </div>`;
}

/* ─────────────────── open / close panel ──────────────────────────── */

function _closePanel() {
  document.getElementById(PANEL_ID)?.remove();
  _activeKind = null;
  document.querySelectorAll('.eq-context-card__trigger[aria-expanded="true"]').forEach((t) => {
    t.setAttribute('aria-expanded', 'false');
  });
}

function _openPanel(kind, anchorEl) {
  _closePanel();
  if (!anchorEl) return;
  _activeKind = kind;

  const select = document.getElementById(kind === 'setor' ? 'eq-setor' : 'eq-cliente');
  const currentVal = select?.value || '';
  const html =
    kind === 'setor' ? _renderSetorOptions(currentVal) : _renderClienteOptions(currentVal);

  const panel = document.createElement('div');
  panel.id = PANEL_ID;
  panel.className = `eq-context-picker eq-context-picker--${kind}`;
  panel.setAttribute('role', 'listbox');
  panel.innerHTML = html;
  document.body.appendChild(panel);

  // Posiciona abaixo do trigger; flip-up se nao couber
  const rect = anchorEl.getBoundingClientRect();
  const panelHeight = panel.offsetHeight;
  const spaceBelow = window.innerHeight - rect.bottom;
  const goesUp = spaceBelow < panelHeight + 16 && rect.top > panelHeight + 16;
  panel.style.position = 'fixed';
  panel.style.left = `${Math.max(8, rect.left)}px`;
  panel.style.minWidth = `${Math.max(280, rect.width)}px`;
  panel.style.maxWidth = '420px';
  panel.style.zIndex = '10000';
  if (goesUp) {
    panel.style.bottom = `${window.innerHeight - rect.top + 6}px`;
    panel.style.top = 'auto';
  } else {
    panel.style.top = `${rect.bottom + 6}px`;
    panel.style.bottom = 'auto';
  }

  anchorEl.setAttribute('aria-expanded', 'true');

  // Auto-focus na search se for cliente
  if (kind === 'cliente') {
    const input = panel.querySelector('#eq-context-picker-search');
    if (input) {
      input.focus();
      // re-render on input
      input.addEventListener('input', () => {
        const term = input.value;
        const newHtml = _renderClienteOptions(currentVal, term);
        const cursorPos = input.selectionStart;
        panel.innerHTML = newHtml;
        const newInput = panel.querySelector('#eq-context-picker-search');
        if (newInput) {
          newInput.focus();
          if (cursorPos != null) {
            try {
              newInput.setSelectionRange(cursorPos, cursorPos);
            } catch (_e) {
              /* noop */
            }
          }
        }
      });
    }
  }
}

/* ─────────────────── seleção (item click) ────────────────────────── */

function _selectValue(kind, value) {
  const select = document.getElementById(kind === 'setor' ? 'eq-setor' : 'eq-cliente');
  if (!select) return;
  select.value = value;
  // Dispatch change pra qualquer listener legado
  select.dispatchEvent(new Event('change', { bubbles: true }));
  syncSelectedLabels();
  _closePanel();
}

/* ─────────────────── bind global (idempotente) ───────────────────── */

export function initEqContextPickers() {
  syncSelectedLabels();
  if (_bound) return;
  _bound = true;

  // Click em trigger abre o panel
  document.addEventListener('click', (event) => {
    const trigger = event.target.closest?.('.eq-context-card__trigger[data-eq-context]');
    if (trigger) {
      event.preventDefault();
      const kind = trigger.dataset.eqContext;
      if (_activeKind === kind) {
        _closePanel();
      } else {
        _openPanel(kind, trigger);
      }
      return;
    }

    // Click num item do panel seleciona
    const item = event.target.closest?.(`#${PANEL_ID} .eq-context-picker__item`);
    if (item && _activeKind) {
      event.preventDefault();
      _selectValue(_activeKind, item.dataset.value);
      return;
    }

    // Click fora fecha (mas nao se for dentro do panel)
    if (_activeKind && !event.target.closest?.(`#${PANEL_ID}`)) {
      _closePanel();
    }
  });

  // Esc fecha
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && _activeKind) {
      _closePanel();
    }
  });
}
