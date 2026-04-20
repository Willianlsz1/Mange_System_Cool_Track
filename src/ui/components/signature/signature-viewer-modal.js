/**
 * CoolTrack Pro - SignatureViewerModal
 * Lightbox read-only da assinatura coletada. Lê o PNG do localStorage via
 * getSignatureForRecord e exibe em tamanho grande com fundo claro pra
 * preservar a rubrica original.
 *
 * API pública:
 *   SignatureViewerModal.open(registro, { equipNome }) → Promise<void>
 *
 * Edge cases:
 *   - PNG ausente no device (cleanup, outro aparelho): o chamador não deve
 *     abrir o modal; a view usa o fallback "chip-only + tooltip".
 *     Mesmo assim, o modal tolera ausência e mostra mensagem amigável.
 *
 * Decisão de produto: não expomos "baixar PNG". A rubrica tem valor legal
 * atrelada ao registro e ao PDF oficial do serviço — baixar como arquivo
 * solto confundiria o fluxo.
 *
 * Markup: segue o contrato `.hist-signature-modal__*` definido no mockup do
 * Claude Design (docs/design/prompts/04-historico-redesign.md). As classes
 * visuais moram em components.css, scoped sob `#view-historico`.
 */

import { Utils } from '../../../core/utils.js';
import { attachDialogA11y } from '../../../core/modal.js';
import { getSignatureForRecord } from './signature-storage.js';

const OVERLAY_ID = 'modal-signature-viewer-overlay';

export const SignatureViewerModal = {
  /**
   * Abre o modal com a assinatura do registro.
   * @param {Object} registro - O registro completo (contém data, clienteNome, etc.)
   * @param {Object} options
   * @param {string} [options.equipNome] - Nome do equipamento pra meta
   */
  open(registro, { equipNome = '—' } = {}) {
    if (!registro || !registro.id) return Promise.resolve();

    // Remove instância anterior se houver (clique duplo).
    document.getElementById(OVERLAY_ID)?.remove();

    const dataUrl = getSignatureForRecord(registro.id);

    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.className = 'hist-signature-modal is-open';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'sig-viewer-title');

    const dataFormatted = registro.data ? Utils.formatDatetime(registro.data) : '—';
    const clienteNome = registro.clienteNome?.trim() || '—';
    const clienteDoc = registro.clienteDocumento?.trim() || '—';
    const tipoServico = registro.tipo?.trim() || '—';

    const canvasInner = dataUrl
      ? `<img class="hist-signature-modal__image"
             src="${Utils.escapeAttr(dataUrl)}"
             alt="Assinatura do cliente ${Utils.escapeAttr(clienteNome)}" />`
      : `<div class="hist-signature-modal__missing" role="status">
           <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
             <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
             <line x1="12" y1="16" x2="12.01" y2="16"/>
           </svg>
           <strong>Assinatura não disponível neste dispositivo</strong>
           <span>A rubrica foi coletada em outro aparelho. Assinaturas ficam armazenadas localmente
             por padrão — acesse o mesmo dispositivo em que o cliente assinou.</span>
         </div>`;

    overlay.innerHTML = `
      <div class="hist-signature-modal__backdrop" data-action="close-viewer" aria-hidden="true"></div>
      <div class="hist-signature-modal__card" role="document">
        <div class="hist-signature-modal__header">
          <span class="hist-signature-modal__header-ic" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 19l7-7 3 3-7 7-3-3z"/>
              <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
              <path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/>
            </svg>
          </span>
          <h2 class="hist-signature-modal__title" id="sig-viewer-title">Assinatura do cliente</h2>
          <button type="button" class="hist-signature-modal__close" data-action="close-viewer"
            aria-label="Fechar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div class="hist-signature-modal__body">
          <div class="hist-signature-modal__canvas">${canvasInner}</div>

          <div class="hist-signature-modal__meta">
            <div class="hist-signature-modal__meta-item">
              <span class="hist-signature-modal__meta-label">Cliente</span>
              <span class="hist-signature-modal__meta-value">${Utils.escapeHtml(clienteNome)}</span>
            </div>
            <div class="hist-signature-modal__meta-item">
              <span class="hist-signature-modal__meta-label">Documento</span>
              <span class="hist-signature-modal__meta-value is-mono">${Utils.escapeHtml(clienteDoc)}</span>
            </div>
            <div class="hist-signature-modal__meta-item">
              <span class="hist-signature-modal__meta-label">Coletada em</span>
              <span class="hist-signature-modal__meta-value is-mono">${Utils.escapeHtml(dataFormatted)}</span>
            </div>
            <div class="hist-signature-modal__meta-item">
              <span class="hist-signature-modal__meta-label">Serviço</span>
              <span class="hist-signature-modal__meta-value">${Utils.escapeHtml(tipoServico)}</span>
            </div>
            <div class="hist-signature-modal__meta-item hist-signature-modal__meta-item--full">
              <span class="hist-signature-modal__meta-label">Equipamento</span>
              <span class="hist-signature-modal__meta-value">${Utils.escapeHtml(equipNome)}</span>
            </div>
          </div>
        </div>

        <div class="hist-signature-modal__footer">
          <button type="button" class="btn-primary" data-action="close-viewer">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Fechar
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    let dismiss = () => {};
    const teardown = () => {
      try {
        dismiss();
      } catch (_error) {
        /* no-op */
      }
      overlay.remove();
    };

    const detachA11y = attachDialogA11y(overlay, { onDismiss: teardown });
    dismiss = detachA11y;

    // Backdrop click e botão "X" / "Fechar" disparam close-viewer.
    overlay.addEventListener('click', (event) => {
      const closer = event.target.closest?.('[data-action="close-viewer"]');
      if (closer) {
        event.preventDefault();
        teardown();
      }
    });

    return Promise.resolve();
  },
};
