import { evaluateEquipmentRisk, getEquipmentMaintenanceContext } from './maintenance.js';
import { getPriority as getCentralPriority, getSuggestedAction } from '../core/equipmentRules.js';

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

function toPriorityLevel(centralPriority, statusCode) {
  if (statusCode === 'critico') return PRIORITY_LEVEL.URGENTE;
  if (centralPriority.level === 'alta') return PRIORITY_LEVEL.ALTA;
  if (centralPriority.level === 'media') return PRIORITY_LEVEL.MONITORAR;
  return PRIORITY_LEVEL.OK;
}

function toSuggestedActionText(suggestedAction) {
  if (suggestedAction.code === 'acao_imediata_corretiva')
    return 'Registrar serviço corretivo imediatamente';
  if (suggestedAction.code === 'acao_imediata_preventiva')
    return 'Registrar serviço preventivo imediatamente';
  if (suggestedAction.code === 'reavaliar_campo') return 'Reavaliar em campo';
  if (suggestedAction.code === 'programar_preventiva') return 'Programar serviço preventivo';
  if (suggestedAction.code === 'coletar_dados') return 'Coletar dados iniciais';
  return 'Nenhuma ação imediata';
}

export function calculateActionPriority({
  riskScore = 0,
  criticidade = 'media',
  status = 'ok',
  daysToNext = null,
  recentCorrectiveCount = 0,
} = {}) {
  const normalized = {
    riskScore: Number.isFinite(riskScore) ? riskScore : 0,
    criticidade: normalizeCriticidade(criticidade),
    status: normalizeStatus(status),
    daysToNext,
    recentCorrectiveCount: Number.isFinite(recentCorrectiveCount) ? recentCorrectiveCount : 0,
  };

  const central = getCentralPriority(normalized);
  const action = getSuggestedAction(normalized);
  const statusCode = central.statusCode;

  const priorityLevel = toPriorityLevel(central, statusCode);
  const reasons = [...central.reasons];
  if (normalized.recentCorrectiveCount >= 2)
    reasons.push('Histórico recente de corretivas repetidas');
  if (normalized.riskScore >= 70) reasons.push('Score de risco elevado');

  return {
    priorityLevel,
    priorityLabel: PRIORITY_LABEL[priorityLevel],
    priorityReasons: [...new Set(reasons)].slice(0, 3),
    suggestedAction: toSuggestedActionText(action),
  };
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
