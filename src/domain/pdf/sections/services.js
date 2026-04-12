import { Utils } from '../../../core/utils.js';
import { resolvePhotoDataUrlForPdf } from '../../../core/photoStorage.js';
import { PDF_COLORS as C, STATUS_CLIENTE } from '../constants.js';
import { accentLine, fillPage, fillRect, roundRect, txt } from '../primitives.js';

function drawServicesPageHeader(doc, pageWidth, margin, profile) {
  fillRect(doc, 0, 0, pageWidth, 18, C.bg2);
  fillRect(doc, 0, 0, pageWidth, 3, C.primary);
  txt(doc, 'COOLTRACK PRO', margin + 2, 8, { size: 7, style: 'bold', color: C.primary });
  txt(doc, 'DETALHES DOS SERVIÇOS REALIZADOS', margin + 40, 8, {
    size: 7,
    style: 'bold',
    color: C.text,
  });

  if (profile?.empresa) {
    txt(doc, profile.empresa, pageWidth - margin, 8, { size: 7, color: C.text3, align: 'right' });
  }

  accentLine(doc, 0, 18, pageWidth);
}

function getRecordPhotos(registro) {
  return Array.isArray(registro.fotos) ? registro.fotos.filter(Boolean).slice(0, 4) : [];
}

function calculateCardLayout(doc, pageWidth, margin, registro) {
  doc.setFontSize(8);
  const obsLines = doc.splitTextToSize(registro.obs || '', pageWidth - margin * 2 - 16);
  const obsHeight = Math.max(obsLines.length, 1) * 4.5;
  const photos = getRecordPhotos(registro);
  const photoRows = Math.ceil(photos.length / 2);
  const photosHeight = photos.length ? photoRows * 26 + 10 : 0;
  const custo = parseFloat(registro.custoPecas || 0) + parseFloat(registro.custoMaoObra || 0);

  const cardHeight = Math.max(
    34,
    28 + obsHeight + (registro.pecas ? 8 : 0) + (custo > 0 ? 8 : 0) + photosHeight,
  );

  return { cardHeight, custo, photos };
}

function drawStatusBadge(doc, pageWidth, margin, y, st) {
  const statusLabel = st.label;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...st.color);
  const statusWidth = doc.getTextWidth(statusLabel) + 10;
  const bx = pageWidth - margin - statusWidth - 1;
  const by = y + 2;
  doc.setDrawColor(...st.color);
  doc.setLineWidth(0.3);
  doc.roundedRect(bx, by, statusWidth + 2, 8, 1.5, 1.5, 'S');
  doc.text(statusLabel, bx + (statusWidth + 2) / 2, by + 5.5, { align: 'center' });
}

function getImageFormat(dataUrl) {
  const formatRaw = dataUrl?.match(/^data:image\/(png|jpe?g|webp);/i)?.[1]?.toLowerCase();
  if (!formatRaw) return 'JPEG';
  if (formatRaw === 'jpg') return 'JPEG';
  return formatRaw.toUpperCase();
}

async function drawPhotosGrid(doc, pageWidth, margin, startY, photos) {
  const photoW = (pageWidth - margin * 2 - 20) / 2;
  const photoH = 22;

  for (let index = 0; index < photos.length; index += 1) {
    const photo = photos[index];
    const row = Math.floor(index / 2);
    const col = index % 2;
    const px = margin + 8 + col * (photoW + 4);
    const py = startY + row * (photoH + 4);
    roundRect(doc, px, py, photoW, photoH, 1.5, [250, 250, 250]);

    try {
      const imageData = await resolvePhotoDataUrlForPdf(photo);
      if (!imageData) throw new Error('Foto indisponível para o PDF.');

      const format = getImageFormat(imageData);
      doc.addImage(imageData, format, px + 1, py + 1, photoW - 2, photoH - 2);
    } catch (_imgErr) {
      txt(doc, 'Foto indisponível', px + photoW / 2, py + photoH / 2 + 1, {
        size: 7,
        color: C.text3,
        align: 'center',
      });
    }
  }
}

async function drawServiceCard(doc, pageWidth, margin, y, registro, equipamento, st, layout) {
  const cardWidth = pageWidth - margin * 2;
  const { cardHeight, custo, photos } = layout;

  if (cardHeight >= 4) {
    roundRect(doc, margin, y, cardWidth, cardHeight, 2, C.bg2);
  } else {
    fillRect(doc, margin, y, cardWidth, cardHeight, C.bg2);
  }
  fillRect(doc, margin, y, 4, cardHeight, st.color);

  txt(doc, Utils.formatDatetime(registro.data), margin + 8, y + 7, { size: 7, color: C.text3 });
  drawStatusBadge(doc, pageWidth, margin, y, st);
  txt(doc, registro.tipo, margin + 8, y + 16, { size: 11, style: 'bold', color: C.text });
  txt(
    doc,
    (equipamento?.nome || '—') + (equipamento?.local ? '  ·  ' + equipamento.local : ''),
    margin + 8,
    y + 23,
    {
      size: 8,
      color: C.text3,
    },
  );
  accentLine(doc, margin + 6, y + 26, pageWidth - margin - 4, C.border);

  let contentY = y + 32;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...C.text2);
  const obsText = doc.splitTextToSize(registro.obs || '—', pageWidth - margin * 2 - 16);
  doc.text(obsText, margin + 8, contentY);
  contentY += obsText.length * 4.5 + 3;

  if (registro.pecas) {
    txt(doc, 'Materiais utilizados: ' + registro.pecas, margin + 8, contentY, {
      size: 7.5,
      color: C.text3,
    });
    contentY += 7;
  }

  if (custo > 0) {
    txt(doc, `Custo do serviço: R$ ${custo.toFixed(2).replace('.', ',')}`, margin + 8, contentY, {
      size: 8,
      style: 'bold',
      color: C.text,
    });
    contentY += 7;
  }

  if (photos.length) {
    txt(doc, 'Fotos anexadas', margin + 8, contentY, { size: 8, style: 'bold', color: C.text3 });
    contentY += 3;
    await drawPhotosGrid(doc, pageWidth, margin, contentY, photos);
  }

  if (registro.tecnico) {
    txt(doc, 'Técnico: ' + registro.tecnico, pageWidth - margin - 4, y + cardHeight - 5, {
      size: 7,
      color: C.text3,
      align: 'right',
    });
  }
}

export async function drawServices(
  doc,
  pageWidth,
  pageHeight,
  margin,
  filtered,
  equipamentos,
  profile,
  drawFooter,
) {
  drawServicesPageHeader(doc, pageWidth, margin, profile);

  let y = 26;
  const pageBottom = pageHeight - 20;

  for (const registro of filtered) {
    const equipamento = equipamentos.find((item) => item.id === registro.equipId);
    const st = STATUS_CLIENTE[registro.status] || STATUS_CLIENTE.ok;
    const layout = calculateCardLayout(doc, pageWidth, margin, registro);

    if (y + layout.cardHeight > pageBottom) {
      doc.addPage();
      fillPage(doc, pageWidth, pageHeight);
      drawServicesPageHeader(doc, pageWidth, margin, profile);
      y = 26;

      if (typeof drawFooter === 'function') {
        drawFooter(
          doc,
          pageWidth,
          pageHeight,
          margin,
          profile,
          doc.getCurrentPageInfo().pageNumber,
        );
      }
    }

    await drawServiceCard(doc, pageWidth, margin, y, registro, equipamento, st, layout);
    y += layout.cardHeight + 6;
  }

  if (typeof drawFooter === 'function') {
    drawFooter(doc, pageWidth, pageHeight, margin, profile, doc.getCurrentPageInfo().pageNumber);
  }
}
