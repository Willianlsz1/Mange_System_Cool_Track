import { Utils } from '../core/utils.js';

export const CRITICIDADE_LABEL = {
  baixa: 'Baixa',
  media: 'Media',
  alta: 'Alta',
  critica: 'Critica',
};

export const PRIORIDADE_OPERACIONAL_LABEL = {
  baixa: 'Baixa',
  normal: 'Normal',
  alta: 'Alta',
};

const PERIODICIDADE_PREVENTIVA_BASE = {
  split_hi_wall: 90,
  split_cassette: 90,
  split_piso_teto: 60,
  vrf_vrv: 45,
  chiller: 30,
  fan_coil: 60,
  self_contained: 60,
  roof_top: 45,
  camara_fria: 30,
  outro: 60,
};

export const PERIODICIDADE_PREVENTIVA_POR_TIPO = {
  'Split Hi-Wall': PERIODICIDADE_PREVENTIVA_BASE.split_hi_wall,
  'Split Cassette': PERIODICIDADE_PREVENTIVA_BASE.split_cassette,
  'Split Piso Teto': PERIODICIDADE_PREVENTIVA_BASE.split_piso_teto,
  'VRF / VRV': PERIODICIDADE_PREVENTIVA_BASE.vrf_vrv,
  Chiller: PERIODICIDADE_PREVENTIVA_BASE.chiller,
  'Fan Coil': PERIODICIDADE_PREVENTIVA_BASE.fan_coil,
  'Self Contained': PERIODICIDADE_PREVENTIVA_BASE.self_contained,
  'Roof Top': PERIODICIDADE_PREVENTIVA_BASE.roof_top,
  'CÃ¢mara Fria': PERIODICIDADE_PREVENTIVA_BASE.camara_fria,
  'Camara Fria': PERIODICIDADE_PREVENTIVA_BASE.camara_fria,
  'Camera Fria': PERIODICIDADE_PREVENTIVA_BASE.camara_fria,
  Outro: PERIODICIDADE_PREVENTIVA_BASE.outro,
};

const CRITICIDADE_VALUES = Object.keys(CRITICIDADE_LABEL);
const PRIORIDADE_OPERACIONAL_VALUES = Object.keys(PRIORIDADE_OPERACIONAL_LABEL);
const CRITICIDADE_FACTOR = { baixa: 1.15, media: 1, alta: 0.85, critica: 0.7 };
const CRITICIDADE_HEALTH_WEIGHT = { baixa: 0, media: 4, alta: 8, critica: 12 };
const ALERT_PRIORITY_WEIGHT = { baixa: 4, media: 10, alta: 18, critica: 28 };
const OPERACIONAL_WEIGHT = { baixa: 0, normal: 6, alta: 14 };

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function sortRegistrosDesc(registros = []) {
  return [...registros].sort((a, b) => b.data.localeCompare(a.data));
}

function parseIsoDate(value) {
  if (!value) return '';
  const date = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '';
}

function addDays(isoDate, days) {
  const source = parseIsoDate(isoDate);
  if (!source) return '';
  const date = new Date(`${source}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  date.setDate(date.getDate() + days);
  return Utils.localDateString(date);
}

function getDaysSince(dateLike) {
  const isoDate = parseIsoDate(dateLike);
  if (!isoDate) return 0;
  return Math.max(0, Utils.daysDiff(isoDate) * -1);
}

function getStatusPenalty(status) {
  if (status === 'danger') return 36;
  if (status === 'warn') return 16;
  return 0;
}

function getTipoKey(tipo) {
  const raw = String(tipo || '').trim();
  if (!raw) return 'outro';

  if (
    raw.includes('Fria') &&
    (raw.includes('Camara') ||
      raw.includes('Camera') ||
      raw.includes('Câmara') ||
      raw.includes('CÃ¢mara'))
  ) {
    return 'camara_fria';
  }

  const aliases = {
    'Split Hi-Wall': 'split_hi_wall',
    'Split Cassette': 'split_cassette',
    'Split Piso Teto': 'split_piso_teto',
    'VRF / VRV': 'vrf_vrv',
    Chiller: 'chiller',
    'Fan Coil': 'fan_coil',
    'Self Contained': 'self_contained',
    'Roof Top': 'roof_top',
  };

  return aliases[raw] || 'outro';
}

function getLeadAlertDays(equipamento) {
  const periodicidade = getPreventiveDays(equipamento);
  const criticidade = normalizeCriticidade(equipamento?.criticidade);
  const minLead =
    criticidade === 'critica' ? 10 : criticidade === 'alta' ? 7 : criticidade === 'baixa' ? 3 : 5;
  return Math.max(minLead, Math.round(periodicidade * 0.15));
}

function getPreventivePenalty(daysToNext) {
  if (daysToNext == null) return 0;
  if (daysToNext < -30) return 24;
  if (daysToNext < -7) return 18;
  if (daysToNext < 0) return 10;
  if (daysToNext <= 7) return 5;
  return 0;
}

function getAgePenalty(daysSinceLast, periodicidadeDias) {
  if (!periodicidadeDias) return 0;
  const ratio = daysSinceLast / periodicidadeDias;
  if (ratio >= 1.5) return 22;
  if (ratio >= 1.15) return 14;
  if (ratio >= 0.85) return 6;
  return 0;
}

function getRecentIssuePenalty(registrosRecentes) {
  const issueCount = registrosRecentes.filter(
    (registro) => registro.status === 'warn' || registro.status === 'danger',
  ).length;
  if (issueCount >= 3) return 14;
  if (issueCount === 2) return 10;
  if (issueCount === 1) return 4;
  return 0;
}

function getCorrectivePenalty(registrosRecentes) {
  const correctiveCount = registrosRecentes.filter((registro) =>
    isCorrectiveService(registro?.tipo),
  ).length;
  return correctiveCount >= 2 ? 8 : 0;
}

function getOperationalPenalty(equipamento, context) {
  const criticidade = normalizeCriticidade(equipamento?.criticidade);
  const prioridade = normalizePrioridadeOperacional(equipamento?.prioridadeOperacional);
  let penalty = CRITICIDADE_HEALTH_WEIGHT[criticidade];

  if (prioridade === 'alta' && context.equipamento.status !== 'ok') {
    penalty += 6;
  } else if (prioridade === 'alta' && context.daysToNext != null && context.daysToNext <= 7) {
    penalty += 3;
  }

  return penalty;
}

function formatDueLabel(daysToNext) {
  if (daysToNext == null) return 'sem agenda preventiva';
  if (daysToNext < 0) {
    const atraso = Math.abs(daysToNext);
    return `atrasada ha ${atraso} dia${atraso === 1 ? '' : 's'}`;
  }
  if (daysToNext === 0) return 'vence hoje';
  return `vence em ${daysToNext} dia${daysToNext === 1 ? '' : 's'}`;
}

function getAlertScore(equipamento, health) {
  return (
    ALERT_PRIORITY_WEIGHT[normalizeCriticidade(equipamento?.criticidade)] +
    OPERACIONAL_WEIGHT[normalizePrioridadeOperacional(equipamento?.prioridadeOperacional)] +
    (100 - health.score)
  );
}

export function normalizeCriticidade(value, fallback = 'media') {
  return CRITICIDADE_VALUES.includes(value) ? value : fallback;
}

export function normalizePrioridadeOperacional(value, fallback = 'normal') {
  return PRIORIDADE_OPERACIONAL_VALUES.includes(value) ? value : fallback;
}

export function getSuggestedPreventiveDays(tipo, criticidade = 'media') {
  const tipoKey = getTipoKey(tipo);
  const baseDays = PERIODICIDADE_PREVENTIVA_BASE[tipoKey] || PERIODICIDADE_PREVENTIVA_BASE.outro;
  const factor = CRITICIDADE_FACTOR[normalizeCriticidade(criticidade)];
  return clamp(Math.round((baseDays * factor) / 5) * 5, 15, 180);
}

export function normalizePeriodicidadePreventivaDias(value, tipo, criticidade = 'media') {
  const numeric = Number.parseInt(value, 10);
  if (Number.isFinite(numeric)) return clamp(numeric, 15, 365);
  return getSuggestedPreventiveDays(tipo, criticidade);
}

export function normalizeEquipmentMaintenanceData(equipamento = {}) {
  return {
    criticidade: normalizeCriticidade(equipamento.criticidade),
    prioridadeOperacional: normalizePrioridadeOperacional(
      equipamento.prioridadeOperacional || equipamento.prioridade,
    ),
    periodicidadePreventivaDias: normalizePeriodicidadePreventivaDias(
      equipamento.periodicidadePreventivaDias,
      equipamento.tipo,
      equipamento.criticidade,
    ),
  };
}

export function getPreventiveDays(equipamento = {}) {
  return normalizePeriodicidadePreventivaDias(
    equipamento.periodicidadePreventivaDias,
    equipamento.tipo,
    equipamento.criticidade,
  );
}

export function isCorrectiveService(tipo = '') {
  const normalized = String(tipo || '').toLowerCase();
  return (
    normalized.includes('corretiva') ||
    normalized.includes('compressor') ||
    normalized.includes('capacitor') ||
    normalized.includes('vazamento')
  );
}

export function getEquipmentMaintenanceContext(equipamento, registros = []) {
  const normalizedEquip = {
    ...equipamento,
    ...normalizeEquipmentMaintenanceData(equipamento),
  };
  const registrosOrdenados = sortRegistrosDesc(registros);
  const ultimoRegistro = registrosOrdenados[0] || null;
  const periodicidadeDias = getPreventiveDays(normalizedEquip);
  const proximaProgramada = parseIsoDate(ultimoRegistro?.proxima);
  const proximaCalculada =
    proximaProgramada || (ultimoRegistro ? addDays(ultimoRegistro.data, periodicidadeDias) : '');
  const daysToNext = proximaCalculada ? Utils.daysDiff(proximaCalculada) : null;
  const daysSinceLast = ultimoRegistro ? getDaysSince(ultimoRegistro.data) : null;
  const registrosRecentes = registrosOrdenados.slice(0, 3);

  return {
    equipamento: normalizedEquip,
    registrosOrdenados,
    ultimoRegistro,
    periodicidadeDias,
    proximaPreventiva: proximaCalculada,
    daysToNext,
    daysSinceLast,
    registrosRecentes,
    recentIssueCount: registrosRecentes.filter(
      (registro) => registro.status === 'warn' || registro.status === 'danger',
    ).length,
    recentCorrectiveCount: registrosRecentes.filter((registro) =>
      isCorrectiveService(registro.tipo),
    ).length,
    leadAlertDays: getLeadAlertDays(normalizedEquip),
  };
}

export function evaluateEquipmentHealth(equipamento, registros = []) {
  if (!equipamento) {
    return { score: 0, reasons: ['Equipamento nao encontrado'], context: null };
  }

  const context = getEquipmentMaintenanceContext(equipamento, registros);
  let penalty = getStatusPenalty(context.equipamento.status);
  const reasons = [];

  if (penalty > 0) {
    reasons.push(
      context.equipamento.status === 'danger' ? 'fora de operacao' : 'operando com atencao',
    );
  }

  if (!context.ultimoRegistro) {
    penalty += 22;
    reasons.push('sem historico tecnico');
  } else {
    const agePenalty = getAgePenalty(context.daysSinceLast, context.periodicidadeDias);
    const nextPenalty = getPreventivePenalty(context.daysToNext);
    const recentPenalty = getRecentIssuePenalty(context.registrosRecentes);
    const correctivePenalty = getCorrectivePenalty(context.registrosRecentes);

    penalty += agePenalty + nextPenalty + recentPenalty + correctivePenalty;

    if (agePenalty > 0) reasons.push('intervalo acima da rotina preventiva');
    if (nextPenalty > 0 && context.daysToNext != null)
      reasons.push(formatDueLabel(context.daysToNext));
    if (recentPenalty > 0) reasons.push('ocorrencias recorrentes recentes');
    if (correctivePenalty > 0) reasons.push('historico corretivo repetitivo');
  }

  const operationalPenalty = getOperationalPenalty(context.equipamento, context);
  penalty += operationalPenalty;
  if (operationalPenalty > 0) {
    if (context.equipamento.criticidade === 'critica') reasons.push('ativo de alta criticidade');
    else if (context.equipamento.criticidade === 'alta') {
      reasons.push('ativo relevante para a operacao');
    }
    if (context.equipamento.prioridadeOperacional === 'alta') {
      reasons.push('impacto operacional elevado');
    }
  }

  const score = clamp(100 - penalty, 0, 100);
  return { score, reasons, context };
}

export function calculateHealthScore(equipamento, registros = []) {
  return evaluateEquipmentHealth(equipamento, registros).score;
}

export function getHealthClass(score) {
  return score >= 80 ? 'ok' : score >= 55 ? 'warn' : 'danger';
}

export function buildMaintenanceAlerts(equipamentos = [], registros = []) {
  const registrosPorEquip = registros.reduce((acc, registro) => {
    if (!acc[registro.equipId]) acc[registro.equipId] = [];
    acc[registro.equipId].push(registro);
    return acc;
  }, {});

  const alerts = [];

  equipamentos.forEach((equipamento) => {
    const health = evaluateEquipmentHealth(equipamento, registrosPorEquip[equipamento.id] || []);
    const { context } = health;
    if (!context) return;

    const baseAlert = {
      eq: context.equipamento,
      reg: context.ultimoRegistro,
      equipmentName: context.equipamento.nome,
      severity: 'warn',
      periodicidadeDias: context.periodicidadeDias,
      daysToNext: context.daysToNext,
      score: health.score,
      healthReasons: health.reasons,
      nextDueDate: context.proximaPreventiva,
    };
    const operationalScore = getAlertScore(context.equipamento, health);

    if (context.equipamento.status === 'danger') {
      alerts.push({
        ...baseAlert,
        kind: 'critical',
        severity: 'danger',
        icon: '!!',
        title: 'Equipamento fora de operacao',
        subtitle: `Prioridade ${PRIORIDADE_OPERACIONAL_LABEL[context.equipamento.prioridadeOperacional]} | criticidade ${CRITICIDADE_LABEL[context.equipamento.criticidade]}`,
        recommendedAction: 'register-now',
        sortScore: 220 + operationalScore,
      });
      return;
    }

    if (!context.ultimoRegistro) {
      const shouldAlertNoHistory =
        context.equipamento.criticidade === 'alta' ||
        context.equipamento.criticidade === 'critica' ||
        context.equipamento.prioridadeOperacional === 'alta';
      if (shouldAlertNoHistory) {
        alerts.push({
          ...baseAlert,
          kind: 'no-history',
          icon: 'i',
          title: 'Equipamento sem historico preventivo',
          subtitle: `Cadastre a primeira intervencao para iniciar a rotina de ${context.periodicidadeDias} dias`,
          recommendedAction: 'start-history',
          sortScore: 120 + operationalScore,
        });
      }
      return;
    }

    if (context.daysToNext != null && context.daysToNext < 0) {
      alerts.push({
        ...baseAlert,
        kind: 'overdue',
        severity: 'danger',
        icon: '!',
        title: 'Preventiva vencida',
        subtitle: `${formatDueLabel(context.daysToNext)} | rotina de ${context.periodicidadeDias} dias`,
        recommendedAction: 'register-now',
        sortScore: 180 + operationalScore + Math.min(Math.abs(context.daysToNext), 30),
      });
      return;
    }

    if (context.daysToNext != null && context.daysToNext <= context.leadAlertDays) {
      alerts.push({
        ...baseAlert,
        kind: 'upcoming',
        icon: '::',
        title: 'Preventiva proxima',
        subtitle: `${formatDueLabel(context.daysToNext)} | janela de planejamento ${context.leadAlertDays} dias`,
        recommendedAction: 'schedule',
        sortScore: 120 + operationalScore + (context.leadAlertDays - context.daysToNext),
      });
      return;
    }

    if (
      context.recentIssueCount >= 2 ||
      context.recentCorrectiveCount >= 2 ||
      (context.equipamento.status === 'warn' &&
        (context.equipamento.prioridadeOperacional === 'alta' ||
          context.equipamento.criticidade === 'critica'))
    ) {
      alerts.push({
        ...baseAlert,
        kind: 'attention',
        icon: '>',
        title: 'Equipamento exige acompanhamento',
        subtitle:
          context.recentCorrectiveCount >= 2
            ? 'Historico recente com corretivas repetidas'
            : 'Ocorrencias recentes indicam monitoramento mais curto',
        recommendedAction: 'inspect',
        sortScore: 90 + operationalScore,
      });
    }
  });

  return alerts.sort((a, b) => b.sortScore - a.sortScore);
}
