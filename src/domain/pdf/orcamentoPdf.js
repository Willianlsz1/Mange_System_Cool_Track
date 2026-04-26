/**
 * CoolTrack Pro - Gerador PDF de Orçamento (Fase de instalação, abr/2026)
 *
 * PDF profissional pra orçamento de instalação. Reusa o estilo do relatório
 * de manutenção (PDF_COLORS navy/teal) mas com layout mais comercial:
 * capa institucional + cliente + tabela itens + termo de aceite com espaço
 * pra assinatura manuscrita.
 *
 * Saida: { fileName, blob } pra share, ou .save() direto se asBlob=false.
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Utils } from '../../core/utils.js';
import { PDF_COLORS as C, PDF_TYPO as T } from './constants.js';
import { fillRect, txt } from './primitives.js';

function brl(n) {
  return Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function brToday() {
  return new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function calcValidUntil(orcamento) {
  if (!orcamento.enviadoEm) {
    const today = new Date();
    today.setDate(today.getDate() + (orcamento.validadeDias || 7));
    return today.toLocaleDateString('pt-BR');
  }
  const sent = new Date(orcamento.enviadoEm);
  sent.setDate(sent.getDate() + (orcamento.validadeDias || 7));
  return sent.toLocaleDateString('pt-BR');
}

function drawMasthead(doc, pageWidth, margin, profile) {
  fillRect(doc, 0, 0, pageWidth, 22, C.bg2);
  fillRect(doc, 0, 22, pageWidth, 0.4, C.borderStrong);
  fillRect(doc, 0, 0, pageWidth, 2.5, C.primary);

  txt(doc, 'COOLTRACK PRO', margin, 11, {
    size: 8,
    style: 'bold',
    color: C.primary,
  });
  txt(doc, 'Orçamento de Instalação', margin, 16, {
    size: 7,
    color: C.text3,
  });

  const empresa =
    profile?.empresa?.trim() ||
    profile?.razao_social?.trim() ||
    profile?.nome?.trim() ||
    'Prestador de Serviço';
  const contato = [profile?.telefone?.trim(), profile?.email?.trim()].filter(Boolean).join('  ·  ');

  txt(doc, empresa, pageWidth - margin, 11, {
    size: 10,
    style: 'bold',
    color: C.text,
    align: 'right',
  });
  if (contato) {
    txt(doc, contato, pageWidth - margin, 16, {
      size: 7.5,
      color: C.text3,
      align: 'right',
    });
  }
}

function drawTitle(doc, pageWidth, margin, y, orcamento) {
  txt(doc, 'ORÇAMENTO', margin, y, {
    size: 22,
    style: 'bold',
    color: C.text,
  });

  // Badge com numero do orçamento
  const numLabel = orcamento.numero || '—';
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  const numW = doc.getTextWidth(numLabel) + 10;
  doc.setFillColor(...C.primary);
  doc.roundedRect(pageWidth - margin - numW, y - 5, numW, 7.5, 1, 1, 'F');
  txt(doc, numLabel, pageWidth - margin - 5, y, {
    size: 10,
    style: 'bold',
    color: C.white,
    align: 'right',
  });

  return y + 10;
}

function drawMetaStrip(doc, pageWidth, margin, y, orcamento) {
  const validUntil = calcValidUntil(orcamento);
  txt(doc, `Emitido em ${brToday()}  ·  Validade até ${validUntil}`, margin, y, {
    size: 8.5,
    color: C.text3,
  });
  return y + 6;
}

function drawClienteBlock(doc, pageWidth, margin, y, orcamento) {
  const innerW = pageWidth - margin * 2;
  // Box com header navy
  doc.setFillColor(...C.bg2);
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.3);
  const blockH = 26;
  doc.rect(margin, y, innerW, blockH, 'FD');
  fillRect(doc, margin, y, 2.5, blockH, C.primary);

  txt(doc, 'CLIENTE', margin + 6, y + 5.5, {
    size: 7,
    style: 'bold',
    color: C.text3,
  });
  txt(doc, orcamento.clienteNome || 'Não informado', margin + 6, y + 11, {
    size: 12,
    style: 'bold',
    color: C.text,
  });

  // Telefone + endereço em 2 colunas
  const halfW = innerW / 2;
  if (orcamento.clienteTelefone) {
    txt(doc, `Telefone: ${orcamento.clienteTelefone}`, margin + 6, y + 17, {
      size: 8.5,
      color: C.text2,
    });
  }
  if (orcamento.clienteEndereco) {
    txt(doc, `Local: ${orcamento.clienteEndereco}`, margin + halfW, y + 17, {
      size: 8.5,
      color: C.text2,
      maxWidth: halfW - 10,
    });
  }

  return y + blockH + 6;
}

function drawTituloBlock(doc, pageWidth, margin, y, orcamento) {
  txt(doc, 'SERVIÇO', margin, y, {
    size: 7,
    style: 'bold',
    color: C.text3,
  });
  y += 5;
  txt(doc, orcamento.titulo || '—', margin, y, {
    size: 12.5,
    style: 'bold',
    color: C.text,
  });
  y += 6;
  if (orcamento.descricao) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...C.text2);
    const lines = doc.splitTextToSize(orcamento.descricao, pageWidth - margin * 2);
    doc.text(lines, margin, y);
    y += lines.length * 4.5;
  }
  return y + 4;
}

function drawItemsTable(doc, pageWidth, margin, y, orcamento) {
  const items = orcamento.itens || [];
  if (!items.length) return y;

  autoTable(doc, {
    startY: y,
    head: [['Descrição', 'Qtd', 'Valor unit.', 'Total']],
    body: items.map((i) => [
      i.descricao || '—',
      String(i.qty || 0),
      brl(i.valorUnitario || 0),
      brl(i.total || 0),
    ]),
    margin: { left: margin, right: margin },
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 9,
      cellPadding: 3,
      textColor: C.text,
      lineColor: C.border,
      lineWidth: 0.15,
      valign: 'middle',
      minCellHeight: 9,
    },
    headStyles: {
      fillColor: C.primary,
      textColor: C.white,
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'left',
      cellPadding: 3,
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 18, halign: 'center' },
      2: { cellWidth: 30, halign: 'right' },
      3: { cellWidth: 30, halign: 'right', fontStyle: 'bold' },
    },
  });

  return doc.lastAutoTable.finalY + 4;
}

function drawTotals(doc, pageWidth, margin, y, orcamento) {
  const innerW = pageWidth - margin * 2;
  const totalsW = 70;
  const x = pageWidth - margin - totalsW;

  // Subtotal
  txt(doc, 'Subtotal', x, y, { size: 9, color: C.text3 });
  txt(doc, brl(orcamento.subtotal || 0), pageWidth - margin, y, {
    size: 9,
    color: C.text2,
    align: 'right',
  });
  y += 5;

  // Desconto
  if (orcamento.desconto > 0) {
    txt(doc, 'Desconto', x, y, { size: 9, color: C.text3 });
    txt(doc, `- ${brl(orcamento.desconto)}`, pageWidth - margin, y, {
      size: 9,
      color: C.amber,
      align: 'right',
    });
    y += 5;
  }

  // Linha divisória
  doc.setDrawColor(...C.borderStrong);
  doc.setLineWidth(0.4);
  doc.line(x, y, pageWidth - margin, y);
  y += 4;

  // Total grande
  txt(doc, 'TOTAL', x, y + 2, {
    size: 10,
    style: 'bold',
    color: C.text,
  });
  txt(doc, brl(orcamento.total || 0), pageWidth - margin, y + 2, {
    size: 14,
    style: 'bold',
    color: C.primary,
    align: 'right',
  });
  return y + 10;
}

function drawCondicoes(doc, pageWidth, margin, y, orcamento) {
  if (!orcamento.formaPagamento && !orcamento.observacoes) return y;

  txt(doc, 'CONDIÇÕES', margin, y, {
    size: 7,
    style: 'bold',
    color: C.text3,
  });
  y += 5;

  if (orcamento.formaPagamento) {
    txt(doc, 'Forma de pagamento:', margin, y, { size: 8.5, style: 'bold', color: C.text2 });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...C.text);
    const lines = doc.splitTextToSize(orcamento.formaPagamento, pageWidth - margin * 2 - 50);
    doc.text(lines, margin + 50, y);
    y += Math.max(5, lines.length * 4.5);
  }

  if (orcamento.observacoes) {
    txt(doc, 'Observações:', margin, y, { size: 8.5, style: 'bold', color: C.text2 });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...C.text);
    const lines = doc.splitTextToSize(orcamento.observacoes, pageWidth - margin * 2 - 50);
    doc.text(lines, margin + 50, y);
    y += Math.max(5, lines.length * 4.5);
  }

  return y + 6;
}

function drawTermo(doc, pageWidth, pageHeight, margin, y, orcamento) {
  // Garante espaço pra termo + assinatura. Se não couber, força nova página.
  const needed = 70;
  if (y + needed > pageHeight - 20) {
    doc.addPage();
    y = margin + 10;
  }

  // Box termo
  doc.setFillColor(...C.bg2);
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.3);
  const boxH = 22;
  doc.rect(margin, y, pageWidth - margin * 2, boxH, 'FD');
  fillRect(doc, margin, y, 2.5, boxH, C.primary);

  txt(doc, 'TERMO DE ACEITE', margin + 6, y + 5.5, {
    size: 7,
    style: 'bold',
    color: C.text3,
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...C.text2);
  const termo =
    'Ao assinar este orçamento, o cliente declara estar ciente dos itens, valores e condições descritos acima, e autoriza o início da execução do serviço conforme acordado.';
  const termoLines = doc.splitTextToSize(termo, pageWidth - margin * 2 - 12);
  doc.text(termoLines, margin + 6, y + 10);
  y += boxH + 14;

  // Caixa de assinatura
  const sigW = pageWidth - margin * 2;
  const sigH = 30;
  doc.setDrawColor(...C.borderStrong);
  doc.setLineWidth(0.4);
  doc.setFillColor(...C.surface);
  doc.rect(margin, y, sigW, sigH, 'FD');

  // X indicador no canto esquerdo
  txt(doc, '×', margin + 6, y + sigH / 2 + 2, {
    size: 14,
    color: C.text3,
  });

  // Linha de assinatura no meio
  doc.setDrawColor(...C.text3);
  doc.setLineWidth(0.3);
  doc.line(margin + 12, y + sigH / 2 + 4, margin + sigW - 8, y + sigH / 2 + 4);

  // Label
  txt(doc, 'ASSINATURA DO CLIENTE', margin + sigW / 2, y + sigH + 5, {
    size: 7,
    style: 'bold',
    color: C.text3,
    align: 'center',
  });
  y += sigH + 12;

  // Nome + data placeholder
  txt(doc, 'Nome: ____________________________________', margin, y, {
    size: 9,
    color: C.text2,
  });
  txt(doc, 'Data: ___ / ___ / ______', pageWidth - margin, y, {
    size: 9,
    color: C.text2,
    align: 'right',
  });

  return y + 6;
}

function drawFooter(doc, pageWidth, pageHeight, margin, orcamento) {
  const pageCount = doc.internal.pages.length - 1;
  for (let p = 1; p <= pageCount; p += 1) {
    doc.setPage(p);
    const y = pageHeight - 10;
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.2);
    doc.line(margin, y - 3, pageWidth - margin, y - 3);
    txt(doc, orcamento.numero || '', margin, y, {
      size: 7,
      color: C.text3,
    });
    txt(doc, 'Gerado pelo CoolTrack Pro', pageWidth / 2, y, {
      size: 7,
      color: C.text3,
      align: 'center',
    });
    txt(doc, `Página ${p} de ${pageCount}`, pageWidth - margin, y, {
      size: 7,
      color: C.text3,
      align: 'right',
    });
  }
}

function buildFileName(orcamento) {
  const safeNumero = String(orcamento.numero || 'orcamento').replace(/[^A-Za-z0-9]+/g, '-');
  const safeCliente = String(orcamento.clienteNome || '')
    .replace(/[^A-Za-z0-9À-ÿ]+/g, '-')
    .slice(0, 30);
  return `${safeNumero}${safeCliente ? '_' + safeCliente : ''}.pdf`;
}

/**
 * Gera o PDF do orçamento.
 * @param {Object} orcamento
 * @param {Object} profile
 * @param {boolean} [asBlob=false]
 * @returns {string|{fileName, blob}}
 */
export function generateOrcamentoPdf({ orcamento, profile = {}, asBlob = false }) {
  if (!orcamento) throw new Error('Orçamento não informado');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;

  drawMasthead(doc, pageWidth, margin, profile);
  let y = 32;
  y = drawTitle(doc, pageWidth, margin, y, orcamento);
  y = drawMetaStrip(doc, pageWidth, margin, y, orcamento);
  y += 4;
  y = drawClienteBlock(doc, pageWidth, margin, y, orcamento);
  y = drawTituloBlock(doc, pageWidth, margin, y, orcamento);
  y = drawItemsTable(doc, pageWidth, margin, y, orcamento);
  y = drawTotals(doc, pageWidth, margin, y, orcamento);
  y += 4;
  y = drawCondicoes(doc, pageWidth, margin, y, orcamento);
  y = drawTermo(doc, pageWidth, pageHeight, margin, y, orcamento);

  drawFooter(doc, pageWidth, pageHeight, margin, orcamento);

  const fileName = buildFileName(orcamento);
  if (asBlob) {
    return { fileName, blob: doc.output('blob') };
  }
  doc.save(fileName);
  return fileName;
}
