/**
 * PMOC Fase 5.C — Cadastro técnico dos equipamentos.
 *
 * Tabela formal NBR 13971 (anexo A): TAG, descrição (nome+tipo), fluido,
 * capacidade (BTU/h se disponível em dadosPlaca), local, periodicidade
 * preventiva (dias). Ordenada por TAG.
 */

import autoTable from 'jspdf-autotable';
import { sectionHeader, numberedSectionHeader, txt } from '../primitives.js';
import { PMOC_COLORS as PC, PMOC_TYPO as PT } from '../constants.js';

function pickCapacidade(dadosPlaca) {
  if (!dadosPlaca || typeof dadosPlaca !== 'object') return '';
  const keys = ['capacidade', 'capacidade_btuh', 'capacidade_btu', 'btu', 'btuh'];
  for (const k of keys) {
    if (dadosPlaca[k]) return String(dadosPlaca[k]);
  }
  return '';
}

function periodicidadeLabel(dias) {
  if (!dias || !Number.isFinite(Number(dias))) return '—';
  const n = Number(dias);
  if (n <= 7) return 'Semanal';
  if (n <= 31) return 'Mensal';
  if (n <= 95) return 'Trimestral';
  if (n <= 185) return 'Semestral';
  if (n <= 370) return 'Anual';
  return `${n} dias`;
}

/**
 * V2: extrai estatisticas do parque pra renderizar o bloco
 * "Informações do Sistema". Resumo agregado: tipo dominante,
 * fluido dominante, area estimada (se vier no dadosPlaca).
 */
function buildSystemInfo(equipamentos, profile) {
  const total = equipamentos.length;
  const tipos = {};
  const fluidos = {};
  let totalBtu = 0;
  equipamentos.forEach((eq) => {
    const t = eq.tipo || 'Não informado';
    tipos[t] = (tipos[t] || 0) + 1;
    const f = eq.fluido || 'Não informado';
    fluidos[f] = (fluidos[f] || 0) + 1;
    // Tenta extrair BTU pra somar capacidade total
    const cap = eq.dadosPlaca?.capacidade || eq.dadosPlaca?.capacidade_btuh || '';
    const num = parseInt(String(cap).replace(/\D/g, ''), 10);
    if (Number.isFinite(num) && num > 0 && num < 1_000_000) totalBtu += num;
  });

  const dominantTipo = Object.entries(tipos).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
  const dominantFluido = Object.entries(fluidos).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

  return {
    tipoSistema: dominantTipo,
    quantidade: total,
    fluidoRefrigerante: dominantFluido,
    capacidadeTotal: totalBtu > 0 ? `${totalBtu.toLocaleString('pt-BR')} BTU/h` : '—',
    responsavelOperacao: profile?.responsavel_tecnico || profile?.nome || '—',
  };
}

/**
 * V2: bloco "Informações do Sistema" — campos em grid 2 colunas com
 * labels uppercase pequenos + valor padrao. Vai DEPOIS da tabela.
 */
function drawSystemInfoBlock(doc, left, right, y, info, finalidade) {
  const innerW = right - left;
  y = sectionHeader(doc, left, y, innerW, 'Informações do sistema');
  y += 4;

  const colW = (innerW - 6) / 2;
  const rowH = 11;

  const fields = [
    ['Tipo de sistema', info.tipoSistema],
    ['Quantidade total de equipamentos', String(info.quantidade)],
    ['Finalidade do ambiente', finalidade || '—'],
    ['Tipo de fluido refrigerante', info.fluidoRefrigerante],
    ['Capacidade total', info.capacidadeTotal],
    ['Responsável pela operação', info.responsavelOperacao],
  ];

  fields.forEach(([label, value], i) => {
    const isRight = i % 2 === 1;
    const colX = isRight ? left + colW + 6 : left;
    const rowY = y + Math.floor(i / 2) * rowH;
    txt(doc, label.toUpperCase(), colX, rowY, {
      typo: { font: 'helvetica', size: 6.5, style: 'bold' },
      color: PC.text3,
    });
    txt(doc, value, colX, rowY + 5, {
      typo: { font: 'helvetica', size: 9.5, style: 'normal' },
      color: PC.text,
      maxWidth: colW,
    });
  });

  return y + Math.ceil(fields.length / 2) * rowH + 4;
}

/**
 * V2: box "Observações" navy soft no rodape da pagina de cadastro.
 * Texto regulatorio padrao informando que os equips listados estao
 * sujeitos ao plano de manutencao definido neste PMOC.
 */
function drawObservationsBox(doc, left, right, y) {
  const innerW = right - left;
  doc.setFillColor(...PC.navySoft);
  doc.setDrawColor(...PC.navyBorder);
  doc.setLineWidth(0.3);
  const boxH = 16;
  doc.rect(left, y, innerW, boxH, 'FD');
  txt(doc, 'OBSERVAÇÕES', left + 5, y + 5.5, {
    typo: { font: 'helvetica', size: 7, style: 'bold' },
    color: PC.navy,
  });
  txt(
    doc,
    'Os equipamentos listados acima estão sujeitos ao plano de manutenção, operação e controle',
    left + 5,
    y + 10,
    { typo: { font: 'helvetica', size: 8.5 }, color: PC.text2 },
  );
  txt(doc, 'estabelecido neste documento, de acordo com sua periodicidade.', left + 5, y + 13.5, {
    typo: { font: 'helvetica', size: 8.5 },
    color: PC.text2,
  });
  return y + boxH;
}

/**
 * V2: completa a tabela com linhas vazias ("—" em todas as colunas)
 * pra preencher visualmente o espaco quando ha poucos equipamentos.
 */
function padRowsToMin(rows, columnCount, minRows = 5) {
  const padded = rows.slice();
  while (padded.length < minRows) {
    padded.push(Array(columnCount).fill('—'));
  }
  return padded;
}

export function drawPmocRegistry(doc, pageWidth, pageHeight, margins, ctx) {
  const { equipamentos = [], cliente } = ctx;
  const filtered = (
    cliente ? equipamentos.filter((e) => e.clienteId === cliente.id) : equipamentos.slice()
  ).sort((a, b) => {
    const ta = String(a.tag || a.nome || '').toLowerCase();
    const tb = String(b.tag || b.nome || '').toLowerCase();
    return ta.localeCompare(tb, 'pt-BR');
  });

  doc.addPage();
  const left = margins.left;
  const right = pageWidth - margins.right;
  const innerW = right - left;
  let y = margins.top;

  y = numberedSectionHeader(doc, left, y, innerW, 2, 'Cadastro técnico dos equipamentos');
  y += 2;

  if (!filtered.length) {
    autoTable(doc, {
      startY: y,
      body: [['Nenhum equipamento cadastrado para este cliente.']],
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

  const head = [['TAG', 'Equipamento / Tipo', 'Fluido', 'Capacidade', 'Local', 'Periodicidade']];
  const realRows = filtered.map((eq) => [
    eq.tag || '—',
    `${eq.nome || '—'}\n${eq.tipo || ''}`.trim(),
    eq.fluido || '—',
    pickCapacidade(eq.dadosPlaca) || '—',
    eq.local || '—',
    periodicidadeLabel(eq.periodicidadePreventivaDias),
  ]);
  const body = padRowsToMin(realRows, head[0].length, 5);

  autoTable(doc, {
    startY: y,
    head,
    body,
    margin: { left, right: margins.right },
    theme: 'grid',
    styles: {
      font: PT.body.font,
      fontSize: PT.meta.size,
      cellPadding: 2.4,
      textColor: PC.text,
      lineColor: PC.border,
      lineWidth: 0.15,
      valign: 'middle',
      minCellHeight: 9,
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
      0: { cellWidth: 22, fontStyle: 'bold', halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 22, halign: 'center' },
      3: { cellWidth: 28, halign: 'center' },
      4: { cellWidth: 38 },
      5: { cellWidth: 26, halign: 'center' },
    },
    didParseCell(data) {
      if (data.section === 'body' && data.row.index >= realRows.length) {
        data.cell.styles.textColor = PC.border;
      }
    },
  });

  y = doc.lastAutoTable.finalY + 8;

  const systemInfo = buildSystemInfo(filtered, ctx.profile);
  const finalidade = cliente?.finalidade || cliente?.tipo || '—';
  y = drawSystemInfoBlock(doc, left, right, y, systemInfo, finalidade);
  y += 4;

  drawObservationsBox(doc, left, right, y);
}
