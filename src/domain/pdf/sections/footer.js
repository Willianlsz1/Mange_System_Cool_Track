import { PDF_COLORS } from '../constants.js';
import { fillRect } from '../primitives.js';

export function drawFooter(doc, pageWidth, pageHeight, margin, _profile, pageNum) {
  const footerY = pageHeight - 12;
  fillRect(doc, 0, footerY - 2, pageWidth, 14, PDF_COLORS.white);
  fillRect(doc, 0, footerY - 2, pageWidth, 0.4, PDF_COLORS.border);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...PDF_COLORS.text3);
  doc.text('Gerado pelo CoolTrack Pro', margin, footerY + 4);
  doc.text(`Relatório #${pageNum}`, pageWidth - margin, footerY + 4, { align: 'right' });
}
