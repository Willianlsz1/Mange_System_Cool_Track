/**
 * PMOC Fase 5.E — Termo de responsabilidade técnica.
 *
 * Página final do PMOC. Contém:
 *   - Declaração formal padrão NBR 13971
 *   - Identificação do RT (nome, CREA/CFT se houver, ART/RRT)
 *   - Linha de assinatura (vazia por padrão; pré-preenchida com nome)
 *   - Data e local
 *
 * Layout institucional: serif para o body legal, ample whitespace.
 */

import { txt, txtBlock, rule, sectionHeader } from '../primitives.js';
import { PMOC_COLORS as PC, PMOC_TYPO as PT, PMOC_DECLARACAO_RT } from '../constants.js';

function brTodayLong() {
  const d = new Date();
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

export function drawPmocTermo(doc, pageWidth, pageHeight, margins, ctx) {
  const { profile } = ctx;
  doc.addPage();

  const left = margins.left;
  const right = pageWidth - margins.right;
  const innerW = right - left;
  let y = margins.top;

  y = sectionHeader(doc, left, y, innerW, 'Termo de responsabilidade técnica');
  y += 4;

  // Declaração formal — texto padrão NBR 13971 em serif (Times)
  y = txtBlock(doc, PMOC_DECLARACAO_RT, left, y, {
    typo: PT.legalBody,
    color: PC.text,
    lineH: 5.6,
  });
  y += 14;

  // ── Identificação do RT ────────────────────────────────────
  txt(doc, 'IDENTIFICAÇÃO DO RESPONSÁVEL TÉCNICO', left, y, {
    typo: PT.sectionLabel,
    color: PC.text2,
  });
  y += 6;

  const labelW = 38;
  const valueX = left + labelW;
  const lineH = 5.4;

  const rows = [
    { label: 'Nome:', value: profile?.responsavel_tecnico || profile?.nome || '—' },
    { label: 'Razão social:', value: profile?.razao_social || '—' },
    { label: 'CNPJ:', value: profile?.cnpj || '—' },
    { label: 'Inscrição estadual:', value: profile?.inscricao_estadual || '—' },
    { label: 'Inscrição municipal:', value: profile?.inscricao_municipal || '—' },
    { label: 'Registro CREA/CFT:', value: profile?.crea_cft || '—' },
    { label: 'ART/RRT nº:', value: profile?.art_rrt || '—' },
    { label: 'Contato:', value: profile?.contato || profile?.email || '—' },
  ];

  for (const { label, value } of rows) {
    txt(doc, label, left, y, { typo: PT.bodyBold, color: PC.text2 });
    txt(doc, value, valueX, y, {
      typo: PT.body,
      color: PC.text,
      maxWidth: innerW - labelW,
    });
    y += lineH;
  }

  y += 16;

  // ── Local e data ───────────────────────────────────────────
  txt(doc, `${profile?.cidade || '__________________'}, ${brTodayLong()}.`, left, y, {
    typo: PT.legalBody,
    color: PC.text,
  });
  y += 22;

  // ── Linha de assinatura ────────────────────────────────────
  const sigLineW = 90;
  const sigX = left + (innerW - sigLineW) / 2;
  rule(doc, sigX, y, sigX + sigLineW, PC.text2, 0.4);
  y += 5;
  txt(
    doc,
    profile?.responsavel_tecnico || profile?.nome || 'Responsável Técnico',
    pageWidth / 2,
    y,
    { typo: PT.bodyBold, color: PC.text, align: 'center' },
  );
  y += 4;
  txt(doc, 'Responsável Técnico', pageWidth / 2, y, {
    typo: PT.meta,
    color: PC.text3,
    align: 'center',
  });
  if (profile?.art_rrt) {
    y += 4;
    txt(doc, `ART/RRT: ${profile.art_rrt}`, pageWidth / 2, y, {
      typo: PT.meta,
      color: PC.text3,
      align: 'center',
    });
  }

  // ── Rodapé legal ───────────────────────────────────────────
  const footY = pageHeight - margins.bottom - 8;
  rule(doc, left, footY - 4, right, PC.border, 0.2);
  txt(
    doc,
    'Este termo integra o documento PMOC e atende aos requisitos da Lei 13.589/2018, ABNT NBR 13971/2014 e Portaria GM/MS 3.523/1998.',
    pageWidth / 2,
    footY,
    {
      typo: PT.micro,
      color: PC.text3,
      align: 'center',
      maxWidth: innerW,
    },
  );
}
