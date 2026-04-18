const CRITICIDADE_MULTIPLIER = {
  baixa: 1,
  media: 1.1,
  alta: 1.25,
  critica: 1.4,
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function getCriticidadeMultiplier(criticidade = 'media') {
  return CRITICIDADE_MULTIPLIER[criticidade] || CRITICIDADE_MULTIPLIER.media;
}

export function classifyRiskScore(score) {
  if (score >= 75) return 'alto';
  if (score >= 40) return 'medio';
  return 'baixo';
}

export function getRiskClassLabel(riskClass) {
  if (riskClass === 'alto') return 'Alto risco';
  if (riskClass === 'medio') return 'Médio risco';
  return 'Baixo risco';
}

export function calculateFinalRiskScore({ baseTechnicalRisk = 0, criticidade = 'media' } = {}) {
  const multiplier = getCriticidadeMultiplier(criticidade);
  const technicalRisk = clamp(Math.round(baseTechnicalRisk), 0, 100);
  const finalRisk = clamp(Math.round(technicalRisk * multiplier), 0, 100);

  return {
    technicalRisk,
    multiplier,
    finalRisk,
    classification: classifyRiskScore(finalRisk),
  };
}
