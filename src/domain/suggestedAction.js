import { getEquipmentMaintenanceContext, evaluateEquipmentRisk } from './maintenance.js';
import { PRIORITY_LEVEL, evaluateEquipmentPriority } from './priorityEngine.js';

export const ACTION_CODE = {
  NONE: 'nenhuma_acao',
  SCHEDULE_PREVENTIVE: 'programar_preventiva',
  REGISTER_PREVENTIVE: 'registrar_preventiva',
  REGISTER_CORRECTIVE: 'registrar_corretiva',
  REGISTER_CORRECTIVE_IMMEDIATE: 'registrar_corretiva_imediata',
  MONITOR: 'acompanhar_equipamento',
  REEVALUATE_FIELD: 'reavaliar_em_campo',
  CHECK_RECURRENT_CAUSE: 'verificar_causa_recorrente',
};

const ACTION_LABEL = {
  [ACTION_CODE.NONE]: 'Nenhuma ação imediata',
  [ACTION_CODE.SCHEDULE_PREVENTIVE]: 'Programar manutenção preventiva',
  [ACTION_CODE.REGISTER_PREVENTIVE]: 'Registrar manutenção preventiva',
  [ACTION_CODE.REGISTER_CORRECTIVE]: 'Registrar manutenção corretiva',
  [ACTION_CODE.REGISTER_CORRECTIVE_IMMEDIATE]: 'Registrar manutenção corretiva imediatamente',
  [ACTION_CODE.MONITOR]: 'Acompanhar equipamento',
  [ACTION_CODE.REEVALUATE_FIELD]: 'Reavaliar em campo',
  [ACTION_CODE.CHECK_RECURRENT_CAUSE]: 'Verificar causa recorrente',
};

function normalizeStatus(status = 'ok') {
  return ['ok', 'warn', 'danger'].includes(status) ? status : 'ok';
}

function hasStableCondition(conditionObserved = '') {
  return ['ok', 'estavel', 'normal'].includes(String(conditionObserved).toLowerCase());
}

function buildAction(actionCode, reasons) {
  return {
    actionCode,
    actionLabel: ACTION_LABEL[actionCode],
    actionReasons: reasons.slice(0, 3),
  };
}

export function calculateSuggestedAction({
  priorityLevel = PRIORITY_LEVEL.OK,
  priorityLabel = '',
  status = 'ok',
  riskScore = 0,
  preventiveOverdue = false,
  preventiveSoon = false,
  recentCorrectiveCount = 0,
  conditionObserved = '',
  criticidade = 'media',
} = {}) {
  const safeStatus = normalizeStatus(status);
  const highCriticidade = ['alta', 'critica'].includes(criticidade);

  if (safeStatus === 'danger') {
    return buildAction(ACTION_CODE.REGISTER_CORRECTIVE_IMMEDIATE, [
      'Equipamento fora de operação',
      'Intervenção imediata necessária',
      'Prioridade urgente',
    ]);
  }

  if (priorityLevel === PRIORITY_LEVEL.URGENTE) {
    return buildAction(ACTION_CODE.REGISTER_CORRECTIVE_IMMEDIATE, [
      'Prioridade urgente',
      highCriticidade ? 'Criticidade operacional alta' : 'Risco elevado no contexto atual',
      riskScore >= 70 ? 'Score de risco em nível crítico' : 'Atenção imediata recomendada',
    ]);
  }

  if (recentCorrectiveCount >= 2) {
    return buildAction(ACTION_CODE.CHECK_RECURRENT_CAUSE, [
      'Corretivas recentes recorrentes',
      'Risco de reincidência de falha',
      'Investigar causa raiz para evitar novas paradas',
    ]);
  }

  if (preventiveOverdue) {
    return buildAction(ACTION_CODE.REGISTER_PREVENTIVE, [
      'Preventiva vencida',
      'Rotina preventiva está atrasada',
      'Registrar preventiva para reduzir risco operacional',
    ]);
  }

  if (safeStatus === 'warn') {
    return buildAction(ACTION_CODE.REEVALUATE_FIELD, [
      'Equipamento operando com restrições',
      'Condição fora do padrão operacional',
      'Reavaliar situação no local',
    ]);
  }

  if (priorityLevel === PRIORITY_LEVEL.ALTA) {
    return buildAction(ACTION_CODE.REGISTER_CORRECTIVE, [
      priorityLabel ? `Prioridade ${priorityLabel.toLowerCase()}` : 'Prioridade elevada para ação',
      riskScore >= 60 ? 'Score de risco moderado/alto' : 'Contexto exige ação no mesmo dia',
      'Registrar manutenção para rastreabilidade',
    ]);
  }

  if (preventiveSoon) {
    return buildAction(ACTION_CODE.SCHEDULE_PREVENTIVE, [
      'Preventiva próxima do vencimento',
      'Planejar janela de manutenção',
      'Evitar avanço para cenário de urgência',
    ]);
  }

  if (priorityLevel === PRIORITY_LEVEL.MONITORAR) {
    return buildAction(ACTION_CODE.MONITOR, [
      'Prioridade em monitoramento',
      'Acompanhar evolução do equipamento',
      'Registrar sinais de desvio em campo',
    ]);
  }

  if (riskScore <= 40 && hasStableCondition(conditionObserved)) {
    return buildAction(ACTION_CODE.NONE, [
      'Risco baixo no momento',
      'Condição estável conforme registros',
      'Sem fator relevante para ação imediata',
    ]);
  }

  return buildAction(ACTION_CODE.MONITOR, [
    'Cenário sem urgência imediata',
    'Manter acompanhamento de rotina',
    'Revisar em próximo registro de campo',
  ]);
}

export function evaluateEquipmentSuggestedAction(equipamento, registros = []) {
  if (!equipamento) {
    return buildAction(ACTION_CODE.NONE, ['Equipamento não encontrado']);
  }

  const priority = evaluateEquipmentPriority(equipamento, registros);
  const context = getEquipmentMaintenanceContext(equipamento, registros);
  const risk = evaluateEquipmentRisk(equipamento, registros);

  return calculateSuggestedAction({
    priorityLevel: priority.priorityLevel,
    priorityLabel: priority.priorityLabel,
    status: context.equipamento.status,
    riskScore: risk.score,
    preventiveOverdue: context.daysToNext != null && context.daysToNext < 0,
    preventiveSoon:
      context.daysToNext != null && context.daysToNext >= 0 && context.daysToNext <= 7,
    recentCorrectiveCount: context.recentCorrectiveCount,
    conditionObserved: context.equipamento.status,
    criticidade: context.equipamento.criticidade,
  });
}
