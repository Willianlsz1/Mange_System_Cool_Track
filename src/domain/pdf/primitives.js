import { PDF_COLORS } from './constants.js';

export function fillRect(doc, x, y, w, h, color) {
  doc.setFillColor(...color);
  doc.rect(x, y, w, h, 'F');
}

export function fillPage(doc, pageWidth, pageHeight) {
  fillRect(doc, 0, 0, pageWidth, pageHeight, PDF_COLORS.bg);
}

export function accentLine(doc, x1, y, x2, color = PDF_COLORS.primary) {
  doc.setDrawColor(...color);
  doc.setLineWidth(0.35);
  doc.line(x1, y, x2, y);
}

export function txt(doc, text, x, y, opts = {}) {
  doc.setFont('helvetica', opts.style || 'normal');
  doc.setFontSize(opts.size || 9);
  if (opts.color) doc.setTextColor(...opts.color);
  doc.text(String(text), x, y, { align: opts.align || 'left', maxWidth: opts.maxWidth });
}

export function roundRect(doc, x, y, w, h, r, color) {
  doc.setFillColor(...color);
  doc.setDrawColor(...PDF_COLORS.border);
  doc.roundedRect(x, y, w, h, r, r, 'FD');
}

// Marca d'água diagonal aplicada em todas as páginas. Usada no plano Free
// para que clientes do técnico vejam "CoolTrack Free" e descubram o produto.
//
// Implementação em malha: o texto se repete em diagonal por toda a página com
// opacidade baixa. Esse é o padrão de documentos "SAMPLE"/"DRAFT" em escritórios
// jurídicos e contábeis — diluído o bastante pra não obscurecer dado algum.
export function drawWatermarkAllPages(doc, pageWidth, pageHeight, options = {}) {
  const text = options.text || 'COOLTRACK FREE';
  const opacity = typeof options.opacity === 'number' ? options.opacity : 0.08;
  const angle = typeof options.angle === 'number' ? options.angle : -30;
  const fontSize = typeof options.fontSize === 'number' ? options.fontSize : 22;
  const color = options.color || PDF_COLORS.primary;

  // Espaçamento da malha (mm). Menor = mais denso; ajuste equilibra saturação
  // com densidade visual pra não parecer texto no meio da página.
  const stepX = typeof options.stepX === 'number' ? options.stepX : 70;
  const stepY = typeof options.stepY === 'number' ? options.stepY : 40;

  const totalPages = doc.internal.getNumberOfPages();
  const supportsGState = typeof doc.GState === 'function' && typeof doc.setGState === 'function';

  for (let i = 1; i <= totalPages; i += 1) {
    doc.setPage(i);

    if (supportsGState) {
      const gs = doc.GState({ opacity });
      doc.setGState(gs);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(fontSize);
    doc.setTextColor(...color);

    // Malha: começa fora da página (negativo) pra garantir cobertura nas bordas
    // mesmo com rotação diagonal.
    for (let y = -stepY; y <= pageHeight + stepY; y += stepY) {
      // Linhas alternadas em offset horizontal (padrão "tijolo") evita alinhamento
      // rígido e melhora a aparência de textura.
      const rowOffset = (Math.round(y / stepY) % 2) * (stepX / 2);
      for (let x = -stepX; x <= pageWidth + stepX; x += stepX) {
        doc.text(text, x + rowOffset, y, { align: 'center', angle });
      }
    }

    if (supportsGState) {
      const gsReset = doc.GState({ opacity: 1 });
      doc.setGState(gsReset);
    }
  }
}

export function getSignatureImagePayload(signatureData) {
  if (!signatureData || typeof signatureData !== 'string') return null;

  const raw = signatureData.trim();
  if (!raw) return null;

  const dataUrlMatch = raw.match(/^data:image\/(png|jpe?g|webp);base64,/i);
  if (dataUrlMatch) {
    const formatRaw = dataUrlMatch[1].toLowerCase();
    const format = formatRaw === 'jpg' ? 'JPEG' : formatRaw.toUpperCase();
    return { data: raw, format };
  }

  if (/^[A-Za-z0-9+/=\s]+$/.test(raw)) {
    return { data: `data:image/png;base64,${raw.replace(/\s+/g, '')}`, format: 'PNG' };
  }

  return null;
}
