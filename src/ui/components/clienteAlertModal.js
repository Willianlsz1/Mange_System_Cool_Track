/**
 * ClienteAlertModal — picker pra definir alerta de retorno por cliente.
 *
 * Layout: 3 botoes rapidos (30/60/90 dias) + input custom + nota opcional.
 * Mostra alerta já existente (se houver) com opção de remover.
 *
 * Uso:
 *   ClienteAlertModal.open(clienteId, clienteNome, { onSaved: () => ... });
 */

import { getClienteAlert, setClienteAlert, clearClienteAlert } from '../../core/clienteAlerts.js';
import { Toast } from '../../core/toast.js';

const OVERLAY_ID = 'cliente-alert-modal-overlay';

const ICON_BELL = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9Z"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`;
const ICON_CLOSE = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
const ICON_TRASH = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="m6 6 1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"/></svg>`;

function _close() {
  document.getElementById(OVERLAY_ID)?.remove();
}

function _formatBR(date) {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function _addDays(days) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}

export const ClienteAlertModal = {
  /**
   * @param {string} clienteId
   * @param {string} clienteNome
   * @param {{onSaved?: () => void}} [opts]
   */
  open(clienteId, clienteNome, { onSaved } = {}) {
    if (!clienteId) return;
    _close();

    const existing = getClienteAlert(clienteId);

    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.className = 'modal-overlay is-open cliente-alert-modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'cliente-alert-title');

    const existingNote = existing?.note || '';
    const existingDate = existing ? new Date(existing.dueAt) : null;
    const existingValid = existingDate && !Number.isNaN(existingDate.getTime());

    overlay.innerHTML = `
      <div class="modal cliente-alert-modal">
        <button type="button" class="cliente-alert-modal__close"
          data-cliente-alert-action="close" aria-label="Fechar">${ICON_CLOSE}</button>

        <div class="cliente-alert-modal__head">
          <span class="cliente-alert-modal__icon" aria-hidden="true">${ICON_BELL}</span>
          <div>
            <h2 class="cliente-alert-modal__title" id="cliente-alert-title">
              Definir alerta de retorno
            </h2>
            <p class="cliente-alert-modal__sub">
              Para <strong>${String(clienteNome || 'cliente').replace(/</g, '&lt;')}</strong>. Você será lembrado em /alertas quando a data chegar.
            </p>
          </div>
        </div>

        ${
          existingValid
            ? `
        <div class="cliente-alert-modal__current">
          <span class="cliente-alert-modal__current-icon" aria-hidden="true">${ICON_BELL}</span>
          <div class="cliente-alert-modal__current-body">
            <div class="cliente-alert-modal__current-label">Alerta atual</div>
            <div class="cliente-alert-modal__current-date">${_formatBR(existingDate)}</div>
          </div>
          <button type="button" class="cliente-alert-modal__remove"
            data-cliente-alert-action="remove" title="Remover alerta">
            ${ICON_TRASH}<span>Remover</span>
          </button>
        </div>`
            : ''
        }

        <div class="cliente-alert-modal__body">
          <div class="cliente-alert-modal__field-label">Em quantos dias?</div>
          <div class="cliente-alert-modal__quick">
            <button type="button" class="cliente-alert-modal__quick-btn"
              data-cliente-alert-action="quick" data-days="30">30 dias</button>
            <button type="button" class="cliente-alert-modal__quick-btn"
              data-cliente-alert-action="quick" data-days="60">60 dias</button>
            <button type="button" class="cliente-alert-modal__quick-btn"
              data-cliente-alert-action="quick" data-days="90">90 dias</button>
          </div>

          <div class="cliente-alert-modal__custom">
            <label for="cliente-alert-days" class="cliente-alert-modal__field-label">
              ou personalize
            </label>
            <div class="cliente-alert-modal__custom-row">
              <input type="number" id="cliente-alert-days" min="1" max="3650" step="1"
                class="cliente-alert-modal__input"
                placeholder="Ex: 45" autocomplete="off" />
              <span class="cliente-alert-modal__custom-unit">dias</span>
            </div>
            <div class="cliente-alert-modal__preview" id="cliente-alert-preview" hidden>
              Será em <strong id="cliente-alert-preview-date">—</strong>
            </div>
          </div>

          <div class="cliente-alert-modal__note">
            <label for="cliente-alert-note" class="cliente-alert-modal__field-label">
              Observação <span class="cliente-alert-modal__field-hint">(opcional)</span>
            </label>
            <textarea id="cliente-alert-note" class="cliente-alert-modal__textarea"
              maxlength="200" rows="2"
              placeholder="Ex: Trazer filtros novos. Verificar capacitor.">${String(existingNote).replace(/</g, '&lt;')}</textarea>
          </div>
        </div>

        <div class="cliente-alert-modal__actions">
          <button type="button" class="cliente-alert-modal__cancel"
            data-cliente-alert-action="close">Cancelar</button>
          <button type="button" class="cliente-alert-modal__save"
            data-cliente-alert-action="save"
            data-cliente-id="${String(clienteId).replace(/"/g, '&quot;')}"
            data-cliente-nome="${String(clienteNome).replace(/"/g, '&quot;')}">
            Salvar alerta
          </button>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    // Estado local: dias selecionados
    let selectedDays = null;

    const updatePreview = (days) => {
      const previewEl = document.getElementById('cliente-alert-preview');
      const dateEl = document.getElementById('cliente-alert-preview-date');
      if (!previewEl || !dateEl) return;
      if (!days || days < 1) {
        previewEl.hidden = true;
        return;
      }
      previewEl.hidden = false;
      dateEl.textContent = _formatBR(_addDays(days));
    };

    const setSelectedDays = (days) => {
      selectedDays = days;
      // Limpa highlight dos quick buttons
      overlay.querySelectorAll('.cliente-alert-modal__quick-btn').forEach((b) => {
        const d = parseInt(b.dataset.days, 10);
        b.classList.toggle('is-active', d === days);
      });
      updatePreview(days);
    };

    // Bind: quick buttons
    overlay.addEventListener('click', async (event) => {
      const target = event.target.closest?.('[data-cliente-alert-action]');
      if (!target) return;
      const action = target.getAttribute('data-cliente-alert-action');

      if (action === 'close') {
        event.preventDefault();
        _close();
      } else if (action === 'quick') {
        event.preventDefault();
        const days = parseInt(target.getAttribute('data-days'), 10);
        if (days > 0) {
          setSelectedDays(days);
          // Espelha no input custom pra clareza
          const input = document.getElementById('cliente-alert-days');
          if (input) input.value = String(days);
        }
      } else if (action === 'remove') {
        event.preventDefault();
        clearClienteAlert(clienteId);
        Toast.success('Alerta removido.');
        _close();
        onSaved?.();
      } else if (action === 'save') {
        event.preventDefault();
        const input = document.getElementById('cliente-alert-days');
        const noteEl = document.getElementById('cliente-alert-note');
        const days = parseInt(input?.value || '', 10) || selectedDays || 0;
        if (days < 1 || days > 3650) {
          Toast.warning('Escolha um intervalo entre 1 e 3650 dias.');
          input?.focus();
          return;
        }
        const due = _addDays(days);
        const note = noteEl?.value || '';
        const ok = setClienteAlert(clienteId, due, note);
        if (!ok) {
          Toast.error('Não foi possivel salvar o alerta.');
          return;
        }
        Toast.success(`Alerta definido para ${_formatBR(due)}.`);
        _close();
        onSaved?.();
      }
    });

    // Bind: custom input atualiza o preview e desliga o highlight do quick
    const input = document.getElementById('cliente-alert-days');
    if (input) {
      input.addEventListener('input', () => {
        const days = parseInt(input.value, 10) || 0;
        setSelectedDays(days);
      });
      input.focus();
    }

    // Click fora fecha
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) _close();
    });

    // Esc fecha
    const onKey = (event) => {
      if (event.key === 'Escape') {
        _close();
        document.removeEventListener('keydown', onKey);
      }
    };
    document.addEventListener('keydown', onKey);
  },

  close: _close,
};
