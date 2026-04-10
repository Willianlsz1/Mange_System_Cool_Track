const VALID_STATUS = ['ok', 'warn', 'danger'];
const CRITICIDADE_WEIGHT = { baixa: 0, media: 1, alta: 2, critica: 3 };
const STATUS_WEIGHT = { sem_informacao: 0, ok: 1, atencao: 2, critico: 3 };

function normalizeStatus(status = '') {
  return VALID_STATUS.includes(status) ? status : '';
}

function normalizeCriticidade(value = 'media') {
  return ['baixa', 'media', 'alta', 'critica'].includes(value) ? value : 'media';
}

function hasOperationalData(equipment = {}) {
  return Boolean(equipment?.status || equipment?.lastStatus || equipment?.ultimoRegistro);
}

export function getOperationalStatus(equipment = {}) {
  const status = normalizeStatus(equipment.status || equipment.lastStatus);
  const daysToNext = Number.isFinite(equipment.daysToNext) ? equipment.daysToNext : null;

  if (!hasOperationalData(equipment) && daysToNext == null) {
    return {
      code: 'sem_informacao',
      label: 'Sem informação',
      uiStatus: 'unknown',
      severityWeight: STATUS_WEIGHT.sem_informacao,
      reasons: ['Ausência de dados operacionais'],
    };
  }

  if (status === 'danger') {
    return {
      code: 'critico',
      label: 'Crítico',
      uiStatus: 'danger',
      severityWeight: STATUS_WEIGHT.critico,
      reasons: ['Equipamento fora de operação'],
    };
  }

  if (daysToNext != null && daysToNext < 0) {
    return {
      code: 'critico',
      label: 'Crítico',
      uiStatus: 'danger',
      severityWeight: STATUS_WEIGHT.critico,
      reasons: ['Preventiva vencida'],
    };
  }

  if (status === 'warn') {
    return {
      code: 'atencao',
      label: 'Atenção',
      uiStatus: 'warn',
      severityWeight: STATUS_WEIGHT.atencao,
      reasons: ['Equipamento com restrição operacional'],
    };
  }

  return {
    code: 'ok',
    label: 'OK',
    uiStatus: 'ok',
    severityWeight: STATUS_WEIGHT.ok,
    reasons: ['Operação normal'],
  };
}

export function getPriority(equipment = {}) {
  const status = getOperationalStatus(equipment);
  const criticidade = normalizeCriticidade(equipment.criticidade);
  const score = status.severityWeight * 10 + (CRITICIDADE_WEIGHT[criticidade] || 0);

  let level = 'baixa';
  if (status.code === 'critico' || score >= 22) level = 'alta';
  else if (status.code === 'atencao' || score >= 14) level = 'media';

  const requiresImmediateAction = level === 'alta';

  return {
    level,
    label: level === 'alta' ? 'Alta' : level === 'media' ? 'Média' : 'Baixa',
    score,
    statusCode: status.code,
    requiresImmediateAction,
    reasons: [...status.reasons, `Criticidade ${criticidade}`],
  };
}

export function getSuggestedAction(equipment = {}) {
  const status = getOperationalStatus(equipment);
  const priority = getPriority(equipment);

  if (priority.requiresImmediateAction) {
    if (status.reasons.includes('Preventiva vencida')) {
      return {
        code: 'acao_imediata_preventiva',
        label: 'Ação imediata obrigatória: registrar preventiva',
        requiresImmediateAction: true,
      };
    }

    return {
      code: 'acao_imediata_corretiva',
      label: 'Ação imediata obrigatória: registrar corretiva',
      requiresImmediateAction: true,
    };
  }

  if (status.code === 'atencao') {
    return {
      code: 'reavaliar_campo',
      label: 'Reavaliar equipamento em campo',
      requiresImmediateAction: false,
    };
  }

  if (status.code === 'sem_informacao') {
    return {
      code: 'coletar_dados',
      label: 'Coletar dados iniciais do equipamento',
      requiresImmediateAction: false,
    };
  }

  return {
    code: 'monitorar_rotina',
    label: 'Manter monitoramento de rotina',
    requiresImmediateAction: false,
  };
}

export function getActionBucket(equipment = {}) {
  const status = getOperationalStatus(equipment);
  if (status.code === 'critico') return 'critico';
  if (status.code === 'atencao') return 'atencao';
  if (status.code === 'sem_informacao') return 'monitoramento';
  return 'monitoramento';
}

export function validateOperationalPayload({ data, status } = {}) {
  const errors = [];
  const now = new Date();
  if (data) {
    const parsed = new Date(data);
    if (Number.isNaN(parsed.getTime())) errors.push('Data inválida.');
    else if (parsed.getTime() > now.getTime())
      errors.push('Data do serviço não pode estar no futuro.');
  }

  if (status && !VALID_STATUS.includes(status)) {
    errors.push('Status informado não é permitido.');
  }

  return { valid: errors.length === 0, errors };
}
