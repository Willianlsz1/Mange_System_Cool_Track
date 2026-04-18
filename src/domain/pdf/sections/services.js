import autoTable from 'jspdf-autotable';
import { Utils } from '../../../core/utils.js';
import { resolvePhotoDataUrlForPdf } from '../../../core/photoStorage.js';
import { PDF_COLORS as C, PDF_TYPO as T, STATUS_CLIENTE } from '../constants.js';
import { accentLine, fillPage, fillRect, txt } from '../primitives.js';

// Cabeçalho fixo que aparece no topo de cada página de serviço.
// Identifica produto + OS + empresa do técnico — alinhado ao ASHRAE 180,
// que exige identificação do emitente em cada folha.
function drawServicesPageHeader(doc, pageWidth, margin, profile, context = {}) {
  fillRect(doc, 0, 0, pageWidth, 14, C.bg2);
  fillRect(doc, 0, 14, pageWidth, 0.3, C.borderStrong);
  fillRect(doc, 0, 0, pageWidth, 2, C.primary);

  txt(doc, 'COOLTRACK PRO', margin, 7.5, {
    size: 7,
    style: 'bold',
    color: C.primary,
  });

  const midParts = ['DETALHES DOS SERVIÇOS'];
  if (context.osNumber) midParts.push(`OS ${context.osNumber}`);
  txt(doc, midParts.join('  ·  '), margin + 40, 7.5, {
    size: 7,
    style: 'bold',
    color: C.text,
  });

  if (profile?.empresa) {
    txt(doc, profile.empresa, pageWidth - margin, 7.5, {
      size: 7,
      color: C.text3,
      align: 'right',
    });
  }
}

function getRecordPhotos(registro) {
  return Array.isArray(registro.fotos) ? registro.fotos.filter(Boolean).slice(0, 4) : [];
}

function getImageFormat(dataUrl) {
  const formatRaw = dataUrl?.match(/^data:image\/(png|jpe?g|webp);/i)?.[1]?.toLowerCase();
  if (!formatRaw) return 'JPEG';
  if (formatRaw === 'jpg') return 'JPEG';
  return formatRaw.toUpperCase();
}

// Carrega a imagem para descobrir as dimensões naturais. Precisamos disso
// para preservar a proporção ao desenhar dentro do box do PDF — sem isso
// fotos 4:3 (1200x900) ficam esticadas como panorama dentro do box 84x20mm.
function loadImageDimensions(dataUrl) {
  return new Promise((resolve) => {
    if (typeof Image === 'undefined') {
      resolve(null);
      return;
    }
    const img = new Image();
    img.onload = () =>
      resolve({
        width: img.naturalWidth || img.width || 0,
        height: img.naturalHeight || img.height || 0,
      });
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

// Centraliza a imagem no box preservando a proporção (contain).
function fitImageInBox(imgDims, boxWidth, boxHeight) {
  if (!imgDims || imgDims.width <= 0 || imgDims.height <= 0) {
    return { drawW: boxWidth, drawH: boxHeight, offsetX: 0, offsetY: 0 };
  }
  const boxRatio = boxWidth / boxHeight;
  const imgRatio = imgDims.width / imgDims.height;
  if (imgRatio > boxRatio) {
    const drawH = boxWidth / imgRatio;
    return { drawW: boxWidth, drawH, offsetX: 0, offsetY: (boxHeight - drawH) / 2 };
  }
  const drawW = boxHeight * imgRatio;
  return { drawW, drawH: boxHeight, offsetX: (boxWidth - drawW) / 2, offsetY: 0 };
}

// Desenha observação + materiais + custo + fotos de um serviço específico
// abaixo da linha da tabela. Retorna a altura usada.
async function drawServiceDetails(doc, pageWidth, margin, startY, registro) {
  // Guarda: se startY for NaN/undefined (ex: data.row.y em v5 do autoTable
  // não existe), evita explodir dentro de jsPDF.text com mensagem vaga.
  if (!Number.isFinite(startY)) return 0;

  const innerX = margin + 4;
  const maxW = pageWidth - margin * 2 - 8;
  let y = startY + 2;

  // Observação
  const obs = (registro.obs || '').trim();
  if (obs) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...C.text2);
    const lines = doc.splitTextToSize(obs, maxW);
    doc.text(lines, innerX, y);
    y += lines.length * 4 + 2;
  }

  // Materiais utilizados
  if (registro.pecas?.trim()) {
    txt(doc, `Materiais: ${registro.pecas.trim()}`, innerX, y, {
      size: 7.5,
      color: C.text3,
    });
    y += 5;
  }

  // Custo
  const custo = parseFloat(registro.custoPecas || 0) + parseFloat(registro.custoMaoObra || 0);
  if (custo > 0) {
    txt(doc, `Custo do serviço: R$ ${custo.toFixed(2).replace('.', ',')}`, innerX, y, {
      size: 8,
      style: 'bold',
      color: C.text,
    });
    y += 5;
  }

  // Fotos
  const photos = getRecordPhotos(registro);
  if (photos.length) {
    txt(doc, 'Fotos anexadas', innerX, y, {
      size: 7,
      style: 'bold',
      color: C.text3,
    });
    y += 3;

    const photoW = (maxW - 4) / 2;
    const photoH = 55; // altura generosa para caber 4:3 sem esticar
    for (let i = 0; i < photos.length; i += 1) {
      const row = Math.floor(i / 2);
      const col = i % 2;
      const px = innerX + col * (photoW + 4);
      const py = y + row * (photoH + 3);
      doc.setDrawColor(...C.border);
      doc.setFillColor(250, 250, 250);
      doc.roundedRect(px, py, photoW, photoH, 1, 1, 'FD');

      try {
        const imageData = await resolvePhotoDataUrlForPdf(photos[i]);
        if (!imageData) throw new Error('Foto indisponível');
        const format = getImageFormat(imageData);
        const imgDims = await loadImageDimensions(imageData);
        const boxInnerW = photoW - 2;
        const boxInnerH = photoH - 2;
        const { drawW, drawH, offsetX, offsetY } = fitImageInBox(imgDims, boxInnerW, boxInnerH);
        doc.addImage(imageData, format, px + 1 + offsetX, py + 1 + offsetY, drawW, drawH);
      } catch (_err) {
        txt(doc, 'Foto indisponível', px + photoW / 2, py + photoH / 2 + 1, {
          size: 7,
          color: C.text3,
          align: 'center',
        });
      }
    }
    const photoRows = Math.ceil(photos.length / 2);
    y += photoRows * (photoH + 3) + 2;
  }

  return y - startY;
}

// Calcula altura do bloco de detalhes para reservar espaço antes da tabela desenhar.
function estimateDetailsHeight(doc, pageWidth, margin, registro) {
  const maxW = pageWidth - margin * 2 - 8;
  let h = 2;

  const obs = (registro.obs || '').trim();
  if (obs) {
    doc.setFontSize(8);
    const lines = doc.splitTextToSize(obs, maxW);
    h += lines.length * 4 + 2;
  }
  if (registro.pecas?.trim()) h += 5;
  const custo = parseFloat(registro.custoPecas || 0) + parseFloat(registro.custoMaoObra || 0);
  if (custo > 0) h += 5;

  const photos = getRecordPhotos(registro);
  if (photos.length) {
    h += 3; // label
    // 55mm (photoH) + 3mm (gap) = 58mm por linha de fotos.
    // Precisa bater com o photoH usado em drawServiceDetails — senão o
    // espaço reservado via minCellHeight sai diferente do desenho e o
    // layout perde alinhamento.
    h += Math.ceil(photos.length / 2) * 58 + 2;
  }

  // Linha separadora abaixo do bloco
  if (h > 2) h += 4;
  return h;
}

export async function drawServices(
  doc,
  pageWidth,
  pageHeight,
  margin,
  filtered,
  equipamentos,
  profile,
  _drawFooter, // compatibilidade — rodapé é aplicado por stampFooterTotals
  context = {},
) {
  if (!filtered.length) return;

  drawServicesPageHeader(doc, pageWidth, margin, profile, context);

  // Linha de título dentro da página
  let titleY = 22;
  txt(doc, 'REGISTROS DE SERVIÇO', margin, titleY, {
    size: T.h1.size,
    style: T.h1.style,
    color: C.primary,
  });
  txt(
    doc,
    `${filtered.length} ${filtered.length === 1 ? 'registro' : 'registros'} no período`,
    pageWidth - margin,
    titleY,
    { size: 8, color: C.text3, align: 'right' },
  );
  accentLine(doc, margin, titleY + 2, pageWidth - margin, C.border);

  // Monta body da tabela: cada linha = 1 serviço, identificado pelo index.
  // Detalhes longos (obs/materiais/fotos) são desenhados manualmente abaixo
  // da linha via didDrawRow, para manter tabela densa e sem quebrar paginação.
  const body = filtered.map((registro) => {
    const equipamento = equipamentos.find((item) => item.id === registro.equipId);
    const st = STATUS_CLIENTE[registro.status] || STATUS_CLIENTE.ok;
    const custo = parseFloat(registro.custoPecas || 0) + parseFloat(registro.custoMaoObra || 0);
    return {
      data: Utils.formatDatetime(registro.data),
      equip: equipamento
        ? `${equipamento.nome}${equipamento.local ? ' · ' + equipamento.local : ''}`
        : '—',
      tipo: registro.tipo || '—',
      tecnico: registro.tecnico || profile?.nome || '—',
      custo: custo > 0 ? `R$ ${custo.toFixed(2).replace('.', ',')}` : '—',
      status: st.label,
      statusColor: st.color,
      _registro: registro,
    };
  });

  // Larguras efetivas de cada coluna (em mm). O bloco precisa bater com
  // `columnStyles` abaixo — uso aqui pra estimar quebra de linha por coluna
  // e compor a altura natural da linha via splitTextToSize.
  const COL_WIDTHS_MM = [26, 50, 24, 28, 22];
  const statusWidth = pageWidth - margin * 2 - COL_WIDTHS_MM.reduce((a, b) => a + b, 0);
  const columnWidths = [...COL_WIDTHS_MM, statusWidth];

  // Calcula a altura NATURAL de uma linha da tabela, considerando quebra de
  // texto em cada célula. Precisamos disso pra:
  //   (a) dimensionar minCellHeight = natural + extra (detalhes) sem que os
  //       detalhes fiquem sobrepostos ao texto padrão da linha, e
  //   (b) posicionar detailY = row.y + naturalHeight, garantindo que os
  //       detalhes começam LOGO ABAIXO do último baseline da linha.
  function computeRowBaseHeight(bodyRow) {
    const texts = [
      bodyRow.data,
      bodyRow.equip,
      bodyRow.tipo,
      bodyRow.tecnico,
      bodyRow.custo,
      bodyRow.status,
    ];
    const prevSize = doc.internal.getFontSize();
    doc.setFontSize(8); // mesmo fontSize do body no autoTable
    let maxLines = 1;
    for (let i = 0; i < texts.length; i += 1) {
      const innerMm = Math.max(columnWidths[i] - 5, 5); // -5 = cellPadding 2.5 de cada lado
      const lines = doc.splitTextToSize(String(texts[i] || ''), innerMm);
      if (lines.length > maxLines) maxLines = lines.length;
    }
    doc.setFontSize(prevSize);
    // 8pt ~= 2.82mm; linha ~4mm com espaçamento; +5mm de padding vertical
    return maxLines * 4 + 5;
  }

  // autoTable não consegue inserir linhas filhas com altura dinâmica
  // assincronamente (imagens). Solução: desenha tabela primeiro sem detalhes,
  // depois, pra cada row com detalhes, reserva espaço via `minCellHeight` na
  // coluna 1 (equipamento) usando estimateDetailsHeight — e no didDrawCell
  // (última coluna) guarda coordenadas para pintar detalhes depois de forma
  // async.
  const rowDetails = body.map((r) => ({
    registro: r._registro,
    height: estimateDetailsHeight(doc, pageWidth, margin, r._registro),
    baseHeight: computeRowBaseHeight(r),
  }));

  const drawCoords = []; // { pageNumber, y, rowIndex }

  autoTable(doc, {
    startY: titleY + 5,
    head: [['Data', 'Equipamento', 'Tipo', 'Técnico', 'Custo', 'Status']],
    body: body.map((r) => [r.data, r.equip, r.tipo, r.tecnico, r.custo, r.status]),
    theme: 'plain',
    margin: { top: 18, left: margin, right: margin, bottom: 22 },
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 2.5,
      textColor: C.text2,
      lineColor: C.border,
      lineWidth: 0.15,
      valign: 'top',
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
      0: { cellWidth: 26 },
      1: { cellWidth: 50 },
      2: { cellWidth: 24 },
      3: { cellWidth: 28, textColor: C.text3 },
      4: { cellWidth: 22, halign: 'right', fontStyle: 'bold', textColor: C.text },
      5: { halign: 'right', fontStyle: 'bold' },
    },
    didParseCell(data) {
      if (data.section === 'body' && data.column.index === 5) {
        const row = body[data.row.index];
        if (row?.statusColor) data.cell.styles.textColor = row.statusColor;
      }
      // Reserva altura extra na linha para o bloco de detalhes.
      //
      // baseHeight é calculado por `computeRowBaseHeight` usando
      // splitTextToSize em cada coluna (ver acima). Isso garante que a
      // inflação via minCellHeight comporta o texto natural da linha sem
      // que os detalhes fiquem sobrepostos a "07:25" ou "Funcionando
      // normalmente" quando as células naturalmente precisam de 2 linhas.
      if (data.section === 'body' && data.column.index === 0) {
        const entry = rowDetails[data.row.index];
        const extra = entry?.height || 0;
        if (extra > 2) {
          const baseRowHeight = entry?.baseHeight || 9;
          data.cell.styles.minCellHeight = baseRowHeight + extra;
        }
      }
    },
    // IMPORTANTE: jspdf-autotable v5 NÃO expõe um hook `didDrawRow`, e a
    // classe Row da v5 não tem `y` — só `Cell` tem x/y/height (ver
    // dist/index.d.ts do pacote). API disponível: didParseCell |
    // willDrawCell | didDrawCell | willDrawPage | didDrawPage.
    //
    // Para saber quando uma linha terminou de ser desenhada usamos
    // didDrawCell filtrando pela ÚLTIMA coluna (index 5 = Status). Nesse
    // ponto a célula já foi pintada e `data.cell.y + data.cell.height` dá
    // o bottom da linha — todas as células compartilham a mesma altura
    // final por causa do minCellHeight aplicado em didParseCell.
    didDrawCell(data) {
      if (data.section !== 'body') return;
      if (data.column.index !== 5) return; // dispara 1 vez por linha
      const entry = rowDetails[data.row.index];
      const extra = entry?.height || 0;
      if (extra <= 2) return;

      const cellY = Number(data.cell?.y);
      if (!Number.isFinite(cellY)) return;

      // detailY = topo da célula + altura natural da linha. Assim os
      // detalhes começam LOGO ABAIXO do último baseline do texto
      // padrão (evita sobrepor "07:25" da coluna Data ou "Funcionando
      // normalmente" da coluna Status com a 1a linha de obs).
      const baseHeight = entry?.baseHeight || 9;
      const detailY = cellY + baseHeight;
      drawCoords.push({
        pageNumber: doc.internal.getCurrentPageInfo().pageNumber,
        y: detailY,
        rowIndex: data.row.index,
      });
    },
    willDrawPage() {
      // Redesenha header em cada página nova da tabela
      fillPage(doc, pageWidth, pageHeight);
      drawServicesPageHeader(doc, pageWidth, margin, profile, context);
    },
  });

  // Segundo passo: desenha os blocos de detalhe async em cima das coordenadas
  // reservadas. Isso roda depois da tabela e pode ser async sem problema.
  for (const coord of drawCoords) {
    doc.setPage(coord.pageNumber);
    await drawServiceDetails(doc, pageWidth, margin, coord.y, body[coord.rowIndex]._registro);
    // Linha separadora entre registros para legibilidade
    accentLine(
      doc,
      margin + 4,
      coord.y + rowDetails[coord.rowIndex].height - 2,
      pageWidth - margin - 4,
      C.border,
    );
  }
}
