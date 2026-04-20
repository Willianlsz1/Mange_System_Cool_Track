/**
 * CoolTrack Pro - SignatureModal (captura)
 * Modal de coleta de assinatura do cliente. Reusa o desenho visual do
 * SignatureViewerModal (card com header + backdrop blur + footer limpo),
 * mas com canvas interativo e ações Limpar / Pular / Confirmar.
 *
 * IDs preservados (`sig-canvas`, `sig-placeholder`) pra continuar compatível
 * com `createSignatureCanvas`. Classes BEM novas sob `.sig-capture-modal__*`.
 */

import { Utils } from '../../../core/utils.js';
import { Toast } from '../../../core/toast.js';
import { attachDialogA11y } from '../../../core/modal.js';
import { createSignatureCanvas } from './signature-canvas.js';

const OVERLAY_ID = 'modal-signature-overlay';

export const SignatureModal = {
  _resolve: null,

  request(registroId, equipNome) {
    return new Promise((resolve) => {
      this._resolve = resolve;
      this._open(registroId, equipNome);
    });
  },

  _open(_registroId, equipNome) {
    // Remove instância anterior se houver (clique duplo no salvar).
    document.getElementById(OVERLAY_ID)?.remove();

    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.className = 'sig-capture-modal is-open';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'sig-title');

    const now = new Date().toLocaleString('pt-BR');
    const safeEquip = Utils.escapeHtml(equipNome || 'Equipamento');

    overlay.innerHTML = `
      <div class="sig-capture-modal__backdrop" data-action="sig-skip" aria-hidden="true"></div>
      <div class="sig-capture-modal__card" role="document">
        <div class="sig-capture-modal__header">
          <span class="sig-capture-modal__header-ic" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 19l7-7 3 3-7 7-3-3z"/>
              <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
              <path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/>
            </svg>
          </span>
          <h2 class="sig-capture-modal__title" id="sig-title">Assinatura do cliente</h2>
          <button type="button" class="sig-capture-modal__close" data-action="sig-skip"
            aria-label="Pular assinatura e fechar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div class="sig-capture-modal__body">
          <div class="sig-capture-modal__context">
            <div class="sig-capture-modal__context-row">
              <span class="sig-capture-modal__context-label">Serviço realizado em</span>
              <span class="sig-capture-modal__context-value">${safeEquip}</span>
            </div>
            <div class="sig-capture-modal__context-row">
              <span class="sig-capture-modal__context-label">Agora</span>
              <span class="sig-capture-modal__context-value is-mono">${Utils.escapeHtml(now)}</span>
            </div>
          </div>

          <div class="sig-capture-modal__instruction">
            Solicite ao cliente que assine abaixo
          </div>

          <div class="sig-capture-modal__canvas">
            <canvas id="sig-canvas" class="sig-capture-modal__canvas-surface"
              width="480" height="180" aria-label="Área de assinatura"></canvas>
            <div class="sig-capture-modal__placeholder" id="sig-placeholder" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                <path d="m19 12-7 7-7-7"/><path d="M19 5H5"/>
              </svg>
              Assine aqui
            </div>
          </div>

          <p class="sig-capture-modal__legal">
            Ao assinar, o cliente confirma a execução do serviço descrito neste registro.
          </p>
        </div>

        <div class="sig-capture-modal__footer">
          <button type="button" class="btn-ghost sig-capture-modal__btn-clear" id="sig-clear">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              <path d="m6 6 1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"/>
            </svg>
            Limpar
          </button>
          <div class="sig-capture-modal__footer-primary">
            <button type="button" class="btn-ghost" id="sig-skip" data-action="sig-skip">
              Pular
            </button>
            <button type="button" class="btn-primary" id="sig-confirm">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Confirmar assinatura
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const canvas = document.getElementById('sig-canvas');
    const placeholder = document.getElementById('sig-placeholder');
    const signatureCanvas = createSignatureCanvas(canvas, placeholder);

    let dismiss = () => {};
    const teardown = () => {
      try {
        dismiss();
      } catch (_error) {
        /* no-op */
      }
      overlay.remove();
    };

    // Skip é equivalente a fechar sem assinatura (backdrop, X, botão Pular).
    const skipAndResolve = () => {
      teardown();
      this._resolve?.(null);
    };

    const detachA11y = attachDialogA11y(overlay, { onDismiss: skipAndResolve });
    dismiss = detachA11y;

    // Backdrop, X e botão Pular → fecha e resolve(null).
    overlay.addEventListener('click', (event) => {
      const skipper = event.target.closest?.('[data-action="sig-skip"]');
      if (skipper) {
        event.preventDefault();
        skipAndResolve();
      }
    });

    document.getElementById('sig-clear')?.addEventListener('click', () => {
      signatureCanvas.clear();
    });

    document.getElementById('sig-confirm')?.addEventListener('click', () => {
      if (!signatureCanvas.hasSignature()) {
        Toast.warning('Solicite ao cliente que assine antes de confirmar.');
        return;
      }

      const dataUrl = signatureCanvas.toDataUrl();
      teardown();
      this._resolve?.(dataUrl);
    });
  },
};
