/**
 * CoolTrack Pro - PMOC Modal (Fase 5 PMOC, abr/2026)
 *
 * Modal de configuração antes de gerar o PDF PMOC formal:
 *   - Seletor de ano-base (default = ano corrente)
 *   - Seletor de cliente (opcional — null = PMOC sem vínculo formal)
 *   - Botão Gerar
 *
 * Pro-gated: Free/Plus veem variante "lock" com CTA upsell. A decisão
 * de qual variante mostrar é responsabilidade do chamador (passa
 * `isPro` no opts).
 */

import { Utils } from '../../core/utils.js';
import { Toast } from '../../core/toast.js';
import { attachDialogA11y } from '../../core/modal.js';
import { goTo } from '../../core/router.js';

const OVERLAY_ID = 'pmoc-modal-overlay';
let _a11yCleanup = null;

function buildOverlayHtml({ ano, clientes, isPro, preselectClienteId }) {
  const optionsClientes = (clientes || [])
    .map((c) => {
      const sel = preselectClienteId && c.id === preselectClienteId ? ' selected' : '';
      return `<option value="${Utils.escapeAttr(c.id)}"${sel}>${Utils.escapeHtml(c.nome)}</option>`;
    })
    .join('');
  const anoOptions = (() => {
    const current = new Date().getFullYear();
    const years = [];
    for (let y = current + 1; y >= current - 5; y -= 1) years.push(y);
    return years
      .map((y) => `<option value="${y}"${y === ano ? ' selected' : ''}>${y}</option>`)
      .join('');
  })();

  return `
    <div class="modal pmoc-modal">
      <header class="pmoc-modal__head">
        <div class="pmoc-modal__head-text">
          <h2 class="pmoc-modal__title" id="pmoc-modal-title">
            Gerar PMOC formal
            ${isPro ? '' : '<span class="pro-badge pro-badge--inline">PRO</span>'}
          </h2>
          <p class="pmoc-modal__sub">
            Documento anual conforme NBR 13971 — capa institucional, cadastro técnico,
            cronograma 12 meses e termo de responsabilidade técnica.
          </p>
        </div>
        <button type="button" class="pmoc-modal__close" id="pmoc-close" aria-label="Fechar">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </header>

      <div class="pmoc-modal__body">
        ${
          isPro
            ? ''
            : `<div class="pmoc-modal__lock">
                <div class="pmoc-modal__lock-icon" aria-hidden="true">🔒</div>
                <div>
                  <strong>PMOC formal é exclusivo do plano Pro.</strong>
                  <p>O Pro inclui geração ilimitada de documentos PMOC com
                     numeração sequencial, layout monocromático formal,
                     termo de RT e cronograma anual.</p>
                </div>
              </div>`
        }

        <div class="pmoc-modal__field">
          <label class="pmoc-modal__label" for="pmoc-ano">Ano-base</label>
          <select id="pmoc-ano" class="form-control pmoc-modal__input" ${isPro ? '' : 'disabled'}>
            ${anoOptions}
          </select>
          <div class="pmoc-modal__hint">Cobertura jan–dez do ano selecionado.</div>
        </div>

        <div class="pmoc-modal__field">
          <label class="pmoc-modal__label" for="pmoc-cliente">Cliente</label>
          <select id="pmoc-cliente" class="form-control pmoc-modal__input" ${
            isPro ? '' : 'disabled'
          }>
            <option value=""${preselectClienteId ? '' : ' selected'}>Sem cliente vinculado (genérico)</option>
            ${optionsClientes}
          </select>
          <div class="pmoc-modal__hint">
            Filtra equipamentos do cliente. Sem vínculo gera PMOC com todos seus equipamentos.
          </div>
        </div>

        <div class="pmoc-modal__actions">
          <button type="button" class="btn btn--outline pmoc-modal__btn" id="pmoc-cancel">
            Cancelar
          </button>
          ${
            isPro
              ? `<button type="button" class="btn btn--primary pmoc-modal__btn" id="pmoc-generate">
                  Gerar PDF PMOC
                </button>`
              : `<button type="button" class="btn btn--primary pmoc-modal__btn" id="pmoc-upgrade"
                  data-action="open-upgrade" data-upgrade-source="pmoc_modal" data-highlight-plan="pro">
                  Desbloquear com Pro →
                </button>`
          }
        </div>
      </div>
    </div>
  `;
}

function open({ clientes, isPro, onConfirm, preselectClienteId = null }) {
  document.getElementById(OVERLAY_ID)?.remove();

  const anoDefault = new Date().getFullYear();
  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.className = 'modal-overlay is-open pmoc-modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'pmoc-modal-title');
  overlay.innerHTML = buildOverlayHtml({ ano: anoDefault, clientes, isPro, preselectClienteId });
  document.body.appendChild(overlay);

  const hardClose = () => {
    if (typeof _a11yCleanup === 'function') {
      _a11yCleanup();
      _a11yCleanup = null;
    }
    overlay.remove();
  };

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) hardClose();
  });
  overlay.querySelector('#pmoc-cancel')?.addEventListener('click', hardClose);
  overlay.querySelector('#pmoc-close')?.addEventListener('click', hardClose);
  _a11yCleanup = attachDialogA11y(overlay, { onDismiss: hardClose });

  if (isPro) {
    const generateBtn = overlay.querySelector('#pmoc-generate');
    generateBtn?.addEventListener('click', async () => {
      const ano = Number(overlay.querySelector('#pmoc-ano')?.value || anoDefault);
      const clienteId = overlay.querySelector('#pmoc-cliente')?.value || null;
      const cliente = clienteId ? (clientes || []).find((c) => c.id === clienteId) || null : null;
      generateBtn.disabled = true;
      const original = generateBtn.textContent;
      generateBtn.textContent = 'Gerando...';
      try {
        await onConfirm({ ano, cliente });
        hardClose();
      } catch (error) {
        Toast.error(error?.message || 'Falha ao gerar PMOC.');
        generateBtn.disabled = false;
        generateBtn.textContent = original;
      }
    });
  } else {
    overlay.querySelector('#pmoc-upgrade')?.addEventListener('click', () => {
      hardClose();
      goTo('pricing', { highlightPlan: 'pro' });
    });
  }
}

export const PmocModal = { open };
