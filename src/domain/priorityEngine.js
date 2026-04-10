import { evaluateEquipmentRisk, getEquipmentMaintenanceContext } from './maintenance.js';

export const PRIORITY_LEVEL = {
  OK: 1,
  MONITORAR: 2,
  ALTA: 3,
  URGENTE: 4,
};

export const PRIORITY_LABEL = {
  [PRIORITY_LEVEL.OK]: 'OK',
  [PRIORITY_LEVEL.MONITORAR]: 'Monitorar',
  [PRIORITY_LEVEL.ALTA]: 'Alta prioridade',
  [PRIORITY_LEVEL.URGENTE]: 'Urgente',
};

function normalizeCriticidade(value = 'media') {
  return ['baixa', 'media', 'alta', 'critica'].includes(value) ? value : 'media';
}

function normalizeStatus(value = 'ok') {
  return ['ok', 'warn', 'danger'].includes(value) ? value : 'ok';
}

function buildSuggestedAction(level, status) {
  if (level === PRIORITY_LEVEL.URGENTE) {
    return status === 'danger'
      ? 'Registrar corretiva imediatamente'
      : 'Intervenção imediata / registrar corretiva';
  }
  if (level === PRIORITY_LEVEL.ALTA) return 'Registrar manutenção';
  if (level === PRIORITY_LEVEL.MONITORAR) return 'Programar preventiva';
  return 'Nenhuma ação imediata';
}

function classifyPriority({ status, riskScore, criticidade, daysToNext, recentCorrectiveCount }) {
  const reasons = [];
  let level = PRIORITY_LEVEL.OK;

  const highCriticidade = criticidade === 'alta' || criticidade === 'critica';
  const hasOverduePreventive = daysToNext != null && daysToNext < 0;
  const hasNearPreventive = daysToNext != null && daysToNext >= 0 && daysToNext <= 7;
  const hasCorrectiveRecurrence = recentCorrectiveCount >= 2;

  if (status === 'danger') {
    level = PRIORITY_LEVEL.URGENTE;
    reasons.push('Equipamento fora de operação');
  } else if (status === 'warn') {
    level = Math.max(level, PRIORITY_LEVEL.ALTA);
    reasons.push('Operando com restrições');
  }

  if (criticidade === 'critica') reasons.push('Criticidade operacional crítica');
  else if (criticidade === 'alta') reasons.push('Criticidade operacional alta');

  if (hasOverduePreventive) {
    level = Math.max(level, PRIORITY_LEVEL.ALTA);
    reasons.push('Preventiva vencida');
  } else if (hasNearPreventive) {
    level = Math.max(level, PRIORITY_LEVEL.MONITORAR);
    reasons.push('Preventiva próxima do vencimento');
  }

  if (recentCorrectiveCount === 1) {
    level = Math.max(level, PRIORITY_LEVEL.ALTA);
    reasons.push('Corretiva recente registrada');
  }

  if (hasCorrectiveRecurrence) {
    level = Math.max(level, PRIORITY_LEVEL.URGENTE);
    reasons.push('Histórico recente de corretivas repetidas');
  }

  if (riskScore >= 80 && highCriticidade) {
    level = PRIORITY_LEVEL.URGENTE;
    reasons.push('Score de risco elevado com criticidade relevante');
  } else if (riskScore >= 65) {
    level = Math.max(level, PRIORITY_LEVEL.ALTA);
    reasons.push('Score de risco moderado/alto');
  } else if (riskScore >= 45) {
    level = Math.max(level, PRIORITY_LEVEL.MONITORAR);
    reasons.push('Score de risco em atenção');
  }

  const strongSignals = [
    status === 'danger',
    hasOverduePreventive,
    highCriticidade,
    hasCorrectiveRecurrence,
    riskScore >= 70,
  ].filter(Boolean).length;

  if (strongSignals >= 3 && level < PRIORITY_LEVEL.URGENTE) {
    level = PRIORITY_LEVEL.URGENTE;
    reasons.push('Combinação de fatores críticos no equipamento');
  }

  if (!reasons.length) {
    reasons.push('Operação normal sem fatores relevantes');
  }

  return {
    priorityLevel: level,
    priorityLabel: PRIORITY_LABEL[level],
    priorityReasons: reasons.slice(0, 3),
    suggestedAction: buildSuggestedAction(level, status),
  };
}

export function calculateActionPriority({
  riskScore = 0,
  criticidade = 'media',
  status = 'ok',
  daysToNext = null,
  recentCorrectiveCount = 0,
} = {}) {
  return classifyPriority({
    riskScore: Number.isFinite(riskScore) ? riskScore : 0,
    criticidade: normalizeCriticidade(criticidade),
    status: normalizeStatus(status),
    daysToNext,
    recentCorrectiveCount: Number.isFinite(recentCorrectiveCount) ? recentCorrectiveCount : 0,
  });
}

export function evaluateEquipmentPriority(equipamento, registros = []) {
  if (!equipamento) {
    return {
      priorityLevel: PRIORITY_LEVEL.OK,
      priorityLabel: PRIORITY_LABEL[PRIORITY_LEVEL.OK],
      priorityReasons: ['Equipamento não encontrado'],
      suggestedAction: 'Nenhuma ação imediata',
    };
  }

  const risk = evaluateEquipmentRisk(equipamento, registros);
  const context = getEquipmentMaintenanceContext(equipamento, registros);

  return calculateActionPriority({
    riskScore: risk.score,
    criticidade: context.equipamento.criticidade,
    status: context.equipamento.status,
    daysToNext: context.daysToNext,
    recentCorrectiveCount: context.recentCorrectiveCount,
  });
}
