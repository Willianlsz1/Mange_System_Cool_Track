import { PDF_COLORS, PDF_TYPO } from '../constants.js';
import { fillRect } from '../primitives.js';

// Rodapé de 2 linhas: (1) identidade do prestador, (2) OS + paginação.
// Padrão ASHRAE/ISO para relatórios técnicos: o emitente tem que aparecer
// em cada página pra que o documento seja verificável em auditoria.
export function drawFooter(doc, pageWidth, pageHeight, margin, profile, pageNum, context = {}) {
  const footerY = pageHeight - 14;
  fillRect(doc, 0, footerY - 2, pageWidth, 16, PDF_COLORS.white);
  fillRect(doc, 0, footerY - 2, pageWidth, 0.3, PDF_COLORS.border);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...PDF_COLORS.text3);

  // Linha 1 — identidade do prestador (empresa + telefone). Quando o perfil
  // não tem empresa/telefone cai em "Gerado por CoolTrack Pro" como antes.
  const empresa = profile?.empresa?.trim();
  const telefone = profile?.telefone?.trim();
  const prestadorParts = [empresa, telefone].filter(Boolean);
  const prestador = prestadorParts.length
    ? prestadorParts.join('  ·  ')
    : 'Gerado por CoolTrack Pro';

  doc.setFontSize(PDF_TYPO.micro.size);
  doc.text(prestador, margin, footerY + 3);

  // Canto direito: página atual / total. Setado em runtime pelo orquestrador
  // depois que todas as páginas foram desenhadas (via setPageTotals).
  const totalPages = context.totalPages || doc.internal.getNumberOfPages();
  doc.text(`Página ${pageNum} de ${totalPages}`, pageWidth - margin, footerY + 3, {
    align: 'right',
  });

  // Linha 2 — número da OS + data de emissão + crédito CoolTrack (discreto).
  const osNumber = context.osNumber || '';
  const emitido = context.emitido || '';
  const leftLineParts = [];
  if (osNumber) leftLineParts.push(`OS ${osNumber}`);
  if (emitido) leftLineParts.push(`Emitido em ${emitido}`);

  if (leftLineParts.length) {
    doc.text(leftLineParts.join('  ·  '), margin, footerY + 8);
  }

  doc.text('Gerado por CoolTrack Pro', pageWidth - margin, footerY + 8, { align: 'right' });
}

// Aplica o total de páginas ao rodapé depois que todas as seções foram desenhadas.
// Chamado pelo orquestrador (pdf.js) depois da marca d'água, antes do save().
export function stampFooterTotals(doc, pageWidth, pageHeight, margin, profile, context = {}) {
  const totalPages = doc.internal.getNumberOfPages();
  // Simplesmente redesenha o rodapé em cima dele mesmo com o total correto.
  // Como o fillRect branco do drawFooter cobre o rodapé anterior, não sobrepõe.
  for (let i = 1; i <= totalPages; i += 1) {
    doc.setPage(i);
    drawFooter(doc, pageWidth, pageHeight, margin, profile, i, { ...context, totalPages });
  }
}
