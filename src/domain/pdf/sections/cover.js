import { Utils } from '../../../core/utils.js';
import { PDF_COLORS as C, STATUS_CLIENTE } from '../constants.js';
import { accentLine, fillPage, fillRect, roundRect, txt } from '../primitives.js';

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

function buildResumoTiles(filtered) {
  const ok = countByStatus(filtered, 'ok');
  const warn = countByStatus(filtered, 'warn');
  const danger = countByStatus(filtered, 'danger');

  return [
    { label: 'Serviços', value: String(filtered.length), color: C.text2 },
    { label: 'Operando', value: String(ok), color: C.green },
    { label: 'Atenção', value: String(warn), color: C.amber },
    { label: 'Fora de op.', value: String(danger), color: C.red },
  ];
}

function listEquipamentosUnicos(filtered, equipamentos) {
  return [
    ...new Map(
      filtered.map((registro) => {
        const equipamento = equipamentos.find((item) => item.id === registro.equipId);
        return [registro.equipId, { eq: equipamento, status: registro.status }];
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

function drawTecnicoCard(doc, pageWidth, margin, profile) {
  const cardY = 64;
  const cardW = pageWidth - margin * 2;
  const cardH = 52;

  roundRect(doc, margin, cardY, cardW, cardH, 2, C.surface);
  fillRect(doc, margin, cardY, 4, cardH, C.primary);

  txt(doc, 'TÉCNICO RESPONSÁVEL', margin + 10, cardY + 9, {
    size: 7,
    style: 'bold',
    color: C.text3,
  });
  txt(doc, profile?.nome || 'Técnico', margin + 10, cardY + 19, {
    size: 14,
    style: 'bold',
    color: C.text,
  });
  if (profile?.empresa)
    txt(doc, profile.empresa, margin + 10, cardY + 28, { size: 9, color: C.text2 });
  if (profile?.telefone)
    txt(doc, profile.telefone, margin + 10, cardY + 36, { size: 9, color: C.text2 });

  txt(doc, 'Plano: CoolTrack PRO', margin + 10, cardY + 47, {
    size: 7,
    color: C.primary,
  });

  return { cardY, cardH };
}

function drawResumoTiles(doc, pageWidth, margin, resumoY, filtered, totalCusto) {
  txt(doc, 'RESUMO GERAL', margin, resumoY, { size: 8, style: 'bold', color: C.text3 });
  accentLine(doc, margin, resumoY + 3, pageWidth - margin);

  const tiles = buildResumoTiles(filtered);
  const tileW = (pageWidth - margin * 2 - 12) / 4;
  const tileY = resumoY + 8;

  tiles.forEach((tile, index) => {
    const x = margin + index * (tileW + 4);
    roundRect(doc, x, tileY, tileW, 26, 1.5, C.surface);
    // strip lateral colorido (não barra no topo — evita excesso de tinta na impressão)
    fillRect(doc, x, tileY + 3, 2.5, 20, tile.color);
    txt(doc, tile.value, x + tileW / 2, tileY + 15, {
      size: 18,
      style: 'bold',
      color: tile.color,
      align: 'center',
    });
    txt(doc, tile.label, x + tileW / 2, tileY + 22, {
      size: 7,
      color: C.text3,
      align: 'center',
    });
  });

  if (totalCusto > 0) {
    txt(
      doc,
      `Custo total dos serviços: R$ ${totalCusto.toFixed(2).replace('.', ',')}`,
      margin,
      tileY + 36,
      {
        size: 9,
        style: 'bold',
        color: C.text2,
      },
    );
  }

  return tileY;
}

function drawSituacaoEquipamentos(doc, pageWidth, margin, eqY, filtered, equipamentos) {
  txt(doc, 'SITUAÇÃO ATUAL DOS EQUIPAMENTOS', margin, eqY, {
    size: 8,
    style: 'bold',
    color: C.text3,
  });
  accentLine(doc, margin, eqY + 3, pageWidth - margin);

  const equipamentosUnicos = listEquipamentosUnicos(filtered, equipamentos);
  let cursorY = eqY + 10;

  equipamentosUnicos.forEach(({ eq, status }) => {
    const st = STATUS_CLIENTE[status] || STATUS_CLIENTE.ok;
    roundRect(doc, margin, cursorY, pageWidth - margin * 2, 14, 1.5, C.surface);
    fillRect(doc, margin, cursorY, 4, 14, st.color);
    txt(doc, eq.nome, margin + 8, cursorY + 6, { size: 10, style: 'bold', color: C.text });
    txt(doc, eq.local, margin + 8, cursorY + 11, { size: 8, color: C.text3 });
    txt(doc, st.label, pageWidth - margin - 4, cursorY + 9, {
      size: 9,
      style: 'bold',
      color: st.color,
      align: 'right',
    });
    cursorY += 18;
  });

  return cursorY;
}

function drawPendencias(doc, pageWidth, pageHeight, margin, startY, filtered, equipamentos) {
  const pendentesY = startY + 6;
  const pendentes = listPendencias(filtered);

  if (pendentes.length > 0) {
    txt(doc, 'AÇÕES NECESSÁRIAS', margin, pendentesY, { size: 8, style: 'bold', color: C.text3 });
    accentLine(doc, margin, pendentesY + 3, pageWidth - margin, C.amber);

    let py = pendentesY + 10;
    pendentes.forEach((registro) => {
      const equipamento = equipamentos.find((item) => item.id === registro.equipId);
      const isUrgent = registro.status === 'danger';
      const cor = isUrgent ? C.red : C.amber;
      const acao = isUrgent
        ? 'Requer intervenção imediata'
        : `Preventiva recomendada${registro.proxima ? ` até ${Utils.formatDate(registro.proxima)}` : ''}`;

      roundRect(doc, margin, py, pageWidth - margin * 2, 16, 1.5, C.surface);
      fillRect(doc, margin, py, 4, 16, cor);
      txt(doc, equipamento?.nome || '—', margin + 8, py + 6, {
        size: 10,
        style: 'bold',
        color: C.text,
      });
      txt(doc, acao, margin + 8, py + 12, { size: 8, color: C.text3 });
      py += 20;
    });
    return;
  }

  if (pendentesY < pageHeight - 40) {
    roundRect(doc, margin, pendentesY, pageWidth - margin * 2, 16, 1.5, C.surface);
    fillRect(doc, margin, pendentesY, 4, 16, C.green);
    txt(doc, 'Nenhuma ação necessária no momento.', margin + 8, pendentesY + 7, {
      size: 10,
      style: 'bold',
      color: C.green,
    });
    txt(
      doc,
      'Todos os equipamentos estão dentro do prazo de manutenção.',
      margin + 8,
      pendentesY + 13,
      {
        size: 8,
        color: C.text2,
      },
    );
  }
}

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
  drawFooter,
) {
  fillPage(doc, pageWidth, pageHeight);

  fillRect(doc, 0, 0, pageWidth, 3, C.primary);
  fillRect(doc, 0, 0, pageWidth, 52, C.bg2);
  accentLine(doc, margin, 52, pageWidth - margin, C.border);

  txt(doc, 'COOLTRACK', margin + 2, 28, { size: 28, style: 'bold', color: C.text });
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.primary);
  const cooltrackTextWidth = doc.getTextWidth('COOLTRACK');
  doc.text('PRO', margin + 2 + cooltrackTextWidth + 3, 28);

  txt(doc, 'Sistema de Gestão de Manutenção', margin + 2, 37, { size: 9, color: C.text3 });
  txt(doc, 'RELATÓRIO DE SERVIÇOS REALIZADOS', margin + 2, 48, {
    size: 14,
    style: 'bold',
    color: C.text,
  });

  const periodo =
    de || ate
      ? `Período: ${de ? Utils.formatDate(de) : 'início'} a ${ate ? Utils.formatDate(ate) : 'atual'}`
      : `Gerado em: ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}`;
  txt(doc, periodo, margin + 2, 56, { size: 9, color: C.text3 });

  const { cardY, cardH } = drawTecnicoCard(doc, pageWidth, margin, profile);
  const resumoY = cardY + cardH + 16;
  const totalCusto = calculateTotalCost(filtered);
  const tileY = drawResumoTiles(doc, pageWidth, margin, resumoY, filtered, totalCusto);

  const eqY = tileY + (totalCusto > 0 ? 50 : 42);
  const situacaoEndY = drawSituacaoEquipamentos(
    doc,
    pageWidth,
    margin,
    eqY,
    filtered,
    equipamentos,
  );
  drawPendencias(doc, pageWidth, pageHeight, margin, situacaoEndY, filtered, equipamentos);

  if (typeof drawFooter === 'function') {
    drawFooter(doc, pageWidth, pageHeight, margin, profile, 1);
  }
}
