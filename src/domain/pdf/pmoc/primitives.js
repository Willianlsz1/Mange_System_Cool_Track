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
 * V2 (abr/2026): cabecalho de secao NUMERADO com badge azul navy.
 * Visual:  [1] TITULO DA SECAO
 *          ────────────────────────
 *
 * O numero fica num quadradinho navy a esquerda, mais profissional/formal
 * que o sectionHeader simples. Usado nas 6 secoes principais do PMOC.
 */
export function numberedSectionHeader(doc, x, y, width, num, title) {
  // Badge quadrado navy com numero branco
  const badgeSize = 6;
  doc.setFillColor(...PC.navy);
  doc.rect(x, y - 4.5, badgeSize, badgeSize, 'F');
  txt(doc, String(num), x + badgeSize / 2, y, {
    typo: { ...PT.bodyBold, size: 8 },
    color: PC.white,
    align: 'center',
  });

  // Titulo a direita do badge
  txt(doc, title.toUpperCase(), x + badgeSize + 4, y, {
    typo: PT.sectionTitle,
    color: PC.navy,
  });

  // Linha separadora navy fina
  rule(doc, x, y + 2.5, x + width, PC.navy, 0.5);
  return y + 8;
}

/**
 * V2: card de resumo executivo (numero/valor grande + label embaixo).
 * Box com borda fina cinza + barra lateral navy. Usado nos 4 cards
 * de Resumo Executivo da capa.
 *   ┌─┬───────────────┐
 *   │█│ 1             │
 *   │█│ Equipamento   │
 *   └─┴───────────────┘
 */
export function summaryCard(doc, x, y, w, h, value, label, opts = {}) {
  // Box branco com borda
  doc.setDrawColor(...PC.border);
  doc.setLineWidth(0.3);
  doc.setFillColor(...PC.white);
  doc.rect(x, y, w, h, 'FD');
  // Barra lateral navy
  doc.setFillColor(...PC.navy);
  doc.rect(x, y, 1.8, h, 'F');
  // Valor grande
  txt(doc, value, x + 5, y + 8, {
    typo: { font: 'helvetica', size: opts.smallValue ? 11 : 16, style: 'bold' },
    color: PC.text,
  });
  // Label embaixo, em multiplas linhas se precisar
  const labelLines = Array.isArray(label) ? label : [label];
  let ly = y + (opts.smallValue ? 13 : 14);
  labelLines.forEach((line) => {
    txt(doc, line, x + 5, ly, {
      typo: { font: 'helvetica', size: 6.5, style: 'normal' },
      color: PC.text3,
    });
    ly += 3;
  });
}

/**
 * V2: badge destacado pra DOCUMENTO Nº + ANO-BASE (capa).
 * Caixa com fundo navySoft + borda navyBorder, label uppercase + valor bold.
 */
export function badgeBox(doc, x, y, w, h, label, value, opts = {}) {
  doc.setFillColor(...(opts.bg || PC.navySoft));
  doc.setDrawColor(...(opts.border || PC.navyBorder));
  doc.setLineWidth(0.4);
  doc.rect(x, y, w, h, 'FD');
  txt(doc, label.toUpperCase(), x + 4, y + 5.5, {
    typo: { font: 'helvetica', size: 6.5, style: 'bold' },
    color: PC.text3,
  });
  txt(doc, value, x + 4, y + 11, {
    typo: { font: 'helvetica', size: 12, style: 'bold' },
    color: opts.valueColor || PC.navy,
  });
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
 */
export function ensureSpace(doc, y, needed, pageHeight, marginBottom, marginTop) {
  if (y + needed > pageHeight - marginBottom) {
    doc.addPage();
    return marginTop;
  }
  return y;
}

/**
 * Footer compacto: número da página + número PMOC + ano.
 */
export function stampPmocFooter(doc, pageWidth, pageHeight, marginLeft, marginRight, info) {
  const pageCount = doc.internal.pages.length - 1;
  for (let p = 1; p <= pageCount; p += 1) {
    doc.setPage(p);
    const y = pageHeight - 10;
    rule(doc, marginLeft, y - 3, pageWidth - marginRight, PC.border, 0.2);
    txt(doc, info.docNumber || '', marginLeft, y, {
      typo: PT.micro,
      color: PC.text3,
    });
    txt(doc, `Ano-base ${info.ano}`, pageWidth / 2, y, {
      typo: PT.micro,
      color: PC.text3,
      align: 'center',
    });
    txt(doc, `Página ${p} de ${pageCount}`, pageWidth - marginRight, y, {
      typo: PT.micro,
      color: PC.text3,
      align: 'right',
    });
  }
}
