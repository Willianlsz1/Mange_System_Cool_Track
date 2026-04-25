/**
 * CoolTrack Pro - PDF Checklist Section (PMOC Fase 3, abr/2026)
 *
 * Renderiza o checklist NBR 13971 dos registros filtrados no PDF.
 * Aparece quando ao menos UM registro do filtro tem `checklist`
 * preenchido. Cada checklist vira um bloco identificado por
 * "{equipamento} — {data do registro}" com tabela de itens.
 *
 * Layout:
 *   CHECKLIST NBR 13971
 *   ─────────────────────────
 *   {Equip A} · 25/04/2026
 *     Mecânico
 *       Limpeza dos filtros        ✓ Conforme         (obs)
 *       Bandeja de condensado      ✗ Não conforme     bandeja com sujidade
 *     Elétrico
 *       ...
 *   {Equip B} · 25/04/2026
 *     ...
 */

import autoTable from 'jspdf-autotable';
import { Utils } from '../../../core/utils.js';
import { PDF_COLORS as C, PDF_TYPO as T } from '../constants.js';
import { accentLine, txt } from '../primitives.js';
import { getTemplateByKey, formatMeasure } from '../../pmoc/checklistTemplates.js';

const STATUS_LABEL = {
  ok: 'Conforme',
  fail: 'Não conforme',
  na: 'N/A',
};

const STATUS_COLOR = (status) => {
  if (status === 'ok') return [34, 167, 100];
  if (status === 'fail') return [215, 43, 63];
  if (status === 'na') return [120, 130, 145];
  return C.text3;
};

function formatRegistroDate(data) {
  if (!data) return '';
  try {
    return Utils.formatDate(data);
  } catch {
    return String(data);
  }
}

function findEquipName(equipId, equipamentos) {
  const eq = (equipamentos || []).find((e) => e.id === equipId);
  return eq?.nome || eq?.tag || '—';
}

/**
 * Desenha a seção de checklist no PDF. Pula silenciosamente quando
 * nenhum registro tem checklist (PDFs de FREE / serviços não-PMOC).
 *
 * @returns {number} novo Y após a seção
 */
export function drawChecklist(doc, pageWidth, pageHeight, margin, startY, filtered, equipamentos) {
  const registrosWithChecklist = (filtered || []).filter(
    (r) => r.checklist && typeof r.checklist === 'object' && Array.isArray(r.checklist.items),
  );
  if (!registrosWithChecklist.length) return startY;

  let y = startY + 6;
  const ensureSpace = (needed) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  // Cabeçalho da seção
  ensureSpace(20);
  txt(doc, 'CHECKLIST NBR 13971', margin, y, {
    size: T.h2.size,
    style: T.h2.style,
    color: C.text3,
  });
  y += 2;
  accentLine(doc, margin, y + 1, pageWidth - margin, C.border);
  y += 5;

  for (const registro of registrosWithChecklist) {
    const tpl = getTemplateByKey(registro.checklist.tipo_template);
    const equipName = findEquipName(registro.equipId, equipamentos);
    const dateStr = formatRegistroDate(registro.data);

    // Bloco header
    ensureSpace(12);
    txt(doc, `${equipName} · ${dateStr}`, margin, y, {
      size: T.h3?.size ?? 9,
      style: T.h3?.style ?? 'bold',
      color: C.text2,
    });
    y += 4;

    // Agrupa items preservando ordem do template (puxa label/group do template
    // ao invés do snapshot, garantindo estabilidade visual).
    const groupsOrder = [];
    const groupBuckets = new Map();
    tpl.items.forEach((tplItem) => {
      const filled = (registro.checklist.items || []).find((i) => i.id === tplItem.id);
      // Inclui só items com status definido; pendentes não vão pro PDF
      // (ruído desnecessário pra cliente final).
      if (!filled || filled.status == null) return;
      if (!groupBuckets.has(tplItem.group)) {
        groupsOrder.push(tplItem.group);
        groupBuckets.set(tplItem.group, []);
      }
      groupBuckets.get(tplItem.group).push({ ...filled, label: tplItem.label });
    });

    if (!groupsOrder.length) {
      txt(doc, '(nenhum item marcado)', margin + 4, y, {
        size: 8,
        style: 'italic',
        color: C.text3,
      });
      y += 5;
      continue;
    }

    // Resumo conforme/não-conforme/N-A pro bloco
    const summary = (registro.checklist.items || []).reduce(
      (acc, i) => {
        if (i.status === 'ok') acc.ok += 1;
        else if (i.status === 'fail') acc.fail += 1;
        else if (i.status === 'na') acc.na += 1;
        return acc;
      },
      { ok: 0, fail: 0, na: 0 },
    );
    txt(
      doc,
      `${summary.ok} conforme · ${summary.fail} não conforme · ${summary.na} N/A`,
      margin + 4,
      y,
      { size: 8, style: 'italic', color: C.text3 },
    );
    y += 4;

    // Renderiza grupos como sub-tabelas
    for (const groupName of groupsOrder) {
      const items = groupBuckets.get(groupName);
      ensureSpace(8 + items.length * 5);

      txt(doc, groupName, margin + 2, y, {
        size: 8,
        style: 'bold',
        color: C.text3,
      });
      y += 3;

      autoTable(doc, {
        startY: y,
        body: items.map((it) => [
          it.label,
          STATUS_LABEL[it.status] || '—',
          // PMOC Fase 4: coluna Medição (vazia quando item não-measurable
          // ou measure não preenchido).
          formatMeasure(it.measure),
          it.obs || '',
        ]),
        theme: 'plain',
        margin: { left: margin + 2, right: margin },
        styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.2, valign: 'top' },
        columnStyles: {
          0: { cellWidth: 70, textColor: C.text1 },
          1: { cellWidth: 24, fontStyle: 'bold' },
          2: { cellWidth: 22, textColor: C.text1, halign: 'right', fontStyle: 'bold' },
          3: { cellWidth: 'auto', textColor: C.text2 },
        },
        // Aplica cor do status na coluna 1
        didParseCell: (data) => {
          if (data.section !== 'body' || data.column.index !== 1) return;
          const itemRow = items[data.row.index];
          if (itemRow) {
            data.cell.styles.textColor = STATUS_COLOR(itemRow.status);
          }
        },
      });
      y = (doc.lastAutoTable?.finalY ?? y) + 2;
    }

    y += 3; // respiro entre registros
  }

  return y;
}
