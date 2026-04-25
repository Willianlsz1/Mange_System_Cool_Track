import { Utils } from '../core/utils.js';
import {
  calculateFinalRiskScore,
  getCriticidadeMultiplier,
  getRiskClassLabel,
} from './riskScore.js';
import { ALERT_SEVERITY_WEIGHT } from './constants/alerts.js';

export const CRITICIDADE_LABEL = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  critica: 'Crítica',
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
  ghp: 45,
  chiller: 30,
  fan_coil: 60,
  self_contained: 60,
  roof_top: 45,
  camara_fria: 30,
  balcao_frigorico: 45,
  freezer: 45,
  geladeira: 60,
  bebedouro: 90,
  outro: 60,
};

export const PERIODICIDADE_PREVENTIVA_POR_TIPO = {
  'Split Hi-Wall': PERIODICIDADE_PREVENTIVA_BASE.split_hi_wall,
  'Split Cassette': PERIODICIDADE_PREVENTIVA_BASE.split_cassette,
  'Split Piso Teto': PERIODICIDADE_PREVENTIVA_BASE.split_piso_teto,
  'VRF / VRV': PERIODICIDADE_PREVENTIVA_BASE.vrf_vrv,
  GHP: PERIODICIDADE_PREVENTIVA_BASE.ghp,
  Chiller: PERIODICIDADE_PREVENTIVA_BASE.chiller,
  'Fan Coil': PERIODICIDADE_PREVENTIVA_BASE.fan_coil,
  'Self Contained': PERIODICIDADE_PREVENTIVA_BASE.self_contained,
  'Roof Top': PERIODICIDADE_PREVENTIVA_BASE.roof_top,
  'Câmara Fria': PERIODICIDADE_PREVENTIVA_BASE.camara_fria,
  'Camara Fria': PERIODICIDADE_PREVENTIVA_BASE.camara_fria,
  'Camera Fria': PERIODICIDADE_PREVENTIVA_BASE.camara_fria,
  'Balcão Frigorífico': PERIODICIDADE_PREVENTIVA_BASE.balcao_frigorico,
  Freezer: PERIODICIDADE_PREVENTIVA_BASE.freezer,
  Geladeira: PERIODICIDADE_PREVENTIVA_BASE.geladeira,
  Bebedouro: PERIODICIDADE_PREVENTIVA_BASE.bebedouro,
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
      raw.includes('Câmara'))
  ) {
    return 'camara_fria';
  }

  const aliases = {
    'Split Hi-Wall': 'split_hi_wall',
    'Split Cassette': 'split_cassette',
    'Split Piso Teto': 'split_piso_teto',
    'VRF / VRV': 'vrf_vrv',
    GHP: 'ghp',
    Chiller: 'chiller',
    'Fan Coil': 'fan_coil',
    'Self Contained': 'self_contained',
    'Roof Top': 'roof_top',
    'Balcão Frigorífico': 'balcao_frigorico',
    Freezer: 'freezer',
    Geladeira: 'geladeira',
    Bebedouro: 'bebedouro',
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
    return `atrasada há ${atraso} dia${atraso === 1 ? '' : 's'}`;
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

function getRiskStatusFactor(status) {
  if (status === 'danger') {
    return {
      points: 38,
      shortLabel: 'fora de operação',
      detail: 'Equipamento está fora de operação e pode gerar impacto imediato na rotina.',
    };
  }
  if (status === 'warn') {
    return {
      points: 22,
      shortLabel: 'operação com restrições',
      detail: 'Equipamento opera com restrições e merece avaliação técnica prioritária.',
    };
  }
  return {
    points: 6,
    shortLabel: 'operação normal',
    detail: 'Equipamento opera normalmente no momento.',
  };
}

function getRiskAgeFactor(context) {
  if (!context.ultimoRegistro) {
    // Equipamento recém cadastrado: risco neutro por falta de histórico.
    // A ausência de registros não indica problema em equipamentos novos.
    return {
      points: 6,
      shortLabel: 'equipamento novo sem registros',
      detail: 'Primeiro registro ainda não cadastrado. Agende a primeira preventiva.',
    };
  }

  const ratio = context.periodicidadeDias ? context.daysSinceLast / context.periodicidadeDias : 0;
  if (ratio >= 1.25) {
    return {
      points: 28,
      shortLabel: 'manutenção além do intervalo',
      detail: `Último serviço há ${context.daysSinceLast} dias, acima do intervalo esperado.`,
    };
  }
  if (ratio >= 0.9) {
    return {
      points: 18,
      shortLabel: 'manutenção próxima do limite',
      detail: `Último serviço há ${context.daysSinceLast} dias, perto do limite da rotina.`,
    };
  }
  return {
    points: 8,
    shortLabel: 'manutenção recente',
    detail: `Último serviço há ${context.daysSinceLast} dias, dentro da rotina planejada.`,
  };
}

function getRiskPreventiveFactor(context) {
  if (context.daysToNext == null) {
    return {
      points: 12,
      shortLabel: 'preventiva sem agenda',
      detail: 'A próxima preventiva não está agendada.',
    };
  }
  if (context.daysToNext < 0) {
    return {
      points: 30,
      shortLabel: 'preventiva vencida',
      detail: `Preventiva atrasada há ${Math.abs(context.daysToNext)} dias.`,
    };
  }
  if (context.daysToNext <= 7) {
    return {
      points: 20,
      shortLabel: 'preventiva próxima',
      detail: `Preventiva prevista para os próximos ${context.daysToNext} dias.`,
    };
  }
  if (context.daysToNext <= 15) {
    return {
      points: 12,
      shortLabel: 'preventiva se aproximando',
      detail: `Preventiva prevista para daqui a ${context.daysToNext} dias.`,
    };
  }
  return {
    points: 4,
    shortLabel: 'preventiva no prazo',
    detail: `Próxima preventiva em ${context.daysToNext} dias.`,
  };
}

function getRiskCorrectiveFactor(context) {
  const count = context.recentCorrectiveCount;
  if (count >= 3) {
    return {
      points: 26,
      shortLabel: 'histórico de corretivas',
      detail: `Foram registradas ${count} corretivas recentes, indicando reincidência de falhas.`,
    };
  }
  if (count === 2) {
    return {
      points: 18,
      shortLabel: 'histórico de corretivas',
      detail: 'Duas corretivas recentes sugerem necessidade de atenção técnica.',
    };
  }
  if (count === 1) {
    return {
      points: 10,
      shortLabel: 'corretiva recente',
      detail: 'Uma corretiva recente registrada para o equipamento.',
    };
  }
  return {
    points: 3,
    shortLabel: 'sem corretivas recentes',
    detail: 'Sem corretivas recentes entre os últimos registros.',
  };
}

// Track record bonus: recompensa manutenção exemplar reduzindo o risco técnico.
// Reverte o efeito "piso" do score — bom comportamento agora derruba o risco,
// em vez de apenas impedir que ele suba. Máximo total de −18 pts sobre os 124
// do factor set (equivale a ~14pp a menos no risco base).
function getRiskTrackRecordBonus(context) {
  const reasons = [];
  let points = 0;

  const registros = context.registrosOrdenados || [];
  const periodicidade = context.periodicidadeDias;

  // 1) Três ou mais preventivas consecutivas em dia → −10 pts
  // Condições: últimos 3 registros são todos preventivos (não corretivos),
  // cada gap entre eles ≤ periodicidade × 1.1 (folga de 10%), e a próxima
  // preventiva atual não está atrasada.
  const preventivasRecentes = registros.filter((r) => !isCorrectiveService(r?.tipo)).slice(0, 3);
  if (preventivasRecentes.length >= 3 && periodicidade > 0) {
    let todasEmDia = true;
    for (let i = 0; i < preventivasRecentes.length - 1; i++) {
      const atualIso = parseIsoDate(preventivasRecentes[i].data);
      const anteriorIso = parseIsoDate(preventivasRecentes[i + 1].data);
      if (!atualIso || !anteriorIso) {
        todasEmDia = false;
        break;
      }
      const gap = getDaysSince(anteriorIso) - getDaysSince(atualIso);
      if (gap > periodicidade * 1.1) {
        todasEmDia = false;
        break;
      }
    }
    const proximaOk = context.daysToNext == null || context.daysToNext >= 0;
    if (todasEmDia && proximaOk) {
      points -= 10;
      reasons.push({
        label: 'preventivas consecutivas em dia',
        points: -10,
        detail: 'Últimas 3 preventivas cumpridas dentro do prazo — rotina estável.',
      });
    }
  }

  // 2) Histórico longo sem corretivas → −5 pts
  // Caso A: nenhuma corretiva no histórico e ≥3 registros totais.
  // Caso B: última corretiva há 180+ dias.
  const ultimaCorretiva = registros.find((r) => isCorrectiveService(r?.tipo));
  if (!ultimaCorretiva && registros.length >= 3) {
    points -= 5;
    reasons.push({
      label: 'sem corretivas no histórico',
      points: -5,
      detail: 'Nenhuma corretiva registrada — equipamento confiável.',
    });
  } else if (ultimaCorretiva) {
    const diasSemCorretiva = getDaysSince(ultimaCorretiva.data);
    if (diasSemCorretiva >= 180) {
      points -= 5;
      reasons.push({
        label: 'longo período sem corretivas',
        points: -5,
        detail: `Última corretiva há ${diasSemCorretiva} dias — sem reincidências.`,
      });
    }
  }

  // 3) Status operacional estável → −3 pts
  // Equipamento em ok agora e todos os registros recentes também em ok
  // (pelo menos 2 registros para caracterizar estabilidade, não apenas sorte).
  const registrosRecentes = context.registrosRecentes || [];
  if (
    context.equipamento?.status === 'ok' &&
    registrosRecentes.length >= 2 &&
    registrosRecentes.every((r) => r?.status === 'ok')
  ) {
    points -= 3;
    reasons.push({
      label: 'status operacional estável',
      points: -3,
      detail: 'Equipamento em operação normal, sem sinais de alerta nos últimos registros.',
    });
  }

  return { points, reasons };
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
    return { score: 0, reasons: ['Equipamento não encontrado'], context: null };
  }

  const context = getEquipmentMaintenanceContext(equipamento, registros);
  let penalty = getStatusPenalty(context.equipamento.status);
  const reasons = [];

  if (penalty > 0) {
    reasons.push(
      context.equipamento.status === 'danger' ? 'fora de operação' : 'operando com atenção',
    );
  }

  if (!context.ultimoRegistro) {
    // Equipamento recém cadastrado: não penaliza por falta de histórico quando o status
    // está ok. Apenas equipamentos com status warn/danger explícito recebem penalidade,
    // pois a ausência de registros é esperada em equipamentos novos.
    if (context.equipamento.status !== 'ok') {
      penalty += 22;
      reasons.push('sem histórico técnico');
    }
  } else {
    const agePenalty = getAgePenalty(context.daysSinceLast, context.periodicidadeDias);
    const nextPenalty = getPreventivePenalty(context.daysToNext);
    const recentPenalty = getRecentIssuePenalty(context.registrosRecentes);
    const correctivePenalty = getCorrectivePenalty(context.registrosRecentes);

    penalty += agePenalty + nextPenalty + recentPenalty + correctivePenalty;

    if (agePenalty > 0) reasons.push('intervalo acima da rotina preventiva');
    if (nextPenalty > 0 && context.daysToNext != null)
      reasons.push(formatDueLabel(context.daysToNext));
    if (recentPenalty > 0) reasons.push('ocorrências recorrentes recentes');
    if (correctivePenalty > 0) reasons.push('histórico corretivo repetitivo');
  }

  const operationalPenalty = getOperationalPenalty(context.equipamento, context);
  penalty += operationalPenalty;
  if (operationalPenalty > 0) {
    if (context.equipamento.criticidade === 'critica') reasons.push('ativo de alta criticidade');
    else if (context.equipamento.criticidade === 'alta') {
      reasons.push('ativo relevante para a operação');
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

export function evaluateEquipmentRisk(equipamento, registros = []) {
  if (!equipamento) {
    return {
      score: 0,
      classification: 'baixo',
      classificationLabel: 'Baixo risco',
      factors: ['equipamento não encontrado'],
      details: [],
      context: null,
    };
  }

  const context = getEquipmentMaintenanceContext(equipamento, registros);
  const criticidadeMultiplier = getCriticidadeMultiplier(context.equipamento.criticidade);
  const factorSet = [
    getRiskStatusFactor(context.equipamento.status),
    getRiskAgeFactor(context),
    getRiskPreventiveFactor(context),
    getRiskCorrectiveFactor(context),
  ];
  const trackRecord = getRiskTrackRecordBonus(context);
  const rawFactorSum = factorSet.reduce((sum, factor) => sum + factor.points, 0);
  // Bônus é negativo; somamos e garantimos que a soma não fique negativa antes
  // da normalização (o piso é 0% de risco técnico).
  const adjustedSum = Math.max(rawFactorSum + trackRecord.points, 0);
  const baseTechnicalRisk = clamp(Math.round((adjustedSum / 124) * 100), 0, 100);
  const finalRisk = calculateFinalRiskScore({
    baseTechnicalRisk,
    criticidade: context.equipamento.criticidade,
  });
  const criticidadeLabel =
    CRITICIDADE_LABEL[context.equipamento.criticidade] || CRITICIDADE_LABEL.media;
  const criticidadeFactor = {
    label: 'criticidade operacional',
    impact: Math.round(finalRisk.finalRisk - finalRisk.technicalRisk),
    detail: `Criticidade ${criticidadeLabel} aplica multiplicador ${criticidadeMultiplier.toFixed(2)} sobre o risco técnico base para priorizar impacto operacional.`,
  };

  const bonusDetails = trackRecord.reasons.map((reason) => ({
    label: reason.label,
    impact: reason.points,
    detail: reason.detail,
  }));

  const bonusFactorLabels = trackRecord.reasons.map((reason) => reason.label);

  return {
    score: finalRisk.finalRisk,
    classification: finalRisk.classification,
    classificationLabel: getRiskClassLabel(finalRisk.classification),
    technicalBaseScore: finalRisk.technicalRisk,
    criticidadeMultiplier,
    trackRecordBonus: trackRecord.points,
    factors: factorSet
      .filter((factor) => factor.points >= 10)
      .map((factor) => factor.shortLabel)
      .slice(0, 3)
      .concat(bonusFactorLabels)
      .concat('criticidade operacional'),
    details: factorSet
      .map((factor) => ({
        label: factor.shortLabel,
        impact: factor.points,
        detail: factor.detail,
      }))
      .concat(bonusDetails)
      .concat(criticidadeFactor),
    explanation:
      trackRecord.points < 0
        ? `Risco técnico base ${finalRisk.technicalRisk} (com bônus de track record ${trackRecord.points} pts) x criticidade (${criticidadeLabel}, ${criticidadeMultiplier.toFixed(2)}) = score final ${finalRisk.finalRisk}.`
        : `Risco técnico base ${finalRisk.technicalRisk} x criticidade (${criticidadeLabel}, ${criticidadeMultiplier.toFixed(2)}) = score final ${finalRisk.finalRisk}.`,
    context,
  };
}

// Tendência do risco nos últimos 30 dias.
// Compara o score atual com o score hipotético calculado apenas com os registros
// anteriores ao corte de 30 dias — permite detectar se o equipamento está
// melhorando (score caindo) ou piorando (score subindo) mesmo antes da próxima
// rodada de preventivas. Se não há registros antes do corte, retorna 'stable'.
export function evaluateEquipmentRiskTrend(equipamento, registros = []) {
  if (!equipamento) {
    return { trend: 'stable', delta: 0, now: 0, past: 0 };
  }

  const now = evaluateEquipmentRisk(equipamento, registros);
  const cutoffIso = addDays(Utils.localDateString(new Date()), -30);
  const registrosPast = (registros || []).filter((registro) => {
    const d = parseIsoDate(registro?.data);
    return d && d <= cutoffIso;
  });

  // Sem histórico antigo o suficiente pra comparar → sem tendência confiável.
  if (registrosPast.length === 0) {
    return { trend: 'stable', delta: 0, now: now.score, past: now.score };
  }

  const past = evaluateEquipmentRisk(equipamento, registrosPast);
  const delta = now.score - past.score;

  let trend = 'stable';
  if (delta <= -5) trend = 'improving';
  else if (delta >= 5) trend = 'worsening';

  return { trend, delta, now: now.score, past: past.score };
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
        title: 'Equipamento fora de operação',
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
          title: 'Equipamento sem histórico preventivo',
          subtitle: `Cadastre a primeira intervenção para iniciar a rotina de ${context.periodicidadeDias} dias`,
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
        title: 'Preventiva próxima',
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
            ? 'Histórico recente com corretivas repetidas'
            : 'Ocorrências recentes indicam monitoramento mais curto',
        recommendedAction: 'inspect',
        sortScore: 90 + operationalScore,
      });
    }
  });

  return alerts.sort(
    (a, b) =>
      (ALERT_SEVERITY_WEIGHT[b.severity] || 0) - (ALERT_SEVERITY_WEIGHT[a.severity] || 0) ||
      b.sortScore - a.sortScore,
  );
}
