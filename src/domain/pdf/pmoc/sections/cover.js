/**
 * PMOC Fase 5.B — Capa institucional formal.
 *
 * Layout:
 *   ────────────────────────────────────
 *   [BRAND TÉCNICO/EMPRESA]
 *
 *               PLANO DE MANUTENÇÃO,
 *           OPERAÇÃO E CONTROLE (PMOC)
 *
 *               Ano-base 2026
 *               Documento PMOC 2026/01
 *   ────────────────────────────────────
 *
 *   ESTABELECIMENTO (CLIENTE)
 *   Nome: ...
 *   Razão social: ...   CNPJ: ...
 *   Endereço: ...
 *   Contato: ...
 *
 *   PRESTADOR (RESPONSÁVEL TÉCNICO)
 *   Nome / Razão social: ...
 *   CNPJ: ...   IE: ...   IM: ...
 *   Responsável Técnico: ...
 *   ────────────────────────────────────
 *
 *   Emitido em: 25/04/2026
 *   Conformidade: Lei 13.589/2018 · NBR 13971 · Portaria 3.523/1998
 */

import { txt, txtBlock, rule, applyTypo, sectionHeader } from '../primitives.js';
import { PMOC_COLORS as PC, PMOC_TYPO as PT } from '../constants.js';

function buildBrandLine(profile) {
  const parts = [];
  if (profile?.razao_social) parts.push(profile.razao_social);
  else if (profile?.nome) parts.push(profile.nome);
  else parts.push('Prestador de Serviços');
  return parts.join(' · ').toUpperCase();
}

function brTodayLong() {
  const d = new Date();
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function infoLine(label, value) {
  if (!value) return null;
  return { label: `${label}:`, value: String(value) };
}

function clientLines(cliente) {
  if (!cliente) return [{ label: 'Cliente:', value: 'Não vinculado' }];
  const lines = [
    infoLine('Nome', cliente.nome),
    infoLine('Razão social', cliente.razaoSocial),
    infoLine('CNPJ/CPF', cliente.cnpj),
  ].filter(Boolean);
  if (cliente.inscricaoEstadual || cliente.inscricaoMunicipal) {
    lines.push({
      label: 'IE/IM:',
      value: [cliente.inscricaoEstadual, cliente.inscricaoMunicipal].filter(Boolean).join(' / '),
    });
  }
  if (cliente.endereco) lines.push(infoLine('Endereço', cliente.endereco));
  if (cliente.contato) lines.push(infoLine('Contato', cliente.contato));
  return lines;
}

function providerLines(profile) {
  const lines = [
    infoLine('Nome / Razão social', profile?.razao_social || profile?.nome),
    infoLine('CNPJ', profile?.cnpj),
  ].filter(Boolean);
  if (profile?.inscricao_estadual || profile?.inscricao_municipal) {
    lines.push({
      label: 'IE/IM:',
      value: [profile?.inscricao_estadual, profile?.inscricao_municipal]
        .filter(Boolean)
        .join(' / '),
    });
  }
  if (profile?.responsavel_tecnico || profile?.nome) {
    lines.push(infoLine('Responsável Técnico', profile?.responsavel_tecnico || profile?.nome));
  }
  if (profile?.contato) lines.push(infoLine('Contato', profile?.contato));
  return lines;
}

function drawInfoBlock(doc, x, y, width, lines) {
  // Tabela 2 colunas: label (35mm) + value (auto). Sem borders pra ficar
  // limpo no documento formal.
  const labelW = 38;
  const valueX = x + labelW;
  const lineH = 5.4;
  let ly = y;
  for (const { label, value } of lines) {
    txt(doc, label, x, ly, { typo: PT.bodyBold, color: PC.text2 });
    txt(doc, value, valueX, ly, {
      typo: PT.body,
      color: PC.text,
      maxWidth: width - labelW,
    });
    ly += lineH;
  }
  return ly;
}

export function drawPmocCover(doc, pageWidth, pageHeight, margins, ctx) {
  const { ano, docNumber, cliente, profile } = ctx;
  const left = margins.left;
  const right = pageWidth - margins.right;
  const innerW = right - left;

  // ── Brand line + rule ─────────────────────────────────────
  let y = margins.top;
  rule(doc, left, y - 4, right, PC.borderStrong, 0.5);
  txt(doc, buildBrandLine(profile), left, y, {
    typo: PT.brand,
    color: PC.text,
  });
  y += 6;
  rule(doc, left, y, right, PC.border, 0.2);
  y += 18;

  // ── Document title (centered, 2 lines) ────────────────────
  applyTypo(doc, PT.docTitle);
  doc.setTextColor(...PC.text);
  doc.text('PLANO DE MANUTENÇÃO,', pageWidth / 2, y, { align: 'center' });
  y += 9;
  doc.text('OPERAÇÃO E CONTROLE', pageWidth / 2, y, { align: 'center' });
  y += 8;
  txt(doc, '(PMOC)', pageWidth / 2, y, {
    typo: PT.docSubtitle,
    color: PC.text2,
    align: 'center',
  });
  y += 12;

  // ── Number + year (centered, monospaced look via tracking) ─
  txt(doc, `Documento Nº  ${docNumber}`, pageWidth / 2, y, {
    typo: PT.docNumber,
    color: PC.text,
    align: 'center',
  });
  y += 5;
  txt(doc, `Ano-base ${ano}`, pageWidth / 2, y, {
    typo: PT.body,
    color: PC.text2,
    align: 'center',
  });
  y += 14;

  rule(doc, left + 30, y, right - 30, PC.borderStrong, 0.3);
  y += 12;

  // ── Cliente / estabelecimento ─────────────────────────────
  y = sectionHeader(doc, left, y, innerW, 'Estabelecimento (cliente)');
  y = drawInfoBlock(doc, left, y, innerW, clientLines(cliente));
  y += 8;

  // ── Prestador / RT ────────────────────────────────────────
  y = sectionHeader(doc, left, y, innerW, 'Prestador de serviços técnicos');
  y = drawInfoBlock(doc, left, y, innerW, providerLines(profile));
  y += 14;

  rule(doc, left, y, right, PC.border, 0.2);
  y += 6;

  // ── Footer da capa: emissão + base normativa ──────────────
  txt(doc, `Emitido em ${brTodayLong()}`, left, y, {
    typo: PT.metaBold,
    color: PC.text2,
  });
  y += 5;
  txtBlock(
    doc,
    [
      'Conformidade: Lei Federal nº 13.589/2018 · ABNT NBR 13971/2014 ·',
      'Portaria GM/MS nº 3.523/1998.',
    ],
    left,
    y,
    { typo: PT.meta, color: PC.text3, lineH: 4 },
  );
}
