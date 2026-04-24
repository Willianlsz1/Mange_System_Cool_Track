/**
 * CoolTrack Pro — Insights técnicos derivados de `dados_placa`.
 *
 * Puro, testável, sem dependência de DOM/Supabase. Recebe o blob
 * `dados_placa` (com opcional `camposExtras`) e devolve:
 *   - agrupamento semântico dos extras em categorias conhecidas
 *   - status de phase-out do refrigerante
 *   - sugestão de disjuntor a partir de MCA/MOCP
 *   - filtro de Tier 1 (campos que merecem destaque em campo)
 *
 * Design: zero copies agressivas, zero promessas absolutas — todos os
 * insights são rotulados como "sugestão" e NÃO bloqueiam nada. O objetivo
 * é dar ao técnico um ponto de partida, não uma decisão final.
 *
 * Nota: o fluido principal pode vir em `dadosPlaca.fluido` (coluna fixa
 * do equipamento), `dadosPlaca.camposExtras[].key==='refrigerant'` ou
 * legado em `dadosPlaca.refrigerante`. Tratamos os 3 paths.
 */

import { prettifyDadosPlacaKey } from './dadosPlacaDisplay.js';

// ── Categorias de agrupamento ──────────────────────────────────────────────
// Ordem = ordem de exibição (mais acionável → menos). "Outros" sempre último.
// Cada categoria tem um regex e um label pt-BR; classifier matcha na 1ª
// correspondência (ordem importa quando uma chave casa dois padrões).
const CATEGORY_ORDER = [
  'eletrica',
  'termodinamica',
  'refrigerante',
  'mecanica',
  'dimensoes',
  'regulamentar',
  'outros',
];

const CATEGORY_LABELS = {
  eletrica: 'Elétrica',
  termodinamica: 'Termodinâmica',
  refrigerante: 'Refrigerante',
  mecanica: 'Mecânica',
  dimensoes: 'Dimensões',
  regulamentar: 'Regulamentar',
  outros: 'Outros',
};

// Cada pattern é testado contra a chave normalizada (lowercase). Ordem é
// relevante: pegamos a primeira que casa pra não duplicar.
const CATEGORY_PATTERNS = [
  { id: 'eletrica', re: /mca|mocp|tensao|potencia|fator_potencia|eletric|carga_eletrica|conexao/ },
  {
    id: 'termodinamica',
    re: /seer|eer|cop|iplv|ieer|scop|^tr$|capacidade_tr|pressao|temperatura_op|temperatura_evap|temperatura_cond/,
  },
  {
    id: 'refrigerante',
    re: /refrigerant|refrigerante|^gas$|gas_refrig|carga_gas|carga_refrigerante|oleo_tipo|oleo_volume|oleo_lub/,
  },
  {
    id: 'mecanica',
    re: /compressor|^fan_|^fan$|ventilador|valvula|motor_|rotor|polia|correia/,
  },
  {
    id: 'dimensoes',
    re: /peso|dimens|vazao|ruido|comprimento|distancia|altura|largura|profundidade/,
  },
  {
    id: 'regulamentar',
    re: /classe_energetica|norma|certific|origem|lote|codigo_fabric|procedencia|ano_fabricacao_extra|inmetro/,
  },
];

/**
 * Classifica uma chave de extra num dos 7 grupos. Retorna 'outros' pra
 * qualquer coisa que não bata nos patterns acima.
 */
export function classifyExtraKey(key) {
  if (!key) return 'outros';
  const norm = String(key).toLowerCase();
  for (const { id, re } of CATEGORY_PATTERNS) {
    if (re.test(norm)) return id;
  }
  return 'outros';
}

/**
 * Agrupa as rows extras em categorias pré-definidas. Retorna array na
 * ordem canônica `CATEGORY_ORDER`, com apenas categorias não-vazias.
 *
 * @param {Array<{key: string, label: string, value: string, extra?: boolean}>} rows
 * @returns {Array<{id: string, label: string, rows: Array}>}
 */
export function groupCamposExtras(rows) {
  if (!Array.isArray(rows) || !rows.length) return [];
  const buckets = Object.fromEntries(CATEGORY_ORDER.map((id) => [id, []]));
  for (const row of rows) {
    if (!row || !row.extra) continue; // ignora campos fixos
    const id = classifyExtraKey(row.key);
    buckets[id].push(row);
  }
  return CATEGORY_ORDER.filter((id) => buckets[id].length > 0).map((id) => ({
    id,
    label: CATEGORY_LABELS[id],
    rows: buckets[id],
  }));
}

// ── Tier 1 (destaque em campo) ─────────────────────────────────────────────
// Chaves consideradas "decisão imediata". A match é em substring da key
// normalizada — permite `mca`, `mca_amps`, `pressao_max`, `pressao_trabalho`
// caírem todas no mesmo tier.
const TIER1_PATTERNS = [/\bmca\b/, /\bmocp\b/, /refrigerant/, /compressor_model/, /pressao/];

export function isTier1Key(key) {
  if (!key) return false;
  const norm = String(key).toLowerCase();
  return TIER1_PATTERNS.some((re) => re.test(norm));
}

export function filterTier1Extras(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.filter((r) => r && r.extra && isTier1Key(r.key));
}

// ── Phase-out de refrigerante ──────────────────────────────────────────────
// Tabela estática. Fonte: Protocolo de Montreal (CFCs/HCFCs) + Kigali (HFCs).
// Valores:
//   phased_out       — uso proibido/restrito; manutenção exige retrofit
//   phase_out_gradual — em processo; vale sinalizar pro cliente
//   low_gwp          — baixo impacto climático; atenção à inflamabilidade (A2L/A3)
//   active           — comum, sem sinal negativo
const REFRIGERANT_STATUS = {
  'R-22': 'phased_out',
  'R-12': 'phased_out',
  'R-502': 'phased_out',
  'R-11': 'phased_out',
  'R-410A': 'phase_out_gradual',
  'R-404A': 'phase_out_gradual',
  'R-407C': 'phase_out_gradual',
  'R-134A': 'phase_out_gradual',
  'R-32': 'active',
  'R-290': 'low_gwp',
  'R-600A': 'low_gwp',
  'R-744': 'low_gwp',
  'R-1234YF': 'low_gwp',
};

const PHASE_OUT_COPY = {
  phased_out: 'Phase-out concluído — avaliar retrofit.',
  phase_out_gradual: 'Phase-out gradual — acompanhar substituição futura.',
  low_gwp: 'Baixo GWP — atenção à inflamabilidade.',
  active: null,
};

// Tom visual — casa com o padrão `eq-risk-panel--{baixo|medio|alto}` já
// existente. Phase-out concluído = alto (amarelo-vermelho); gradual = médio;
// low_gwp = baixo. Active não gera chip.
const PHASE_OUT_TONE = {
  phased_out: 'alto',
  phase_out_gradual: 'medio',
  low_gwp: 'baixo',
};

/**
 * Normaliza o código do refrigerante pra casar com a tabela.
 *   "r410a" → "R-410A"
 *   "R 410A" → "R-410A"
 *   "r-290" → "R-290"
 */
export function normalizeRefrigerantCode(raw) {
  if (raw == null) return null;
  const upper = String(raw).toUpperCase().replace(/\s+/g, '');
  if (!upper) return null;
  const withDash = upper.startsWith('R-') ? upper : upper.replace(/^R/, 'R-');
  return withDash;
}

/**
 * Tenta encontrar o refrigerante em múltiplas locações:
 *   1. dadosPlaca.fluido (coluna fixa do equipamento)
 *   2. dadosPlaca.refrigerante (legado)
 *   3. camposExtras com key ~ /refrigerant|fluido/
 */
export function findRefrigerant(dadosPlaca) {
  if (!dadosPlaca || typeof dadosPlaca !== 'object') return null;
  if (dadosPlaca.fluido) return normalizeRefrigerantCode(dadosPlaca.fluido);
  if (dadosPlaca.refrigerante) return normalizeRefrigerantCode(dadosPlaca.refrigerante);
  const extras = Array.isArray(dadosPlaca.camposExtras) ? dadosPlaca.camposExtras : [];
  for (const entry of extras) {
    if (!entry || typeof entry !== 'object') continue;
    const key = String(entry.key || '').toLowerCase();
    if (/refrigerant|fluido/.test(key)) {
      return normalizeRefrigerantCode(entry.value);
    }
  }
  return null;
}

/**
 * Devolve o insight de phase-out quando aplicável. Retorna null quando o
 * refrigerante não é conhecido ou tem status 'active'. Nunca lança.
 *
 * @returns {{ code: string, status: string, message: string, tone: string } | null}
 */
export function detectRefrigerantPhaseOut(dadosPlaca) {
  const code = findRefrigerant(dadosPlaca);
  if (!code) return null;
  const status = REFRIGERANT_STATUS[code];
  if (!status || status === 'active') return null;
  const message = PHASE_OUT_COPY[status];
  if (!message) return null;
  return {
    code,
    status,
    message,
    tone: PHASE_OUT_TONE[status] || 'medio',
  };
}

// ── Sugestão de disjuntor ──────────────────────────────────────────────────
// Ordem crescente; primeira >= necessidade é o escolhido.
const COMMERCIAL_BREAKERS = [10, 15, 20, 25, 32, 40, 50, 63, 80, 100];

function findExtraByKey(dadosPlaca, predicate) {
  const extras = Array.isArray(dadosPlaca?.camposExtras) ? dadosPlaca.camposExtras : [];
  for (const entry of extras) {
    if (!entry || typeof entry !== 'object') continue;
    if (predicate(String(entry.key || '').toLowerCase())) return entry;
  }
  return null;
}

function parseAmps(raw) {
  if (raw == null) return null;
  const str = String(raw).replace(',', '.');
  // Extrai o primeiro número (aceita "12", "12 A", "12A", "12.5 A").
  const match = str.match(/[0-9]+(?:\.[0-9]+)?/);
  if (!match) return null;
  const n = parseFloat(match[0]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function roundUpToCommercialBreaker(amps) {
  if (!Number.isFinite(amps) || amps <= 0) return null;
  for (const b of COMMERCIAL_BREAKERS) {
    if (b >= amps) return b;
  }
  return COMMERCIAL_BREAKERS[COMMERCIAL_BREAKERS.length - 1];
}

/**
 * Sugere disjuntor com base em MCA/MOCP. MOCP (se presente) ganha do MCA —
 * por definição, MOCP já é o valor de proteção máxima permitido pela
 * fabricante. Sem MCA nem MOCP → null.
 *
 * @returns {{ mca: number|null, mocp: number|null, suggested: number, source: 'mocp'|'mca' } | null}
 */
export function suggestBreaker(dadosPlaca) {
  if (!dadosPlaca || typeof dadosPlaca !== 'object') return null;
  const mcaEntry = findExtraByKey(dadosPlaca, (k) => /\bmca\b/.test(k));
  const mocpEntry = findExtraByKey(dadosPlaca, (k) => /\bmocp\b/.test(k));
  const mca = mcaEntry ? parseAmps(mcaEntry.value) : null;
  const mocp = mocpEntry ? parseAmps(mocpEntry.value) : null;
  if (mca == null && mocp == null) return null;

  // MOCP tem precedência — é o valor do fabricante. Se só tem MCA,
  // calcula via regra NEC/ABNT simplificada: disjuntor >= MCA × 1.25.
  let suggested;
  let source;
  if (mocp != null) {
    suggested = roundUpToCommercialBreaker(mocp);
    source = 'mocp';
  } else {
    suggested = roundUpToCommercialBreaker(mca * 1.25);
    source = 'mca';
  }
  if (!suggested) return null;
  return { mca, mocp, suggested, source };
}

/**
 * Bundle de todos os insights Tier 1 pra o detail view consumir numa só
 * chamada. Sempre retorna objeto — propriedades individuais são null
 * quando não aplicáveis.
 */
export function buildTechnicalInsights(dadosPlaca) {
  return {
    phaseOut: detectRefrigerantPhaseOut(dadosPlaca),
    breaker: suggestBreaker(dadosPlaca),
  };
}

// Exposição do mapa de tones/copies pra o PDF reutilizar texto/cor.
export const INSIGHT_CATEGORY_ORDER = CATEGORY_ORDER;
export const INSIGHT_CATEGORY_LABELS = { ...CATEGORY_LABELS };

// Re-export do prettify pra o PDF não precisar importar dois módulos
// quando quer só "label humanizado + categoria".
export { prettifyDadosPlacaKey };
