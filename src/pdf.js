/**
 * CoolTrack Pro - PDF Generator Module v3.1 (P2 Fix)
 *
 * Correção aplicada:
 * [FIX-PDF] doc.internal.getNumberOfPages() → doc.getNumberOfPages()
 *           A API interna foi depreciada nas versões recentes do jsPDF.
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getState } from './state.js';
import { Utils } from './utils.js';

const COLORS = {
  primary: [0, 212, 255],
  dark: [15, 23, 42],
  text: [37, 242, 247],
  muted: [100, 116, 140],
  success: [0, 180, 130],
  warning: [230, 160, 0],
  danger: [230, 70, 90],
  white: [255, 255, 255]
};

export const PDFGenerator = {

  generateMaintenanceReport(options = {}) {
    const { registros, equipamentos } = getState();
    const { filtEq = '', de = '', ate = '' } = options;

    let filtered = [...registros].sort((a, b) => b.data.localeCompare(a.data));
    if (filtEq) filtered = filtered.filter(r => r.equipId === filtEq);
    if (de) filtered = filtered.filter(r => r.data >= de);
    if (ate) filtered = filtered.filter(r => r.data <= `${ate}T23:59`);

    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;

    // ── CABEÇALHO ──
    doc.setFillColor(...COLORS.dark);
    doc.rect(0, 0, pageWidth, 38, 'F');
    doc.setFillColor(...COLORS.primary);
    doc.rect(0, 36, pageWidth, 2, 'F');

    doc.setTextColor(...COLORS.white);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('COOLTRACK PRO', margin, 15);

    doc.setFontSize(13);
    doc.setTextColor(...COLORS.primary);
    doc.text('Relatorio de Manutencao de Equipamentos', margin, 24);

    doc.setFontSize(9);
    doc.setTextColor(...COLORS.muted);
    const today = new Date().toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
    doc.text(`Gerado: ${today}`, pageWidth - margin, 15, { align: 'right' });

    let yPos = 46;

    // ── RESUMO EXECUTIVO ──
    doc.setFillColor(240, 242, 245);
    doc.roundedRect(margin, yPos, pageWidth - (margin * 2), 20, 3, 3, 'F');

    doc.setTextColor(...COLORS.dark);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('RESUMO EXECUTIVO', margin + 5, yPos + 8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.muted);
    doc.text(`Registros: ${filtered.length}`, margin + 5, yPos + 15);
    doc.text(`Equipamentos: ${equipamentos.length}`, 60, yPos + 15);
    doc.text(`Periodo: ${de || 'Inicio'} ate ${ate || 'Atual'}`, 120, yPos + 15);

    yPos += 28;

    // ── TABELA PRINCIPAL ──
    if (filtered.length > 0) {
      const tableData = filtered.map(reg => {
        const eq = equipamentos.find(e => e.id === reg.equipId);
        let statusText = 'Normal';
        if (reg.status === 'warn') statusText = 'Atencao';
        if (reg.status === 'danger') statusText = 'Critico';
        return [
          Utils.formatDatetime(reg.data),
          eq?.nome?.substring(0, 20) || '--',
          reg.tipo?.substring(0, 25) || '--',
          reg.tecnico?.substring(0, 14) || '--',
          statusText,
          reg.obs?.substring(0, 80) || '--'
        ];
      });

      autoTable(doc, {
        startY: yPos,
        head: [['Data/Hora', 'Equipamento', 'Tipo de Servico', 'Tecnico', 'Status', 'Observacoes']],
        body: tableData,
        theme: 'grid',
        styles: {
          fontSize: 8.5, cellPadding: 4, lineColor: [200, 200, 200], lineWidth: 0.4,
          textColor: [50, 50, 50], font: 'helvetica', overflow: 'linebreak', cellWidth: 'wrap'
        },
        headStyles: {
          fillColor: [...COLORS.dark], textColor: [...COLORS.white],
          fontStyle: 'bold', fontSize: 8.5, halign: 'center', valign: 'middle'
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { cellWidth: 38, halign: 'center', fontSize: 8 },
          1: { cellWidth: 45, fontSize: 8 },
          2: { cellWidth: 55, fontSize: 8 },
          3: { cellWidth: 32, halign: 'center', fontSize: 8 },
          4: { cellWidth: 22, halign: 'center', fontSize: 8 },
          5: { cellWidth: 'auto', fontSize: 8 }
        },
        didParseCell: function(data) {
          if (data.section === 'body' && data.column.index === 4) {
            const status = data.cell.raw;
            if (status.includes('Critico')) { data.cell.styles.textColor = [...COLORS.danger]; data.cell.styles.fontStyle = 'bold'; }
            else if (status.includes('Atencao')) { data.cell.styles.textColor = [...COLORS.warning]; data.cell.styles.fontStyle = 'bold'; }
            else { data.cell.styles.textColor = [...COLORS.success]; data.cell.styles.fontStyle = 'bold'; }
          }
        },
        didDrawPage: function(data) {
          const footerY = pageHeight - 10;
          doc.setFillColor(...COLORS.dark);
          doc.rect(0, footerY, pageWidth, 10, 'F');
          doc.setFontSize(7.5);
          doc.setTextColor(...COLORS.muted);
          // [FIX-PDF] Usando doc.getNumberOfPages() em vez de doc.internal.getNumberOfPages()
          doc.text(
            `CoolTrack Pro v3.2.0 | Pagina ${data.pageNumber} de ${doc.getNumberOfPages()}`,
            pageWidth / 2, footerY + 4, { align: 'center' }
          );
        },
        margin: { top: 10, right: margin, bottom: 20, left: margin },
        tableWidth: 'auto'
      });

    } else {
      doc.setFontSize(14);
      doc.setTextColor(...COLORS.muted);
      doc.text('Nenhum registro encontrado.', pageWidth / 2, yPos + 30, { align: 'center' });
      this._addFooter(doc, pageWidth, pageHeight);
    }

    const fileName = `CoolTrack_Relatorio_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(fileName);
    return fileName;
  },

  _addFooter(doc, pageWidth, pageHeight) {
    const footerY = pageHeight - 10;
    doc.setFillColor(...COLORS.dark);
    doc.rect(0, footerY, pageWidth, 10, 'F');
    doc.setFontSize(7.5);
    doc.setTextColor(...COLORS.muted);
    // [FIX-PDF] Mesma correção no rodapé de fallback
    doc.text(
      `CoolTrack Pro v3.2.0 | Relatorio automatico | Pagina 1 de ${doc.getNumberOfPages()}`,
      pageWidth / 2, footerY + 4, { align: 'center' }
    );
  }
};

export default PDFGenerator;