/**
 * PMOC V2 (abr/2026) — Seção 4: PLANO DE MANUTENÇÃO.
 *
 * Tabela tabular com 4 frequências (Mensal, Trimestral, Semestral, Anual)
 * e suas atividades + objetivos. Texto baseado em ABNT NBR 13971/2014
 * §5.2 (procedimentos de manutenção preventiva por periodicidade).
 *
 * Renderiza DEPOIS do cronograma (que mostra QUANDO foi feito) — esse
 * detalha O QUE deve ser feito a cada periodicidade. Juntos atendem ao
 * requisito do PMOC formal de "plano declarado + execução comprovada".
 */

import autoTable from 'jspdf-autotable';
import { numberedSectionHeader, txt } from '../primitives.js';
import { PMOC_COLORS as PC, PMOC_TYPO as PT } from '../constants.js';

// Atividades padrão por periodicidade. Texto pode ser customizado no
// futuro via profile.plano_manutencao_custom (TODO Fase 5+).
const PLANO_PADRAO = [
  {
    periodo: 'MENSAL',
    atividades: [
      'Limpeza ou substituição dos filtros de ar',
      'Verificação das condições de operação',
      'Verificação de ruídos e vibrações',
      'Verificação dos drenos de condensado',
    ],
    objetivo: 'Garantir a qualidade do ar e o desempenho adequado do sistema.',
  },
  {
    periodo: 'TRIMESTRAL',
    atividades: [
      'Verificação elétrica dos componentes',
      'Verificação de pressões e temperaturas',
      'Limpeza das serpentinas (evaporadora e condensadora)',
    ],
    objetivo: 'Garantir segurança operacional e eficiência energética.',
  },
  {
    periodo: 'SEMESTRAL',
    atividades: [
      'Limpeza geral do sistema',
      'Verificação de isolamento térmico',
      'Testes de funcionamento completo',
    ],
    objetivo: 'Garantir vida útil do equipamento e conformidade normativa.',
  },
  {
    periodo: 'ANUAL',
    atividades: [
      'Revisão completa do sistema',
      'Verificação do fluido refrigerante',
      'Relatório técnico de conformidade',
    ],
    objetivo: 'Assegurar conformidade com as normas e emissão do relatório PMOC.',
  },
];

export function drawPmocPlano(doc, pageWidth, pageHeight, margins, _ctx) {
  const left = margins.left;
  const right = pageWidth - margins.right;
  const innerW = right - left;
  let y = doc.lastAutoTable?.finalY || margins.top;

  // Se ja estamos perto do fim da pagina, quebra (a secao precisa de ~80mm)
  if (y + 80 > pageHeight - margins.bottom) {
    doc.addPage();
    y = margins.top;
  } else {
    y += 12; // gap depois do cronograma
  }

  y = numberedSectionHeader(doc, left, y, innerW, 4, 'Plano de manutenção');
  y += 2;

  const head = [['Periodicidade', 'Atividades programadas', 'Objetivo']];
  const body = PLANO_PADRAO.map((row) => [
    row.periodo,
    row.atividades.map((a) => `• ${a}`).join('\n'),
    row.objetivo,
  ]);

  autoTable(doc, {
    startY: y,
    head,
    body,
    margin: { left, right: margins.right },
    theme: 'grid',
    styles: {
      font: PT.body.font,
      fontSize: PT.meta.size,
      cellPadding: 3,
      textColor: PC.text,
      lineColor: PC.border,
      lineWidth: 0.15,
      valign: 'top',
      minCellHeight: 14,
    },
    headStyles: {
      fillColor: PC.navy,
      textColor: PC.white,
      fontStyle: 'bold',
      fontSize: PT.metaBold.size,
      halign: 'left',
      cellPadding: 3,
    },
    columnStyles: {
      0: {
        cellWidth: 28,
        fontStyle: 'bold',
        halign: 'center',
        valign: 'middle',
        fillColor: PC.bg2,
      },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 60, textColor: PC.text2 },
    },
  });

  y = doc.lastAutoTable.finalY + 6;

  // V2: nota de rodape regulatoria
  doc.setFillColor(...PC.navySoft);
  doc.setDrawColor(...PC.navyBorder);
  doc.setLineWidth(0.3);
  const noteH = 12;
  if (y + noteH > pageHeight - margins.bottom) {
    doc.addPage();
    y = margins.top;
  }
  doc.rect(left, y, innerW, noteH, 'FD');
  txt(doc, 'NOTA', left + 5, y + 5.5, {
    typo: { font: 'helvetica', size: 6.5, style: 'bold' },
    color: PC.navy,
  });
  txt(
    doc,
    'Todas as atividades deverão ser registradas com data, responsável e observações técnicas, mantendo histórico disponível para fiscalização.',
    left + 5,
    y + 9,
    { typo: { font: 'helvetica', size: 8 }, color: PC.text2, maxWidth: innerW - 10 },
  );
}
