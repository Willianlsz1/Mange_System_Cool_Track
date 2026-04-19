const VALID_STATUS = ['ok', 'warn', 'danger'];
const VALID_CRITICIDADE = ['baixa', 'media', 'alta', 'critica'];

const CRITICIDADE_WEIGHT = { baixa: 0, media: 1, alta: 2, critica: 3 };
const STATUS_WEIGHT = { sem_informacao: 0, ok: 1, atencao: 2, critico: 3 };

function normalizeStatus(status = '') {
  return VALID_STATUS.includes(status) ? status : '';
}

function normalizeCriticidade(value = 'media') {
  return VALID_CRITICIDADE.includes(value) ? value : 'media';
}

function hasOperationalData(equipment = {}) {
  return Boolean(equipment?.status || equipment?.lastStatus || equipment?.ultimoRegistro);
}

function getDaysToNext(equipment = {}) {
  return Number.isFinite(equipment.daysToNext) ? equipment.daysToNext : null;
}

export function getOperationalStatus(equipment = {}) {
  const status = normalizeStatus(equipment.status || equipment.lastStatus);
  const daysToNext = getDaysToNext(equipment);

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
  const daysToNext = getDaysToNext(equipment);
  const score = status.severityWeight * 10 + (CRITICIDADE_WEIGHT[criticidade] || 0);

  let level = 'baixa';
  if (status.code === 'critico') level = 'alta';
  else if (status.code === 'atencao') level = criticidade === 'critica' ? 'alta' : 'media';
  else if (status.code === 'sem_informacao') level = criticidade === 'critica' ? 'media' : 'baixa';
  else if (score >= 13) level = 'media';

  if (daysToNext != null && daysToNext >= 0 && daysToNext <= 7 && level === 'baixa') {
    level = 'media';
  }

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

  const daysToNext = getDaysToNext(equipment);

  if (status.code === 'atencao') {
    return {
      code: 'reavaliar_campo',
      label: 'Reavaliar equipamento em campo',
      requiresImmediateAction: false,
    };
  }

  if (daysToNext != null && daysToNext >= 0 && daysToNext <= 7) {
    return {
      code: 'programar_preventiva',
      label: 'Programar serviço preventivo',
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
  return 'monitoramento';
}

export function validateOperationalPayload({ data, status } = {}) {
  const errors = [];
  const now = Date.now();

  if (data) {
    const parsed = new Date(data);
    if (Number.isNaN(parsed.getTime())) errors.push('Data inválida.');
    else if (parsed.getTime() > now) errors.push('Data do serviço não pode estar no futuro.');
  }

  if (status && !VALID_STATUS.includes(status)) {
    errors.push('Status informado não é permitido.');
  }

  if (!data && status) {
    errors.push('Data é obrigatória quando status operacional é informado.');
  }

  return { valid: errors.length === 0, errors };
}
