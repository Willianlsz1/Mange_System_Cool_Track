/**
 * PMOC Fase 5.C — Cadastro técnico dos equipamentos.
 *
 * Tabela formal NBR 13971 (anexo A): TAG, descrição (nome+tipo), fluido,
 * capacidade (BTU/h se disponível em dadosPlaca), local, periodicidade
 * preventiva (dias). Ordenada por TAG.
 */

import autoTable from 'jspdf-autotable';
import { sectionHeader } from '../primitives.js';
import { PMOC_COLORS as PC, PMOC_TYPO as PT } from '../constants.js';

function pickCapacidade(dadosPlaca) {
  if (!dadosPlaca || typeof dadosPlaca !== 'object') return '';
  // Tenta chaves comuns; aceita BTU/h, kcal/h, TR. Pega a primeira que existir.
  const keys = ['capacidade', 'capacidade_btuh', 'capacidade_btu', 'btu', 'btuh'];
  for (const k of keys) {
    if (dadosPlaca[k]) return String(dadosPlaca[k]);
  }
  return '';
}

function periodicidadeLabel(dias) {
  if (!dias || !Number.isFinite(Number(dias))) return '—';
  const n = Number(dias);
  if (n <= 7) return 'Semanal';
  if (n <= 31) return 'Mensal';
  if (n <= 95) return 'Trimestral';
  if (n <= 185) return 'Semestral';
  if (n <= 370) return 'Anual';
  return `${n} dias`;
}

export function drawPmocRegistry(doc, pageWidth, pageHeight, margins, ctx) {
  const { equipamentos = [], cliente } = ctx;
  // Filtra equipamentos do cliente (se cliente foi escolhido); senão pega
  // todos. Também ordena por TAG/nome.
  const filtered = (
    cliente ? equipamentos.filter((e) => e.clienteId === cliente.id) : equipamentos.slice()
  ).sort((a, b) => {
    const ta = String(a.tag || a.nome || '').toLowerCase();
    const tb = String(b.tag || b.nome || '').toLowerCase();
    return ta.localeCompare(tb, 'pt-BR');
  });

  doc.addPage();
  const left = margins.left;
  const right = pageWidth - margins.right;
  const innerW = right - left;
  let y = margins.top;

  y = sectionHeader(doc, left, y, innerW, 'Cadastro técnico dos equipamentos');

  if (!filtered.length) {
    autoTable(doc, {
      startY: y,
      body: [['Nenhum equipamento cadastrado para este cliente.']],
      theme: 'plain',
      margin: { left, right: margins.right },
      styles: {
        font: PT.body.font,
        fontSize: PT.body.size,
        textColor: PC.text3,
        fontStyle: 'italic',
      },
    });
    return;
  }

  const head = [['TAG', 'Equipamento / Tipo', 'Fluido', 'Capacidade', 'Local', 'Periodicidade']];
  const body = filtered.map((eq) => [
    eq.tag || '—',
    `${eq.nome || '—'}\n${eq.tipo || ''}`.trim(),
    eq.fluido || '—',
    pickCapacidade(eq.dadosPlaca) || '—',
    eq.local || '—',
    periodicidadeLabel(eq.periodicidadePreventivaDias),
  ]);

  autoTable(doc, {
    startY: y,
    head,
    body,
    margin: { left, right: margins.right },
    theme: 'grid',
    styles: {
      font: PT.body.font,
      fontSize: PT.meta.size,
      cellPadding: 1.8,
      textColor: PC.text,
      lineColor: PC.border,
      lineWidth: 0.15,
      valign: 'top',
    },
    headStyles: {
      fillColor: PC.bg3,
      textColor: PC.text,
      fontStyle: 'bold',
      fontSize: PT.metaBold.size,
      halign: 'left',
    },
    columnStyles: {
      0: { cellWidth: 22, fontStyle: 'bold' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 22 },
      3: { cellWidth: 28 },
      4: { cellWidth: 38 },
      5: { cellWidth: 26 },
    },
  });
}
