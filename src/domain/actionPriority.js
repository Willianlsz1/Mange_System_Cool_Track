import { evaluateEquipmentRisk, getEquipmentMaintenanceContext } from './maintenance.js';
import { evaluateEquipmentPriority } from './priorityEngine.js';
import { evaluateEquipmentSuggestedAction } from './suggestedAction.js';
import { getActionBucket as getCentralActionBucket, getOperationalStatus } from '../core/equipmentRules.js';

const CRITICIDADE_WEIGHT = { baixa: 4, media: 10, alta: 20, critica: 24 };
const BUCKET_WEIGHT = { critico: 3, atencao: 2, monitoramento: 1 };

function normalizeCriticidade(value = 'media') {
  return ['baixa', 'media', 'alta', 'critica'].includes(value) ? value : 'media';
}

export function getActionPriorityScore(equipment, registros = []) {
  if (!equipment) {
    return {
      actionPriorityScore: 0,
      group: 'monitoramento',
      reasons: ['Equipamento não encontrado'],
      suggestedAction: evaluateEquipmentSuggestedAction(null, []),
    };
  }

  const context = getEquipmentMaintenanceContext(equipment, registros);
  const risk = evaluateEquipmentRisk(equipment, registros);
  const priority = evaluateEquipmentPriority(equipment, registros);
  const suggestedAction = evaluateEquipmentSuggestedAction(equipment, registros);
  const criticidade = normalizeCriticidade(context.equipamento.criticidade);

  let score = 0;
  const reasons = [];

  if (context.equipamento.status === 'danger') {
    score += 50;
    reasons.push('Fora de operação');
  }

  if (context.daysToNext != null && context.daysToNext < 0) {
    score += 30;
    reasons.push('Preventiva vencida');
  }

  score += priority.priorityLevel * 12;
  if (priority.priorityLevel >= 3)
    reasons.push(`Prioridade ${priority.priorityLabel.toLowerCase()}`);

  score += CRITICIDADE_WEIGHT[criticidade] || 0;
  if (criticidade === 'alta' || criticidade === 'critica') {
    reasons.push(`Criticidade ${criticidade}`);
  }

  if (context.recentCorrectiveCount > 0) {
    score += context.recentCorrectiveCount * 10;
    reasons.push('Corretiva recente');
  }

  score += Math.round(risk.score * 0.35);
  if (risk.score >= 70) reasons.push('Score de risco elevado');

  const group = getActionBucket({
    status: context.equipamento.status,
    daysToNext: context.daysToNext,
    riskScore: risk.score,
    ultimoRegistro: context.ultimoRegistro,
  });

  score += BUCKET_WEIGHT[group] * 100;

  return {
    actionPriorityScore: score,
    group,
    reasons: reasons.slice(0, 3),
    suggestedAction,
  };
}

export function getActionBucket({ status = 'ok', daysToNext = null, riskScore = 0, ultimoRegistro = null } = {}) {
  const central = getCentralActionBucket({ status, daysToNext, ultimoRegistro });
  if (central === 'critico') return 'critico';
  if (central === 'atencao') return 'atencao';

  const op = getOperationalStatus({ status, daysToNext, ultimoRegistro });
  if (op.code === 'atencao' || riskScore >= 60) return 'atencao';
  return 'monitoramento';
}
