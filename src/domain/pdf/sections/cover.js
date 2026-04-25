import autoTable from 'jspdf-autotable';
import { Utils } from '../../../core/utils.js';
import { PDF_COLORS as C, PDF_TYPO as T, STATUS_CLIENTE } from '../constants.js';
import { formatStatusConclusion, sanitizePublicText } from '../sanitizers.js';
import { accentLine, fillPage, fillRect, roundRect, txt } from '../primitives.js';
import { formatDadosPlacaRows } from '../../dadosPlacaDisplay.js';
import { drawChecklist } from './checklist.js';

// -------------------------------- helpers --------------------------------

function countByStatus(registros, status) {
  return registros.filter((registro) => registro.status === status).length;
}

function calculateTotalCost(registros) {
  return registros.reduce(
    (acc, registro) =>
      acc + parseFloat(registro.custoPecas || 0) + parseFloat(registro.custoMaoObra || 0),
    0,
  );
}

function formatMoney(value) {
  return `R$ ${Number(value || 0)
    .toFixed(2)
    .replace('.', ',')}`;
}

function listEquipamentosUnicos(filtered, equipamentos) {
  return [
    ...new Map(
      filtered.map((registro) => {
        const equipamento = equipamentos.find((item) => item.id === registro.equipId);
        return [registro.equipId, { eq: equipamento, lastRegistro: registro }];
      }),
    ).values(),
  ].filter((item) => item.eq);
}

function listPendencias(filtered) {
  return filtered.filter((registro) => {
    if (registro.status === 'danger') return true;
    if (registro.proxima && Utils.daysDiff(registro.proxima) <= 30) return true;
    return false;
  });
}

// ------------------------------- masthead -------------------------------

function drawMasthead(doc, pageWidth, margin, profile) {
  const mastheadH = 20;
  // Faixa sutil bg2 dá identidade sem "cartão dashboard". Linha fina inferior
  // separa do conteúdo como masthead de invoice formal.
  fillRect(doc, 0, 0, pageWidth, mastheadH, C.bg2);
  fillRect(doc, 0, mastheadH, pageWidth, 0.4, C.borderStrong);
  fillRect(doc, 0, 0, pageWidth, 2.5, C.primary);

  // Lado esquerdo: produto que gerou o PDF (pequeno, discreto — não rouba cena)
  txt(doc, 'COOLTRACK PRO', margin, 10, {
    size: 8,
    style: 'bold',
    color: C.primary,
  });
  txt(doc, 'Sistema de Gestão de Manutenção', margin, 15, {
    size: 7,
    color: C.text3,
  });

  // Lado direito: IDENTIDADE DO PRESTADOR — quem assina o serviço.
  // Esse é o bloco que legitima o documento pro cliente do Willian.
  const empresa = profile?.empresa?.trim() || profile?.nome?.trim() || 'Prestador de Serviço';
  const contatoParts = [profile?.telefone?.trim(), profile?.email?.trim()].filter(Boolean);

  txt(doc, empresa, pageWidth - margin, 10, {
    size: 10,
    style: 'bold',
    color: C.text,
    align: 'right',
  });
  if (contatoParts.length) {
    txt(doc, contatoParts.join('  ·  '), pageWidth - margin, 15, {
      size: 7.5,
      color: C.text3,
      align: 'right',
    });
  }
}

// -------------------------- title & meta line --------------------------

function drawTitleBlock(doc, pageWidth, margin, startY, context = {}) {
  let y = startY;

  txt(doc, 'RELATÓRIO DE MANUTENÇÃO', margin, y, {
    size: T.title.size,
    style: T.title.style,
    color: C.text,
  });

  if (context.osNumber) {
    txt(doc, `OS ${context.osNumber}`, pageWidth - margin, y, {
      size: 10,
      style: 'bold',
      color: C.primary,
      align: 'right',
    });
  }
  y += 7;

  const emitido = context.emitido
    ? `Emitido em ${context.emitido}`
    : `Emitido em ${new Date().toLocaleDateString('pt-BR')}`;
  const periodo = context.periodoTexto ? `  ·  ${context.periodoTexto}` : '';
  txt(doc, `${emitido}${periodo}`, margin, y, { size: T.meta.size, color: C.text3 });

  y += 4;
  accentLine(doc, margin, y, pageWidth - margin, C.border);
  return y + 6;
}

// --------------------------- técnico + cliente ---------------------------

function drawInfoBlocks(doc, pageWidth, margin, startY, profile, cliente) {
  const colGap = 6;
  const blockW = (pageWidth - margin * 2 - colGap) / 2;
  // V2 (abr/2026): altura dinâmica. Quando profile/cliente têm dados PMOC
  // (CNPJ, IE, IM), usa 42mm pra acomodar até 5 linhas. Sem dados PMOC,
  // mantém 30mm — não vaza espaço inutilmente em PDFs de técnico residencial.
  const hasPmocData =
    !!(profile?.cnpj || profile?.inscricao_estadual || profile?.inscricao_municipal) ||
    !!(cliente?.cnpj || cliente?.ie || cliente?.im);
  const blockH = hasPmocData ? 42 : 30;
  const leftX = margin;
  const rightX = margin + blockW + colGap;

  // Caixa técnico (esquerda) — expandida com dados legais PMOC quando
  // preenchidos. Linha vazia é filtrada em drawLabeledBlock.
  const cnpjLine = profile?.cnpj?.trim();
  const ieLine = profile?.inscricao_estadual?.trim();
  const imLine = profile?.inscricao_municipal?.trim();
  const inscricoes = [ieLine && `IE ${ieLine}`, imLine && `IM ${imLine}`]
    .filter(Boolean)
    .join('  ·  ');

  drawLabeledBlock(doc, leftX, startY, blockW, blockH, 'TÉCNICO RESPONSÁVEL', [
    { value: profile?.nome?.trim() || 'Técnico', bold: true, size: 11 },
    {
      value: profile?.razao_social?.trim() || profile?.empresa?.trim() || '',
      size: 8.5,
      color: C.text2,
    },
    { value: cnpjLine ? `CNPJ ${cnpjLine}` : '', size: 8, color: C.text3 },
    { value: inscricoes, size: 7.5, color: C.text3 },
    { value: profile?.telefone?.trim() || '', size: 8, color: C.text3 },
  ]);

  // Caixa cliente (direita) — só aparece quando extractClientBlock retorna algo
  if (cliente) {
    const clienteLines = [];
    clienteLines.push({
      value: sanitizePublicText(cliente.nome, 'Não informado'),
      bold: true,
      size: 11,
    });
    clienteLines.push({
      value: sanitizePublicText(cliente.documento, 'Não informado'),
      size: 8,
      color: C.text3,
    });
    clienteLines.push({
      value: sanitizePublicText(cliente.local, 'Não informado'),
      size: 8.5,
      color: C.text2,
    });
    clienteLines.push({
      value: sanitizePublicText(cliente.contato, 'Não informado'),
      size: 8,
      color: C.text3,
    });

    drawLabeledBlock(doc, rightX, startY, blockW, blockH, 'CLIENTE / LOCAL', clienteLines);
  } else {
    // Bloco placeholder profissional para ausência de dados
    drawLabeledBlock(doc, rightX, startY, blockW, blockH, 'CLIENTE / LOCAL', [
      { value: 'Não informado', size: 9, color: C.text3, italic: true },
    ]);
  }

  return startY + blockH + 8;
}

function drawLabeledBlock(doc, x, y, w, h, label, lines) {
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.3);
  doc.rect(x, y, w, h, 'S');
  fillRect(doc, x, y, 2.5, h, C.primary);

  txt(doc, label, x + 6, y + 5.5, {
    size: 6.5,
    style: 'bold',
    color: C.text3,
  });

  let cursorY = y + 12;
  lines.forEach((line) => {
    if (!line?.value) return;
    txt(doc, line.value, x + 6, cursorY, {
      size: line.size || 9,
      style: line.bold ? 'bold' : 'normal',
      color: line.color || C.text,
    });
    cursorY += (line.size || 9) * 0.5 + 2;
  });
}

// ------------------------- resumo executivo -------------------------

function drawResumoExecutivo(doc, pageWidth, margin, startY, filtered, equipamentos) {
  const totalServicos = filtered.length;
  const totalCusto = calculateTotalCost(filtered);
  const ok = countByStatus(filtered, 'ok');
  const warn = countByStatus(filtered, 'warn');
  const danger = countByStatus(filtered, 'danger');
  const equipCount = listEquipamentosUnicos(filtered, equipamentos).length;

  let y = startY;
  txt(doc, 'RESUMO EXECUTIVO', margin, y, {
    size: T.h2.size,
    style: T.h2.style,
    color: C.text3,
  });
  y += 2;
  accentLine(doc, margin, y + 1, pageWidth - margin, C.border);
  y += 6;

  // Prosa curta, sem tiles. Cliente lê como documento formal.
  const bulletX = margin + 2;
  const items = [];

  if (totalServicos === 0) {
    items.push('Nenhum serviço executado no período selecionado.');
  } else {
    items.push(
      `${totalServicos} ${totalServicos === 1 ? 'serviço executado' : 'serviços executados'} em ${equipCount} ${equipCount === 1 ? 'equipamento' : 'equipamentos'}.`,
    );
    const statusParts = [];
    if (ok)
      statusParts.push(
        `${ok} ${ok === 1 ? 'equipamento operando normalmente' : 'equipamentos operando normalmente'}`,
      );
    if (warn)
      statusParts.push(
        `${warn} ${warn === 1 ? 'equipamento em atenção' : 'equipamentos em atenção'}`,
      );
    if (danger)
      statusParts.push(
        `${danger} ${danger === 1 ? 'equipamento fora de operação' : 'equipamentos fora de operação'}`,
      );
    if (statusParts.length) items.push(`Status atual: ${statusParts.join(', ')}.`);
    if (totalCusto > 0) items.push(`Custo total dos serviços: ${formatMoney(totalCusto)}.`);
  }

  items.forEach((line) => {
    txt(doc, '•', bulletX, y, { size: T.body.size, color: C.primary, style: 'bold' });
    const textLines = doc.splitTextToSize(line, pageWidth - margin * 2 - 6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(T.body.size);
    doc.setTextColor(...C.text2);
    doc.text(textLines, bulletX + 4, y);
    y += textLines.length * 4.5 + 1.5;
  });

  return y + 4;
}

function drawConclusao(doc, pageWidth, margin, startY, filtered) {
  const ok = countByStatus(filtered, 'ok');
  const warn = countByStatus(filtered, 'warn');
  const danger = countByStatus(filtered, 'danger');
  const conclusion = formatStatusConclusion({ ok, warn, danger });

  let y = startY;
  txt(doc, 'CONCLUSÃO', margin, y, {
    size: T.h2.size,
    style: T.h2.style,
    color: C.text3,
  });
  y += 2;
  accentLine(doc, margin, y + 1, pageWidth - margin, C.border);
  y += 6;

  roundRect(doc, margin, y - 2, pageWidth - margin * 2, 14, 1.2, C.surface);
  fillRect(doc, margin, y - 2, 2.5, 14, C.primary);
  txt(doc, 'Situação final do equipamento', margin + 6, y + 3.5, {
    size: 8,
    style: 'bold',
    color: C.text3,
  });
  txt(doc, conclusion, margin + 6, y + 9, {
    size: 9,
    color: C.text,
  });

  return y + 16;
}

// ---------------------- tabela de equipamentos ----------------------

function drawEquipamentosTable(doc, pageWidth, margin, startY, filtered, equipamentos) {
  const equipamentosUnicos = listEquipamentosUnicos(filtered, equipamentos);
  if (!equipamentosUnicos.length) return startY;

  let y = startY;
  txt(doc, 'EQUIPAMENTOS ATENDIDOS', margin, y, {
    size: T.h2.size,
    style: T.h2.style,
    color: C.text3,
  });
  y += 2;
  accentLine(doc, margin, y + 1, pageWidth - margin, C.border);
  y += 3;

  const rows = equipamentosUnicos.map(({ eq, lastRegistro }) => {
    const st = STATUS_CLIENTE[lastRegistro.status] || STATUS_CLIENTE.ok;
    const ultimo = lastRegistro.data ? Utils.formatDate(lastRegistro.data) : '—';
    const proxima = lastRegistro.proxima ? Utils.formatDate(lastRegistro.proxima) : '—';
    return {
      tag: eq.codigo || eq.tag || '—',
      nome: eq.nome || '—',
      local: eq.local || '—',
      ultimo,
      proxima,
      statusLabel: st.label,
      statusColor: st.color,
    };
  });

  autoTable(doc, {
    startY: y + 2,
    head: [['Tag', 'Equipamento', 'Localização', 'Último', 'Próximo', 'Status']],
    body: rows.map((r) => [r.tag, r.nome, r.local, r.ultimo, r.proxima, r.statusLabel]),
    theme: 'plain',
    margin: { left: margin, right: margin },
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 2.5,
      textColor: C.text2,
      lineColor: C.border,
      lineWidth: 0.15,
    },
    headStyles: {
      fillColor: C.bg2,
      textColor: C.text3,
      fontStyle: 'bold',
      fontSize: 7,
      lineColor: C.borderStrong,
      lineWidth: 0.3,
    },
    alternateRowStyles: { fillColor: [252, 252, 253] },
    columnStyles: {
      0: { cellWidth: 18, fontStyle: 'bold', textColor: C.text },
      1: { cellWidth: 44 },
      2: { cellWidth: 40, textColor: C.text3 },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 20, halign: 'center' },
      5: { halign: 'right', fontStyle: 'bold' },
    },
    didParseCell(data) {
      if (data.section === 'body' && data.column.index === 5) {
        const row = rows[data.row.index];
        if (row?.statusColor) data.cell.styles.textColor = row.statusColor;
      }
    },
  });

  return doc.lastAutoTable.finalY + 6;
}

// --------------------------- pendências ---------------------------

function drawFichaTecnica(doc, pageWidth, pageHeight, margin, startY, filtered, equipamentos) {
  // Reúne equipamentos distintos do filtro que tenham ao menos uma linha de
  // ficha técnica. Sem categorização/insights — só:
  //   "Dados da etiqueta"         (campos fixos de FIELD_ORDER)
  //   "Outras informações da etiqueta" (camposExtras flat, com cap)
  const PDF_EXTRAS_CAP = 10; // cap global de extras por equipamento no PDF
  const unique = listEquipamentosUnicos(filtered, equipamentos);

  const blocks = unique
    .map(({ eq }) => {
      const allRows = formatDadosPlacaRows(eq.dadosPlaca);
      return {
        eq,
        fixedRows: allRows.filter((r) => !r.extra),
        extraRows: allRows.filter((r) => r.extra),
      };
    })
    .filter((b) => b.fixedRows.length > 0 || b.extraRows.length > 0);

  if (!blocks.length) return startY;

  // Cabeçalho da seção
  let y = startY + 6;
  if (y + 20 > pageHeight - margin) {
    doc.addPage();
    y = margin;
  }
  txt(doc, 'FICHA TÉCNICA DO EQUIPAMENTO', margin, y, {
    size: T.h2.size,
    style: T.h2.style,
    color: C.text3,
  });
  y += 2;
  accentLine(doc, margin, y + 1, pageWidth - margin, C.border);
  y += 5;

  const renderTable = (rows) => {
    autoTable(doc, {
      startY: y,
      body: rows.map((r) => [r.label, r.value]),
      theme: 'plain',
      margin: { left: margin, right: margin },
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.2 },
      columnStyles: {
        0: { cellWidth: 55, textColor: C.text3 },
        1: { cellWidth: 'auto', textColor: C.text1 },
      },
    });
    y = (doc.lastAutoTable?.finalY ?? y) + 2;
  };

  const ensureSpace = (needed) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  for (const { eq, fixedRows, extraRows } of blocks) {
    ensureSpace(14);

    txt(doc, String(eq.nome || eq.tag || '—'), margin, y, {
      size: T.h3?.size ?? 9,
      style: T.h3?.style ?? 'bold',
      color: C.text2,
    });
    y += 4;

    if (fixedRows.length) {
      txt(doc, 'Dados da etiqueta', margin, y, {
        size: 8,
        style: 'bold',
        color: C.text3,
      });
      y += 3;
      ensureSpace(fixedRows.length * 5);
      renderTable(fixedRows);
    }

    if (extraRows.length) {
      const display = extraRows.slice(0, PDF_EXTRAS_CAP);
      const truncated = extraRows.length - display.length;

      ensureSpace(8 + display.length * 5 + (truncated ? 4 : 0));

      txt(doc, 'Outras informações da etiqueta', margin, y, {
        size: 8,
        style: 'bold',
        color: C.text3,
      });
      y += 3;

      renderTable(display);

      if (truncated > 0) {
        txt(doc, `(+${truncated} campos omitidos)`, margin, y, {
          size: 7,
          style: 'italic',
          color: C.text3,
        });
        y += 4;
      }
    }

    y += 3; // respiro entre blocos de equipamentos
  }

  return y;
}

function drawPendencias(doc, pageWidth, pageHeight, margin, startY, filtered, equipamentos) {
  const pendentes = listPendencias(filtered);
  if (!pendentes.length) return; // Sem fallback "nada pendente" — redundante com o resumo

  let y = startY;
  if (y > pageHeight - 50) return; // Sem espaço na capa, pendências migram pra próxima seção

  txt(doc, 'AÇÕES RECOMENDADAS', margin, y, {
    size: T.h2.size,
    style: T.h2.style,
    color: C.amber,
  });
  y += 2;
  accentLine(doc, margin, y + 1, pageWidth - margin, C.amber);
  y += 5;

  pendentes.forEach((registro) => {
    if (y > pageHeight - 25) return;
    const equipamento = equipamentos.find((item) => item.id === registro.equipId);
    const isUrgent = registro.status === 'danger';
    const cor = isUrgent ? C.red : C.amber;
    const acao = isUrgent
      ? 'Requer intervenção imediata'
      : `Preventiva recomendada${registro.proxima ? ` até ${Utils.formatDate(registro.proxima)}` : ''}`;

    roundRect(doc, margin, y, pageWidth - margin * 2, 14, 1.5, C.surface);
    fillRect(doc, margin, y, 2.5, 14, cor);
    txt(doc, equipamento?.nome || '—', margin + 6, y + 6, {
      size: 9.5,
      style: 'bold',
      color: C.text,
    });
    txt(doc, acao, margin + 6, y + 11, { size: 7.5, color: C.text3 });
    y += 16;
  });
}

// ------------------------------- entry -------------------------------

export function drawCover(
  doc,
  pageWidth,
  pageHeight,
  margin,
  profile,
  _filtEq,
  de,
  ate,
  filtered,
  equipamentos,
  _drawFooter, // assinatura mantida pra compatibilidade; footer final é feito em stampFooterTotals
  context = {},
) {
  fillPage(doc, pageWidth, pageHeight);

  drawMasthead(doc, pageWidth, margin, profile);

  const periodoTexto =
    de || ate
      ? `Período ${de ? Utils.formatDate(de) : 'início'} – ${ate ? Utils.formatDate(ate) : 'atual'}`
      : '';

  let y = drawTitleBlock(doc, pageWidth, margin, 32, {
    osNumber: context.osNumber,
    emitido: context.emitido,
    periodoTexto,
  });

  y = drawInfoBlocks(doc, pageWidth, margin, y, profile, context.cliente);
  y = drawResumoExecutivo(doc, pageWidth, margin, y, filtered, equipamentos);
  y = drawEquipamentosTable(doc, pageWidth, margin, y, filtered, equipamentos);
  y = drawConclusao(doc, pageWidth, margin, y, filtered);
  y = drawFichaTecnica(doc, pageWidth, pageHeight, margin, y, filtered, equipamentos);
  // PMOC Fase 3: checklist NBR 13971 dos registros que tiveram preenchimento.
  // Pula silenciosamente quando não há nenhum (PDFs FREE / não-PMOC).
  y = drawChecklist(doc, pageWidth, pageHeight, margin, y, filtered, equipamentos);
  drawPendencias(doc, pageWidth, pageHeight, margin, y, filtered, equipamentos);
}
