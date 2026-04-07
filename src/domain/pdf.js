/**
 * CoolTrack Pro - PDF Generator v7.0
 * Foco no cliente — linguagem clara, sem jargão técnico
 *
 * Estrutura:
 *   Página 1: Capa executiva (quem fez, resumo em linguagem simples)
 *   Página 2: Histórico de serviços (o que foi feito, em linguagem humana)
 *   Página 3+: Assinaturas (quando houver)
 */

import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { getState } from '../core/state.js';
import { Utils } from '../core/utils.js';
import { Profile } from '../features/profile.js';
import { getSignatureForRecord } from '../ui/components/signature.js';

/* ── Paleta ─────────────────────────────────────────── */
const C = {
  bg: [255, 255, 255],
  bg2: [255, 255, 255],
  bg3: [245, 245, 245],
  surface: [255, 255, 255],
  border: [204, 204, 204],
  primary: [0, 200, 232],
  green: [46, 125, 50],
  amber: [245, 127, 23],
  red: [198, 40, 40],
  text: [0, 0, 0],
  text2: [26, 26, 26],
  text3: [85, 85, 85],
  white: [255, 255, 255],
};

/* Status em linguagem do cliente */
const STATUS_CLIENTE = {
  ok: { label: 'Funcionando normalmente', color: C.green, icon: '✓' },
  warn: { label: 'Requer atenção em breve', color: C.amber, icon: '!' },
  danger: { label: 'Fora de operação', color: C.red, icon: '✗' },
};

/* ── Helpers ─────────────────────────────────────────── */
function fillRect(doc, x, y, w, h, c) {
  doc.setFillColor(...c);
  doc.rect(x, y, w, h, 'F');
}
function fillPage(doc, PW, PH) {
  fillRect(doc, 0, 0, PW, PH, C.bg);
}
function accentLine(doc, x1, y, x2, color = C.primary) {
  doc.setDrawColor(...color);
  doc.setLineWidth(0.35);
  doc.line(x1, y, x2, y);
}
function txt(doc, text, x, y, opts = {}) {
  doc.setFont('helvetica', opts.style || 'normal');
  doc.setFontSize(opts.size || 9);
  if (opts.color) doc.setTextColor(...opts.color);
  doc.text(String(text), x, y, { align: opts.align || 'left', maxWidth: opts.maxWidth });
}
function roundRect(doc, x, y, w, h, r, c) {
  doc.setFillColor(...c);
  doc.setDrawColor(...C.border);
  doc.roundedRect(x, y, w, h, r, r, 'FD');
}
function drawSignaturePageHeader(doc, PW, M) {
  fillRect(doc, 0, 0, PW, 18, C.bg2);
  fillRect(doc, 0, 0, PW, 3, C.primary);
  txt(doc, 'COOLTRACK PRO', M + 2, 8, { size: 7, style: 'bold', color: C.primary });
  txt(doc, 'COMPROVANTE DE SERVIÇO', M + 40, 8, { size: 7, style: 'bold', color: C.text });
  accentLine(doc, 0, 18, PW);
}
function getSignatureImagePayload(sigData) {
  if (!sigData || typeof sigData !== 'string') return null;

  const raw = sigData.trim();
  if (!raw) return null;

  const dataUrlMatch = raw.match(/^data:image\/(png|jpe?g|webp);base64,/i);
  if (dataUrlMatch) {
    const formatRaw = dataUrlMatch[1].toLowerCase();
    const format = formatRaw === 'jpg' ? 'JPEG' : formatRaw.toUpperCase();
    return { data: raw, format };
  }

  if (/^[A-Za-z0-9+/=\s]+$/.test(raw)) {
    return { data: `data:image/png;base64,${raw.replace(/\s+/g, '')}`, format: 'PNG' };
  }

  return null;
}

/* ── Export principal ──────────────────────────────── */
export const PDFGenerator = {
  generateMaintenanceReport(options = {}) {
    try {
      const { registros, equipamentos } = getState();
      const { filtEq = '', de = '', ate = '' } = options;
      const profile = Profile.get();

      let filtered = [...registros].sort((a, b) => b.data.localeCompare(a.data));
      if (filtEq) filtered = filtered.filter((r) => r.equipId === filtEq);
      if (de) filtered = filtered.filter((r) => r.data >= de);
      if (ate) filtered = filtered.filter((r) => r.data <= `${ate}T23:59`);

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const PW = doc.internal.pageSize.getWidth(); // 210mm
      const PH = doc.internal.pageSize.getHeight(); // 297mm
      const M = 18;

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
      const data = new Date().toISOString().slice(0, 10);
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

    /* Faixa fina de identidade da marca */
    fillRect(doc, 0, 0, PW, 3, C.primary);

    /* Cabeçalho */
    fillRect(doc, 0, 0, PW, 52, C.bg2);
    accentLine(doc, M, 52, PW - M, C.border);

    /* Logo */
    txt(doc, 'COOLTRACK', M + 2, 28, { size: 28, style: 'bold', color: C.text });
    doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.primary);
    const cw = doc.getTextWidth('COOLTRACK');
    doc.text('PRO', M + 2 + cw + 3, 28);

    txt(doc, 'Sistema de Gestão de Manutenção', M + 2, 37, { size: 9, color: C.text3 });

    /* Título do documento */
    txt(doc, 'RELATÓRIO DE SERVIÇOS REALIZADOS', M + 2, 48, {
      size: 14,
      style: 'bold',
      color: C.text,
    });

    /* Período */
    const periodo =
      de || ate
        ? `Período: ${de ? Utils.formatDate(de) : 'início'} a ${ate ? Utils.formatDate(ate) : 'atual'}`
        : `Gerado em: ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}`;
    txt(doc, periodo, M + 2, 56, { size: 9, color: C.text3 });

    /* ── Card do técnico responsável ── */
    const cardY = 64,
      cardW = PW - M * 2,
      cardH = 42;
    roundRect(doc, M, cardY, cardW, cardH, 2, C.surface);
    fillRect(doc, M, cardY, 4, cardH, C.primary);

    txt(doc, 'TÉCNICO RESPONSÁVEL', M + 10, cardY + 9, { size: 7, style: 'bold', color: C.text3 });
    txt(doc, profile?.nome || 'Técnico', M + 10, cardY + 19, {
      size: 14,
      style: 'bold',
      color: C.text,
    });
    if (profile?.empresa)
      txt(doc, profile.empresa, M + 10, cardY + 28, { size: 9, color: C.text2 });
    if (profile?.telefone)
      txt(doc, profile.telefone, M + 10, cardY + 36, { size: 9, color: C.text2 });

    /* ── Resumo em linguagem simples ── */
    const resumoY = cardY + cardH + 16;
    txt(doc, 'RESUMO GERAL', M, resumoY, { size: 8, style: 'bold', color: C.text3 });
    accentLine(doc, M, resumoY + 3, PW - M);

    /* Contar status */
    const ok = filtered.filter((r) => r.status === 'ok').length;
    const warn = filtered.filter((r) => r.status === 'warn').length;
    const danger = filtered.filter((r) => r.status === 'danger').length;
    const totalCusto = filtered.reduce(
      (acc, r) => acc + parseFloat(r.custoPecas || 0) + parseFloat(r.custoMaoObra || 0),
      0,
    );

    /* Tiles de resumo — 4 por linha */
    const tiles = [
      { label: 'Serviços', value: String(filtered.length), color: C.text2 },
      { label: 'Operando', value: String(ok), color: C.green },
      { label: 'Atenção', value: String(warn), color: C.amber },
      { label: 'Fora de op.', value: String(danger), color: C.red },
    ];

    const tileW = (PW - M * 2 - 12) / 4;
    const tileY = resumoY + 8;

    tiles.forEach((t, i) => {
      const x = M + i * (tileW + 4);
      roundRect(doc, x, tileY, tileW, 26, 1.5, C.surface);
      fillRect(doc, x, tileY, tileW, 3, t.color);
      txt(doc, t.value, x + tileW / 2, tileY + 15, {
        size: 18,
        style: 'bold',
        color: t.color,
        align: 'center',
      });
      txt(doc, t.label, x + tileW / 2, tileY + 22, { size: 7, color: C.text3, align: 'center' });
    });

    if (totalCusto > 0) {
      txt(
        doc,
        `Custo total dos serviços: R$ ${totalCusto.toFixed(2).replace('.', ',')}`,
        M,
        tileY + 36,
        { size: 9, style: 'bold', color: C.text2 },
      );
    }

    /* ── Situação atual dos equipamentos ── */
    const eqY = tileY + (totalCusto > 0 ? 50 : 42);
    txt(doc, 'SITUAÇÃO ATUAL DOS EQUIPAMENTOS', M, eqY, { size: 8, style: 'bold', color: C.text3 });
    accentLine(doc, M, eqY + 3, PW - M);

    /* Listar equipamentos com status */
    const eqUnicos = [
      ...new Map(
        filtered.map((r) => {
          const eq = equipamentos.find((e) => e.id === r.equipId);
          return [r.equipId, { eq, status: r.status }];
        }),
      ).values(),
    ].filter((e) => e.eq);

    let ey = eqY + 10;
    eqUnicos.forEach(({ eq, status }) => {
      const st = STATUS_CLIENTE[status] || STATUS_CLIENTE.ok;
      roundRect(doc, M, ey, PW - M * 2, 14, 1.5, C.surface);
      // Indicador de cor
      fillRect(doc, M, ey, 4, 14, st.color);
      // Nome do equipamento
      txt(doc, eq.nome, M + 8, ey + 6, { size: 10, style: 'bold', color: C.text });
      txt(doc, eq.local, M + 8, ey + 11, { size: 8, color: C.text3 });
      // Status em linguagem simples
      txt(doc, st.label, PW - M - 4, ey + 9, {
        size: 9,
        style: 'bold',
        color: st.color,
        align: 'right',
      });
      ey += 18;
    });

    /* ── O que precisa ser feito ── */
    const pendentesY = ey + 6;
    const pendentes = filtered.filter((r) => {
      if (r.status === 'danger') return true;
      if (r.proxima && Utils.daysDiff(r.proxima) <= 30) return true;
      return false;
    });

    if (pendentes.length > 0) {
      txt(doc, 'AÇÕES NECESSÁRIAS', M, pendentesY, { size: 8, style: 'bold', color: C.text3 });
      accentLine(doc, M, pendentesY + 3, PW - M, C.amber);

      let py = pendentesY + 10;
      pendentes.forEach((r) => {
        const eq = equipamentos.find((e) => e.id === r.equipId);
        const isUrgent = r.status === 'danger';
        const cor = isUrgent ? C.red : C.amber;
        roundRect(doc, M, py, PW - M * 2, 16, 1.5, C.surface);
        fillRect(doc, M, py, 4, 16, cor);
        const acao = isUrgent
          ? 'Requer intervenção imediata'
          : `Preventiva recomendada${r.proxima ? ` até ${Utils.formatDate(r.proxima)}` : ''}`;
        txt(doc, eq?.nome || '—', M + 8, py + 6, { size: 10, style: 'bold', color: C.text });
        txt(doc, acao, M + 8, py + 12, { size: 8, color: C.text3 });
        py += 20;
      });
    } else if (pendentesY < PH - 40) {
      roundRect(doc, M, pendentesY, PW - M * 2, 16, 1.5, C.surface);
      fillRect(doc, M, pendentesY, 4, 16, C.green);
      txt(doc, 'Nenhuma ação necessária no momento.', M + 8, pendentesY + 7, {
        size: 10,
        style: 'bold',
        color: C.green,
      });
      txt(
        doc,
        'Todos os equipamentos estão dentro do prazo de manutenção.',
        M + 8,
        pendentesY + 13,
        { size: 8, color: C.text2 },
      );
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
    fillRect(doc, 0, 0, PW, 3, C.primary);
    txt(doc, 'COOLTRACK PRO', M + 2, 8, { size: 7, style: 'bold', color: C.primary });
    txt(doc, 'DETALHES DOS SERVIÇOS REALIZADOS', M + 40, 8, {
      size: 7,
      style: 'bold',
      color: C.text,
    });
    if (profile?.empresa) {
      txt(doc, profile.empresa, PW - M, 8, { size: 7, color: C.text3, align: 'right' });
    }
    accentLine(doc, 0, 18, PW);

    let y = 26;
    const pageBottom = PH - 20;

    filtered.forEach((r) => {
      const eq = equipamentos.find((e) => e.id === r.equipId);
      const st = STATUS_CLIENTE[r.status] || STATUS_CLIENTE.ok;
      const custo = parseFloat(r.custoPecas || 0) + parseFloat(r.custoMaoObra || 0);

      /* Calcular altura necessária para este card */
      doc.setFontSize(8);
      const obsLines = doc.splitTextToSize(r.obs || '', PW - M * 2 - 16);
      const obsH = Math.max(obsLines.length, 1) * 4.5;
      const photos = Array.isArray(r.fotos) ? r.fotos.filter(Boolean).slice(0, 4) : [];
      const photoRows = Math.ceil(photos.length / 2);
      const photosH = photos.length ? photoRows * 26 + 10 : 0;
      const cardH = Math.max(34, 28 + obsH + (r.pecas ? 8 : 0) + (custo > 0 ? 8 : 0) + photosH);

      /* Nova página se necessário */
      if (y + cardH > pageBottom) {
        doc.addPage();
        fillPage(doc, PW, PH);
        fillRect(doc, 0, 0, PW, 18, C.bg2);
        fillRect(doc, 0, 0, PW, 3, C.primary);
        txt(doc, 'COOLTRACK PRO', M + 2, 8, { size: 7, style: 'bold', color: C.primary });
        txt(doc, 'DETALHES DOS SERVIÇOS REALIZADOS', M + 40, 8, {
          size: 7,
          style: 'bold',
          color: C.text,
        });
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
      /* Data */
      txt(doc, Utils.formatDatetime(r.data), M + 8, y + 7, { size: 7, color: C.text3 });
      /* Status badge — no topo direito, dentro do card */
      const stLabel = st.label;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...st.color);
      const stW = doc.getTextWidth(stLabel) + 8;
      fillRect(doc, PW - M - stW - 2, y + 2, stW + 2, 8, [
        st.color[0] * 0.15,
        st.color[1] * 0.15,
        st.color[2] * 0.15,
      ]);
      doc.text(stLabel, PW - M - stW / 2 - 1, y + 7.5, { align: 'center' });
      /* Tipo do serviço */
      txt(doc, r.tipo, M + 8, y + 16, { size: 11, style: 'bold', color: C.text });
      /* Equipamento e local */
      txt(doc, (eq?.nome || '—') + (eq?.local ? '  ·  ' + eq.local : ''), M + 8, y + 23, {
        size: 8,
        color: C.text3,
      });
      accentLine(doc, M + 6, y + 26, PW - M - 4, C.border);

      /* O que foi feito — o texto principal para o cliente */
      let cy = y + 32;
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
        txt(doc, `Custo do serviço: R$ ${custo.toFixed(2).replace('.', ',')}`, M + 8, cy, {
          size: 8,
          style: 'bold',
          color: C.text,
        });
        cy += 7;
      }

      if (photos.length) {
        txt(doc, 'Fotos anexadas', M + 8, cy, { size: 8, style: 'bold', color: C.text3 });
        cy += 3;
        const photoW = (PW - M * 2 - 20) / 2;
        const photoH = 22;
        photos.forEach((photo, photoIdx) => {
          const row = Math.floor(photoIdx / 2);
          const col = photoIdx % 2;
          const px = M + 8 + col * (photoW + 4);
          const py = cy + row * (photoH + 4);
          roundRect(doc, px, py, photoW, photoH, 1.5, [250, 250, 250]);
          try {
            doc.addImage(photo, 'JPEG', px + 1, py + 1, photoW - 2, photoH - 2);
          } catch (_imgErr) {
            txt(doc, 'Foto indisponível', px + photoW / 2, py + photoH / 2 + 1, {
              size: 7,
              color: C.text3,
              align: 'center',
            });
          }
        });
      }

      /* Técnico */
      if (r.tecnico) {
        txt(doc, 'Técnico: ' + r.tecnico, PW - M - 4, y + cardH - 5, {
          size: 7,
          color: C.text3,
          align: 'right',
        });
      }

      y += cardH + 6;
    });

    this._drawFooter(doc, PW, PH, M, profile, doc.getCurrentPageInfo().pageNumber);
  },

  /* ────────────────────────────────────────────────────
     ASSINATURAS
  ──────────────────────────────────────────────────── */
  _drawSignaturePages(doc, PW, PH, M, filtered, equipamentos, profile) {
    const signedRecords = filtered.filter((r) => r.assinatura || !!getSignatureForRecord(r.id));
    if (!signedRecords.length) return;

    signedRecords.forEach((r) => {
      const sigData = getSignatureForRecord(r.id);
      const sigPayload = getSignatureImagePayload(sigData);
      const signatureDate = r.data
        ? Utils.formatDatetime(r.data)
        : Utils.formatDatetime(new Date().toISOString());
      const clienteNome = r.clienteNome || r.cliente || 'Cliente';
      const eq = equipamentos.find((e) => e.id === r.equipId);
      const st = STATUS_CLIENTE[r.status] || STATUS_CLIENTE.ok;

      doc.addPage();
      fillPage(doc, PW, PH);
      drawSignaturePageHeader(doc, PW, M);

      let y = 28;
      txt(doc, 'CONFIRMAÇÃO DE SERVIÇO REALIZADO', M, y, {
        size: 11,
        style: 'bold',
        color: C.text,
      });
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
        txt(doc, val, M + 55, y, {
          size: 8.5,
          color: label === 'Situação após o serviço' ? st.color : C.text,
          style: label === 'Situação após o serviço' ? 'bold' : 'normal',
        });
        y += 9;
      });

      y += 4;
      txt(doc, 'Descrição do serviço realizado:', M, y, { size: 7.5, color: C.text3 });
      y += 6;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...C.text2);
      const obsLines = doc.splitTextToSize(r.obs || '—', PW - M * 2);
      doc.text(obsLines, M, y);
      y += obsLines.length * 4.5 + 10;

      /* Assinatura */
      const sigW = PW - M * 2;
      const sigH = 45;
      const sigMetaH = 16;
      const sigBlockTotal = 8 + 14 + sigH + sigMetaH + 12;
      if (y + sigBlockTotal > PH - 18) {
        doc.addPage();
        fillPage(doc, PW, PH);
        drawSignaturePageHeader(doc, PW, M);
        y = 28;
      }

      accentLine(doc, M, y, PW - M, C.border);
      y += 8;
      txt(doc, 'ASSINATURA DO CLIENTE', M, y, { size: 7.5, style: 'bold', color: C.text3 });
      txt(doc, 'Confirmo que o serviço acima foi realizado conforme descrito.', M, y + 6, {
        size: 7.5,
        color: C.text3,
      });
      y += 14;

      fillRect(doc, M, y, sigW, sigH, [243, 248, 252]);
      fillRect(doc, M, y, sigW, 1.5, C.border);

      if (sigPayload) {
        try {
          const imageX = M + 4;
          const imageY = y + 5;
          const imageW = sigW - 8;
          const imageH = sigH - 12;
          doc.addImage(sigPayload.data, sigPayload.format, imageX, imageY, imageW, imageH);
        } catch (err) {
          console.error(
            `[PDF assinatura] Falha ao renderizar assinatura do registro ${r.id}`,
            err,
            {
              format: sigPayload.format,
              hasData: !!sigPayload.data,
            },
          );
          txt(doc, 'Assinatura não coletada', M + sigW / 2, y + sigH / 2, {
            size: 10,
            style: 'bold',
            color: C.red,
            align: 'center',
          });
        }
      } else {
        if (r.assinatura) {
          console.error(`[PDF assinatura] Assinatura ausente/corrompida para registro ${r.id}`);
        }
        txt(doc, 'Assinatura não coletada', M + sigW / 2, y + sigH / 2, {
          size: 10,
          style: 'bold',
          color: C.red,
          align: 'center',
        });
      }

      accentLine(doc, M + 8, y + sigH - 5, M + sigW - 8);
      txt(doc, 'Assinatura', M + sigW / 2, y + sigH + 4, {
        size: 7,
        color: C.text3,
        align: 'center',
      });

      y += sigH + 10;
      txt(doc, `Nome do cliente: ${clienteNome}`, M, y, { size: 8, style: 'bold', color: C.text });
      txt(doc, `Data/Hora da assinatura: ${signatureDate}`, M, y + 6, {
        size: 7.5,
        color: C.text2,
      });

      this._drawFooter(doc, PW, PH, M, profile, doc.getCurrentPageInfo().pageNumber);
    });
  },

  /* ── Rodapé ──────────────────────────────────────── */
  _drawFooter(doc, PW, PH, M, profile, pageNum) {
    const fy = PH - 12;
    fillRect(doc, 0, fy - 2, PW, 14, C.white);
    fillRect(doc, 0, fy - 2, PW, 0.4, C.border);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...C.text3);
    doc.text('Gerado pelo CoolTrack Pro', M, fy + 4);
    doc.text(`Relatório #${pageNum}`, PW - M, fy + 4, { align: 'right' });
  },
};

export default PDFGenerator;
