import { Utils } from '../../../core/utils.js';
import { Toast } from '../../../core/toast.js';
import { createSignatureCanvas } from './signature-canvas.js';

export const SignatureModal = {
  _resolve: null,

  request(registroId, equipNome) {
    return new Promise((resolve) => {
      this._resolve = resolve;
      this._open(registroId, equipNome);
    });
  },

  _open(_registroId, equipNome) {
    document.getElementById('modal-signature-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'modal-signature-overlay';
    overlay.className = 'modal-overlay is-open';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'sig-title');

    const now = new Date().toLocaleString('pt-BR');

    overlay.innerHTML = `
      <div class="modal" style="max-width:520px;">
        <div class="modal__handle"></div>
        <div class="modal__title" id="sig-title">Assinatura do Cliente</div>
        <p class="sig-desc">
          Serviço realizado em: <strong>${Utils.escapeHtml(equipNome)}</strong><br>
          <span style="font-family:var(--font-mono);font-size:11px;color:var(--text-3)">${now}</span>
        </p>
        <div class="sig-instruction">Solicite ao cliente que assine abaixo</div>
        <div class="sig-canvas-wrapper">
          <canvas id="sig-canvas" class="sig-canvas" width="480" height="180"
            aria-label="Área de assinatura"></canvas>
          <div class="sig-placeholder" id="sig-placeholder">← Assine aqui</div>
        </div>
        <div class="sig-actions">
          <button class="btn btn--outline btn--sm" id="sig-clear">Limpar</button>
          <div style="display:flex;gap:8px;">
            <button class="btn btn--outline btn--sm" id="sig-skip">Pular</button>
            <button class="btn btn--primary btn--sm" id="sig-confirm">Confirmar Assinatura</button>
          </div>
        </div>
        <p class="sig-legal">
          Ao assinar, o cliente confirma a execução do serviço descrito neste registro.
        </p>
      </div>
    `;

    document.body.appendChild(overlay);

    const canvas = document.getElementById('sig-canvas');
    const placeholder = document.getElementById('sig-placeholder');
    const signatureCanvas = createSignatureCanvas(canvas, placeholder);

    document.getElementById('sig-clear')?.addEventListener('click', () => {
      signatureCanvas.clear();
    });

    document.getElementById('sig-skip')?.addEventListener('click', () => {
      overlay.remove();
      this._resolve?.(null);
    });

    document.getElementById('sig-confirm')?.addEventListener('click', () => {
      if (!signatureCanvas.hasSignature()) {
        Toast.warning('Solicite ao cliente que assine antes de confirmar.');
        return;
      }

      const dataUrl = signatureCanvas.toDataUrl();
      overlay.remove();
      this._resolve?.(dataUrl);
    });
  },
};
