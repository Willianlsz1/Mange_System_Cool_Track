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

function drawServiceFields(doc, margin, y, registro, equipamento, statusInfo, profile, pageWidth) {
  // V3 refator: campos em grid 2 colunas (em vez de lista vertical de 6 linhas).
  // Mais profissional, menos vertical waste, e sobra espaço pra assinatura.
  const campos = [
    ['Equipamento', sanitizePublicText(equipamento?.nome)],
    ['Tipo de serviço', sanitizePublicText(registro.tipo)],
    ['Localização', sanitizePublicText(equipamento?.local)],
    ['Data / Hora', Utils.formatDatetime(registro.data)],
    ['Técnico responsável', sanitizePublicText(registro.tecnico || profile?.nome)],
    ['Situação após o serviço', statusInfo.label, statusInfo.color],
  ];

  // Grid 2 colunas: indice par esquerda, impar direita
  const colW = (pageWidth - margin * 2 - 4) / 2;
  const rowH = 11;
  let cursorY = y;

  campos.forEach(([label, value, valueColor], i) => {
    const isRight = i % 2 === 1;
    const colX = isRight ? margin + colW + 4 : margin;
    const isStatus = label === 'Situação após o serviço';
    txt(doc, label.toUpperCase(), colX, cursorY, {
      size: 6.5,
      style: 'bold',
      color: C.text3,
    });
    txt(doc, value, colX, cursorY + 5, {
      size: 9.5,
      color: valueColor || C.text,
      style: isStatus ? 'bold' : 'normal',
    });
    if (isRight) cursorY += rowH;
  });

  // Caso ímpar (Situação fica sozinha no fim), bumpa cursor
  if (campos.length % 2 === 1) cursorY += rowH;

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
    // V3 refator: hero com OS + cliente em destaque pra parecer recibo
    // formal, nao só "comprovante de servico".
    txt(doc, 'COMPROVANTE DE SERVIÇO', margin, y, {
      size: T.h1.size,
      style: T.h1.style,
      color: C.text,
    });
    if (context.osNumber) {
      txt(doc, `OS ${context.osNumber}`, pageWidth - margin, y, {
        size: 9,
        style: 'bold',
        color: C.primary,
        align: 'right',
      });
    }
    y += 4;
    accentLine(doc, margin, y, pageWidth - margin, C.borderStrong);
    y += 7;

    y = drawServiceFields(doc, margin, y, registro, equipamento, statusInfo, profile, pageWidth);
    y += 6;

    // Descrição em box destacado pra separar visualmente dos campos
    const obsLines = doc.splitTextToSize(
      sanitizeObservation(registro.obs),
      pageWidth - margin * 2 - 8,
    );
    const descBoxH = 8 + obsLines.length * 4.5 + 4;
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.3);
    doc.setFillColor(...C.bg2);
    doc.rect(margin, y, pageWidth - margin * 2, descBoxH, 'FD');
    fillRectAccent(doc, margin, y, 2.5, descBoxH);
    txt(doc, 'DESCRIÇÃO DO SERVIÇO REALIZADO', margin + 6, y + 5, {
      size: 6.5,
      style: 'bold',
      color: C.text3,
    });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...C.text2);
    doc.text(obsLines, margin + 6, y + 10);
    y += descBoxH + 8;

    y = ensureSignatureBlockPage(doc, pageWidth, pageHeight, margin, y, context);

    // Cláusula de responsabilidade — fica acima da caixa de assinatura,
    // alinhada e em italico pra ler como "termo aceito ao assinar".
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(...C.text3);
    const clauseLines = doc.splitTextToSize(
      'Declaro que os serviços descritos neste relatório foram executados a contento, nas datas e condições registradas.',
      pageWidth - margin * 2,
    );
    doc.text(clauseLines, margin, y);
    y += clauseLines.length * 4 + 4;

    // Caixa de assinatura V3 — maior (55mm), borda mais marcada, label "X" no
    // canto inferior esquerdo (convenção de assinatura), e linha guia no meio
    // ao inves de embaixo. Cliente assina por cima da linha.
    const signatureWidth = pageWidth - margin * 2;
    const signatureHeight = 55;

    doc.setDrawColor(...C.borderStrong);
    doc.setLineWidth(0.4);
    doc.setFillColor(...C.surface);
    doc.rect(margin, y, signatureWidth, signatureHeight, 'FD');

    // "X" indicador no canto esquerdo (convenção legal)
    txt(doc, '×', margin + 6, y + signatureHeight / 2 + 2, {
      size: 14,
      color: C.text3,
    });

    // Linha de assinatura no meio vertical
    accentLine(doc, margin + 12, y + signatureHeight / 2 + 4, margin + signatureWidth - 8, C.text3);

    drawSignatureImage(doc, registro, signaturePayload, margin, y, signatureWidth, signatureHeight);

    // Label centralizado embaixo da caixa
    txt(doc, 'ASSINATURA DO CLIENTE', margin + signatureWidth / 2, y + signatureHeight + 5, {
      size: 7,
      style: 'bold',
      color: C.text3,
      align: 'center',
    });

    y += signatureHeight + 12;

    // Bloco identificacao cliente — em grid 2 colunas pra parecer recibo
    const colW = (signatureWidth - 4) / 2;
    txt(doc, 'NOME COMPLETO', margin, y, { size: 6.5, style: 'bold', color: C.text3 });
    txt(doc, clienteNome, margin, y + 5, { size: 9.5, style: 'bold', color: C.text });

    if (clienteDoc) {
      txt(doc, 'DOCUMENTO', margin + colW + 4, y, {
        size: 6.5,
        style: 'bold',
        color: C.text3,
      });
      txt(doc, clienteDoc, margin + colW + 4, y + 5, { size: 9, color: C.text });
    }
    y += 12;

    txt(doc, 'DATA / HORA DA ASSINATURA', margin, y, {
      size: 6.5,
      style: 'bold',
      color: C.text3,
    });
    txt(doc, signatureDate, margin, y + 5, { size: 9, color: C.text });
  });
}

// Helper local pra acentar caixa com barra lateral primary
function fillRectAccent(doc, x, y, w, h) {
  doc.setFillColor(...C.primary);
  doc.rect(x, y, w, h, 'F');
}
