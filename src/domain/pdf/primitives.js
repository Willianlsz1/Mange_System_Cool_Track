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

export function drawSignaturePageHeader(doc, pageWidth, margin) {
  fillRect(doc, 0, 0, pageWidth, 18, PDF_COLORS.bg2);
  fillRect(doc, 0, 0, pageWidth, 3, PDF_COLORS.primary);
  txt(doc, 'COOLTRACK PRO', margin + 2, 8, {
    size: 7,
    style: 'bold',
    color: PDF_COLORS.primary,
  });
  txt(doc, 'COMPROVANTE DE SERVIÇO', margin + 40, 8, {
    size: 7,
    style: 'bold',
    color: PDF_COLORS.text,
  });
  accentLine(doc, 0, 18, pageWidth);
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
