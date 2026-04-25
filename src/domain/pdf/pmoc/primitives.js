/**
 * Primitivos para o PDF PMOC formal (Fase 5 PMOC, abr/2026).
 *
 * Helpers compartilhados pelas sections. Mantém doc state determinístico
 * (sempre reseta cor/fonte/tamanho ao desenhar) pra evitar leak de estilo
 * entre sections.
 */

import { PMOC_COLORS as PC, PMOC_TYPO as PT } from './constants.js';

/** Aplica família + tamanho + estilo de uma vez. */
export function applyTypo(doc, typo) {
  doc.setFont(typo.font || 'helvetica', typo.style || 'normal');
  doc.setFontSize(typo.size || 9);
}

/** Aplica cor de texto. Aceita PMOC_COLORS.* ou tupla [r,g,b]. */
export function setTextColor(doc, color) {
  doc.setTextColor(...(color || PC.text));
}

/**
 * Texto direto. Substitui múltiplos doc.setFont/setFontSize/setTextColor
 * espalhados pelo código de section.
 */
export function txt(doc, text, x, y, opts = {}) {
  const typo = opts.typo || PT.body;
  applyTypo(doc, typo);
  setTextColor(doc, opts.color || PC.text);
  doc.text(String(text == null ? '' : text), x, y, {
    align: opts.align || 'left',
    maxWidth: opts.maxWidth,
  });
}

/** Texto multi-linha com line-height controlado. Retorna nova Y. */
export function txtBlock(doc, lines, x, y, opts = {}) {
  const typo = opts.typo || PT.body;
  applyTypo(doc, typo);
  setTextColor(doc, opts.color || PC.text);
  const lineH = opts.lineH ?? 4.6;
  const arr = Array.isArray(lines) ? lines : String(lines).split('\n');
  arr.forEach((line, i) => {
    doc.text(String(line), x, y + i * lineH, { align: opts.align || 'left' });
  });
  return y + arr.length * lineH;
}

/** Linha horizontal estrutural. */
export function rule(doc, x1, y, x2, color = PC.rule, width = 0.4) {
  doc.setDrawColor(...color);
  doc.setLineWidth(width);
  doc.line(x1, y, x2, y);
}

/** Retângulo com fill + opcional border. */
export function fillRect(doc, x, y, w, h, color, withBorder = false) {
  doc.setFillColor(...color);
  if (withBorder) {
    doc.setDrawColor(...PC.border);
    doc.setLineWidth(0.2);
    doc.rect(x, y, w, h, 'FD');
  } else {
    doc.rect(x, y, w, h, 'F');
  }
}

/**
 * Banner de cabeçalho de seção. Renderiza:
 *   [TÍTULO DA SEÇÃO]
 *   ─────────────────────────
 *
 * Padrão usado por todas as sections do PMOC.
 */
export function sectionHeader(doc, x, y, width, title) {
  txt(doc, title.toUpperCase(), x, y, {
    typo: PT.sectionTitle,
    color: PC.text,
  });
  rule(doc, x, y + 1.5, x + width, PC.borderStrong, 0.5);
  return y + 6;
}

/**
 * Banner de cabeçalho de página continuada. Mais discreto que sectionHeader,
 * usado quando a seção quebra de página e a próxima precisa de orientação.
 */
export function continuationHeader(doc, x, y, width, title) {
  txt(doc, `${title} (continuação)`, x, y, {
    typo: PT.metaBold,
    color: PC.text3,
  });
  rule(doc, x, y + 1, x + width, PC.border, 0.2);
  return y + 4;
}

/**
 * Garante que há espaço vertical suficiente; senão cria nova página.
 * Retorna a nova Y após eventual page-break (mantém Y se cabe).
 */
export function ensureSpace(doc, y, needed, pageHeight, marginBottom, marginTop) {
  if (y + needed > pageHeight - marginBottom) {
    doc.addPage();
    return marginTop;
  }
  return y;
}

/**
 * Footer compacto: número da página + número PMOC + ano. Stampado em todas
 * as páginas pelo orquestrador, não pelas sections.
 */
export function stampPmocFooter(doc, pageWidth, pageHeight, marginLeft, marginRight, info) {
  const pageCount = doc.internal.pages.length - 1;
  for (let p = 1; p <= pageCount; p += 1) {
    doc.setPage(p);
    const y = pageHeight - 10;
    rule(doc, marginLeft, y - 3, pageWidth - marginRight, PC.border, 0.2);
    // Esquerda: PMOC YYYY/NN
    txt(doc, info.docNumber || '', marginLeft, y, {
      typo: PT.micro,
      color: PC.text3,
    });
    // Centro: ano-base
    txt(doc, `Ano-base ${info.ano}`, pageWidth / 2, y, {
      typo: PT.micro,
      color: PC.text3,
      align: 'center',
    });
    // Direita: paginação
    txt(doc, `Página ${p} de ${pageCount}`, pageWidth - marginRight, y, {
      typo: PT.micro,
      color: PC.text3,
      align: 'right',
    });
  }
}
