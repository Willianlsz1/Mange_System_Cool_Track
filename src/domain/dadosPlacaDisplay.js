/**
 * CoolTrack Pro — Formatação de `dados_placa` para exibição.
 *
 * Os 12 campos da placa são persistidos em `equipamentos.dados_placa` (JSONB)
 * após serem capturados via IA (Edge Function analyze-nameplate) ou digitados
 * manualmente no form. Este módulo traduz o JSON bruto em linhas formatadas
 * (label + value em pt-BR, unidades corretas) que o UI consome.
 *
 * Consumidores:
 *   - viewEquip() no modal de detalhe do equipamento (seção "Dados da etiqueta")
 *   - record card expandido no histórico/relatório
 *   - (futuro) PDF export
 *
 * Schema esperado — ver migration 20260421_equipamentos_dados_placa.sql:
 *   numero_serie (string), capacidade_btu (int), tensao (string), frequencia_hz (int),
 *   fases (int), potencia_w (int), corrente_refrig_a (num), corrente_aquec_a (num),
 *   pressao_succao_mpa (num), pressao_descarga_mpa (num), grau_protecao (string),
 *   ano_fabricacao (int).
 *
 * Campos ausentes ou vazios são OMITIDOS (não viram "—"). A ausência da seção
 * inteira é tratada pelo caller via hasAnyDadosPlaca() — evita ruído visual
 * em equipamentos antigos cadastrados antes da feature de IA.
 */

// Labels e unidades em ordem semântica — identificação → elétrica → termodinâmica
// → proteção → ano. Pensado pra um técnico ler de cima pra baixo.
const FIELD_ORDER = [
  'numero_serie',
  'capacidade_btu',
  'tensao',
  'frequencia_hz',
  'fases',
  'potencia_w',
  'corrente_refrig_a',
  'corrente_aquec_a',
  'pressao_succao_mpa',
  'pressao_descarga_mpa',
  'grau_protecao',
  'ano_fabricacao',
];

const LABELS = {
  numero_serie: 'Nº de série',
  capacidade_btu: 'Capacidade',
  tensao: 'Tensão',
  frequencia_hz: 'Frequência',
  fases: 'Fases',
  potencia_w: 'Potência',
  corrente_refrig_a: 'Corrente (refrig.)',
  corrente_aquec_a: 'Corrente (aquec.)',
  pressao_succao_mpa: 'Pressão de sucção',
  pressao_descarga_mpa: 'Pressão de descarga',
  grau_protecao: 'Grau de proteção',
  ano_fabricacao: 'Ano de fabricação',
};

const FASES_LABEL = {
  1: 'Monofásico',
  2: 'Bifásico',
  3: 'Trifásico',
};

/**
 * Formata um número decimal em pt-BR (vírgula como separador).
 * fmtDecimal(4.63, 2) → "4,63"
 * fmtDecimal(4, 2)    → "4,00"
 * fmtDecimal(2.4, 1)  → "2,4"
 */
function fmtDecimal(n, digits = 2) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return null;
  return n.toFixed(digits).replace('.', ',');
}

/**
 * Formata inteiro com separador de milhar pt-BR (ponto).
 * fmtInt(9000)  → "9.000"
 * fmtInt(12000) → "12.000"
 */
function fmtInt(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return null;
  return Math.trunc(n).toLocaleString('pt-BR');
}

/**
 * Formata um valor individual baseado no tipo de campo.
 * Retorna null se o valor é ausente/inválido — caller deve omitir a linha.
 */
function formatValue(key, raw) {
  if (raw == null || raw === '') return null;

  switch (key) {
    case 'numero_serie':
    case 'grau_protecao':
      // Strings livres — apenas trim e passa adiante.
      return String(raw).trim() || null;

    case 'capacidade_btu': {
      const s = fmtInt(Number(raw));
      return s ? `${s} BTU` : null;
    }

    case 'tensao': {
      // tensão vem como string porque "bivolt" não é número. Se for numérico,
      // formata como "NNN V". Senão, usa como está (ex: "bivolt").
      const trimmed = String(raw).trim();
      if (!trimmed) return null;
      // Aceita "220", "220V", "220 V" — extrai só dígitos e adiciona unidade.
      const asNum = parseInt(trimmed, 10);
      if (!Number.isNaN(asNum) && /^\d+$/.test(trimmed.replace(/\s/g, ''))) {
        return `${asNum} V`;
      }
      // Normaliza case pra "Bivolt" (primeira maiúscula) — comum na etiqueta.
      return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
    }

    case 'frequencia_hz': {
      const n = Number(raw);
      return Number.isFinite(n) ? `${n} Hz` : null;
    }

    case 'fases': {
      const n = parseInt(raw, 10);
      if (Number.isNaN(n)) return null;
      // Fallback genérico se vier algo fora de 1-3 (schema permite outros).
      return FASES_LABEL[n] || `${n} fases`;
    }

    case 'potencia_w': {
      const s = fmtInt(Number(raw));
      return s ? `${s} W` : null;
    }

    case 'corrente_refrig_a':
    case 'corrente_aquec_a': {
      const s = fmtDecimal(Number(raw), 2);
      return s ? `${s} A` : null;
    }

    case 'pressao_succao_mpa':
    case 'pressao_descarga_mpa': {
      // Pressões podem ter 1 ou 2 casas na etiqueta. Usamos 2 e deixamos o
      // número falar (2.4 → "2,40" pode parecer exagerado; preferimos 1 casa
      // se for inteiro .0 ou terminar em .N0). Compromisso: fixo em 1 casa.
      const s = fmtDecimal(Number(raw), 1);
      return s ? `${s} MPa` : null;
    }

    case 'ano_fabricacao': {
      const n = parseInt(raw, 10);
      if (Number.isNaN(n) || n < 1900 || n > 2100) return null;
      return String(n);
    }

    default:
      // Campo desconhecido — mostra raw stringificado (defesa em profundidade
      // se o schema expandir e este formatter esquecer de atualizar).
      return String(raw).trim() || null;
  }
}

/**
 * Cap máximo de extras renderizados. Protege o detail/PDF de payloads
 * exagerados. Se houver mais que isso, os últimos são omitidos (com
 * indicador de truncamento quando consumido pelo PDF).
 */
export const CAMPOS_EXTRAS_DISPLAY_CAP = 10;

/**
 * Prettifica uma chave de campo extra (snake_case ou camelCase) em rótulo
 * legível em pt-BR. Usada pelo display quando um campo chega sem `label`
 * (ex.: payload legado onde salvamos só `{ key, value }`).
 *
 *   prettifyDadosPlacaKey('pressao_maxima') → 'Pressao maxima'
 *   prettifyDadosPlacaKey('compressorModel') → 'Compressor model'
 */
export function prettifyDadosPlacaKey(key) {
  if (key == null) return '';
  const str = String(key).trim();
  if (!str) return '';
  const spaced = str
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
  if (!spaced) return '';
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

/**
 * Chaves que são metadata (não campo de etiqueta). Não entram no render
 * do detail view nem do PDF. Qualquer chave iniciada com `_` também é
 * tratada como metadata.
 */
const METADATA_KEYS = new Set(['camposExtras', 'notas']);

function isMetadataKey(key) {
  if (typeof key !== 'string') return true;
  if (key.startsWith('_')) return true;
  return METADATA_KEYS.has(key);
}

/**
 * Converte o blob `dados_placa` em array de linhas prontas pra renderização.
 * Preserva ordem semântica (FIELD_ORDER) e inclui campos extras (quando
 * presentes em `dadosPlaca.camposExtras`) como seção secundária.
 *
 * Omite campos sem valor válido, metadata (`_*`, `notas`, `camposExtras`)
 * e extras que colidem com keys já renderizadas (evita duplicação).
 *
 * @param {object|null|undefined} dadosPlaca
 * @returns {Array<{key: string, label: string, value: string, mono?: boolean, extra?: boolean}>}
 */
export function formatDadosPlacaRows(dadosPlaca) {
  if (!dadosPlaca || typeof dadosPlaca !== 'object' || Array.isArray(dadosPlaca)) {
    return [];
  }

  const rows = [];
  const renderedKeys = new Set();

  // (1) Campos fixos da etiqueta (ordem semântica).
  for (const key of FIELD_ORDER) {
    const value = formatValue(key, dadosPlaca[key]);
    if (value == null) continue;
    const row = { key, label: LABELS[key], value };
    // Nº de série merece monospace (códigos alfanuméricos longos ficam melhores
    // alinhados). Grau de proteção também (IPX0, IP24 são "códigos").
    if (key === 'numero_serie' || key === 'grau_protecao') {
      row.mono = true;
    }
    rows.push(row);
    renderedKeys.add(key);
  }

  // (2) Campos extras — lista de `{ key, label, value }` provenientes da IA
  //     ou do review UI manual. Respeita o cap e evita duplicação com os
  //     campos fixos. Fallback de label pra prettify quando ausente.
  const extras = Array.isArray(dadosPlaca.camposExtras) ? dadosPlaca.camposExtras : [];
  let added = 0;
  for (const entry of extras) {
    if (added >= CAMPOS_EXTRAS_DISPLAY_CAP) break;
    if (!entry || typeof entry !== 'object') continue;
    const rawKey = entry.key;
    const rawValue = entry.value;
    if (rawKey == null || rawValue == null || String(rawValue).trim() === '') continue;
    const keyStr = String(rawKey).trim();
    if (!keyStr) continue;
    if (isMetadataKey(keyStr)) continue;
    if (renderedKeys.has(keyStr)) continue;
    const label = entry.label ? String(entry.label).trim() : '';
    rows.push({
      key: keyStr,
      label: label || prettifyDadosPlacaKey(rawKey),
      value: String(rawValue).trim(),
      extra: true,
    });
    renderedKeys.add(keyStr);
    added += 1;
  }

  return rows;
}

/**
 * Retorna true se o objeto tem pelo menos um campo "útil" preenchido.
 * Ignora metadata (_source) e chaves vazias. Serve pro caller decidir se
 * renderiza a seção inteira ou um empty-state / CTA.
 */
export function hasAnyDadosPlaca(dadosPlaca) {
  return formatDadosPlacaRows(dadosPlaca).length > 0;
}
