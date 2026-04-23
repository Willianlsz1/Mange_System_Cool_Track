export const SETOR_NOME_MAX = 40;

export function validateSetorNome(rawValue) {
  const value = String(rawValue ?? '');
  const trimmed = value.trim();
  const empty = trimmed.length === 0;
  const tooLong = value.length > SETOR_NOME_MAX;

  return {
    raw: value,
    trimmed,
    empty,
    tooLong,
    isValid: !empty && !tooLong,
  };
}
