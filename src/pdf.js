/**
 * CoolTrack Pro - PDF Generator v5.0 (SaaS)
 * + Assinatura digital embarcada
 * + Campos de custo (peças + mão de obra + total)
 * + Dados de perfil do técnico no cabeçalho
 */

import { jsPDF }     from 'jspdf';
import autoTable     from 'jspdf-autotable';
import { getState }  from './state.js';
import { Utils }     from './utils.js';
import { Profile }   from './onboarding.js';
import { getSignatureForRecord } from './signature.js';

const C = {
  navy:   [7,   17,  31],
  navy2:  [12,  25,  41],
  navy3:  [23,  34,  53],
  cyan:   [0,   200, 232],
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
      let yPos = 56;
      yPos = this._drawSummary(doc, PW, M, yPos, filtered);

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
    doc.setFillColor(...C.navy); doc.rect(0, 0, PW, 48, 'F');
    doc.setFillColor(...C.cyan); doc.rect(0, 0, PW, 2.5, 'F');

    doc.setTextColor(...C.cyan); doc.setFontSize(18); doc.setFont('helvetica', 'bold');
    doc.text('COOLTRACK PRO', M, 14);

    doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.text2);
    doc.text('Sistema de Gestao de Climatizacao e Refrigeracao', M, 21);

    // Perfil do técnico no header
    if (profile?.nome) {
      doc.setTextColor(...C.text); doc.setFontSize(9); doc.setFont('helvetica', 'bold');
      doc.text(profile.nome + (profile.empresa ? ` — ${profile.empresa}` : ''), M, 30);
      if (profile.telefone) {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...C.text3);
        doc.text(profile.telefone, M, 36);
      }
    }

    doc.setDrawColor(...C.border); doc.setLineWidth(0.3); doc.line(M, 40, PW - M, 40);

    const hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    doc.setFontSize(8); doc.setTextColor(...C.text3);
    doc.text(`Gerado: ${hoje}`, M, 46);

    const eqLabel = filtEq ? (equipamentos.find(e => e.id === filtEq)?.nome || '—') : 'Todos';
    doc.text(`Equipamento: ${eqLabel}`, M + 70, 46);
    doc.text(`Periodo: ${de || 'inicio'} a ${ate || 'atual'}`, M + 170, 46);
    doc.setTextColor(...C.cyan); doc.text(`${filtered.length} registro(s)`, PW - M, 46, { align: 'right' });
  },

  _drawSummary(doc, PW, M, yPos, filtered) {
    const counts   = { ok: 0, warn: 0, danger: 0 };
    let totalCusto = 0;
    filtered.forEach(r => {
      if (counts[r.status] !== undefined) counts[r.status]++;
      totalCusto += (parseFloat(r.custoPecas || 0) + parseFloat(r.custoMaoObra || 0));
    });

    const tiles = [
      { label: 'Total Registros',  value: String(filtered.length), color: C.cyan  },
      { label: 'Operando Normal',  value: String(counts.ok),       color: C.green },
      { label: 'Requer Atencao',   value: String(counts.warn),     color: C.amber },
      { label: 'Falha / Critico',  value: String(counts.danger),   color: C.red   },
      { label: 'Custo Total (R$)', value: totalCusto > 0 ? totalCusto.toFixed(2).replace('.', ',') : '—', color: C.text2 },
    ];

    const tileW = (PW - M * 2 - 12) / 5;
    tiles.forEach((t, i) => {
      const x = M + i * (tileW + 3);
      doc.setFillColor(...C.navy2); doc.roundedRect(x, yPos, tileW, 18, 1.5, 1.5, 'F');
      doc.setFillColor(...t.color); doc.roundedRect(x, yPos, tileW, 2, 1, 1, 'F');
      doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.setTextColor(...t.color);
      doc.text(t.value, x + tileW / 2, yPos + 11, { align: 'center' });
      doc.setFontSize(6.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.text3);
      doc.text(t.label.toUpperCase(), x + tileW / 2, yPos + 16, { align: 'center' });
    });

    return yPos + 24;
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
      styles: { fontSize: 7, cellPadding: { top: 3, right: 4, bottom: 3, left: 4 }, textColor: C.text2, font: 'helvetica', overflow: 'linebreak', lineColor: C.border, lineWidth: 0.2 },
      headStyles: { fillColor: C.navy2, textColor: C.text3, fontStyle: 'bold', fontSize: 6.5, halign: 'left', lineColor: C.cyan, lineWidth: { bottom: 0.4 } },
      alternateRowStyles: { fillColor: C.navy },
      bodyStyles: { fillColor: C.navy2 },
      columnStyles: {
        0: { cellWidth: 28, halign: 'center', fontSize: 6.5, textColor: C.text3 },
        1: { cellWidth: 34 },
        2: { cellWidth: 18, fontStyle: 'bold', textColor: C.cyan, fontSize: 6.5 },
        3: { cellWidth: 16, halign: 'center', fontSize: 6.5 },
        4: { cellWidth: 34 },
        5: { cellWidth: 22, halign: 'center', fontSize: 6.5 },
        6: { cellWidth: 16, halign: 'center', fontStyle: 'bold', fontSize: 6.5 },
        7: { cellWidth: 20, halign: 'right',  fontSize: 6.5, textColor: C.cyan },
        8: { cellWidth: 'auto' },
      },
      didParseCell: (data) => {
        if (data.section !== 'body') return;
        if (data.column.index === 6) {
          const v = data.cell.raw;
          data.cell.styles.textColor = v === 'FALHA' ? C.red : v === 'ATENCAO' ? C.amber : C.green;
        }
        if (data.column.index === 2) data.cell.styles.textColor = C.cyan;
      },
      didDrawPage: (data) => this._drawFooter(doc, PW, PH, Profile.get(), data.pageNumber, doc.getNumberOfPages()),
      margin: { top: 8, right: M, bottom: 18, left: M },
      tableWidth: 'auto',
    });
  },

  _drawSignaturePages(doc, PW, PH, M, filtered, equipamentos) {
    // Página de assinaturas para registros que têm assinatura
    const withSig = filtered.filter(r => r.assinatura);
    if (!withSig.length) return;

    withSig.forEach(r => {
      const sigData = getSignatureForRecord(r.id);
      if (!sigData) return;

      doc.addPage();
      const eq = equipamentos.find(e => e.id === r.equipId);

      // Header simples
      doc.setFillColor(...C.navy); doc.rect(0, 0, PW, 30, 'F');
      doc.setFillColor(...C.cyan); doc.rect(0, 0, PW, 2, 'F');
      doc.setTextColor(...C.cyan); doc.setFontSize(13); doc.setFont('helvetica', 'bold');
      doc.text('COOLTRACK PRO — COMPROVANTE DE SERVIÇO', M, 14);
      doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.text2);
      doc.text(`${eq?.nome || '—'} · ${Utils.formatDatetime(r.data)}`, M, 22);

      // Dados do serviço
      let y = 40;
      doc.setFontSize(8); doc.setTextColor(...C.text3);
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
        doc.text(val, M + 50, y);
        y += 7;
      });

      // Descrição
      y += 4;
      doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.text2); doc.text('Descrição do Serviço:', M, y);
      y += 6;
      doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.text);
      const obsLines = doc.splitTextToSize(r.obs, PW - M * 2);
      doc.text(obsLines, M, y);
      y += obsLines.length * 5 + 10;

      // Assinatura
      doc.setFillColor(...C.navy2); doc.roundedRect(M, y, PW / 2.2, 50, 2, 2, 'F');
      try {
        doc.addImage(sigData, 'PNG', M + 4, y + 4, (PW / 2.2) - 8, 42);
      } catch (_) {}
      doc.setDrawColor(...C.cyan); doc.setLineWidth(0.3);
      doc.line(M + 4, y + 48, M + (PW / 2.2) - 8, y + 48);
      doc.setFontSize(7); doc.setTextColor(...C.text3);
      doc.text('Assinatura do cliente', M + 4, y + 54);
      doc.setTextColor(...C.success || C.green);
      doc.text(`Assinado digitalmente em ${Utils.formatDatetime(new Date().toISOString())}`, M + 4, y + 60);

      this._drawFooter(doc, PW, PH, Profile.get(), doc.getCurrentPageInfo().pageNumber, doc.getNumberOfPages());
    });
  },

  _drawFooter(doc, PW, PH, profile, pageNum, totalPages) {
    const footY = PH - 10;
    doc.setFillColor(...C.navy); doc.rect(0, footY - 2, PW, 12, 'F');
    doc.setFillColor(...C.cyan); doc.rect(0, footY - 2, PW, 0.5, 'F');
    doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.text3);
    const leftText = profile?.nome ? `CoolTrack Pro v5.0 — ${profile.nome}${profile.empresa ? ` / ${profile.empresa}` : ''}` : 'CoolTrack Pro v5.0 — Sistema de Gestao de Climatizacao e Refrigeracao';
    doc.text(leftText, 14, footY + 3);
    doc.text(`Pagina ${pageNum} de ${totalPages}`, PW - 14, footY + 3, { align: 'right' });
  },
};

export default PDFGenerator;