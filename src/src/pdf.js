/**
 * CoolTrack Pro - PDF Generator Module v1.0
 * 
 * Geração de relatórios PDF profissionais usando jsPDF
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getState } from './state.js';
import { Utils } from './utils.js';

const COLORS = {
  primary: [0, 212, 255],
  dark: [7, 12, 24],
  text: [37, 242, 247],
  muted: [123, 141, 166],
  success: [0, 229, 160],
  warning: [255, 184, 0],
  danger: [255, 61, 90]
};

export const PDFGenerator = {
  
  /**
   * Gera relatório completo de manutenções
   */
  generateMaintenanceReport(options = {}) {
    const { registros, equipamentos } = getState();
    const { filtEq = '', de = '', ate = '' } = options;
    
    // Filtra registros
    let filtered = [...registros].sort((a, b) => b.data.localeCompare(a.data));
    
    if (filtEq) filtered = filtered.filter(r => r.equipId === filtEq);
    if (de) filtered = filtered.filter(r => r.data >= de);
    if (ate) filtered = filtered.filter(r => r.data <= `${ate}T23:59`);
    
    // Cria documento PDF (formato A4 landscape para tabelas)
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });
    
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    // ====== CABEÇALHO ======
    // Background escuro
    doc.setFillColor(...COLORS.dark);
    doc.rect(0, 0, pageWidth, 35, 'F');
    
    // Linha decorativa primária
    doc.setFillColor(...COLORS.primary);
    doc.rect(0, 33, pageWidth, 2, 'F');
    
    // Título
    doc.setTextColor(...COLORS.text);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('COOLTRACK PRO', 15, 15);
    
    // Subtítulo
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.muted);
    doc.text('Relatório de Manutenção de Equipamentos', 15, 23);
    
    // Data do relatório
    doc.setFontSize(10);
    const today = new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    doc.text(`Gerado em: ${today}`, pageWidth - 15, 15, { align: 'right' });
    
    // ====== RESUMO EXECUTIVO ======
    let yPosition = 45;
    
    doc.setFillColor(240, 240, 240);
    doc.roundedRect(15, yPosition, pageWidth - 30, 30, 3, 3, 'F');
    
    doc.setTextColor(...COLORS.dark);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('RESUMO EXECUTIVO', 22, yPosition + 10);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Total de Registros: ${filtered.length}`, 22, yPosition + 18);
    doc.text(`Equipamentos Cadastrados: ${equipamentos.length}`, 80, yPosition + 18);
    doc.text(`Período: ${de || 'Início'} até ${ate || 'Atual'}`, 160, yPosition + 18);
    
    yPosition += 40;
    
    // ====== TABELA DE REGISTROS ======
    if (filtered.length > 0) {
      // Prepara dados para tabela
      const tableData = filtered.map(reg => {
        const eq = equipamentos.find(e => e.id === reg.equipId);
        
        return [
          Utils.formatDatetime(reg.data),
          eq?.nome || '—',
          reg.tipo?.substring(0, 30) || '—',
          reg.tecnico || '—',
          reg.status === 'ok' ? '✅ Normal' : 
           reg.status === 'warn' ? '⚠️ Atenção' : '🔴 Crítico',
          reg.obs?.substring(0, 50) || '—'
        ];
      });
      
      // Configuração da tabela
      autoTable(doc, {
        startY: yPosition,
        head: [['Data/Hora', 'Equipamento', 'Tipo de Serviço', 'Técnico', 'Status', 'Observações']],
        body: tableData,
        theme: 'grid',
        styles: {
          fontSize: 9,
          cellPadding: 4,
          lineColor: [200, 200, 200],
          lineWidth: 0.5,
          textColor: [60, 60, 60]
        },
        headStyles: {
          fillColor: [...COLORS.dark],
          textColor: [...COLORS.text],
          fontStyle: 'bold',
          fontSize: 10,
          halign: 'center'
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245]
        },
        columnStyles: {
          0: { cellWidth: 35 },  // Data
          1: { cellWidth: 40 },  // Equipamento
          2: { cellWidth: 55 },  // Tipo
          3: { cellWidth: 30 },  // Técnico
          4: { cellWidth: 25 },  // Status
          5: { cellWidth: 'auto' } // Obs
        },
        didParseCell: function(data) {
          // Colorir status
          if (data.section === 'body' && data.column.index === 4) {
            if (data.cell.raw.includes('Normal')) {
              data.cell.styles.textColor = [...COLORS.success];
            } else if (data.cell.raw.includes('Atenção')) {
              data.cell.styles.textColor = [...COLORS.warning];
            } else if (data.cell.raw.includes('Crítico')) {
              data.cell.styles.textColor = [...COLORS.danger];
            }
          }
        }
      });
    } else {
      doc.setFontSize(14);
      doc.setTextColor(...COLORS.muted);
      doc.text('Nenhum registro encontrado para o período selecionado.', pageWidth / 2, yPosition + 20, { align: 'center' });
    }
    
    // ====== RODAPÉ ======
    const finalY = doc.lastAutoTable?.finalY || yPosition + 40;
    
    doc.setFillColor(...COLORS.dark);
    doc.rect(0, pageHeight - 15, pageWidth, 15, 'F');
    
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.muted);
    doc.text(
      'CoolTrack Pro v3.1.0 | Relatório gerado automaticamente | Página 1 de 1',
      pageWidth / 2,
      pageHeight - 6,
      { align: 'center' }
    );
    
    // Salva o PDF
    const fileName = `CoolTrack_Relatorio_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(fileName);
    
    return fileName;
  },
  
  /**
   * Gera relatório simplificado de um equipamento específico
   */
  generateEquipmentReport(equipId) {
    const { equipamentos, registros } = getState();
    const eq = equipamentos.find(e => e.id === equipId);
    
    if (!eq) {
      alert('Equipamento não encontrado!');
      return null;
    }
    
    const eqRegistros = registros
      .filter(r => r.equipId === equipId)
      .sort((a, b) => b.data.localeCompare(a.data));
    
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Cabeçalho
    doc.setFillColor(...COLORS.dark);
    doc.rect(0, 0, pageWidth, 40, 'F');
    
    doc.setFillColor(...COLORS.primary);
    doc.rect(0, 38, pageWidth, 2, 'F');
    
    doc.setTextColor(...COLORS.text);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('RELATÓRIO DO EQUIPAMENTO', 15, 18);
    
    doc.setFontSize(14);
    doc.text(eq.nome, 15, 28);
    
    // Informações do equipamento
    let y = 55;
    doc.setFontSize(11);
    doc.setTextColor(...COLORS.dark);
    
    doc.setFont('helvetica', 'bold');
    doc.text('TAG:', 20, y); doc.setFont('normal'); doc.text(eq.tag || '—', 45, y); y += 8;
    doc.setFont('bold'); doc.text('Local:', 20, y); doc.setFont('normal'); doc.text(eq.local, 45, y); y += 8;
    doc.setFont('bold'); doc.text('Tipo:', 20, y); doc.setFont('normal'); doc.text(eq.tipo, 45, y); y += 8;
    doc.setFont('bold'); doc.text('Modelo:', 20, y); doc.setFont('normal'); doc.text(eq.modelo || '—', 45, y); y += 8;
    doc.setFont('bold'); doc.text('Fluido:', 20, y); doc.setFont('normal'); doc.text(eq.fluido || '—', 45, y); y += 12;
    
    // Tabela de manutenções
    if (eqRegistros.length > 0) {
      const tableData = eqRegistros.map(reg => [
        Utils.formatDatetime(reg.data),
        reg.tipo,
        reg.tecnico || '—',
        reg.obs?.substring(0, 60) || '—'
      ]);
      
      autoTable(doc, {
        startY: y,
        head: [['Data', 'Serviço', 'Técnico', 'Observações']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [...COLORS.dark], textColor: [...COLORS.text] },
        styles: { fontSize: 10 }
      });
    }
    
    // Salva
    const fileName = `CoolTrack_${eq.nome.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
    doc.save(fileName);
    
    return fileName;
  }
};

export default PDFGenerator;