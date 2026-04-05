/**
 * CoolTrack Pro - Signature Module v1.0 (D1)
 * Assinatura digital do cliente via canvas touch/mouse
 * Embedded no PDF via jsPDF
 */

import { Utils } from './utils.js';
import { Toast }  from './toast.js';

const SIG_KEY = 'cooltrack-pending-signature';

export const SignatureModal = {
  _resolve: null,

  /**
   * Abre modal de assinatura. Retorna Promise<string|null>
   * string = dataURL da assinatura | null = cancelado
   */
  request(registroId, equipNome) {
    return new Promise(resolve => {
      this._resolve = resolve;
      this._open(registroId, equipNome);
    });
  },

  _open(registroId, equipNome) {
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

    const canvas  = document.getElementById('sig-canvas');
    const ctx     = canvas.getContext('2d');
    let drawing   = false;
    let hasSig    = false;

    // Escala para DPR
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = 480 * dpr;
    canvas.height = 180 * dpr;
    canvas.style.width  = '100%';
    canvas.style.height = '180px';
    ctx.scale(dpr, dpr);

    ctx.strokeStyle = '#E8F2FA';
    ctx.lineWidth   = 2.5;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';

    const getPos = (e) => {
      const r = canvas.getBoundingClientRect();
      const src = e.touches ? e.touches[0] : e;
      return {
        x: (src.clientX - r.left) * (480 / r.width),
        y: (src.clientY - r.top)  * (180 / r.height),
      };
    };

    const startDraw = (e) => {
      e.preventDefault();
      drawing = true;
      const p = getPos(e);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      if (!hasSig) {
        hasSig = true;
        document.getElementById('sig-placeholder').style.display = 'none';
      }
    };

    const draw = (e) => {
      if (!drawing) return;
      e.preventDefault();
      const p = getPos(e);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    };

    const stopDraw = () => { drawing = false; };

    // Mouse
    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup',   stopDraw);
    canvas.addEventListener('mouseleave', stopDraw);

    // Touch
    canvas.addEventListener('touchstart', startDraw, { passive: false });
    canvas.addEventListener('touchmove',  draw,      { passive: false });
    canvas.addEventListener('touchend',   stopDraw);

    // Limpar
    document.getElementById('sig-clear')?.addEventListener('click', () => {
      ctx.clearRect(0, 0, 480, 180);
      hasSig = false;
      document.getElementById('sig-placeholder').style.display = 'flex';
    });

    // Pular
    document.getElementById('sig-skip')?.addEventListener('click', () => {
      overlay.remove();
      this._resolve?.(null);
    });

    // Confirmar
    document.getElementById('sig-confirm')?.addEventListener('click', () => {
      if (!hasSig) {
        Toast.warning('Solicite ao cliente que assine antes de confirmar.');
        return;
      }

      // Gerar dataURL em resolução 2x
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width  = 480;
      exportCanvas.height = 180;
      const exportCtx = exportCanvas.getContext('2d');
      exportCtx.fillStyle = '#0C1929';
      exportCtx.fillRect(0, 0, 480, 180);
      exportCtx.drawImage(canvas, 0, 0, 480, 180);

      const dataUrl = exportCanvas.toDataURL('image/png');
      overlay.remove();
      this._resolve?.(dataUrl);
    });
  },
};

/**
 * Salva assinatura associada a um registro
 */
export function saveSignatureForRecord(registroId, dataUrl) {
  if (!dataUrl) return;
  try {
    const key  = `cooltrack-sig-${registroId}`;
    localStorage.setItem(key, dataUrl);
  } catch (_) {
    Toast.warning('Assinatura não pôde ser salva localmente (armazenamento cheio).');
  }
}

export function getSignatureForRecord(registroId) {
  return localStorage.getItem(`cooltrack-sig-${registroId}`) || null;
}