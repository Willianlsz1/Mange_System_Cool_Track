/**
 * CoolTrack Pro - PDF Generator v5.1 (SaaS) - REFACTORADO
 * + Assinatura digital embarcada
 * + Campos de custo (peças + mão de obra + total)
 * + Dados de perfil do técnico no cabeçalho
 * 
 * MELHORIAS IMPLEMENTADAS:
 * ✓ Tarefa 1: Header com fundo dark (#0B1120), títulos maiores (22px/14px)
 * ✓ Tarefa 2: Resumo executivo melhorado (fontes 13px/10px)
 * ✓ Tarefa 3: Tabela otimizada (fontes 9-11px, cellPadding 6-10px)
 * ✅ CORRIGIDO: ReferenceError de/ate not defined
 */

import { jsPDF }     from 'jspdf';
import autoTable     from 'jspdf-autotable';
import { getState }  from './state.js';
import { Utils }     from './utils.js';
import { Profile }   from './onboarding.js';
import { getSignatureForRecord } from './signature.js';

const C = {
  navy:   [11,  17,  32],   // #0B1120
  navy2:  [15,  23,  42],
  navy3:  [23,  34,  53],
  cyan:   [0,   212, 255],
  amber:  [232, 160, 32],
  red:    [224, 48,  64],
  green:  [0,   200, 112],
  text:   [232, 242, 250],
  text2:  [138, 170, 200],
  text3:  [106, 139, 168],
  white:  [255, 255, 255],
  border: [23,  45,  69],
};

const STATUS_PDF = {
  ok:     { label: 'OPERANDO', color: C.green },
  warn:   { label: 'ATENCAO',  color: C.amber },
  danger: { label: 'FALHA',    color: C.red   },
};

export const PDFGenerator = {

  generateMaintenanceReport(options = {}) {
    try {
      const { registros, equipamentos } = getState();
      const { filtEq = '', de = '', ate = '' } = options;
      const profile = Profile.get();

      let filtered = [...registros].sort((a, b) => b.data.localeCompare(a.data));
      if (filtEq) filtered = filtered.filter(r => r.equipId === filtEq);
      if (de)     filtered = filtered.filter(r => r.data >= de);
      if (ate)    filtered = filtered.filter(r => r.data <= `${ate}T23:59`);

      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const PW  = doc.internal.pageSize.getWidth();
      const PH  = doc.internal.pageSize.getHeight();
      const M   = 14;

      this._drawHeader(doc, PW, M, profile, filtEq, de, ate, filtered, equipamentos);
      
      let yPos = 56;  // Mais breathing room
      
      // ✅ CORRIGIDO: Passando de e ate como parâmetros
      yPos = this._drawSummary(doc, PW, M, yPos, filtered, de, ate);

      if (filtered.length > 0) {
        this._drawTable(doc, PW, PH, M, yPos, filtered, equipamentos);
        this._drawSignaturePages(doc, PW, PH, M, filtered, equipamentos);
      } else {
        doc.setFontSize(12); doc.setTextColor(...C.text3);
        doc.text('Nenhum registro encontrado.', PW / 2, yPos + 20, { align: 'center' });
        this._drawFooter(doc, PW, PH, profile, 1, 1);
      }

      const fileName = `CoolTrack_${(profile?.empresa || 'Relatorio').replace(/\s/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
      doc.save(fileName);
      return fileName;
    } catch (err) {
      console.error('[PDFGenerator]', err);
      return null;
    }
  },

  _drawHeader(doc, PW, M, profile, filtEq, de, ate, filtered, equipamentos) {
    // Fundo dark #0B1120
    doc.setFillColor(...C.navy);  
    doc.rect(0, 0, PW, 52, 'F');
    
    // Linha decorativa cyan no topo
    doc.setFillColor(...C.cyan); 
    doc.rect(0, 0, PW, 3, 'F');
    
    // TÍTULO PRINCIPAL 22px
    doc.setTextColor(...C.cyan); 
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('COOLTRACK PRO', M, 16);

    // SUBTÍTULO 14px
    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal'); 
    doc.setTextColor(...C.text2);
    doc.text('Sistema de Gestao de Climatizacao e Refrigeracao', M, 24);

    // Perfil do técnico
    if (profile?.nome) {
      doc.setTextColor(...C.text); 
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(profile.nome + (profile.empresa ? ` — ${profile.empresa}` : ''), M, 33);
      if (profile.telefone) {
        doc.setFont('helvetica', 'normal'); 
        doc.setFontSize(9);
        doc.setTextColor(...C.text3);
        doc.text(profile.telefone, M, 39);
      }
    }

    // Linha separadora cyan
    doc.setDrawColor(...C.cyan);
    doc.setLineWidth(0.5);
    doc.line(M, 44, PW - M, 44);

    // Informações de geração
    const hoje = new Date().toLocaleDateString('pt-BR', { 
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' 
    });
    
    doc.setFontSize(10);
    doc.setTextColor(...C.text3);
    doc.text(`Gerado: ${hoje}`, M, 50);

    const eqLabel = filtEq ? (equipamentos.find(e => e.id === filtEq)?.nome || '—') : 'Todos';
    doc.text(`Equipamento: ${eqLabel}`, M + 80, 50);
    doc.text(`Periodo: ${de || 'inicio'} a ${ate || 'atual'}`, M + 180, 50);
    
    doc.setTextColor(...C.cyan); 
    doc.setFontSize(10);
    doc.text(`${filtered.length} registro(s)`, PW - M, 50, { align: 'right' });
  },

  // ✅ CORRIGIDO: Agora recebe de e ate como parâmetros
  _drawSummary(doc, PW, M, yPos, filtered, de, ate) {
    const counts   = { ok: 0, warn: 0, danger: 0 };
    let totalCusto = 0;
    
    filtered.forEach(r => {
      if (counts[r.status] !== undefined) counts[r.status]++;
      totalCusto += (parseFloat(r.custoPecas || 0) + parseFloat(r.custoMaoObra || 0));
    });

    const resumoY = yPos;

    // Borda lateral esquerda decorativa cyan
    doc.setFillColor(...C.cyan);
    doc.rect(M, resumoY, 3, 24, 'F');

    // Fundo dark
    doc.setFillColor(15, 23, 42);  
    doc.roundedRect(M + 5, resumoY, PW - (M * 2) - 5, 24, 4, 4, 'F');

    // Título do resumo 13px
    doc.setTextColor(...C.cyan); 
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('RESUMO EXECUTIVO', M + 14, resumoY + 8);

    // Dados do resumo 10px
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.text2);
    
    // ✅ Agora de e ate estão definidos!
    const summaryText = `Registros: ${filtered.length}   |   Equipamentos: ${filtered.length > 0 ? new Set(filtered.map(r => r.equipId)).size : 0}   |   Periodo: ${de || 'Inicio'} ate ${ate || 'Atual'}   |   Custo Total: R$${totalCusto.toFixed(2).replace('.', ',')}`;
    doc.text(summaryText, M + 14, resumoY + 17);

    return resumoY + 28;
  },

  _drawTable(doc, PW, PH, M, yPos, filtered, equipamentos) {
    const rows = filtered.map(r => {
      const eq         = equipamentos.find(e => e.id === r.equipId);
      const stData     = STATUS_PDF[r.status] || STATUS_PDF.ok;
      const custoTotal = (parseFloat(r.custoPecas || 0) + parseFloat(r.custoMaoObra || 0));
      return [
        Utils.formatDatetime(r.data),
        eq?.nome?.substring(0, 20) || '—',
        eq?.tag || '—',
        eq?.fluido || '—',
        r.tipo?.substring(0, 22) || '—',
        r.tecnico?.substring(0, 14) || '—',
        stData.label,
        custoTotal > 0 ? `R$${custoTotal.toFixed(2).replace('.', ',')}` : '—',
        r.obs?.substring(0, 70) || '—',
      ];
    });

    autoTable(doc, {
      startY: yPos,
      head: [['DATA / HORA', 'EQUIPAMENTO', 'TAG', 'FLUIDO', 'TIPO DE SERVICO', 'TECNICO', 'STATUS', 'CUSTO', 'DESCRICAO']],
      body: rows,
      theme: 'plain',
      
      styles: { 
        fontSize: 9,
        cellPadding: { top: 6, right: 7, bottom: 6, left: 6 },
        textColor: C.text2, 
        font: 'helvetica', 
        overflow: 'linebreak', 
        lineColor: C.border, 
        lineWidth: 0.3,
        lineHeight: 1.4
      },
      
      headStyles: { 
        fillColor: C.navy2, 
        textColor: C.text3, 
        fontStyle: 'bold', 
        fontSize: 8,
        halign: 'left', 
        lineColor: C.cyan, 
        lineWidth: { bottom: 0.6 },
        cellPadding: { top: 7, right: 6, bottom: 7, left: 6 },
        fontStyle: 'bold'
      },
      
      bodyStyles: { 
        fillColor: C.navy2,
        fontSize: 9
      },
      
      alternateRowStyles: { 
        fillColor: C.navy
      },
      
      columnStyles: {
        0: { cellWidth: 28, halign: 'center', fontSize: 9, textColor: C.text3 },
        1: { cellWidth: 34, fontSize: 10, fontWeight: '600' },
        2: { cellWidth: 18, fontStyle: 'bold', textColor: C.cyan, fontSize: 9 },
        3: { cellWidth: 16, halign: 'center', fontSize: 9 },
        4: { cellWidth: 34, fontSize: 9 },
        5: { cellWidth: 22, halign: 'center', fontSize: 9 },
        6: { cellWidth: 18, halign: 'center', fontStyle: 'bold', fontSize: 9 },
        7: { cellWidth: 22, halign: 'right', fontSize: 9, textColor: C.cyan },
        8: { cellWidth: 'auto', fontSize: 9 },
      },
      
      didParseCell: (data) => {
        if (data.section !== 'body') return;
        
        if (data.column.index === 6) {
          const v = data.cell.raw;
          data.cell.styles.textColor = v === 'FALHA' ? C.red : v === 'ATENCAO' ? C.amber : C.green;
          data.cell.styles.fontStyle = 'bold';
        }
        
        if (data.column.index === 2) {
          data.cell.styles.textColor = C.cyan;
          data.cell.styles.fontStyle = 'bold';
        }
        
        if (data.column.index === 7) {
          data.cell.styles.textColor = C.cyan;
        }
      },
      
      didDrawPage: (data) => this._drawFooter(doc, PW, PH, Profile.get(), data.pageNumber, doc.getNumberOfPages()),
      
      margin: { top: 12, right: M, bottom: 20, left: M },
      
      tableWidth: 'auto',
    });
  },

  _drawSignaturePages(doc, PW, PH, M, filtered, equipamentos) {
    const withSig = filtered.filter(r => r.assinatura);
    if (!withSig.length) return;

    withSig.forEach(r => {
      const sigData = getSignatureForRecord(r.id);
      if (!sigData) return;

      doc.addPage();
      const eq = equipamentos.find(e => e.id === r.equipId);

      doc.setFillColor(...C.navy); doc.rect(0, 0, PW, 32, 'F');
      doc.setFillColor(...C.cyan); doc.rect(0, 0, PW, 3, 'F');
      doc.setTextColor(...C.cyan); doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('COOLTRACK PRO — COMPROVANTE DE SERVIÇO', M, 15);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.text2);
      doc.text(`${eq?.nome || '—'} · ${Utils.formatDatetime(r.data)}`, M, 24);

      let y = 42;
      doc.setFontSize(9);
      doc.setTextColor(...C.text3);
      const lines = [
        ['Equipamento:', eq?.nome || '—'],
        ['TAG:',         eq?.tag  || '—'],
        ['Local:',       eq?.local || '—'],
        ['Tipo de Serviço:', r.tipo],
        ['Técnico:',     r.tecnico || '—'],
        ['Data/Hora:',   Utils.formatDatetime(r.data)],
        ['Status pós-serviço:', r.status === 'ok' ? 'Operando Normal' : r.status === 'warn' ? 'Requer Atenção' : 'Fora de Operação'],
      ];
      lines.forEach(([label, val]) => {
        doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.text2);
        doc.text(label, M, y);
        doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.text);
        doc.text(val, M + 55, y);
        y += 8;
      });

      y += 5;
      doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.text2); doc.text('Descrição do Serviço:', M, y);
      y += 7;
      doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.text);
      const obsLines = doc.splitTextToSize(r.obs, PW - M * 2);
      doc.text(obsLines, M, y);
      y += obsLines.length * 6 + 12;

      doc.setFillColor(...C.navy2); doc.roundedRect(M, y, PW / 2.2, 52, 2, 2, 'F');
      try {
        doc.addImage(sigData, 'PNG', M + 4, y + 4, (PW / 2.2) - 8, 44);
      } catch (_) {}
      doc.setDrawColor(...C.cyan); doc.setLineWidth(0.4);
      doc.line(M + 4, y + 50, M + (PW / 2.2) - 8, y + 50);
      doc.setFontSize(8);
      doc.setTextColor(...C.text3);
      doc.text('Assinatura do cliente', M + 4, y + 56);
      doc.setTextColor(...C.green);
      doc.text(`Assinado digitalmente em ${Utils.formatDatetime(new Date().toISOString())}`, M + 4, y + 62);

      this._drawFooter(doc, PW, PH, Profile.get(), doc.getCurrentPageInfo().pageNumber, doc.getNumberOfPages());
    });
  },

  _drawFooter(doc, PW, PH, profile, pageNum, totalPages) {
    const footY = PH - 12;
    doc.setFillColor(...C.navy); doc.rect(0, footY - 2, PW, 14, 'F');
    doc.setFillColor(...C.cyan); doc.rect(0, footY - 2, PW, 0.6, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.text3);
    const leftText = profile?.nome 
      ? `CoolTrack Pro v5.1 — ${profile.nome}${profile.empresa ? ` / ${profile.empresa}` : ''}` 
      : 'CoolTrack Pro v5.1 — Sistema de Gestao de Climatizacao e Refrigeracao';
    doc.text(leftText, 14, footY + 4);
    doc.text(`Pagina ${pageNum} de ${totalPages}`, PW - 14, footY + 4, { align: 'right' });
  },
};

export default PDFGenerator;