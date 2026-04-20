function getEventPoint(canvas, event) {
  const bounds = canvas.getBoundingClientRect();
  const source = event.touches ? event.touches[0] : event;

  return {
    x: (source.clientX - bounds.left) * (480 / bounds.width),
    y: (source.clientY - bounds.top) * (180 / bounds.height),
  };
}

export function createSignatureCanvas(canvas, placeholderEl) {
  const ctx = canvas.getContext('2d');
  let drawing = false;
  let hasSignature = false;

  const dpr = window.devicePixelRatio || 1;
  canvas.width = 480 * dpr;
  canvas.height = 180 * dpr;
  // O display é controlado pelo CSS do container — não forçamos altura fixa
  // pra que o aspect-ratio do wrapper (.sig-capture-modal__canvas) prevaleça
  // e o canvas ocupe 100% da área disponível em qualquer largura.
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  ctx.scale(dpr, dpr);

  ctx.strokeStyle = '#E8F2FA';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const startDraw = (event) => {
    event.preventDefault();
    drawing = true;
    const p = getEventPoint(canvas, event);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);

    if (!hasSignature) {
      hasSignature = true;
      if (placeholderEl) placeholderEl.style.display = 'none';
    }
  };

  const draw = (event) => {
    if (!drawing) return;
    event.preventDefault();
    const p = getEventPoint(canvas, event);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  };

  const stopDraw = () => {
    drawing = false;
  };

  canvas.addEventListener('mousedown', startDraw);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', stopDraw);
  canvas.addEventListener('mouseleave', stopDraw);

  canvas.addEventListener('touchstart', startDraw, { passive: false });
  canvas.addEventListener('touchmove', draw, { passive: false });
  canvas.addEventListener('touchend', stopDraw);

  return {
    hasSignature() {
      return hasSignature;
    },
    clear() {
      ctx.clearRect(0, 0, 480, 180);
      hasSignature = false;
      if (placeholderEl) placeholderEl.style.display = 'flex';
    },
    toDataUrl() {
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = 480;
      exportCanvas.height = 180;
      const exportCtx = exportCanvas.getContext('2d');
      exportCtx.fillStyle = '#0C1929';
      exportCtx.fillRect(0, 0, 480, 180);
      exportCtx.drawImage(canvas, 0, 0, 480, 180);
      return exportCanvas.toDataURL('image/png');
    },
  };
}
