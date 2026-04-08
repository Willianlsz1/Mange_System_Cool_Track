import { Utils } from '../../../core/utils.js';
import { PDF_COLORS as C, STATUS_CLIENTE } from '../constants.js';
import {
  accentLine,
  drawSignaturePageHeader,
  fillPage,
  fillRect,
  getSignatureImagePayload,
  txt,
} from '../primitives.js';

function getSignedRecords(filtered, getSignatureForRecord) {
  return filtered.filter((registro) => registro.assinatura || !!getSignatureForRecord(registro.id));
}

function drawServiceFields(doc, margin, y, registro, equipamento, statusInfo, profile) {
  const campos = [
    ['Equipamento', equipamento?.nome || '—'],
    ['Localização', equipamento?.local || '—'],
    ['Tipo de serviço', registro.tipo],
    ['Data / Hora', Utils.formatDatetime(registro.data)],
    ['Técnico responsável', registro.tecnico || profile?.nome || '—'],
    ['Situação após o serviço', statusInfo.label],
  ];

  let cursorY = y;
  campos.forEach(([label, value]) => {
    txt(doc, label, margin, cursorY, { size: 7.5, color: C.text3 });
    txt(doc, value, margin + 55, cursorY, {
      size: 8.5,
      color: label === 'Situação após o serviço' ? statusInfo.color : C.text,
      style: label === 'Situação após o serviço' ? 'bold' : 'normal',
    });
    cursorY += 9;
  });

  return cursorY;
}

function drawMissingSignatureText(doc, x, y, width, height) {
  txt(doc, 'Assinatura não coletada', x + width / 2, y + height / 2, {
    size: 10,
    style: 'bold',
    color: C.red,
    align: 'center',
  });
}

function drawSignatureImage(doc, registro, signaturePayload, x, y, width, height) {
  if (signaturePayload) {
    try {
      const imageX = x + 4;
      const imageY = y + 5;
      const imageW = width - 8;
      const imageH = height - 12;
      doc.addImage(signaturePayload.data, signaturePayload.format, imageX, imageY, imageW, imageH);
      return;
    } catch (err) {
      console.error(
        `[PDF assinatura] Falha ao renderizar assinatura do registro ${registro.id}`,
        err,
        {
          format: signaturePayload.format,
          hasData: !!signaturePayload.data,
        },
      );
      drawMissingSignatureText(doc, x, y, width, height);
      return;
    }
  }

  if (registro.assinatura) {
    console.error(`[PDF assinatura] Assinatura ausente/corrompida para registro ${registro.id}`);
  }
  drawMissingSignatureText(doc, x, y, width, height);
}

function ensureSignatureBlockPage(doc, pageWidth, pageHeight, margin, y) {
  const signatureHeight = 45;
  const signatureMetaHeight = 16;
  const signatureBlockTotal = 8 + 14 + signatureHeight + signatureMetaHeight + 12;

  if (y + signatureBlockTotal <= pageHeight - 18) return y;

  doc.addPage();
  fillPage(doc, pageWidth, pageHeight);
  drawSignaturePageHeader(doc, pageWidth, margin);
  return 28;
}

export function drawSignaturePages(
  doc,
  pageWidth,
  pageHeight,
  margin,
  filtered,
  equipamentos,
  profile,
  getSignatureForRecord,
  drawFooter,
) {
  const signedRecords = getSignedRecords(filtered, getSignatureForRecord);
  if (!signedRecords.length) return;

  signedRecords.forEach((registro) => {
    const signatureData = getSignatureForRecord(registro.id);
    const signaturePayload = getSignatureImagePayload(signatureData);
    const signatureDate = registro.data
      ? Utils.formatDatetime(registro.data)
      : Utils.formatDatetime(new Date().toISOString());
    const clienteNome = registro.clienteNome || registro.cliente || 'Cliente';
    const equipamento = equipamentos.find((item) => item.id === registro.equipId);
    const statusInfo = STATUS_CLIENTE[registro.status] || STATUS_CLIENTE.ok;

    doc.addPage();
    fillPage(doc, pageWidth, pageHeight);
    drawSignaturePageHeader(doc, pageWidth, margin);

    let y = 28;
    txt(doc, 'CONFIRMAÇÃO DE SERVIÇO REALIZADO', margin, y, {
      size: 11,
      style: 'bold',
      color: C.text,
    });
    y += 10;

    y = drawServiceFields(doc, margin, y, registro, equipamento, statusInfo, profile);
    y += 4;

    txt(doc, 'Descrição do serviço realizado:', margin, y, { size: 7.5, color: C.text3 });
    y += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...C.text2);
    const obsLines = doc.splitTextToSize(registro.obs || '—', pageWidth - margin * 2);
    doc.text(obsLines, margin, y);
    y += obsLines.length * 4.5 + 10;

    y = ensureSignatureBlockPage(doc, pageWidth, pageHeight, margin, y);

    const signatureWidth = pageWidth - margin * 2;
    const signatureHeight = 45;

    accentLine(doc, margin, y, pageWidth - margin, C.border);
    y += 8;
    txt(doc, 'ASSINATURA DO CLIENTE', margin, y, { size: 7.5, style: 'bold', color: C.text3 });
    txt(doc, 'Confirmo que o serviço acima foi realizado conforme descrito.', margin, y + 6, {
      size: 7.5,
      color: C.text3,
    });
    y += 14;

    fillRect(doc, margin, y, signatureWidth, signatureHeight, [243, 248, 252]);
    fillRect(doc, margin, y, signatureWidth, 1.5, C.border);
    drawSignatureImage(doc, registro, signaturePayload, margin, y, signatureWidth, signatureHeight);

    accentLine(doc, margin + 8, y + signatureHeight - 5, margin + signatureWidth - 8);
    txt(doc, 'Assinatura', margin + signatureWidth / 2, y + signatureHeight + 4, {
      size: 7,
      color: C.text3,
      align: 'center',
    });

    y += signatureHeight + 10;
    txt(doc, `Nome do cliente: ${clienteNome}`, margin, y, {
      size: 8,
      style: 'bold',
      color: C.text,
    });
    txt(doc, `Data/Hora da assinatura: ${signatureDate}`, margin, y + 6, {
      size: 7.5,
      color: C.text2,
    });

    if (typeof drawFooter === 'function') {
      drawFooter(doc, pageWidth, pageHeight, margin, profile, doc.getCurrentPageInfo().pageNumber);
    }
  });
}
