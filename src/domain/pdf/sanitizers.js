const FORBIDDEN_SNIPPETS = [
  'onboarding',
  'texto de teste',
  'modo teste',
  'preencha no modal',
  'ultima manutencao registrada durante o onboarding',
];

const EMPTY_PLACEHOLDERS = [
  'cliente não identificado',
  'cliente nao identificado',
  'preencha no modal de registro',
  'local a definir',
  '—',
  '-',
];

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function sanitizePublicText(value, fallback = 'Não informado') {
  const raw = String(value || '').trim();
  if (!raw) return fallback;

  const normalized = normalize(raw);
  if (EMPTY_PLACEHOLDERS.some((item) => normalized === normalize(item))) return fallback;
  if (FORBIDDEN_SNIPPETS.some((item) => normalized.includes(item))) return fallback;

  return raw;
}

export function sanitizeObservation(value) {
  const safe = sanitizePublicText(value, 'Não informado');
  return safe.length > 800 ? `${safe.slice(0, 797)}...` : safe;
}

export function formatStatusConclusion({ warn = 0, danger = 0 } = {}) {
  if (danger > 0) return 'Equipamento requer intervenção corretiva para operação segura.';
  if (warn > 0) return 'Equipamento em funcionamento, com pontos de atenção recomendados.';
  return 'Equipamento operando normalmente após manutenção.';
}
