/**
 * CoolTrack Pro - Histórico Filters Bottom Sheet
 *
 * Bottom sheet (mobile) / modal centered (desktop) para filtros secundários
 * do histórico — setor, equipamento, tipo. Libera espaço vertical no topo
 * da tela, deixando ali apenas search + chips de período.
 *
 * Uso:
 *   import { HistoricoFiltersSheet } from './ui/components/historicoFiltersSheet.js';
 *   HistoricoFiltersSheet.open({
 *     setores: [{ id, nome }],
 *     equipamentos: [{ id, nome, setorId }],
 *     tipoOptions: [{ id, label }],
 *     initial: { setor: '', equip: '', tipo: '' },
 *     onApply: ({ setor, equip, tipo }) => { ... },
 *     onReset: () => { ... },
 *   });
 *
 * Ciclo: cria overlay dinamicamente no body, attachDialogA11y, animacao
 * de slide-up, focus trap. Cancel/backdrop/ESC/swipe-down fecha.
 */

import { Utils } from '../../core/utils.js';
import { attachDialogA11y } from '../../core/modal.js';

const OVERLAY_ID = 'hist-filters-sheet-overlay';
let _a11yCleanup = null;

function buildOverlayHtml({ setores, equipamentos, tipoOptions, initial }) {
  const safeSetor = Utils.escapeHtml(initial.setor || '');
  const safeEquip = Utils.escapeHtml(initial.equip || '');
  const safeTipo = Utils.escapeHtml(initial.tipo || '');

  const setorOptions = (setores || [])
    .map((s) => {
      const sel = s.id === initial.setor ? ' selected' : '';
      return (
        '<option value="' +
        Utils.escapeHtml(s.id) +
        '"' +
        sel +
        '>' +
        Utils.escapeHtml(s.nome || s.id) +
        '</option>'
      );
    })
    .join('');

  const equipFiltered = initial.setor
    ? (equipamentos || []).filter((e) => e.setorId === initial.setor)
    : equipamentos || [];
  const equipOptions = equipFiltered
    .map((e) => {
      const sel = e.id === initial.equip ? ' selected' : '';
      return (
        '<option value="' +
        Utils.escapeHtml(e.id) +
        '"' +
        sel +
        '>' +
        Utils.escapeHtml(e.nome || e.id) +
        '</option>'
      );
    })
    .join('');

  const tipoChips = (tipoOptions || [])
    .map((opt) => {
      const active = opt.id === initial.tipo ? ' is-active' : '';
      return (
        '<button type="button" class="hist-filters-sheet__tipo-chip' +
        active +
        '" data-tipo-id="' +
        Utils.escapeHtml(opt.id) +
        '" aria-pressed="' +
        (opt.id === initial.tipo ? 'true' : 'false') +
        '">' +
        Utils.escapeHtml(opt.label) +
        '</button>'
      );
    })
    .join('');

  const setorBlock =
    (setores || []).length > 0
      ? `<div class="hist-filters-sheet__field">
          <label class="hist-filters-sheet__label" for="hfs-setor">Setor</label>
          <select id="hfs-setor" class="hist-filters-sheet__select" data-current="${safeSetor}">
            <option value="">Todos os setores</option>
            ${setorOptions}
          </select>
        </div>`
      : '';

  return `
    <div class="modal hist-filters-sheet" role="dialog"
      aria-modal="true" aria-labelledby="hist-filters-sheet-title">
      <header class="hist-filters-sheet__head">
        <div class="hist-filters-sheet__handle" aria-hidden="true"></div>
        <div class="hist-filters-sheet__head-row">
          <h2 class="hist-filters-sheet__title" id="hist-filters-sheet-title">Filtros</h2>
          <button type="button" class="hist-filters-sheet__close"
            id="hfs-close" aria-label="Fechar filtros">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </header>
      <div class="hist-filters-sheet__body">
        ${setorBlock}
        <div class="hist-filters-sheet__field">
          <label class="hist-filters-sheet__label" for="hfs-equip">Equipamento</label>
          <select id="hfs-equip" class="hist-filters-sheet__select" data-current="${safeEquip}">
            <option value="">Todos os equipamentos</option>
            ${equipOptions}
          </select>
        </div>
        <div class="hist-filters-sheet__field">
          <span class="hist-filters-sheet__label">Tipo de servico</span>
          <div class="hist-filters-sheet__tipo-grid"
            role="group" aria-label="Filtrar por tipo de servico"
            data-current="${safeTipo}">
            <button type="button" class="hist-filters-sheet__tipo-chip${initial.tipo ? '' : ' is-active'}"
              data-tipo-id="" aria-pressed="${initial.tipo ? 'false' : 'true'}">Todos</button>
            ${tipoChips}
          </div>
        </div>
      </div>
      <footer class="hist-filters-sheet__foot">
        <button type="button" class="btn btn--ghost hist-filters-sheet__reset"
          id="hfs-reset">Limpar tudo</button>
        <button type="button" class="btn btn--primary hist-filters-sheet__apply"
          id="hfs-apply">Aplicar</button>
      </footer>
    </div>
  `;
}

function ensureOverlay(html) {
  let overlay = document.getElementById(OVERLAY_ID);
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.className = 'modal-overlay hist-filters-sheet-overlay';
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = html;
  return overlay;
}

function getCurrentSelections(overlay) {
  const setorSel = overlay.querySelector('#hfs-setor');
  const equipSel = overlay.querySelector('#hfs-equip');
  const tipoGrid = overlay.querySelector('.hist-filters-sheet__tipo-grid');
  return {
    setor: setorSel ? setorSel.value : '',
    equip: equipSel ? equipSel.value : '',
    tipo: tipoGrid ? tipoGrid.dataset.current || '' : '',
  };
}

function close(overlay) {
  if (!overlay) return;
  overlay.classList.remove('is-open');
  if (_a11yCleanup) {
    _a11yCleanup();
    _a11yCleanup = null;
  }
  // Pequeno timeout casa com a animacao CSS (260ms).
  setTimeout(() => {
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
  }, 260);
}

export const HistoricoFiltersSheet = {
  open({ setores = [], equipamentos = [], tipoOptions = [], initial = {}, onApply, onReset }) {
    const safeInitial = {
      setor: initial.setor || '',
      equip: initial.equip || '',
      tipo: initial.tipo || '',
    };
    const html = buildOverlayHtml({ setores, equipamentos, tipoOptions, initial: safeInitial });
    const overlay = ensureOverlay(html);

    requestAnimationFrame(() => {
      overlay.classList.add('is-open');
    });

    _a11yCleanup = attachDialogA11y(overlay, {
      onDismiss: () => close(overlay),
    });

    // Fechar ao clicar no backdrop
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close(overlay);
    });

    overlay.querySelector('#hfs-close')?.addEventListener('click', () => close(overlay));

    // Setor mudou: filtra equipamentos correspondentes
    const setorSel = overlay.querySelector('#hfs-setor');
    const equipSel = overlay.querySelector('#hfs-equip');
    if (setorSel && equipSel) {
      setorSel.addEventListener('change', () => {
        const setorId = setorSel.value;
        const filtered = setorId ? equipamentos.filter((e) => e.setorId === setorId) : equipamentos;
        const currentEquip = equipSel.value;
        const stillValid = filtered.some((e) => e.id === currentEquip);
        equipSel.innerHTML =
          '<option value="">Todos os equipamentos</option>' +
          filtered
            .map(
              (e) =>
                '<option value="' +
                Utils.escapeHtml(e.id) +
                '"' +
                (stillValid && e.id === currentEquip ? ' selected' : '') +
                '>' +
                Utils.escapeHtml(e.nome || e.id) +
                '</option>',
            )
            .join('');
      });
    }

    // Tipo chips: toggle exclusivo
    const tipoGrid = overlay.querySelector('.hist-filters-sheet__tipo-grid');
    if (tipoGrid) {
      tipoGrid.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-tipo-id]');
        if (!btn) return;
        const tipoId = btn.dataset.tipoId || '';
        tipoGrid.dataset.current = tipoId;
        tipoGrid.querySelectorAll('[data-tipo-id]').forEach((b) => {
          const active = b.dataset.tipoId === tipoId;
          b.classList.toggle('is-active', active);
          b.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
      });
    }

    // Reset: limpa locais e chama callback
    overlay.querySelector('#hfs-reset')?.addEventListener('click', () => {
      if (typeof onReset === 'function') onReset();
      close(overlay);
    });

    // Apply: envia selecoes pro callback
    overlay.querySelector('#hfs-apply')?.addEventListener('click', () => {
      const values = getCurrentSelections(overlay);
      if (typeof onApply === 'function') onApply(values);
      close(overlay);
    });
  },

  close() {
    const overlay = document.getElementById(OVERLAY_ID);
    if (overlay) close(overlay);
  },
};
