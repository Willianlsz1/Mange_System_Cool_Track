/**
 * CoolTrack Pro - PDF Generator v7.0
 * Foco no cliente — linguagem clara, sem jargão técnico
 *
 * Estrutura:
 *   Página 1: Capa executiva (quem fez, resumo em linguagem simples)
 *   Página 2: Histórico de serviços (o que foi feito, em linguagem humana)
 *   Página 3+: Assinaturas (quando houver)
 */

import { jsPDF }    from 'jspdf';
import autoTable    from 'jspdf-autotable';
import { getState } from './state.js';
import { Utils }    from './utils.js';
import { Profile }  from './onboarding.js';
import { getSignatureForRecord } from './signature.js';

/* ── Paleta ─────────────────────────────────────────── */
const C = {
  bg:      [7,   17,  31],
  bg2:     [12,  25,  41],
  bg3:     [18,  34,  56],
  surface: [23,  38,  62],
  border:  [35,  60,  95],
  cyan:    [0,   200, 232],
  green:   [0,   195, 110],
  amber:   [232, 160, 32],
  red:     [220, 48,  64],
  text:    [232, 242, 250],
  text2:   [138, 170, 200],
  text3:   [90,  125, 158],
  white:   [255, 255, 255],
};

/* Status em linguagem do cliente */
const STATUS_CLIENTE = {
  ok:     { label: 'Funcionando normalmente', color: C.green, icon: '✓' },
  warn:   { label: 'Requer atenção em breve',  color: C.amber, icon: '!' },
  danger: { label: 'Fora de operação',          color: C.red,   icon: '✗' },
};

/* ── Helpers ─────────────────────────────────────────── */
function fillRect(doc, x, y, w, h, c) {
  doc.setFillColor(...c); doc.rect(x, y, w, h, 'F');
}
function fillPage(doc, PW, PH) { fillRect(doc, 0, 0, PW, PH, C.bg); }
function accentLine(doc, x1, y, x2, color = C.cyan) {
  doc.setDrawColor(...color); doc.setLineWidth(0.35); doc.line(x1, y, x2, y);
}
function txt(doc, text, x, y, opts = {}) {
  doc.setFont('helvetica', opts.style || 'normal');
  doc.setFontSize(opts.size || 9);
  if (opts.color) doc.setTextColor(...opts.color);
  doc.text(String(text), x, y, { align: opts.align || 'left', maxWidth: opts.maxWidth });
}
function roundRect(doc, x, y, w, h, r, c) {
  doc.setFillColor(...c); doc.roundedRect(x, y, w, h, r, r, 'F');
}

/* ── Export principal ──────────────────────────────── */
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

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const PW  = doc.internal.pageSize.getWidth();   // 210mm
      const PH  = doc.internal.pageSize.getHeight();  // 297mm
      const M   = 18;

      /* ① Capa */
      this._drawCover(doc, PW, PH, M, profile, filtEq, de, ate, filtered, equipamentos);

      /* ② Serviços realizados */
      if (filtered.length > 0) {
        doc.addPage();
        fillPage(doc, PW, PH);
        this._drawServicos(doc, PW, PH, M, filtered, equipamentos, profile);
        this._drawSignaturePages(doc, PW, PH, M, filtered, equipamentos, profile);
      }

      const empresa = (profile?.empresa || 'Relatorio').replace(/\s+/g, '_');
      const data    = new Date().toISOString().slice(0, 10);
      const fileName = `CoolTrack_${empresa}_${data}.pdf`;
      doc.save(fileName);
      return fileName;
    } catch (err) {
      console.error('[PDF v7]', err);
      return null;
    }
  },

  /* ────────────────────────────────────────────────────
     CAPA — linguagem do cliente, não do técnico
  ──────────────────────────────────────────────────── */
  _drawCover(doc, PW, PH, M, profile, filtEq, de, ate, filtered, equipamentos) {
    fillPage(doc, PW, PH);

    /* Faixa lateral cyan */
    fillRect(doc, 0, 0, 5, PH, C.cyan);

    /* Cabeçalho escuro */
    fillRect(doc, 0, 0, PW, 70, C.bg2);
    accentLine(doc, 0, 70, PW);

    /* Logo */
    txt(doc, 'COOLTRACK', M + 2, 28, { size: 28, style: 'bold', color: C.text });
    doc.setFontSize(28); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.cyan);
    const cw = doc.getTextWidth('COOLTRACK');
    doc.text('PRO', M + 2 + cw + 3, 28);

    txt(doc, 'Sistema de Gestão de Manutenção', M + 2, 37, { size: 9, color: C.text3 });

    /* Título do documento */
    txt(doc, 'RELATÓRIO DE SERVIÇOS REALIZADOS', M + 2, 54, { size: 14, style: 'bold', color: C.text });

    /* Período */
    const periodo = (de || ate)
      ? `Período: ${de ? Utils.formatDate(de) : 'início'} a ${ate ? Utils.formatDate(ate) : 'atual'}`
      : `Gerado em: ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}`;
    txt(doc, periodo, M + 2, 63, { size: 9, color: C.cyan });

    /* ── Card do técnico responsável ── */
    const cardY = 82, cardW = PW - M * 2, cardH = 42;
    fillRect(doc, M, cardY, cardW, cardH, C.bg2);
    fillRect(doc, M, cardY, 4, cardH, C.cyan);

    txt(doc, 'TÉCNICO RESPONSÁVEL', M + 10, cardY + 9, { size: 7, style: 'bold', color: C.text3 });
    txt(doc, profile?.nome || 'Técnico', M + 10, cardY + 19, { size: 14, style: 'bold', color: C.text });
    if (profile?.empresa)  txt(doc, profile.empresa,  M + 10, cardY + 28, { size: 9, color: C.cyan });
    if (profile?.telefone) txt(doc, profile.telefone, M + 10, cardY + 36, { size: 9, color: C.text2 });

    /* ── Resumo em linguagem simples ── */
    const resumoY = cardY + cardH + 16;
    txt(doc, 'RESUMO GERAL', M, resumoY, { size: 8, style: 'bold', color: C.text3 });
    accentLine(doc, M, resumoY + 3, PW - M);

    /* Contar status */
    const ok     = filtered.filter(r => r.status === 'ok').length;
    const warn   = filtered.filter(r => r.status === 'warn').length;
    const danger = filtered.filter(r => r.status === 'danger').length;
    const totalCusto = filtered.reduce((acc, r) =>
      acc + parseFloat(r.custoPecas || 0) + parseFloat(r.custoMaoObra || 0), 0);

    /* Tiles de resumo — 4 por linha */
    const tiles = [
      { label: 'Serviços\nrealizados',    value: String(filtered.length), color: C.cyan },
      { label: 'Equipamentos\noperando',  value: String(ok),              color: C.green },
      { label: 'Precisam de\natenção',    value: String(warn),            color: C.amber },
      { label: 'Fora de\noperação',       value: String(danger),          color: C.red },
    ];

    const tileW = (PW - M * 2 - 12) / 4;
    const tileY = resumoY + 8;

    tiles.forEach((t, i) => {
      const x = M + i * (tileW + 4);
      if (tileW >= 4 && 28 >= 4) roundRect(doc, x, tileY, tileW, 28, 2, C.surface);
      else fillRect(doc, x, tileY, tileW, 28, C.surface);
      fillRect(doc, x, tileY, tileW, 3, t.color);
      txt(doc, t.value, x + tileW / 2, tileY + 14, { size: 18, style: 'bold', color: t.color, align: 'center' });
      // Label em 2 linhas
      const lines = t.label.split('\n');
      lines.forEach((l, li) => {
        txt(doc, l, x + tileW / 2, tileY + 21 + li * 5, { size: 6, color: C.text3, align: 'center' });
      });
    });

    if (totalCusto > 0) {
      txt(doc, `Custo total dos serviços: R$ ${totalCusto.toFixed(2).replace('.', ',')}`,
        M, tileY + 36, { size: 9, style: 'bold', color: C.cyan });
    }

    /* ── Situação atual dos equipamentos ── */
    const eqY = tileY + (totalCusto > 0 ? 50 : 42);
    txt(doc, 'SITUAÇÃO ATUAL DOS EQUIPAMENTOS', M, eqY, { size: 8, style: 'bold', color: C.text3 });
    accentLine(doc, M, eqY + 3, PW - M);

    /* Listar equipamentos com status */
    const eqUnicos = [...new Map(filtered.map(r => {
      const eq = equipamentos.find(e => e.id === r.equipId);
      return [r.equipId, { eq, status: r.status }];
    })).values()].filter(e => e.eq);

    let ey = eqY + 10;
    eqUnicos.forEach(({ eq, status }) => {
      const st = STATUS_CLIENTE[status] || STATUS_CLIENTE.ok;
      fillRect(doc, M, ey, PW - M * 2, 14, C.bg2);
      // Indicador de cor
      fillRect(doc, M, ey, 4, 14, st.color);
      // Nome do equipamento
      txt(doc, eq.nome, M + 8, ey + 6, { size: 10, style: 'bold', color: C.text });
      txt(doc, eq.local, M + 8, ey + 11, { size: 8, color: C.text3 });
      // Status em linguagem simples
      txt(doc, st.label, PW - M - 4, ey + 9, { size: 9, style: 'bold', color: st.color, align: 'right' });
      ey += 18;
    });

    /* ── O que precisa ser feito ── */
    const pendentesY = ey + 6;
    const pendentes = filtered.filter(r => {
      if (r.status === 'danger') return true;
      if (r.proxima && Utils.daysDiff(r.proxima) <= 30) return true;
      return false;
    });

    if (pendentes.length > 0) {
      txt(doc, 'AÇÕES NECESSÁRIAS', M, pendentesY, { size: 8, style: 'bold', color: C.text3 });
      accentLine(doc, M, pendentesY + 3, PW - M, C.amber);

      let py = pendentesY + 10;
      pendentes.forEach(r => {
        const eq = equipamentos.find(e => e.id === r.equipId);
        const isUrgent = r.status === 'danger';
        const cor = isUrgent ? C.red : C.amber;
        fillRect(doc, M, py, PW - M * 2, 16, isUrgent ? [30, 12, 14] : [28, 22, 8]);
        fillRect(doc, M, py, 4, 16, cor);
        const acao = isUrgent
          ? 'Requer intervenção imediata'
          : `Preventiva recomendada${r.proxima ? ` até ${Utils.formatDate(r.proxima)}` : ''}`;
        txt(doc, eq?.nome || '—', M + 8, py + 6, { size: 10, style: 'bold', color: C.text });
        txt(doc, acao, M + 8, py + 12, { size: 8, color: cor });
        py += 20;
      });
    } else if (pendentesY < PH - 40) {
      fillRect(doc, M, pendentesY, PW - M * 2, 16, C.surface);
      fillRect(doc, M, pendentesY, 4, 16, C.green);
      txt(doc, 'Nenhuma ação necessária no momento.', M + 8, pendentesY + 7, { size: 10, style: 'bold', color: C.green });
      txt(doc, 'Todos os equipamentos estão dentro do prazo de manutenção.', M + 8, pendentesY + 13, { size: 8, color: C.text2 });
    }

    /* Rodapé */
    this._drawFooter(doc, PW, PH, M, profile, 1);
  },

  /* ────────────────────────────────────────────────────
     SERVIÇOS — o que foi feito, em linguagem humana
  ──────────────────────────────────────────────────── */
  _drawServicos(doc, PW, PH, M, filtered, equipamentos, profile) {
    /* Cabeçalho da página */
    fillRect(doc, 0, 0, PW, 18, C.bg2);
    fillRect(doc, 0, 0, 4, 18, C.cyan);
    txt(doc, 'COOLTRACK PRO', M + 2, 8, { size: 7, style: 'bold', color: C.cyan });
    txt(doc, 'DETALHES DOS SERVIÇOS REALIZADOS', M + 40, 8, { size: 7, style: 'bold', color: C.text });
    if (profile?.empresa) {
      txt(doc, profile.empresa, PW - M, 8, { size: 7, color: C.text3, align: 'right' });
    }
    accentLine(doc, 0, 18, PW);

    let y = 26;
    const pageBottom = PH - 20;

    filtered.forEach((r, idx) => {
      const eq  = equipamentos.find(e => e.id === r.equipId);
      const st  = STATUS_CLIENTE[r.status] || STATUS_CLIENTE.ok;
      const custo = parseFloat(r.custoPecas || 0) + parseFloat(r.custoMaoObra || 0);

      /* Calcular altura necessária para este card */
      doc.setFontSize(8);
      const obsLines = doc.splitTextToSize(r.obs || '', PW - M * 2 - 16);
      const obsH  = Math.max(obsLines.length, 1) * 4.5;
      const cardH = Math.max(34, 28 + obsH + (r.pecas ? 8 : 0) + (custo > 0 ? 8 : 0));

      /* Nova página se necessário */
      if (y + cardH > pageBottom) {
        doc.addPage();
        fillPage(doc, PW, PH);
        fillRect(doc, 0, 0, PW, 18, C.bg2);
        fillRect(doc, 0, 0, 4, 18, C.cyan);
        txt(doc, 'COOLTRACK PRO', M + 2, 8, { size: 7, style: 'bold', color: C.cyan });
        txt(doc, 'DETALHES DOS SERVIÇOS REALIZADOS', M + 40, 8, { size: 7, style: 'bold', color: C.text });
        accentLine(doc, 0, 18, PW);
        y = 26;
        this._drawFooter(doc, PW, PH, M, profile, doc.getCurrentPageInfo().pageNumber);
      }

      /* Card do serviço */
      const cw2 = PW - M * 2;
      if (cardH >= 4) {
        roundRect(doc, M, y, cw2, cardH, 2, C.bg2);
      } else {
        fillRect(doc, M, y, cw2, cardH, C.bg2);
      }
      fillRect(doc, M, y, 4, cardH, st.color);

      /* Cabeçalho do card */
      txt(doc, Utils.formatDatetime(r.data), M + 8, y + 7, { size: 7, color: C.text3 });
      txt(doc, r.tipo, M + 8, y + 13, { size: 11, style: 'bold', color: C.text });
      /* Status no canto direito */
      txt(doc, st.icon + ' ' + st.label, PW - M - 4, y + 10, { size: 8, style: 'bold', color: st.color, align: 'right' });

      /* Equipamento e local */
      txt(doc, (eq?.nome || '—') + (eq?.local ? '  ·  ' + eq.local : ''),
        M + 8, y + 20, { size: 8, color: C.cyan });

      accentLine(doc, M + 6, y + 23, PW - M - 4, C.border);

      /* O que foi feito — o texto principal para o cliente */
      let cy = y + 29;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...C.text2);
      const obsText = doc.splitTextToSize(r.obs || '—', PW - M * 2 - 16);
      doc.text(obsText, M + 8, cy);
      cy += obsText.length * 4.5 + 3;

      /* Peças — simplificado */
      if (r.pecas) {
        txt(doc, 'Materiais utilizados: ' + r.pecas, M + 8, cy, { size: 7.5, color: C.text3 });
        cy += 7;
      }

      /* Custo — visível para o cliente */
      if (custo > 0) {
        txt(doc, `Custo do serviço: R$ ${custo.toFixed(2).replace('.', ',')}`,
          M + 8, cy, { size: 8, style: 'bold', color: C.text });
        cy += 7;
      }

      /* Técnico */
      if (r.tecnico) {
        txt(doc, 'Técnico: ' + r.tecnico, PW - M - 4, y + cardH - 5, { size: 7, color: C.text3, align: 'right' });
      }

      y += cardH + 6;
    });

    this._drawFooter(doc, PW, PH, M, profile, doc.getCurrentPageInfo().pageNumber);
  },

  /* ────────────────────────────────────────────────────
     ASSINATURAS
  ──────────────────────────────────────────────────── */
  _drawSignaturePages(doc, PW, PH, M, filtered, equipamentos, profile) {
    const withSig = filtered.filter(r => r.assinatura && getSignatureForRecord(r.id));
    if (!withSig.length) return;

    withSig.forEach(r => {
      const sigData = getSignatureForRecord(r.id);
      const eq = equipamentos.find(e => e.id === r.equipId);
      const st = STATUS_CLIENTE[r.status] || STATUS_CLIENTE.ok;

      doc.addPage();
      fillPage(doc, PW, PH);
      fillRect(doc, 0, 0, PW, 18, C.bg2);
      fillRect(doc, 0, 0, 4, 18, C.cyan);
      txt(doc, 'COOLTRACK PRO', M + 2, 8, { size: 7, style: 'bold', color: C.cyan });
      txt(doc, 'COMPROVANTE DE SERVIÇO', M + 40, 8, { size: 7, style: 'bold', color: C.text });
      accentLine(doc, 0, 18, PW);

      let y = 28;
      txt(doc, 'CONFIRMAÇÃO DE SERVIÇO REALIZADO', M, y, { size: 11, style: 'bold', color: C.text });
      y += 10;

      const campos = [
        ['Equipamento', eq?.nome || '—'],
        ['Localização', eq?.local || '—'],
        ['Tipo de serviço', r.tipo],
        ['Data / Hora', Utils.formatDatetime(r.data)],
        ['Técnico responsável', r.tecnico || profile?.nome || '—'],
        ['Situação após o serviço', st.label],
      ];

      campos.forEach(([label, val]) => {
        txt(doc, label, M, y, { size: 7.5, color: C.text3 });
        txt(doc, val, M + 55, y, { size: 8.5, color: label === 'Situação após o serviço' ? st.color : C.text, style: label === 'Situação após o serviço' ? 'bold' : 'normal' });
        y += 9;
      });

      y += 4;
      txt(doc, 'Descrição do serviço realizado:', M, y, { size: 7.5, color: C.text3 });
      y += 6;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...C.text2);
      const obsLines = doc.splitTextToSize(r.obs || '—', PW - M * 2);
      doc.text(obsLines, M, y);
      y += obsLines.length * 4.5 + 10;

      /* Assinatura */
      accentLine(doc, M, y, PW - M, C.border);
      y += 8;
      txt(doc, 'ASSINATURA DO CLIENTE', M, y, { size: 7.5, style: 'bold', color: C.text3 });
      txt(doc, 'Confirmo que o serviço acima foi realizado conforme descrito.', M, y + 6, { size: 7.5, color: C.text3 });
      y += 14;

      const sigW = PW - M * 2, sigH = 45;
      fillRect(doc, M, y, sigW, sigH, C.surface);
      fillRect(doc, M, y, sigW, 3, C.cyan);
      try { doc.addImage(sigData, 'PNG', M + 4, y + 5, sigW - 8, sigH - 10); } catch (_) {}
      accentLine(doc, M + 8, y + sigH - 5, M + sigW - 8);
      txt(doc, 'Assinatura', M + sigW / 2, y + sigH + 4, { size: 7, color: C.text3, align: 'center' });

      y += sigH + 12;
      txt(doc, `Assinado digitalmente em ${Utils.formatDatetime(new Date().toISOString())}`,
        M, y, { size: 7, color: C.green });

      this._drawFooter(doc, PW, PH, M, profile, doc.getCurrentPageInfo().pageNumber);
    });
  },

  /* ── Rodapé ──────────────────────────────────────── */
  _drawFooter(doc, PW, PH, M, profile, pageNum) {
    const fy = PH - 12;
    fillRect(doc, 0, fy - 2, PW, 14, C.bg2);
    fillRect(doc, 0, fy - 2, PW, 0.4, C.border);
    const left = profile?.nome
      ? `${profile.nome}${profile.empresa ? '  ·  ' + profile.empresa : ''}${profile.telefone ? '  ·  ' + profile.telefone : ''}`
      : 'CoolTrack Pro — Sistema de Gestão de Manutenção';
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...C.text3);
    doc.text(left, M, fy + 4);
    doc.text(`Pág. ${pageNum}`, PW - M, fy + 4, { align: 'right' });
  },
};

export default PDFGenerator;