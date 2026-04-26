/**
 * PMOC Fase 5.D — Cronograma anual de manutenção.
 *
 * Matriz 12 meses × equipamentos. Para cada (equip, mes), classifica
 * o que aconteceu/está planejado:
 *   R = realizada (preventiva concluída no mês)
 *   C = corretiva (manutenção corretiva registrada no mês)
 *   L = limpeza (limpeza específica registrada no mês)
 *   P = planejada (preventiva esperada baseado em periodicidadePreventivaDias)
 *   — = sem ação prevista nem registrada
 *
 * Layout em landscape virtual: 14 colunas (1 equip + 12 meses + 1 obs).
 * Em A4 portrait com margens de 18mm fica apertado mas legível na fonte 7pt.
 */

import autoTable from 'jspdf-autotable';
import { sectionHeader, numberedSectionHeader, txt } from '../primitives.js';
import { PMOC_COLORS as PC, PMOC_TYPO as PT, SCHEDULE_MARK as M } from '../constants.js';

/**
 * V2: Legenda visual do cronograma com pílulas coloridas.
 * Cada item: [letra colorida][label] em sequência horizontal.
 */
function drawScheduleLegend(doc, left, y, _innerW) {
  const items = [
    { mark: 'R', label: 'Realizada (preventiva)', color: PC.ok },
    { mark: 'C', label: 'Corretiva', color: PC.text },
    { mark: 'L', label: 'Limpeza', color: PC.text2 },
    { mark: 'P', label: 'Planejada', color: PC.warn },
    { mark: '—', label: 'Sem ação', color: PC.na },
  ];
  txt(doc, 'Legenda:', left, y, {
    typo: { font: 'helvetica', size: 7.5, style: 'bold' },
    color: PC.text2,
  });
  let cursorX = left + 18;
  items.forEach((it) => {
    // Bullet/letra colorida em circle
    doc.setFillColor(...it.color);
    doc.circle(cursorX + 1.5, y - 1.2, 1.8, 'F');
    txt(doc, it.mark, cursorX + 1.5, y, {
      typo: { font: 'helvetica', size: 6.5, style: 'bold' },
      color: PC.white,
      align: 'center',
    });
    txt(doc, `= ${it.label}`, cursorX + 5, y, {
      typo: { font: 'helvetica', size: 7.5 },
      color: PC.text2,
    });
    // Calcula largura aproximada do label
    doc.setFontSize(7.5);
    cursorX += 7 + doc.getTextWidth(`= ${it.label}`) + 6;
  });
  return y + 4;
}

const MONTH_LABELS = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
];

function isPreventivaTipo(tipo) {
  const t = String(tipo || '').toLowerCase();
  return t.includes('preventiv');
}

function isCorretivaTipo(tipo) {
  const t = String(tipo || '').toLowerCase();
  return t.includes('corretiv');
}

function isLimpezaTipo(tipo) {
  const t = String(tipo || '').toLowerCase();
  return t.includes('limpeza') || t.includes('higieniz');
}

function monthOfDate(dateString) {
  if (!dateString) return null;
  // Aceita ISO 'YYYY-MM-DD' ou 'YYYY-MM-DDTHH:MM' — pega os 7 primeiros
  // chars e split. Evita parse Date pra não ter shift de timezone.
  const m = String(dateString).match(/^(\d{4})-(\d{2})/);
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]) };
}

/**
 * Computa marcações da matriz pra um equip.
 * @returns array de 12 strings (jan..dez) com a mark de cada mês.
 */
function computeRowMarks(equip, registrosDoAno, ano) {
  const marks = Array(12).fill(M.NONE);

  // 1) Plano: gera meses de preventiva planejada baseado em periodicidade.
  //    Modelo simples: começa em janeiro e adiciona N meses a cada ciclo.
  //    Ex: periodicidade 90 dias = ~3 meses → meses 1,4,7,10.
  const dias = Number(equip.periodicidadePreventivaDias);
  if (Number.isFinite(dias) && dias > 0) {
    const intervalMonths = Math.max(1, Math.round(dias / 30));
    for (let m = 1; m <= 12; m += intervalMonths) {
      marks[m - 1] = M.PREVENTIVA_PLANEJADA;
    }
  }

  // 2) Realizado: pra cada registro do equip do ano, sobrescreve a mark do mês.
  //    Ordem de prioridade visual: R (realizada) > C (corretiva) > L (limpeza)
  //    > P (planejada) > —. Múltiplos no mesmo mês: mantém o de maior
  //    prioridade (R+C → mostra R, com nota no rodapé).
  const priority = {
    [M.REALIZADA]: 4,
    [M.CORRETIVA]: 3,
    [M.LIMPEZA]: 2,
    [M.PREVENTIVA_PLANEJADA]: 1,
    [M.NONE]: 0,
  };
  for (const reg of registrosDoAno) {
    if (reg.equipId !== equip.id) continue;
    const ymd = monthOfDate(reg.data);
    if (!ymd || ymd.year !== ano) continue;
    let candidate = M.NONE;
    if (isPreventivaTipo(reg.tipo)) candidate = M.REALIZADA;
    else if (isCorretivaTipo(reg.tipo)) candidate = M.CORRETIVA;
    else if (isLimpezaTipo(reg.tipo)) candidate = M.LIMPEZA;
    if (priority[candidate] > priority[marks[ymd.month - 1]]) {
      marks[ymd.month - 1] = candidate;
    }
  }
  return marks;
}

export function drawPmocSchedule(doc, pageWidth, pageHeight, margins, ctx) {
  const { ano, cliente, equipamentos = [], registros = [] } = ctx;

  doc.addPage();
  const left = margins.left;
  const right = pageWidth - margins.right;
  const innerW = right - left;
  let y = margins.top;

  y = numberedSectionHeader(doc, left, y, innerW, 3, `Cronograma anual de manutenção (${ano})`);
  y += 2;

  // Filtra equipamentos do cliente; ordena por TAG/nome.
  const filtered = (
    cliente ? equipamentos.filter((e) => e.clienteId === cliente.id) : equipamentos.slice()
  ).sort((a, b) => {
    const ta = String(a.tag || a.nome || '').toLowerCase();
    const tb = String(b.tag || b.nome || '').toLowerCase();
    return ta.localeCompare(tb, 'pt-BR');
  });

  if (!filtered.length) {
    autoTable(doc, {
      startY: y,
      body: [['Nenhum equipamento para gerar cronograma.']],
      theme: 'plain',
      margin: { left, right: margins.right },
      styles: {
        font: PT.body.font,
        fontSize: PT.body.size,
        textColor: PC.text3,
        fontStyle: 'italic',
      },
    });
    return;
  }

  // Pré-filtra registros do ano pra acelerar (varre a lista 1x por equip).
  const registrosDoAno = registros.filter((r) => {
    const ymd = monthOfDate(r.data);
    return ymd && ymd.year === ano;
  });

  const head = [['TAG', ...MONTH_LABELS, 'Periodic.']];
  const body = filtered.map((eq) => {
    const marks = computeRowMarks(eq, registrosDoAno, ano);
    const dias = Number(eq.periodicidadePreventivaDias);
    const periodLabel = Number.isFinite(dias) && dias > 0 ? `${dias}d` : '—';
    return [eq.tag || eq.nome || '—', ...marks, periodLabel];
  });

  autoTable(doc, {
    startY: y,
    head,
    body,
    margin: { left, right: margins.right },
    theme: 'grid',
    styles: {
      font: PT.body.font,
      fontSize: PT.micro.size,
      cellPadding: 1.4,
      textColor: PC.text,
      lineColor: PC.border,
      lineWidth: 0.15,
      halign: 'center',
      valign: 'middle',
    },
    headStyles: {
      fillColor: PC.navy,
      textColor: PC.white,
      fontStyle: 'bold',
      fontSize: PT.microBold.size,
    },
    columnStyles: {
      0: { cellWidth: 22, halign: 'left', fontStyle: 'bold' },
      // Meses: 12 colunas iguais
      ...Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i + 1, { cellWidth: 'auto' }])),
      13: { cellWidth: 16, fontSize: 6 },
    },
    didParseCell: (data) => {
      if (data.section !== 'body') return;
      if (data.column.index < 1 || data.column.index > 12) return;
      const value = String(data.cell.raw || '').trim();
      if (value === M.REALIZADA) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.textColor = PC.ok;
      } else if (value === M.CORRETIVA) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.textColor = PC.text;
      } else if (value === M.LIMPEZA) {
        data.cell.styles.textColor = PC.text2;
      } else if (value === M.PREVENTIVA_PLANEJADA) {
        data.cell.styles.textColor = PC.warn;
      } else {
        data.cell.styles.textColor = PC.na;
      }
    },
  });

  // V2: Legenda visual com circles coloridos
  const legendY = (doc.lastAutoTable?.finalY ?? y) + 6;
  drawScheduleLegend(doc, left, legendY, innerW);
}
