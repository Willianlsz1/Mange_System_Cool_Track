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

import {
  txt,
  txtBlock,
  rule,
  applyTypo,
  sectionHeader,
  numberedSectionHeader,
  summaryCard,
  badgeBox,
} from '../primitives.js';
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
  // PMOC NBR 13971 §6.2: deve constar o canal de comunicacao para abertura
  // de chamados/manutencao corretiva. Quando informado pelo cliente, vai
  // aqui na capa pra ficar imediatamente visivel ao leitor.
  if (cliente.urlChamados) {
    lines.push({
      label: 'Abertura de chamados:',
      value: String(cliente.urlChamados),
      isLink: true,
    });
  }
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
  // limpo no documento formal. Suporta isLink no item — quando true, cria
  // area clicavel via doc.link() sobre o valor renderizado.
  const labelW = 38;
  const valueX = x + labelW;
  const lineH = 5.4;
  let ly = y;
  for (const { label, value, isLink } of lines) {
    txt(doc, label, x, ly, { typo: PT.bodyBold, color: PC.text2 });
    // Pinta o valor — links em cor mais "ativa" (azul) e sublinhado pra
    // afford clicavel mesmo em PDFs impressos (sublinhado e o sinal universal).
    txt(doc, value, valueX, ly, {
      typo: PT.body,
      color: isLink ? PC.primary : PC.text,
      maxWidth: width - labelW,
    });
    if (isLink) {
      // Calcula altura da linha (jsPDF: getTextWidth + lineHeight) e cria
      // area clicavel. Em PDFs digitais, click abre URL em browser.
      const textW = Math.min(doc.getTextWidth(value), width - labelW);
      try {
        doc.link(valueX, ly - 4, textW, 5, { url: value });
      } catch (_e) {
        /* alguns ambientes (jsPDF mockado em test) podem nao ter doc.link */
      }
    }
    ly += lineH;
  }
  return ly;
}

export function drawPmocCover(doc, pageWidth, pageHeight, margins, ctx) {
  const { ano, docNumber, cliente, profile, equipamentos = [] } = ctx;
  const left = margins.left;
  const right = pageWidth - margins.right;
  const innerW = right - left;

  // ── Brand line + rule ─────────────────────────────────────
  // V2 fix: rule navy fica DEPOIS do texto (linha de assinatura visual
  // do brand), nao antes. Texto 22pt se estende ~5-6mm acima da baseline,
  // entao rule em (y-4) cortava o nome no meio.
  let y = margins.top + 4; // empurra a baseline pra dar espaço pro topo do texto
  txt(doc, buildBrandLine(profile), left, y, {
    typo: PT.brand,
    color: PC.navy,
  });
  y += 4;
  rule(doc, left, y, right, PC.navy, 0.6); // rule navy ABAIXO do brand
  y += 14;

  // ── Document title (left-aligned, 3 lines, mais visual) ────
  applyTypo(doc, { ...PT.docTitle, size: 22 });
  doc.setTextColor(...PC.text);
  doc.text('PLANO DE MANUTENÇÃO,', left, y);
  y += 8;
  doc.text('OPERAÇÃO E', left, y);
  y += 8;
  doc.text('CONTROLE (PMOC)', left, y);
  y += 7;
  txtBlock(
    doc,
    [
      `Conformidade com a Lei Federal nº 13.589/2018,`,
      `Portaria GM/MS nº 3.523/1998 e ABNT NBR 13971/2014`,
    ],
    left,
    y,
    { typo: { ...PT.body, size: 9, style: 'italic' }, color: PC.text3, lineH: 4.5 },
  );
  y += 12;

  // ── V2: Badges de identificação (Doc Nº + Ano-base) ───────
  // Caixas navy lado a lado pra dar peso institucional ao número
  // do documento, replicando o visual do design de referência.
  const badgeW = (innerW - 6) / 2;
  badgeBox(doc, left, y, badgeW, 16, 'Documento Nº', docNumber);
  badgeBox(doc, left + badgeW + 6, y, badgeW, 16, 'Ano-base', String(ano));
  y += 22;

  // ── V2: Resumo Executivo (4 cards visuais) ────────────────
  // Substitui a prosa "Conformidade NBR..." por cards de KPI:
  // equipamentos cadastrados, periodicidade padrão, conformidade %,
  // status do plano (preventiva programada).
  y = numberedSectionHeader(doc, left, y, innerW, 1, 'Resumo Executivo');
  y += 2;

  const cardGap = 4;
  const cardW = (innerW - cardGap * 3) / 4;
  const cardH = 22;
  const equipCount = equipamentos.length;

  summaryCard(
    doc,
    left,
    y,
    cardW,
    cardH,
    String(equipCount),
    equipCount === 1 ? ['Equipamento', 'cadastrado'] : ['Equipamentos', 'cadastrados'],
  );
  summaryCard(
    doc,
    left + (cardW + cardGap),
    y,
    cardW,
    cardH,
    'Mensal',
    ['Periodicidade', 'padrão'],
    { smallValue: true },
  );
  summaryCard(doc, left + (cardW + cardGap) * 2, y, cardW, cardH, '100%', [
    'Conformidade',
    'normativa',
  ]);
  summaryCard(
    doc,
    left + (cardW + cardGap) * 3,
    y,
    cardW,
    cardH,
    'Manutenção',
    ['preventiva', 'programada'],
    { smallValue: true },
  );
  y += cardH + 10;

  // ── Cliente / estabelecimento ─────────────────────────────
  y = sectionHeader(doc, left, y, innerW, 'Estabelecimento (cliente)');
  y = drawInfoBlock(doc, left, y, innerW, clientLines(cliente));
  y += 6;

  // ── Prestador / RT ────────────────────────────────────────
  y = sectionHeader(doc, left, y, innerW, 'Prestador de serviços técnicos');
  y = drawInfoBlock(doc, left, y, innerW, providerLines(profile));
  y += 8;

  // ── V2: Card de conformidade no rodape ────────────────────
  doc.setFillColor(...PC.navySoft);
  doc.setDrawColor(...PC.navyBorder);
  doc.setLineWidth(0.3);
  doc.rect(left, y, innerW, 14, 'FD');
  txt(
    doc,
    'Este plano foi elaborado e será executado em conformidade com a legislação vigente,',
    left + 5,
    y + 6,
    { typo: { ...PT.meta, size: 8.5 }, color: PC.text2 },
  );
  txt(
    doc,
    'garantindo a qualidade do ar interior e o bom funcionamento dos sistemas de climatização.',
    left + 5,
    y + 10,
    { typo: { ...PT.meta, size: 8.5 }, color: PC.text2 },
  );
  y += 18;

  txt(doc, `Emitido em ${brTodayLong()}`, left, y, {
    typo: PT.metaBold,
    color: PC.text3,
  });
}
