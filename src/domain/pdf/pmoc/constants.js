/**
 * Constantes do PDF PMOC formal (Fase 5 PMOC, abr/2026).
 *
 * Paleta MONOCROMÁTICA — preto/cinza/branco. Diferente do relatório
 * técnico (que usa navy + accent teal), este PDF se posiciona como
 * "documento legal/formal" alinhado com a estética de ART, RRT, e
 * memoriais técnicos. Imprime sem custo de tinta colorida.
 *
 * Fontes: jsPDF embute helvetica (sans) e times (serif). Usamos
 * helvetica nas tabelas/body (mais compacta) e times nos títulos
 * grandes da capa pra dar peso institucional.
 */

export const PMOC_COLORS = {
  bg: [255, 255, 255],
  bg2: [248, 248, 248], // band sutilíssima para masthead
  bg3: [241, 241, 241], // header de tabela
  border: [200, 200, 200],
  borderStrong: [120, 120, 120],
  rule: [100, 100, 100], // linhas estruturais (capa, divisores)
  text: [20, 20, 20], // quase preto
  text2: [60, 60, 60],
  text3: [120, 120, 120],
  black: [0, 0, 0],
  white: [255, 255, 255],
  // V2 (abr/2026): adicionado azul navy como accent INSTITUCIONAL pra alinhar
  // com referencia de design (ver PR PMOC visual upgrade). Uso restrito a:
  //   - numero das secoes (1., 2., 3., ...)
  //   - badges de identificacao (DOCUMENTO Nº box)
  //   - barras laterais de cards (resumo executivo)
  //   - header de tabelas formais
  // Mantemos o resto monocromatico — navy eh accent, nao cor primaria.
  navy: [30, 58, 95], // titulos numerados + barras laterais
  navySoft: [219, 234, 254], // backgrounds de cards/badges
  navyBorder: [191, 219, 254], // bordas de cards azuis
  // Tons usados em badges de status no cronograma — mantidos em escala
  // de cinza pra preservar a identidade monocromática.
  ok: [40, 40, 40], // realizado/conforme = preto sólido
  warn: [110, 110, 110], // planejado mas não cumprido = cinza médio
  na: [200, 200, 200], // sem ação = cinza muito claro
};

export const PMOC_TYPO = {
  // Capa
  brand: { font: 'times', size: 22, style: 'bold' },
  docTitle: { font: 'times', size: 18, style: 'bold' },
  docSubtitle: { font: 'times', size: 11, style: 'italic' },
  docNumber: { font: 'helvetica', size: 10, style: 'bold' },

  // Seções
  sectionTitle: { font: 'helvetica', size: 11, style: 'bold' }, // CAIXA ALTA
  sectionLabel: { font: 'helvetica', size: 9, style: 'bold' },
  body: { font: 'helvetica', size: 9, style: 'normal' },
  bodyBold: { font: 'helvetica', size: 9, style: 'bold' },
  meta: { font: 'helvetica', size: 8, style: 'normal' },
  metaBold: { font: 'helvetica', size: 8, style: 'bold' },
  micro: { font: 'helvetica', size: 7, style: 'normal' },
  microBold: { font: 'helvetica', size: 7, style: 'bold' },

  // Termo de RT
  legalBody: { font: 'times', size: 10, style: 'normal' },
  legalBodyBold: { font: 'times', size: 10, style: 'bold' },
  signature: { font: 'times', size: 10, style: 'italic' },
};

// Margens padrão do PMOC (mais generosas que o relatório técnico
// pra dar respiro institucional).
export const PMOC_MARGINS = {
  top: 22,
  bottom: 22,
  left: 18,
  right: 18,
};

// Marks do cronograma anual.
//   P = Preventiva planejada
//   R = Realizada (preventiva cumprida)
//   C = Corretiva
//   L = Limpeza específica
//   "—" = sem ação
export const SCHEDULE_MARK = Object.freeze({
  PREVENTIVA_PLANEJADA: 'P',
  REALIZADA: 'R',
  CORRETIVA: 'C',
  LIMPEZA: 'L',
  NONE: '—',
});

// Texto padrão do termo de responsabilidade técnica (NBR 13971
// recomenda essa estrutura). Usado se o profile não tiver texto custom.
export const PMOC_DECLARACAO_RT = [
  'Declaro, na qualidade de Responsável Técnico (RT), que o Plano de Manutenção,',
  'Operação e Controle (PMOC) deste estabelecimento foi elaborado e executado em',
  'conformidade com a Lei Federal nº 13.589/2018, a Portaria GM/MS nº 3.523/1998',
  'e a Norma ABNT NBR 13971/2014, observando a periodicidade das atividades de',
  'manutenção preventiva, corretiva e limpeza necessárias à preservação da qualidade',
  'do ar interior e ao bom funcionamento dos sistemas de climatização instalados.',
];
