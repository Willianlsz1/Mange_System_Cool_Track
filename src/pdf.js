/**
 * CoolTrack Pro - PDF Generator v6.0
 * ─────────────────────────────────────────────────────────────────
 * Melhorias v6:
 *   • Capa executiva com logo textual, branding e dados do técnico
 *   • Tema dark preservado em TODAS as páginas (sem fundo branco)
 *   • Página de resumo executivo com KPIs visuais e gráfico de barras
 *   • Tabela de registros com densidade e legibilidade melhoradas
 *   • Header/footer profissionais e consistentes em cada página
 *   • Páginas de assinatura redesenhadas
 * ─────────────────────────────────────────────────────────────────
 */

import { jsPDF }    from 'jspdf';
import autoTable    from 'jspdf-autotable';
import { getState } from './state.js';
import { Utils }    from './utils.js';
import { Profile }  from './onboarding.js';
import { getSignatureForRecord } from './signature.js';

/* ── Paleta de cores (RGB) ───────────────────────────────────────── */
const C = {
  bg:      [7,   17,  31],   // fundo principal (navy profundo)
  bg2:     [12,  25,  41],   // card/tabela linha par
  bg3:     [18,  34,  56],   // card/tabela linha ímpar
  surface: [23,  38,  62],   // superfície elevada
  border:  [35,  60,  95],   // bordas sutis
  cyan:    [0,   200, 232],  // accent primário
  cyan2:   [0,   150, 175],  // accent secundário
  amber:   [232, 160, 32],   // aviso
  red:     [220, 48,  64],   // crítico
  green:   [0,   195, 110],  // ok
  text:    [232, 242, 250],  // texto primário
  text2:   [138, 170, 200],  // texto secundário
  text3:   [80,  115, 150],  // texto terciário / muted
  white:   [255, 255, 255],
};

const STATUS_PDF = {
  ok:     { label: 'OPERANDO', color: C.green },
  warn:   { label: 'ATENÇÃO',  color: C.amber },
  danger: { label: 'FALHA',    color: C.red   },
};

/* ── Helpers internos ────────────────────────────────────────────── */
function rgb(doc, arr)     { doc.setFillColor(...arr); }
function stroke(doc, arr)  { doc.setDrawColor(...arr); }
function color(doc, arr)   { doc.setTextColor(...arr); }

function fillRect(doc, x, y, w, h, c) {
  rgb(doc, c); doc.rect(x, y, w, h, 'F');
}

function roundRect(doc, x, y, w, h, r, c) {
  rgb(doc, c); doc.roundedRect(x, y, w, h, r, r, 'F');
}

/* Fundo escuro total da página */
function fillPage(doc, PW, PH) {
  fillRect(doc, 0, 0, PW, PH, C.bg);
}

/* Linha divisória com accent cyan */
function accentLine(doc, x1, y, x2) {
  stroke(doc, C.cyan); doc.setLineWidth(0.35);
  doc.line(x1, y, x2, y);
}

/* Texto com fonte definida inline */
function txt(doc, text, x, y, opts = {}) {
  doc.setFont('helvetica', opts.style || 'normal');
  doc.setFontSize(opts.size || 9);
  if (opts.color) color(doc, opts.color);
  doc.text(text, x, y, { align: opts.align || 'left', maxWidth: opts.maxWidth });
}

/* ── Export principal ─────────────────────────────────────────────── */
export const PDFGenerator = {

  generateMaintenanceReport(options = {}) {
    try {
      const { registros, equipamentos } = getState();
      const { filtEq = '', de = '', ate = '' } = options;
      const profile = Profile.get();

      /* Filtragem e ordenação */
      let filtered = [...registros].sort((a, b) => b.data.localeCompare(a.data));
      if (filtEq) filtered = filtered.filter(r => r.equipId === filtEq);
      if (de)     filtered = filtered.filter(r => r.data >= de);
      if (ate)    filtered = filtered.filter(r => r.data <= `${ate}T23:59`);

      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const PW  = doc.internal.pageSize.getWidth();   // 297mm
      const PH  = doc.internal.pageSize.getHeight();  // 210mm
      const M   = 16;

      /* ① Capa executiva */
      this._drawCoverPage(doc, PW, PH, M, profile, filtEq, de, ate, filtered, equipamentos);

      /* ② Página de resumo / KPIs */
      doc.addPage();
      fillPage(doc, PW, PH);
      this._drawPageHeader(doc, PW, M, 'RESUMO EXECUTIVO', profile, 2);
      this._drawExecutiveSummary(doc, PW, PH, M, filtered, equipamentos);
      this._drawFooter(doc, PW, PH, M, profile, 2);

      /* ③ Tabela de registros */
      if (filtered.length > 0) {
        doc.addPage();
        fillPage(doc, PW, PH);
        this._drawPageHeader(doc, PW, M, 'HISTÓRICO DE MANUTENÇÃO', profile, 3);
        this._drawTable(doc, PW, PH, M, filtered, equipamentos, profile);
        this._drawSignaturePages(doc, PW, PH, M, filtered, equipamentos, profile);
      } else {
        doc.addPage();
        fillPage(doc, PW, PH);
        this._drawPageHeader(doc, PW, M, 'HISTÓRICO DE MANUTENÇÃO', profile, 3);
        txt(doc, 'Nenhum registro encontrado para os filtros selecionados.', PW / 2, PH / 2,
          { align: 'center', color: C.text3, size: 11 });
        this._drawFooter(doc, PW, PH, M, profile, 3);
      }

      /* Atualiza número total de páginas no rodapé (não é possível retroativamente com jsPDF simples,
         mas usamos a abordagem de totalPages já conhecido ao final) */

      const fileName = `CoolTrack_${(profile?.empresa || 'Relatorio').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
      doc.save(fileName);
      return fileName;
    } catch (err) {
      console.error('[PDFGenerator v6]', err);
      return null;
    }
  },

  /* ── CAPA ──────────────────────────────────────────────────────── */
  _drawCoverPage(doc, PW, PH, M, profile, filtEq, de, ate, filtered, equipamentos) {
    fillPage(doc, PW, PH);

    /* Faixa lateral esquerda decorativa */
    fillRect(doc, 0, 0, 5, PH, C.cyan);

    /* Bloco superior escuro */
    fillRect(doc, 0, 0, PW, PH * 0.55, C.bg2);

    /* Linha accent separadora */
    accentLine(doc, 0, PH * 0.55, PW);

    /* ── Logo / Produto ── */
    txt(doc, 'COOLTRACK', M + 6, 38, { size: 36, style: 'bold', color: C.white });

    /* "PRO" em cyan ao lado */
    doc.setFontSize(36); doc.setFont('helvetica', 'bold'); color(doc, C.cyan);
    const cooltrackWidth = doc.getTextWidth('COOLTRACK');
    doc.text('PRO', M + 6 + cooltrackWidth + 3, 38);

    txt(doc, 'Sistema de Gestão de Climatização e Refrigeração', M + 6, 47, {
      size: 9, color: C.text3,
    });

    /* Linha fina sob o nome */
    stroke(doc, C.border); doc.setLineWidth(0.2);
    doc.line(M + 6, 52, PW * 0.55, 52);

    /* Título do relatório */
    txt(doc, 'RELATÓRIO DE MANUTENÇÃO', M + 6, 68, {
      size: 18, style: 'bold', color: C.text,
    });

    /* Período */
    const periodoStr = (de || ate)
      ? `${de ? Utils.formatDate(de) : 'início'} — ${ate ? Utils.formatDate(ate) : 'atual'}`
      : 'Período completo';
    txt(doc, periodoStr, M + 6, 78, { size: 10, color: C.cyan });

    /* Equipamento filtrado */
    const eqLabel = filtEq
      ? (equipamentos.find(e => e.id === filtEq)?.nome || filtEq)
      : 'Todos os equipamentos';
    txt(doc, eqLabel, M + 6, 87, { size: 9, color: C.text2 });

    /* ── Bloco de dados do técnico (card) ── */
    if (profile?.nome) {
      const cardX = M + 6, cardY = 100, cardW = 130, cardH = 38;
      roundRect(doc, cardX, cardY, cardW, cardH, 2, C.surface);
      fillRect(doc, cardX, cardY, 3, cardH, C.cyan);

      txt(doc, 'TÉCNICO RESPONSÁVEL', cardX + 8, cardY + 8, { size: 6.5, color: C.text3, style: 'bold' });
      txt(doc, profile.nome, cardX + 8, cardY + 16, { size: 11, style: 'bold', color: C.text });
      if (profile.empresa) txt(doc, profile.empresa, cardX + 8, cardY + 23, { size: 8, color: C.cyan });
      if (profile.telefone) txt(doc, profile.telefone, cardX + 8, cardY + 30, { size: 8, color: C.text2 });
      if (profile.crea || profile.registro) {
        const reg = profile.crea || profile.registro;
        txt(doc, `Reg: ${reg}`, cardX + cardW - 4, cardY + 30, { size: 7, color: C.text3, align: 'right' });
      }
    }

    /* ── KPI mini tiles na capa ── */
    const counts = { ok: 0, warn: 0, danger: 0 };
    let totalCusto = 0;
    filtered.forEach(r => {
      if (counts[r.status] !== undefined) counts[r.status]++;
      totalCusto += (parseFloat(r.custoPecas || 0) + parseFloat(r.custoMaoObra || 0));
    });

    const tiles = [
      { label: 'Registros',  value: String(filtered.length), c: C.cyan  },
      { label: 'Operando',   value: String(counts.ok),       c: C.green },
      { label: 'Atenção',    value: String(counts.warn),     c: C.amber },
      { label: 'Falha',      value: String(counts.danger),   c: C.red   },
    ];
    const tileW = 28, tileH = 28, tileGap = 4;
    let tx = PW - M - (tiles.length * tileW) - ((tiles.length - 1) * tileGap);
    const ty = PH * 0.55 + 18;

    tiles.forEach(t => {
      roundRect(doc, tx, ty, tileW, tileH, 2, C.surface);
      fillRect(doc, tx, ty, tileW, 2, t.c);
      txt(doc, t.value, tx + tileW / 2, ty + 15, { size: 16, style: 'bold', color: t.c, align: 'center' });
      txt(doc, t.label.toUpperCase(), tx + tileW / 2, ty + 23, { size: 5.5, color: C.text3, align: 'center' });
      tx += tileW + tileGap;
    });

    /* Custo total em destaque */
    if (totalCusto > 0) {
      const custoX = PW - M - (tiles.length * tileW) - ((tiles.length - 1) * tileGap);
      txt(doc, `Custo Total: R$ ${totalCusto.toFixed(2).replace('.', ',')}`, custoX, ty - 6, {
        size: 9, style: 'bold', color: C.cyan,
      });
    }

    /* Data de geração */
    const hoje = new Date().toLocaleDateString('pt-BR', {
      day: '2-digit', month: 'long', year: 'numeric',
    });
    txt(doc, `Gerado em ${hoje}`, M + 6, PH - 12, { size: 7.5, color: C.text3 });
    txt(doc, 'CoolTrack Pro v6.0 — Confidencial', PW - M, PH - 12, { size: 7.5, color: C.text3, align: 'right' });
  },

  /* ── HEADER DE PÁGINA INTERNA ──────────────────────────────────── */
  _drawPageHeader(doc, PW, M, title, profile, pageNum) {
    /* Faixa topo */
    fillRect(doc, 0, 0, PW, 20, C.bg2);
    fillRect(doc, 0, 0, 4, 20, C.cyan);

    txt(doc, 'COOLTRACK PRO', M + 2, 9, { size: 8, style: 'bold', color: C.cyan });
    txt(doc, title, M + 40, 9, { size: 8, style: 'bold', color: C.text });

    const nomeEmpresa = profile?.empresa || profile?.nome || '';
    if (nomeEmpresa) {
      txt(doc, nomeEmpresa, PW - M, 9, { size: 7.5, color: C.text3, align: 'right' });
    }

    accentLine(doc, 0, 20, PW);
  },

  /* ── RESUMO EXECUTIVO ──────────────────────────────────────────── */
  _drawExecutiveSummary(doc, PW, PH, M, filtered, equipamentos) {
    const counts = { ok: 0, warn: 0, danger: 0 };
    let totalCusto = 0, totalPecas = 0, totalMao = 0;

    const eqMap = {};
    filtered.forEach(r => {
      if (counts[r.status] !== undefined) counts[r.status]++;
      const p = parseFloat(r.custoPecas || 0);
      const mo = parseFloat(r.custoMaoObra || 0);
      totalPecas += p; totalMao += mo; totalCusto += p + mo;

      const eq = equipamentos.find(e => e.id === r.equipId);
      const nome = eq?.nome || r.equipId;
      eqMap[nome] = (eqMap[nome] || 0) + 1;
    });

    /* ── KPI tiles ── */
    const tiles = [
      { label: 'Total de Registros',  value: String(filtered.length),                             c: C.cyan  },
      { label: 'Operando Normal',      value: String(counts.ok),                                   c: C.green },
      { label: 'Requer Atenção',       value: String(counts.warn),                                  c: C.amber },
      { label: 'Falha / Crítico',      value: String(counts.danger),                               c: C.red   },
      { label: 'Custo Total',          value: totalCusto > 0 ? `R$${totalCusto.toFixed(0)}` : '—', c: C.text2 },
      { label: 'Peças',               value: totalPecas > 0  ? `R$${totalPecas.toFixed(0)}`  : '—', c: C.text3 },
      { label: 'Mão de Obra',          value: totalMao > 0    ? `R$${totalMao.toFixed(0)}`    : '—', c: C.text3 },
    ];

    const cols  = 7;
    const tileW = (PW - M * 2 - (cols - 1) * 3) / cols;
    const tileH = 26;
    const startY = 28;

    tiles.forEach((t, i) => {
      const x = M + i * (tileW + 3);
      roundRect(doc, x, startY, tileW, tileH, 1.5, C.surface);
      fillRect(doc, x, startY, tileW, 2.5, t.c);
      txt(doc, t.value, x + tileW / 2, startY + 14, { size: 13, style: 'bold', color: t.c, align: 'center' });
      txt(doc, t.label.toUpperCase(), x + tileW / 2, startY + 21, { size: 5.5, color: C.text3, align: 'center' });
    });

    /* ── Gráfico de barras: registros por equipamento ── */
    const eqEntries = Object.entries(eqMap).sort((a, b) => b[1] - a[1]).slice(0, 10);
    if (eqEntries.length > 0) {
      const chartY = startY + tileH + 14;
      txt(doc, 'REGISTROS POR EQUIPAMENTO', M, chartY - 5, { size: 7, style: 'bold', color: C.text3 });
      accentLine(doc, M, chartY - 3, M + 130);

      const maxVal  = Math.max(...eqEntries.map(e => e[1]));
      const barMaxW = 110;
      const barH    = 7;
      const barGap  = 3;

      eqEntries.forEach(([nome, count], idx) => {
        const by   = chartY + idx * (barH + barGap);
        const barW = (count / maxVal) * barMaxW;
        const lbl  = nome.length > 20 ? nome.slice(0, 18) + '…' : nome;

        /* label */
        txt(doc, lbl, M + 38, by + barH - 1.5, { size: 6, color: C.text2, align: 'right' });

        /* trilho */
        roundRect(doc, M + 40, by, barMaxW, barH, 1, C.bg3);

        /* barra preenchida */
        const barColor = idx === 0 ? C.cyan : idx < 3 ? C.cyan2 : C.border;
        roundRect(doc, M + 40, by, Math.max(barW, 2), barH, 1, barColor);

        /* valor */
        txt(doc, String(count), M + 40 + barW + 3, by + barH - 1.5, { size: 6, style: 'bold', color: C.text });
      });

      /* ── Distribuição de status (legenda visual) ── */
      const pieSectionX = M + 165;
      const pieSectionY = chartY - 5;
      txt(doc, 'DISTRIBUIÇÃO DE STATUS', pieSectionX, pieSectionY, { size: 7, style: 'bold', color: C.text3 });
      accentLine(doc, pieSectionX, pieSectionY + 2, pieSectionX + 110);

      const total = filtered.length || 1;
      [
        { label: 'Operando Normal', count: counts.ok,     c: C.green },
        { label: 'Requer Atenção',  count: counts.warn,   c: C.amber },
        { label: 'Falha / Crítico', count: counts.danger, c: C.red   },
      ].forEach((item, i) => {
        const by   = pieSectionY + 10 + i * 16;
        const pct  = Math.round((item.count / total) * 100);
        const barW = (item.count / total) * 100;

        txt(doc, item.label, pieSectionX, by + 5, { size: 7, color: C.text2 });

        roundRect(doc, pieSectionX, by + 7, 100, 5, 1, C.bg3);
        if (barW > 0) roundRect(doc, pieSectionX, by + 7, barW, 5, 1, item.c);

        txt(doc, `${item.count} (${pct}%)`, pieSectionX + 104, by + 11, { size: 6.5, style: 'bold', color: item.c });
      });
    }
  },

  /* ── TABELA DE REGISTROS ───────────────────────────────────────── */
  _drawTable(doc, PW, PH, M, filtered, equipamentos, profile) {
    const rows = filtered.map(r => {
      const eq         = equipamentos.find(e => e.id === r.equipId);
      const stData     = STATUS_PDF[r.status] || STATUS_PDF.ok;
      const custoTotal = parseFloat(r.custoPecas || 0) + parseFloat(r.custoMaoObra || 0);
      return [
        Utils.formatDatetime(r.data),
        eq?.nome?.substring(0, 22) || '—',
        eq?.tag || '—',
        eq?.fluido || '—',
        r.tipo?.substring(0, 24) || '—',
        r.tecnico?.substring(0, 16) || '—',
        stData.label,
        custoTotal > 0 ? `R$${custoTotal.toFixed(2).replace('.', ',')}` : '—',
        r.obs?.substring(0, 80) || '—',
      ];
    });

    autoTable(doc, {
      startY: 28,
      head: [['DATA / HORA', 'EQUIPAMENTO', 'TAG', 'FLUIDO', 'TIPO DE SERVIÇO', 'TÉCNICO', 'STATUS', 'CUSTO', 'DESCRIÇÃO']],
      body: rows,
      theme: 'plain',
      styles: {
        fontSize: 6.8,
        cellPadding: { top: 3.5, right: 4, bottom: 3.5, left: 4 },
        textColor: C.text2,
        font: 'helvetica',
        overflow: 'linebreak',
        lineColor: C.border,
        lineWidth: 0.15,
        fillColor: C.bg2,
      },
      headStyles: {
        fillColor: C.surface,
        textColor: C.text3,
        fontStyle: 'bold',
        fontSize: 6.2,
        halign: 'left',
        lineColor: C.cyan,
        lineWidth: { bottom: 0.5 },
      },
      alternateRowStyles: { fillColor: C.bg3 },
      bodyStyles:         { fillColor: C.bg2 },
      columnStyles: {
        0: { cellWidth: 27, halign: 'center', fontSize: 6.2, textColor: C.text3 },
        1: { cellWidth: 34 },
        2: { cellWidth: 17, fontStyle: 'bold', textColor: C.cyan, fontSize: 6.2, halign: 'center' },
        3: { cellWidth: 16, halign: 'center', fontSize: 6.2 },
        4: { cellWidth: 34 },
        5: { cellWidth: 22, halign: 'center', fontSize: 6.2 },
        6: { cellWidth: 17, halign: 'center', fontStyle: 'bold', fontSize: 6.5 },
        7: { cellWidth: 20, halign: 'right', fontSize: 6.2, textColor: C.cyan },
        8: { cellWidth: 'auto' },
      },
      didParseCell: (data) => {
        if (data.section !== 'body') return;
        if (data.column.index === 6) {
          const v = data.cell.raw;
          data.cell.styles.textColor =
            v === 'FALHA' ? C.red : v === 'ATENÇÃO' ? C.amber : C.green;
        }
      },
      willDrawCell: (data) => {
        /* Garante que o fundo da célula seja sempre escuro */
        if (data.section === 'body') {
          doc.setFillColor(...(data.row.index % 2 === 0 ? C.bg2 : C.bg3));
          doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
        }
        if (data.section === 'head') {
          doc.setFillColor(...C.surface);
          doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
        }
      },
      didDrawPage: (data) => {
        fillPage(doc, PW, doc.internal.pageSize.getHeight());  // re-pinta fundo nas novas páginas
        this._drawPageHeader(doc, PW, M, 'HISTÓRICO DE MANUTENÇÃO', profile, data.pageNumber + 2);
        this._drawFooter(doc, PW, doc.internal.pageSize.getHeight(), M, profile, data.pageNumber + 2);
      },
      margin: { top: 28, right: M, bottom: 20, left: M },
      tableWidth: 'auto',
    });
  },

  /* ── PÁGINAS DE ASSINATURA ─────────────────────────────────────── */
  _drawSignaturePages(doc, PW, PH, M, filtered, equipamentos, profile) {
    const withSig = filtered.filter(r => r.assinatura);
    if (!withSig.length) return;

    withSig.forEach(r => {
      const sigData = getSignatureForRecord(r.id);
      if (!sigData) return;

      doc.addPage();
      fillPage(doc, PW, PH);
      this._drawPageHeader(doc, PW, M, 'COMPROVANTE DE SERVIÇO', profile,
        doc.getCurrentPageInfo().pageNumber);

      const eq = equipamentos.find(e => e.id === r.equipId);

      /* Dados do serviço — coluna esquerda */
      let y = 30;
      const col1 = M, col2 = M + 55;

      txt(doc, 'DETALHES DO SERVIÇO REALIZADO', col1, y, { size: 7, style: 'bold', color: C.text3 });
      accentLine(doc, col1, y + 2, col1 + 140);
      y += 10;

      const campos = [
        ['Equipamento',      eq?.nome || '—'],
        ['TAG',              eq?.tag  || '—'],
        ['Local',            eq?.local || '—'],
        ['Tipo de Serviço',  r.tipo || '—'],
        ['Técnico',          r.tecnico || '—'],
        ['Data / Hora',      Utils.formatDatetime(r.data)],
        ['Status Pós-Serviço', STATUS_PDF[r.status]?.label || r.status],
      ];

      campos.forEach(([label, val]) => {
        txt(doc, label, col1, y, { size: 7, style: 'bold', color: C.text3 });
        txt(doc, val,   col2, y, { size: 7.5, color: C.text });
        y += 8;
      });

      /* Descrição */
      y += 4;
      txt(doc, 'DESCRIÇÃO DO SERVIÇO', col1, y, { size: 7, style: 'bold', color: C.text3 });
      accentLine(doc, col1, y + 2, col1 + 140);
      y += 8;
      const obsLines = doc.splitTextToSize(r.obs || '—', 130);
      txt(doc, obsLines, col1, y, { size: 7.5, color: C.text });

      /* Assinatura — lado direito */
      const sigX = PW / 2 + 10, sigY = 30;
      const sigW  = PW - sigX - M, sigH = 65;

      txt(doc, 'ASSINATURA DO CLIENTE', sigX, sigY, { size: 7, style: 'bold', color: C.text3 });
      accentLine(doc, sigX, sigY + 2, sigX + sigW);

      roundRect(doc, sigX, sigY + 8, sigW, sigH, 2, C.surface);
      fillRect(doc, sigX, sigY + 8, sigW, 2, C.cyan);

      try {
        doc.addImage(sigData, 'PNG', sigX + 4, sigY + 12, sigW - 8, sigH - 14);
      } catch (_) {}

      stroke(doc, C.border); doc.setLineWidth(0.2);
      doc.line(sigX + 4, sigY + 8 + sigH - 5, sigX + sigW - 4, sigY + 8 + sigH - 5);

      txt(doc, 'Assinatura do responsável', sigX + 4, sigY + 8 + sigH + 6,
        { size: 6.5, color: C.text3 });

      const tsStr = Utils.formatDatetime(new Date().toISOString());
      txt(doc, `✓ Assinado digitalmente em ${tsStr}`, sigX + 4, sigY + 8 + sigH + 13,
        { size: 6.5, color: C.green });

      this._drawFooter(doc, PW, PH, M, profile, doc.getCurrentPageInfo().pageNumber);
    });
  },

  /* ── RODAPÉ ────────────────────────────────────────────────────── */
  _drawFooter(doc, PW, PH, M, profile, pageNum) {
    const fy = PH - 12;
    fillRect(doc, 0, fy - 2, PW, 14, C.bg2);
    fillRect(doc, 0, fy - 2, PW, 0.4, C.border);

    const leftTxt = profile?.nome
      ? `CoolTrack Pro v6.0  ·  ${profile.nome}${profile.empresa ? `  /  ${profile.empresa}` : ''}`
      : 'CoolTrack Pro v6.0  ·  Sistema de Gestão de Climatização e Refrigeração';

    txt(doc, leftTxt, M, fy + 4, { size: 6.5, color: C.text3 });
    txt(doc, `Página ${pageNum}`, PW - M, fy + 4, { size: 6.5, color: C.text3, align: 'right' });
  },
};

export default PDFGenerator;