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

function drawTitleBlock(doc, pageWidth, margin, startY, context = {}, profile, cliente) {
  let y = startY;

  // V3 refator: titulo grande + faixa de identificadores
  // (OS · Data · Cliente · Técnico) consolidada num strip único.
  // Cliente fica em destaque (bold + cor text) porque eh quem
  // recebe o documento — segue convenção de invoice/recibo formal.

  txt(doc, 'RELATÓRIO DE MANUTENÇÃO', margin, y, {
    size: T.title.size,
    style: T.title.style,
    color: C.text,
  });

  if (context.osNumber) {
    // OS em badge destacado no canto direito
    const osLabel = `OS ${context.osNumber}`;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    const osWidth = doc.getTextWidth(osLabel) + 6;
    doc.setFillColor(...C.primary);
    doc.roundedRect(pageWidth - margin - osWidth, y - 4.5, osWidth, 6.5, 1, 1, 'F');
    txt(doc, osLabel, pageWidth - margin - 3, y, {
      size: 9,
      style: 'bold',
      color: C.white,
      align: 'right',
    });
  }
  y += 8;

  // V3: Strip horizontal "DATA · CLIENTE · TÉCNICO" — tudo numa linha so,
  // pra cliente ler o quem-pra-quem-quando em um vistazo.
  const emitido = context.emitido || new Date().toLocaleDateString('pt-BR');
  const clienteNome = cliente?.nome ? sanitizePublicText(cliente.nome, '') : '';
  const tecnicoNome = profile?.nome?.trim() || 'Técnico';

  // Constroi label inline tipo "Emitido 26/04/2026  |  Cliente: Empresa X  |  Técnico: Fulano"
  // Usa cores diferentes pra label (cinza) e value (escuro) — implementado
  // segmento por segmento pra ter controle de cor.
  let cursorX = margin;
  const drawSegment = (label, value, valueBold = false) => {
    txt(doc, label, cursorX, y, { size: 7.5, color: C.text3 });
    doc.setFontSize(7.5);
    const labelW = doc.getTextWidth(label) + 1;
    txt(doc, value, cursorX + labelW, y, {
      size: 8.5,
      color: C.text,
      style: valueBold ? 'bold' : 'normal',
    });
    doc.setFontSize(8.5);
    if (valueBold) doc.setFont('helvetica', 'bold');
    const valueW = doc.getTextWidth(value);
    doc.setFont('helvetica', 'normal');
    cursorX += labelW + valueW + 6;

    // Separador "·"
    txt(doc, '·', cursorX - 3, y, { size: 8, color: C.text3 });
  };

  drawSegment('Emitido em ', emitido);
  if (clienteNome) drawSegment('Cliente ', clienteNome, true);
  drawSegment('Técnico ', tecnicoNome);

  // Periodo se tiver — segunda linha discreta
  if (context.periodoTexto) {
    y += 5;
    txt(doc, context.periodoTexto, margin, y, { size: 7, color: C.text3, style: 'italic' });
  }

  y += 5;
  accentLine(doc, margin, y, pageWidth - margin, C.borderStrong);
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
  // Refator V3: 3 cards visuais (Servicos / Equipamentos / Status geral)
  // em vez de bullets de prosa. Numero grande no topo, label embaixo,
  // barra colorida lateral pra identidade. Compacto, lido em 1 segundo.
  const totalServicos = filtered.length;
  const ok = countByStatus(filtered, 'ok');
  const warn = countByStatus(filtered, 'warn');
  const danger = countByStatus(filtered, 'danger');
  const equipCount = listEquipamentosUnicos(filtered, equipamentos).length;

  // Status geral consolidado: pior wins. Se ha alguma falha, vira "Atenção".
  const statusLabel = danger
    ? 'Fora de operação'
    : warn
      ? 'Requer atenção'
      : totalServicos > 0
        ? 'OK'
        : '—';
  const statusColor = danger ? C.red : warn ? C.amber : totalServicos > 0 ? C.green : C.text3;

  let y = startY;
  txt(doc, 'RESUMO EXECUTIVO', margin, y, {
    size: T.h2.size,
    style: T.h2.style,
    color: C.text3,
  });
  y += 2;
  accentLine(doc, margin, y + 1, pageWidth - margin, C.border);
  y += 6;

  // Layout: 3 cards lado a lado, gap 4mm
  const gap = 4;
  const cardW = (pageWidth - margin * 2 - gap * 2) / 3;
  const cardH = 22;

  const cards = [
    {
      x: margin,
      value: String(totalServicos),
      label: totalServicos === 1 ? 'Serviço realizado' : 'Serviços realizados',
      barColor: C.primary,
      valueColor: C.text,
    },
    {
      x: margin + cardW + gap,
      value: String(equipCount),
      label: equipCount === 1 ? 'Equipamento atendido' : 'Equipamentos atendidos',
      barColor: C.accent,
      valueColor: C.text,
    },
    {
      x: margin + cardW * 2 + gap * 2,
      value: statusLabel,
      label: 'Status geral',
      barColor: statusColor,
      valueColor: statusColor,
      smallValue: statusLabel.length > 4, // "Fora de operação" / "Requer atenção" precisam fonte menor
    },
  ];

  cards.forEach((card) => {
    // Box com borda fina + barra lateral colorida
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.3);
    doc.setFillColor(...C.surface);
    doc.rect(card.x, y, cardW, cardH, 'FD');
    fillRect(doc, card.x, y, 2.5, cardH, card.barColor);

    // Valor grande
    txt(doc, card.value, card.x + 6, y + 11, {
      size: card.smallValue ? 12 : 18,
      style: 'bold',
      color: card.valueColor,
    });

    // Label embaixo
    txt(doc, card.label, card.x + 6, y + 18, {
      size: 7.5,
      color: C.text3,
    });
  });

  return y + cardH + 6;
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
    // V3 refator: nome trunca em 32 chars + "…" pra evitar wrap feio.
    // Cliente prefere overflow controlado a duas linhas estouradas.
    const nomeBruto = eq.nome || '—';
    const nome = nomeBruto.length > 32 ? `${nomeBruto.slice(0, 31)}…` : nomeBruto;
    const localBruto = eq.local || '—';
    const local = localBruto.length > 28 ? `${localBruto.slice(0, 27)}…` : localBruto;
    return {
      tag: eq.codigo || eq.tag || '—',
      nome,
      local,
      ultimo,
      proxima,
      statusLabel: st.label,
      statusColor: st.color,
      statusKey: lastRegistro.status || 'ok',
    };
  });

  autoTable(doc, {
    startY: y + 2,
    // V3 refator: coluna nova "•" pra bullet colorido de status (canto esquerdo).
    // Mantive a coluna texto "Status" no fim porque cliente formal precisa do
    // label escrito ("Funcionando normalmente"), nao so cor.
    head: [['', 'Tag', 'Equipamento', 'Localização', 'Último', 'Próximo', 'Status']],
    body: rows.map((r) => ['●', r.tag, r.nome, r.local, r.ultimo, r.proxima, r.statusLabel]),
    theme: 'plain',
    margin: { left: margin, right: margin },
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 2.5,
      textColor: C.text2,
      lineColor: C.border,
      lineWidth: 0.15,
      overflow: 'ellipsize', // V3: previne wrap feio — corta com elipse
      valign: 'middle',
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
      0: { cellWidth: 6, halign: 'center', fontSize: 11 }, // bullet status
      1: { cellWidth: 18, fontStyle: 'bold', textColor: C.text },
      2: { cellWidth: 42 },
      3: { cellWidth: 36, textColor: C.text3 },
      4: { cellWidth: 20, halign: 'center' },
      5: { cellWidth: 20, halign: 'center' },
      6: { halign: 'right', fontStyle: 'bold' },
    },
    didParseCell(data) {
      if (data.section !== 'body') return;
      const row = rows[data.row.index];
      if (!row) return;
      // Bullet (col 0) recebe a cor do status
      if (data.column.index === 0) {
        data.cell.styles.textColor = row.statusColor;
      }
      // Label de status (ultima coluna) tambem na cor
      if (data.column.index === 6) {
        data.cell.styles.textColor = row.statusColor;
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
  _drawFooter,
  context = {},
) {
  fillPage(doc, pageWidth, pageHeight);

  drawMasthead(doc, pageWidth, margin, profile);

  const periodoTexto =
    de || ate
      ? `Período ${de ? Utils.formatDate(de) : 'início'} – ${ate ? Utils.formatDate(ate) : 'atual'}`
      : '';

  let y = drawTitleBlock(
    doc,
    pageWidth,
    margin,
    32,
    {
      osNumber: context.osNumber,
      emitido: context.emitido,
      periodoTexto,
    },
    profile,
    context.cliente,
  );

  y = drawInfoBlocks(doc, pageWidth, margin, y, profile, context.cliente);
  y = drawResumoExecutivo(doc, pageWidth, margin, y, filtered, equipamentos);
  y = drawEquipamentosTable(doc, pageWidth, margin, y, filtered, equipamentos);
  y = drawConclusao(doc, pageWidth, margin, y, filtered);
  y = drawFichaTecnica(doc, pageWidth, pageHeight, margin, y, filtered, equipamentos);
  y = drawChecklist(doc, pageWidth, pageHeight, margin, y, filtered, equipamentos);
  drawPendencias(doc, pageWidth, pageHeight, margin, y, filtered, equipamentos);
}
