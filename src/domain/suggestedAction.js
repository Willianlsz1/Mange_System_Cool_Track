import { getEquipmentMaintenanceContext } from './maintenance.js';
import { PRIORITY_LEVEL, evaluateEquipmentPriority } from './priorityEngine.js';
import { getSuggestedAction as getCentralSuggestedAction } from '../core/equipmentRules.js';

export const ACTION_CODE = {
  NONE: 'nenhuma_acao',
  SCHEDULE_PREVENTIVE: 'programar_preventiva',
  REGISTER_PREVENTIVE: 'registrar_preventiva',
  REGISTER_CORRECTIVE: 'registrar_corretiva',
  REGISTER_CORRECTIVE_IMMEDIATE: 'registrar_corretiva_imediata',
  MONITOR: 'acompanhar_equipamento',
  REEVALUATE_FIELD: 'reavaliar_em_campo',
  CHECK_RECURRENT_CAUSE: 'verificar_causa_recorrente',
  COLLECT_DATA: 'coletar_dados',
};

const ACTION_LABEL = {
  [ACTION_CODE.NONE]: 'Nenhuma ação imediata',
  [ACTION_CODE.SCHEDULE_PREVENTIVE]: 'Programar serviço preventivo',
  [ACTION_CODE.REGISTER_PREVENTIVE]: 'Registrar serviço preventivo',
  [ACTION_CODE.REGISTER_CORRECTIVE]: 'Registrar serviço corretivo',
  [ACTION_CODE.REGISTER_CORRECTIVE_IMMEDIATE]: 'Registrar serviço corretivo imediatamente',
  [ACTION_CODE.MONITOR]: 'Acompanhar equipamento',
  [ACTION_CODE.REEVALUATE_FIELD]: 'Reavaliar em campo',
  [ACTION_CODE.CHECK_RECURRENT_CAUSE]: 'Verificar causa recorrente',
  [ACTION_CODE.COLLECT_DATA]: 'Coletar dados iniciais',
};

function buildAction(actionCode, reasons) {
  return {
    actionCode,
    actionLabel: ACTION_LABEL[actionCode],
    actionReasons: reasons.slice(0, 3),
  };
}

export function calculateSuggestedAction({
  priorityLevel = PRIORITY_LEVEL.OK,
  status = 'ok',
  preventiveOverdue = false,
  preventiveSoon = false,
  recentCorrectiveCount = 0,
  criticidade = 'media',
} = {}) {
  const centralAction = getCentralSuggestedAction({
    status,
    criticidade,
    daysToNext: preventiveOverdue ? -1 : preventiveSoon ? 3 : null,
  });

  if (centralAction.code === 'acao_imediata_corretiva') {
    return buildAction(ACTION_CODE.REGISTER_CORRECTIVE_IMMEDIATE, [
      'Equipamento fora de operação',
      'Intervenção imediata necessária',
      'Ação imediata obrigatória',
    ]);
  }

  if (centralAction.code === 'acao_imediata_preventiva') {
    return buildAction(ACTION_CODE.REGISTER_PREVENTIVE, [
      'Preventiva vencida',
      'Registrar serviço preventivo imediatamente',
      'Ação imediata obrigatória',
    ]);
  }

  if (centralAction.code === 'reavaliar_campo') {
    return buildAction(ACTION_CODE.REEVALUATE_FIELD, [
      'Equipamento operando com restrições',
      'Condição fora do padrão operacional',
      'Reavaliar situação no local',
    ]);
  }

  if (centralAction.code === 'programar_preventiva') {
    return buildAction(ACTION_CODE.SCHEDULE_PREVENTIVE, [
      'Preventiva próxima do vencimento',
      'Planejar janela de manutenção',
      'Evitar avanço para cenário crítico',
    ]);
  }

  if (centralAction.code === 'coletar_dados') {
    return buildAction(ACTION_CODE.COLLECT_DATA, [
      'Sem informação operacional',
      'Não há histórico suficiente',
      'Coletar dados para classificação',
    ]);
  }

  if (recentCorrectiveCount >= 2) {
    return buildAction(ACTION_CODE.CHECK_RECURRENT_CAUSE, [
      'Corretivas recentes recorrentes',
      'Risco de reincidência de falha',
      'Investigar causa raiz para evitar novas paradas',
    ]);
  }

  if (priorityLevel >= PRIORITY_LEVEL.ALTA && status !== 'ok') {
    return buildAction(ACTION_CODE.REGISTER_CORRECTIVE, [
      'Prioridade elevada para ação',
      'Contexto exige intervenção no mesmo dia',
      'Registrar serviço para rastreabilidade',
    ]);
  }

  return buildAction(ACTION_CODE.MONITOR, [
    'Cenário sem urgência imediata',
    'Manter acompanhamento de rotina',
    'Revisar no próximo serviço de campo',
  ]);
}

export function evaluateEquipmentSuggestedAction(equipamento, registros = []) {
  if (!equipamento) {
    return buildAction(ACTION_CODE.NONE, ['Equipamento não encontrado']);
  }

  const priority = evaluateEquipmentPriority(equipamento, registros);
  const context = getEquipmentMaintenanceContext(equipamento, registros);

  return calculateSuggestedAction({
    priorityLevel: priority.priorityLevel,
    status: context.equipamento.status,
    preventiveOverdue: context.daysToNext != null && context.daysToNext < 0,
    preventiveSoon:
      context.daysToNext != null && context.daysToNext >= 0 && context.daysToNext <= 7,
    recentCorrectiveCount: context.recentCorrectiveCount,
    criticidade: context.equipamento.criticidade,
  });
}
