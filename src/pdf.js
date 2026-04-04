/**
 * CoolTrack Pro - PDF Generator v4.0
 * Design industrial HVAC:
 * - Paleta navy/cyan/amber/red
 * - Cabeçalho técnico com TAG, fluido, modelo
 * - Tabela densa com dados de campo
 * - Rodapé com versão e paginação
 * - Sem emojis (compatibilidade total com jsPDF)
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getState } from './state.js';
import { Utils } from './utils.js';

// ── Paleta HVAC para PDF ──────────────────────────────
const C = {
  navy:       [7,   17,  31],   // #07111F
  navy2:      [12,  25,  41],   // #0C1929
  navy3:      [23,  34,  53],   // #172235
  cyan:       [0,   200, 232],  // #00C8E8
  cyan_dim:   [0,   44,  55],   // fundo ciano suave
  amber:      [232, 160, 32],   // #E8A020
  amber_dim:  [50,  38,  10],   // fundo amber suave
  red:        [224, 48,  64],   // #E03040
  red_dim:    [50,  15,  18],   // fundo red suave
  green:      [0,   200, 112],  // #00C870
  green_dim:  [0,   42,  26],   // fundo green suave
  text:       [232, 242, 250],  // #E8F2FA
  text2:      [138, 170, 200],  // #8AAAC8
  text3:      [74,  104, 128],  // #4A6880
  white:      [255, 255, 255],
  border:     [23,  45,  69],   // --surface-3
};

const STATUS_PDF = {
  ok:     { label: 'OPERANDO', color: C.green },
  warn:   { label: 'ATENCAO',  color: C.amber },
  danger: { label: 'FALHA',    color: C.red   },
};

function hex(rgb) {
  return '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('');
}

export const PDFGenerator = {

  generateMaintenanceReport(options = {}) {
    try {
      const { registros, equipamentos } = getState();
      const { filtEq = '', de = '', ate = '' } = options;

      // ── Filtragem ──
      let filtered = [...registros].sort((a, b) => b.data.localeCompare(a.data));
      if (filtEq) filtered = filtered.filter(r => r.equipId === filtEq);
      if (de)     filtered = filtered.filter(r => r.data >= de);
      if (ate)    filtered = filtered.filter(r => r.data <= `${ate}T23:59`);

      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const PW  = doc.internal.pageSize.getWidth();
      const PH  = doc.internal.pageSize.getHeight();
      const M   = 14; // margem

      // ════════════════════════════════════════════════
      // CAPA / CABEÇALHO
      // ════════════════════════════════════════════════
      this._drawHeader(doc, PW, M, filtEq, de, ate, filtered, equipamentos);

      // ════════════════════════════════════════════════
      // SUMÁRIO EXECUTIVO
      // ════════════════════════════════════════════════
      let yPos = 52;
      yPos = this._drawSummary(doc, PW, M, yPos, filtered, equipamentos);

      // ════════════════════════════════════════════════
      // TABELA PRINCIPAL
      // ════════════════════════════════════════════════
      if (filtered.length > 0) {
        this._drawTable(doc, PW, PH, M, yPos, filtered, equipamentos);
      } else {
        doc.setFontSize(12);
        doc.setTextColor(...C.text3);
        doc.text('Nenhum registro encontrado para os filtros selecionados.', PW / 2, yPos + 20, { align: 'center' });
        this._drawFooter(doc, PW, PH, 1, 1);
      }

      const fileName = `CoolTrack_Relatorio_${new Date().toISOString().slice(0, 10)}.pdf`;
      doc.save(fileName);
      return fileName;

    } catch (err) {
      console.error('[PDFGenerator] Erro ao gerar PDF:', err);
      return null;
    }
  },

  // ── Cabeçalho industrial ─────────────────────────
  _drawHeader(doc, PW, M, filtEq, de, ate, filtered, equipamentos) {
    // Fundo navy escuro
    doc.setFillColor(...C.navy);
    doc.rect(0, 0, PW, 44, 'F');

    // Linha cyan no topo
    doc.setFillColor(...C.cyan);
    doc.rect(0, 0, PW, 2.5, 'F');

    // Logo texto
    doc.setTextColor(...C.cyan);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('COOLTRACK PRO', M, 16);

    // Subtítulo técnico
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.text2);
    doc.text('Sistema de Gestao de Climatizacao e Refrigeracao', M, 23);

    // Linha divisória vertical
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.3);
    doc.line(M, 28, PW - M, 28);

    // Metadados do relatório — linha inferior do header
    const hoje = new Date().toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

    doc.setFontSize(8);
    doc.setTextColor(...C.text3);
    doc.text(`Gerado em: ${hoje}`, M, 36);

    const eqLabel = filtEq
      ? (equipamentos.find(e => e.id === filtEq)?.nome || 'Equipamento selecionado')
      : 'Todos os equipamentos';
    doc.text(`Equipamento: ${eqLabel}`, M + 80, 36);

    const periodo = de || ate
      ? `${de || 'inicio'} a ${ate || 'atual'}`
      : 'Todo o historico';
    doc.text(`Periodo: ${periodo}`, M + 180, 36);

    doc.setTextColor(...C.cyan);
    doc.text(`${filtered.length} registro(s)`, PW - M, 36, { align: 'right' });
  },

  // ── Sumário executivo ─────────────────────────────
  _drawSummary(doc, PW, M, yPos, filtered, equipamentos) {
    const counts = { ok: 0, warn: 0, danger: 0 };
    filtered.forEach(r => { if (counts[r.status] !== undefined) counts[r.status]++; });

    const tiles = [
      { label: 'Total de Registros', value: String(filtered.length),  color: C.cyan  },
      { label: 'Operando Normal',    value: String(counts.ok),         color: C.green },
      { label: 'Requer Atencao',     value: String(counts.warn),       color: C.amber },
      { label: 'Falha / Critico',    value: String(counts.danger),     color: C.red   },
    ];

    const tileW = (PW - M * 2 - 9) / 4;
    tiles.forEach((t, i) => {
      const x = M + i * (tileW + 3);
      // Fundo tile
      doc.setFillColor(...C.navy2);
      doc.roundedRect(x, yPos, tileW, 18, 1.5, 1.5, 'F');
      // Borda superior colorida
      doc.setFillColor(...t.color);
      doc.roundedRect(x, yPos, tileW, 2, 1, 1, 'F');
      // Valor
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...t.color);
      doc.text(t.value, x + tileW / 2, yPos + 11, { align: 'center' });
      // Label
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...C.text3);
      doc.text(t.label.toUpperCase(), x + tileW / 2, yPos + 16, { align: 'center' });
    });

    return yPos + 24;
  },

  // ── Tabela principal ──────────────────────────────
  _drawTable(doc, PW, PH, M, yPos, filtered, equipamentos) {
    const rows = filtered.map(r => {
      const eq     = equipamentos.find(e => e.id === r.equipId);
      const stData = STATUS_PDF[r.status] || STATUS_PDF.ok;
      return [
        Utils.formatDatetime(r.data),
        eq?.nome?.substring(0, 22)   || '—',
        eq?.tag                       || '—',
        eq?.fluido                    || '—',
        r.tipo?.substring(0, 24)      || '—',
        r.tecnico?.substring(0, 16)   || '—',
        stData.label,
        r.obs?.substring(0, 90)       || '—',
      ];
    });

    autoTable(doc, {
      startY:       yPos,
      head: [[
        'DATA / HORA', 'EQUIPAMENTO', 'TAG',
        'FLUIDO', 'TIPO DE SERVICO', 'TECNICO',
        'STATUS', 'DESCRICAO'
      ]],
      body: rows,
      theme: 'plain',

      styles: {
        fontSize:   7.5,
        cellPadding: { top: 4, right: 5, bottom: 4, left: 5 },
        textColor:  C.text2,
        font:       'helvetica',
        overflow:   'linebreak',
        lineColor:  C.border,
        lineWidth:  0.2,
      },

      headStyles: {
        fillColor:  C.navy2,
        textColor:  C.text3,
        fontStyle:  'bold',
        fontSize:   7,
        halign:     'left',
        valign:     'middle',
        lineColor:  C.cyan,
        lineWidth:  { bottom: 0.5 },
      },

      alternateRowStyles: {
        fillColor: C.navy,
      },

      bodyStyles: {
        fillColor: C.navy2,
      },

      columnStyles: {
        0: { cellWidth: 30, halign: 'center', fontStyle: 'normal', textColor: C.text3, fontSize: 7 },
        1: { cellWidth: 38 },
        2: { cellWidth: 20, fontStyle: 'bold', textColor: C.cyan, fontSize: 7 },
        3: { cellWidth: 18, halign: 'center', fontSize: 7 },
        4: { cellWidth: 38 },
        5: { cellWidth: 24, halign: 'center', fontSize: 7 },
        6: { cellWidth: 18, halign: 'center', fontStyle: 'bold', fontSize: 7 },
        7: { cellWidth: 'auto' },
      },

      // Colorir status e TAGs
      didParseCell: (data) => {
        if (data.section !== 'body') return;

        // Coluna STATUS
        if (data.column.index === 6) {
          const raw = data.cell.raw;
          if (raw === 'FALHA')    data.cell.styles.textColor = C.red;
          else if (raw === 'ATENCAO') data.cell.styles.textColor = C.amber;
          else                    data.cell.styles.textColor = C.green;
        }

        // Coluna TAG — cyan
        if (data.column.index === 2) {
          data.cell.styles.textColor = C.cyan;
        }
      },

      // Rodapé em cada página
      didDrawPage: (data) => {
        this._drawFooter(
          doc, PW, PH,
          data.pageNumber,
          doc.getNumberOfPages()
        );
      },

      margin:     { top: 8, right: M, bottom: 18, left: M },
      tableWidth: 'auto',
    });
  },

  // ── Rodapé técnico ────────────────────────────────
  _drawFooter(doc, PW, PH, pageNum, totalPages) {
    const footY = PH - 10;

    // Barra de fundo
    doc.setFillColor(...C.navy);
    doc.rect(0, footY - 2, PW, 12, 'F');

    // Linha cyan superior
    doc.setFillColor(...C.cyan);
    doc.rect(0, footY - 2, PW, 0.5, 'F');

    // Texto esquerda
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.text3);
    doc.text(
      'CoolTrack Pro v4.0 — Sistema de Gestao de Climatizacao e Refrigeracao',
      14, footY + 3
    );

    // Texto direita — paginação
    doc.setTextColor(...C.text3);
    doc.text(
      `Pagina ${pageNum} de ${totalPages}`,
      PW - 14, footY + 3,
      { align: 'right' }
    );
  },
};

export default PDFGenerator;