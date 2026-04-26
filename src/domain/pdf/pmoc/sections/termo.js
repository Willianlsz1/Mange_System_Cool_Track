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

import { txt, txtBlock, rule, numberedSectionHeader } from '../primitives.js';
import { PMOC_COLORS as PC, PMOC_TYPO as PT, PMOC_DECLARACAO_RT } from '../constants.js';

/**
 * V2: bloco de assinatura completo (linha + label + nome + role).
 * Renderiza vertical pra um bloco. Usado lado a lado pra RT e Cliente.
 */
function drawSignatureBlock(doc, x, y, width, opts) {
  const { name, role, subtitle } = opts;
  // Linha de assinatura
  rule(doc, x, y, x + width, PC.text2, 0.4);
  // Label "ASSINATURA DO ..." pequeno em cima da linha
  txt(doc, opts.label.toUpperCase(), x + width / 2, y - 4, {
    typo: { font: 'helvetica', size: 7, style: 'bold' },
    color: PC.text3,
    align: 'center',
  });
  // Nome do signatario abaixo
  if (name) {
    txt(doc, name, x + width / 2, y + 5, {
      typo: PT.bodyBold,
      color: PC.text,
      align: 'center',
    });
  } else {
    // Espaco em branco pra cliente assinar a mao
    txt(doc, 'Nome: ____________________________', x + width / 2, y + 5, {
      typo: PT.meta,
      color: PC.text3,
      align: 'center',
    });
  }
  // Role/cargo
  if (role) {
    txt(doc, role, x + width / 2, y + 10, {
      typo: PT.meta,
      color: PC.text3,
      align: 'center',
    });
  }
  // Subtitle (ART/RRT, data manuscrita pra cliente)
  if (subtitle) {
    txt(doc, subtitle, x + width / 2, y + 14, {
      typo: PT.meta,
      color: PC.text3,
      align: 'center',
    });
  }
  return y + 20;
}

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

  y = numberedSectionHeader(doc, left, y, innerW, 5, 'Termo de responsabilidade técnica');
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

  // V2 fix (#114): aliases pra perfis antigos. crea_cft cai em crea (campo
  // legado), responsavel_tecnico cai em nome se nao foi separado, contato
  // tem 3 fallbacks. Evita "—" quando o perfil tem o dado mas com nome
  // de campo diferente.
  const rows = [
    { label: 'Nome:', value: profile?.responsavel_tecnico || profile?.nome || '—' },
    { label: 'Razão social:', value: profile?.razao_social || profile?.empresa || '—' },
    { label: 'CNPJ:', value: profile?.cnpj || '—' },
    { label: 'Inscrição estadual:', value: profile?.inscricao_estadual || '—' },
    { label: 'Inscrição municipal:', value: profile?.inscricao_municipal || '—' },
    { label: 'Registro CREA/CFT:', value: profile?.crea_cft || profile?.crea || '—' },
    { label: 'ART/RRT nº:', value: profile?.art_rrt || '—' },
    { label: 'Contato:', value: profile?.contato || profile?.telefone || profile?.email || '—' },
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

  // � V2: Duas caixas de assinatura lado a lado (RT + Cliente)
  const sigGap = 10;
  const sigW = (innerW - sigGap) / 2;
  const sigYStart = y;

  drawSignatureBlock(doc, left, sigYStart, sigW, {
    label: 'Assinatura do responsável técnico',
    name: profile?.responsavel_tecnico || profile?.nome || 'Responsável Técnico',
    role: 'Responsável Técnico',
    subtitle:
      profile?.crea_cft || profile?.crea
        ? `CREA/CFT ${profile.crea_cft || profile.crea}`
        : profile?.art_rrt
          ? `ART/RRT ${profile.art_rrt}`
          : '',
  });

  drawSignatureBlock(doc, left + sigW + sigGap, sigYStart, sigW, {
    label: 'Assinatura do cliente',
    name: '',
    role: '',
    subtitle: 'Data: ___ / ___ / ______',
  });
  // Rodape legal
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
