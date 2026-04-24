import { Utils } from '../../../core/utils.js';
import { parseDadosPlacaFloat } from '../../../domain/dadosPlacaValidation.js';

/**
 * IDs e paths dos 13 campos da etiqueta persistidos em `dados_placa` (JSONB).
 * Mapping UI input → key no JSON. Source of truth usado por:
 *   - collectDadosPlaca() — form → JSON (save)
 *   - restoreDadosPlaca() — JSON → form (edit)
 *   - clearDadosPlacaInputs() — reset no cleanup
 * Escondido em const pra evitar typos propagando entre os 3 lugares.
 */
export const DADOS_PLACA_FIELDS = [
  { inputId: 'eq-numero-serie', key: 'numero_serie', type: 'string' },
  { inputId: 'eq-capacidade-btu', key: 'capacidade_btu', type: 'int' },
  { inputId: 'eq-tensao', key: 'tensao', type: 'string' },
  { inputId: 'eq-frequencia', key: 'frequencia_hz', type: 'int' },
  { inputId: 'eq-fase', key: 'fases', type: 'int' },
  { inputId: 'eq-potencia', key: 'potencia_w', type: 'int' },
  {
    inputId: 'eq-corrente-refrig',
    key: 'corrente_refrig_a',
    type: 'float',
    label: 'Corrente refrig.',
    unit: 'A',
    max: 100,
  },
  {
    inputId: 'eq-corrente-aquec',
    key: 'corrente_aquec_a',
    type: 'float',
    label: 'Corrente aquec.',
    unit: 'A',
    max: 100,
  },
  {
    inputId: 'eq-pressao-suc',
    key: 'pressao_succao_mpa',
    type: 'float',
    label: 'Pressão sucção',
    unit: 'MPa',
    max: 10,
  },
  {
    inputId: 'eq-pressao-desc',
    key: 'pressao_descarga_mpa',
    type: 'float',
    label: 'Pressão descarga',
    unit: 'MPa',
    max: 10,
  },
  { inputId: 'eq-grau-protecao', key: 'grau_protecao', type: 'string' },
  { inputId: 'eq-ano-fabricacao', key: 'ano_fabricacao', type: 'int' },
];

export const DADOS_PLACA_INPUT_IDS = DADOS_PLACA_FIELDS.map((f) => f.inputId);

/**
 * Lê os 12 inputs da etiqueta e monta o objeto `dados_placa` pro DB.
 * Omite campos vazios (ao invés de `null`) pra manter o JSON compacto.
 *
 * Delega parsing decimal + range check pra parseDadosPlacaFloat (módulo puro,
 * testável). Quando um valor decimal ultrapassa o range plausível (sinal de
 * separador decimal esquecido, ex: "42" em vez de "4,2"), propaga
 * DadosPlacaValidationError pro saveEquip tratar com Toast + foco no input.
 */
export function collectDadosPlaca() {
  const result = {};
  for (const field of DADOS_PLACA_FIELDS) {
    const { inputId, key, type } = field;
    const raw = Utils.getVal(inputId);
    if (raw == null || raw === '') continue;
    if (type === 'int') {
      const n = parseInt(raw, 10);
      if (!Number.isNaN(n)) result[key] = n;
    } else if (type === 'float') {
      const n = parseDadosPlacaFloat(raw, field);
      if (n !== null) result[key] = n;
    } else {
      result[key] = String(raw).trim();
    }
  }
  return result;
}

/**
 * Popula os inputs da etiqueta a partir de um objeto `dados_placa` salvo.
 * Ignora chaves desconhecidas — se um dia deprecarmos um campo, não quebra.
 */
export function restoreDadosPlaca(dadosPlaca) {
  if (!dadosPlaca || typeof dadosPlaca !== 'object') return;
  for (const { inputId, key } of DADOS_PLACA_FIELDS) {
    const value = dadosPlaca[key];
    if (value == null) continue;
    Utils.setVal(inputId, String(value));
  }
}
