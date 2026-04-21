/**
 * CoolTrack Pro — Validação de ranges plausíveis dos campos decimais da etiqueta.
 *
 * Problema de UX: o usuário BR digita separador decimal errado (esquece a
 * vírgula) e acaba enviando "42" onde deveria ser "4,2". Como HTML5 aceita
 * inteiros em campos `type=number step=0.1`, o valor passa pelo form e vai
 * pro DB distorcendo tudo (uma corrente de 42A é ~10x o plausível pra split).
 *
 * Solução: range guard por campo. Se o número normalizado passa do máximo
 * plausível, lançamos erro com hint específico sugerindo a vírgula no lugar
 * certo. Ranges calibrados pra cobrir >99% dos equipamentos reais:
 *   - Corrente (A): até 100 A (splits grandes vão até ~30A; VRF ~60A)
 *   - Pressão (MPa): até 10 MPa (R-410A em descarga atinge ~5 MPa)
 */

export class DadosPlacaValidationError extends Error {
  constructor({ inputId, label, unit, value, max }) {
    super(`${label} (${unit}) fora do range plausível: ${value} > ${max}`);
    this.name = 'DadosPlacaValidationError';
    this.inputId = inputId;
    this.label = label;
    this.unit = unit;
    this.value = value;
    this.max = max;
  }
}

/**
 * Parseia uma string/número de input decimal, aceitando vírgula como
 * separador (pt-BR). Retorna `null` se a string é vazia/whitespace ou não
 * parseável — nesse caso o caller deve omitir o campo do payload.
 *
 * Se o número é válido mas ultrapassa `fieldSpec.max`, lança
 * `DadosPlacaValidationError` com os metadados necessários pro caller
 * mostrar Toast + focar o input culpado.
 *
 * @param {string|number|null|undefined} raw
 * @param {{ inputId: string, label: string, unit: string, max?: number }} fieldSpec
 * @returns {number|null}
 */
export function parseDadosPlacaFloat(raw, fieldSpec) {
  if (raw == null || raw === '') return null;
  const normalized = typeof raw === 'string' ? raw.replace(',', '.').trim() : raw;
  if (normalized === '') return null;
  const n = parseFloat(normalized);
  if (!Number.isFinite(n)) return null;
  if (typeof fieldSpec?.max === 'number' && n > fieldSpec.max) {
    throw new DadosPlacaValidationError({
      inputId: fieldSpec.inputId,
      label: fieldSpec.label,
      unit: fieldSpec.unit,
      value: n,
      max: fieldSpec.max,
    });
  }
  return n;
}

/**
 * Formata um hint amigável com a sugestão de como o valor deveria ser
 * digitado. Ex: valor=42, sugere "4,2" (divide por 10). Usado no Toast
 * quando DadosPlacaValidationError dispara.
 */
export function formatDecimalHint(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '';
  return (value / 10).toFixed(1).replace('.', ',');
}
