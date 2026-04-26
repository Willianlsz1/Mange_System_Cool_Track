/**
 * PMOC V2 (abr/2026) — Seção 6: ANEXOS E EVIDÊNCIAS.
 *
 * Checklist do que deve estar anexado/disponível para fiscalização.
 * Renderiza DEPOIS do Termo de RT (seção 5), tipicamente na ultima
 * pagina. Itens vem com checkbox (✓ ou ☐) — todos checked por default
 * porque o PMOC eh declaratorio: o RT esta atestando que tem esses
 * registros disponiveis.
 */

import { numberedSectionHeader, txt } from '../primitives.js';
import { PMOC_COLORS as PC, PMOC_TYPO as PT } from '../constants.js';

const ANEXOS_PADRAO = [
  'Relatórios de execução das manutenções',
  'Registro fotográfico das atividades realizadas',
  'Comprovantes de limpeza e substituição de filtros',
  'Outros documentos pertinentes (laudos, certificados, planos)',
];

export function drawPmocAnexos(doc, pageWidth, pageHeight, margins, _ctx) {
  // V2 fix: SEMPRE inicia em pagina nova. Antes estava chutando
  // `margins.top + 100` (posicao fixa) que sobrepunha o termo
  // quando este tinha bastante conteudo.
  doc.addPage();

  const left = margins.left;
  const right = pageWidth - margins.right;
  const innerW = right - left;
  let y = margins.top;

  y = numberedSectionHeader(doc, left, y, innerW, 6, 'Anexos e evidências');
  y += 6;

  // Subtitulo explicativo (com maxWidth pra wrap natural)
  txt(
    doc,
    'Os documentos abaixo compõem o conjunto de evidências do PMOC e devem estar disponíveis para fiscalização:',
    left,
    y,
    { typo: { ...PT.body, size: 9.5 }, color: PC.text2, maxWidth: innerW },
  );
  y += 10; // espaco extra pra acomodar wrap se necessario

  // Lista de anexos com checkbox + label
  ANEXOS_PADRAO.forEach((item) => {
    // Checkbox quadrado navy
    doc.setDrawColor(...PC.navy);
    doc.setLineWidth(0.4);
    doc.rect(left, y - 3.5, 4, 4, 'S');
    // V check
    doc.setLineWidth(0.6);
    doc.line(left + 0.7, y - 1.5, left + 1.7, y - 0.5);
    doc.line(left + 1.7, y - 0.5, left + 3.3, y - 3);

    // Texto do item — afastado do checkbox pra nao colar
    txt(doc, item, left + 7, y, {
      typo: { ...PT.body, size: 10 },
      color: PC.text,
    });
    y += 7;
  });

  y += 6;

  // V2 fix: box "Autenticidade" com altura DINAMICA baseada no conteudo
  // Antes era 12mm fixo, mas o texto wrap-a em 2 linhas e estourava a caixa.
  // Calcula linhas previamente e usa altura adequada.
  const noteText =
    'Os registros listados são gerados pelo CoolTrack Pro e podem ser auditados pela autoridade sanitária local.';
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  const noteLines = doc.splitTextToSize(noteText, innerW - 10);
  const lineH = 4.2;
  const noteH = 8 + noteLines.length * lineH + 4; // 8mm pro label + linhas + padding

  doc.setFillColor(...PC.navySoft);
  doc.setDrawColor(...PC.navyBorder);
  doc.setLineWidth(0.3);
  doc.rect(left, y, innerW, noteH, 'FD');

  txt(doc, 'AUTENTICIDADE', left + 5, y + 5.5, {
    typo: { font: 'helvetica', size: 6.5, style: 'bold' },
    color: PC.navy,
  });

  doc.setTextColor(...PC.text2);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  noteLines.forEach((line, i) => {
    doc.text(line, left + 5, y + 10 + i * lineH);
  });
}
