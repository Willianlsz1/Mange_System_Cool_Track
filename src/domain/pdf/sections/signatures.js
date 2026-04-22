import { Utils } from '../../../core/utils.js';
import { PDF_COLORS as C, PDF_TYPO as T, STATUS_CLIENTE } from '../constants.js';
import { sanitizeObservation, sanitizePublicText } from '../sanitizers.js';
import { accentLine, fillPage, fillRect, getSignatureImagePayload, txt } from '../primitives.js';

function getSignedRecords(filtered, getSignatureForRecord) {
  return filtered.filter((registro) => registro.assinatura || !!getSignatureForRecord(registro.id));
}

function drawSignaturePageHeader(doc, pageWidth, margin, context = {}) {
  fillRect(doc, 0, 0, pageWidth, 14, C.bg2);
  fillRect(doc, 0, 14, pageWidth, 0.3, C.borderStrong);
  fillRect(doc, 0, 0, pageWidth, 2, C.primary);

  txt(doc, 'COOLTRACK PRO', margin, 7.5, {
    size: 7,
    style: 'bold',
    color: C.primary,
  });

  const midParts = ['COMPROVANTE DE SERVIÇO'];
  if (context.osNumber) midParts.push(`OS ${context.osNumber}`);
  txt(doc, midParts.join('  ·  '), margin + 40, 7.5, {
    size: 7,
    style: 'bold',
    color: C.text,
  });
}

function drawServiceFields(doc, margin, y, registro, equipamento, statusInfo, profile) {
  const campos = [
    ['Equipamento', sanitizePublicText(equipamento?.nome)],
    ['Localização', sanitizePublicText(equipamento?.local)],
    ['Tipo de serviço', sanitizePublicText(registro.tipo)],
    ['Data / Hora', Utils.formatDatetime(registro.data)],
    ['Técnico responsável', sanitizePublicText(registro.tecnico || profile?.nome)],
    ['Situação após o serviço', statusInfo.label],
  ];

  let cursorY = y;
  campos.forEach(([label, value]) => {
    txt(doc, label, margin, cursorY, { size: 7.5, color: C.text3 });
    txt(doc, value, margin + 55, cursorY, {
      size: 9,
      color: label === 'Situação após o serviço' ? statusInfo.color : C.text,
      style: label === 'Situação após o serviço' ? 'bold' : 'normal',
    });
    cursorY += 8;
  });

  return cursorY;
}

function drawMissingSignatureText(doc, x, y, width, height) {
  txt(doc, 'Assinatura não coletada', x + width / 2, y + height / 2, {
    size: 9,
    color: [170, 170, 170],
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

function ensureSignatureBlockPage(doc, pageWidth, pageHeight, margin, y, context) {
  const signatureHeight = 45;
  const signatureMetaHeight = 22; // Aumentado pra comportar RG/CPF opcional
  const signatureBlockTotal = 8 + 14 + signatureHeight + signatureMetaHeight + 12;

  if (y + signatureBlockTotal <= pageHeight - 22) return y;

  doc.addPage();
  fillPage(doc, pageWidth, pageHeight);
  drawSignaturePageHeader(doc, pageWidth, margin, context);
  return 22;
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
  _drawFooter,
  context = {},
) {
  const signedRecords = getSignedRecords(filtered, getSignatureForRecord);
  if (!signedRecords.length) return;

  signedRecords.forEach((registro) => {
    const signatureData = getSignatureForRecord(registro.id);
    const signaturePayload = getSignatureImagePayload(signatureData);
    const signatureDate = registro.data
      ? Utils.formatDatetime(registro.data)
      : Utils.formatDatetime(new Date().toISOString());
    const clienteNome = sanitizePublicText(
      registro.clienteNome?.trim() || registro.cliente?.trim() || '',
      'Não informado',
    );
    const clienteDoc =
      registro.clienteDocumento?.trim() ||
      registro.clienteCnpj?.trim() ||
      registro.clienteCpf?.trim() ||
      '';
    const equipamento = equipamentos.find((item) => item.id === registro.equipId);
    const statusInfo = STATUS_CLIENTE[registro.status] || STATUS_CLIENTE.ok;

    doc.addPage();
    fillPage(doc, pageWidth, pageHeight);
    drawSignaturePageHeader(doc, pageWidth, margin, context);

    let y = 22;
    txt(doc, 'CONFIRMAÇÃO DE SERVIÇO REALIZADO', margin, y, {
      size: T.h1.size,
      style: T.h1.style,
      color: C.text,
    });
    y += 8;
    accentLine(doc, margin, y - 2, pageWidth - margin, C.border);

    y = drawServiceFields(doc, margin, y, registro, equipamento, statusInfo, profile);
    y += 4;

    txt(doc, 'Descrição do serviço realizado', margin, y, {
      size: 7.5,
      style: 'bold',
      color: C.text3,
    });
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...C.text2);
    const obsLines = doc.splitTextToSize(sanitizeObservation(registro.obs), pageWidth - margin * 2);
    doc.text(obsLines, margin, y);
    y += obsLines.length * 4.5 + 10;

    y = ensureSignatureBlockPage(doc, pageWidth, pageHeight, margin, y, context);

    // Cláusula de responsabilidade (dá peso legal ao documento)
    txt(
      doc,
      'Declaro que os serviços descritos neste relatório foram executados a contento, nas datas e condições registradas.',
      margin,
      y,
      { size: 7.5, color: C.text3 },
    );
    y += 8;

    const signatureWidth = pageWidth - margin * 2;
    const signatureHeight = 45;

    // Fundo branco com borda sutil (antes era azul claro — atrapalhava print)
    doc.setDrawColor(...C.borderStrong);
    doc.setLineWidth(0.3);
    doc.setFillColor(...C.surface);
    doc.rect(margin, y, signatureWidth, signatureHeight, 'FD');
    drawSignatureImage(doc, registro, signaturePayload, margin, y, signatureWidth, signatureHeight);

    // Linha sobre a qual a assinatura aparenta estar apoiada
    accentLine(
      doc,
      margin + 8,
      y + signatureHeight - 6,
      margin + signatureWidth - 8,
      C.borderStrong,
    );
    txt(doc, 'Assinatura do cliente', margin + signatureWidth / 2, y + signatureHeight + 4, {
      size: 7,
      color: C.text3,
      align: 'center',
    });

    y += signatureHeight + 10;
    txt(doc, `Nome: ${clienteNome}`, margin, y, {
      size: 9,
      style: 'bold',
      color: C.text,
    });
    y += 5;
    if (clienteDoc) {
      txt(doc, `Documento: ${clienteDoc}`, margin, y, { size: 8, color: C.text2 });
      y += 5;
    }
    txt(doc, `Data/Hora: ${signatureDate}`, margin, y, { size: 8, color: C.text2 });
  });
}
