import { Utils } from '../../../core/utils.js';
import { regsForEquip } from '../../../core/state.js';
import {
  evaluateEquipmentRisk,
  evaluateEquipmentRiskTrend,
  getEquipmentMaintenanceContext,
} from '../../../domain/maintenance.js';
import { evaluateEquipmentPriority } from '../../../domain/priorityEngine.js';
import { ACTION_CODE, evaluateEquipmentSuggestedAction } from '../../../domain/suggestedAction.js';
import { getActionPriorityScore } from '../../../domain/actionPriority.js';
import { getEquipmentVisualMeta } from '../../components/equipmentVisual.js';
import { calcHealthScore, getHealthClass } from '../dashboard.js';
import { PRIORIDADE_LABEL, RISK_CLASS_LABEL, STATUS_OPERACIONAL } from './constants.js';

function renderTrendBadge(trend) {
  if (!trend || trend.trend === 'stable') return '';
  if (trend.trend === 'improving') {
    return `<span class="equip-card__risk-trend equip-card__risk-trend--improving" title="Risco caiu ${Math.abs(trend.delta)} pontos nos últimos 30 dias" aria-label="Tendência melhorando">↓ ${Math.abs(trend.delta)} <span class="equip-card__risk-trend-word">melhorando</span></span>`;
  }
  return `<span class="equip-card__risk-trend equip-card__risk-trend--worsening" title="Risco subiu ${trend.delta} pontos nos últimos 30 dias" aria-label="Tendência piorando">↑ ${trend.delta} <span class="equip-card__risk-trend-word">piorando</span></span>`;
}

/**
 * Labels do tone-pill V3 para status operacional do equipamento.
 * Mesma vocabulária do Setor Card V3 (Estável/Em atenção/Crítico/Aguardando)
 * pra unificar o sistema de pills em todas as superfícies de equipamento.
 */
const _EQUIP_TONE_LABELS = {
  ok: 'Estável',
  warn: 'Em atenção',
  danger: 'Crítico',
};

/**
 * Classifica um factor do risk panel como positivo (verde) ou neutro.
 * Positivos são os que expressam "está tudo em ordem" — preventivas em dia,
 * sem corretivas, rotina estável. Tudo o mais fica neutro.
 */
const _POSITIVE_FACTOR_PATTERNS = [
  'em dia',
  'preventivas consecutivas',
  'sem corretivas',
  'dentro da rotina',
  'rotina estável',
  'estável',
  'sem alertas',
  'histórico limpo',
];
function _classifyFactor(factorStr) {
  const lf = String(factorStr || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return _POSITIVE_FACTOR_PATTERNS.some((p) =>
    lf.includes(p.normalize('NFD').replace(/[\u0300-\u036f]/g, '')),
  )
    ? 'positive'
    : 'neutral';
}

// ── PR4 §12.3 · idle-cluster (threshold baixo + histerese) ────────────────
//
// Equipamentos em rotina sem registros/agenda/alerta são "fullyIdle".
// Brief: mockup sugeriu >10 idles pra ativar cluster — tarde demais; 6 já
// polui o grid. Decisão: cluster coleta idles quando houver ≥5; solta quando
// cair ≤2 (histerese 5→2 mata flicker em listas que oscilam perto do limiar).
//
// State é módulo-level porque a decisão colapsar/não precisa lembrar do
// render anterior pra histerese funcionar. Começa null (sem decisão) e
// resolve no primeiro chamada de _resolveIdleClusterCollapsed.
const IDLE_CLUSTER_COLLAPSE_AT = 5;
const IDLE_CLUSTER_RELEASE_AT = 2;
let _idleClusterCollapsed = null;

export function _resolveIdleClusterCollapsed(idleCount) {
  if (_idleClusterCollapsed === null) {
    _idleClusterCollapsed = idleCount >= IDLE_CLUSTER_COLLAPSE_AT;
  } else if (_idleClusterCollapsed && idleCount <= IDLE_CLUSTER_RELEASE_AT) {
    _idleClusterCollapsed = false;
  } else if (!_idleClusterCollapsed && idleCount >= IDLE_CLUSTER_COLLAPSE_AT) {
    _idleClusterCollapsed = true;
  }
  return _idleClusterCollapsed;
}

/** Mesma lógica de `isFullyIdle` do card, extraída pra decisão de partição. */
function _isEquipFullyIdle(eq) {
  const context = getEquipmentMaintenanceContext(eq, regsForEquip(eq.id));
  const scls = Utils.safeStatus(eq.status);
  if (scls !== 'ok') return false;
  const eqRegs = regsForEquip(eq.id);
  const risk = evaluateEquipmentRisk(eq, eqRegs);
  if (risk.classification !== 'baixo') return false;
  const suggestedAction = evaluateEquipmentSuggestedAction(eq, eqRegs);
  const hasAction =
    suggestedAction.actionCode !== ACTION_CODE.NONE &&
    suggestedAction.actionCode !== ACTION_CODE.MONITOR;
  if (hasAction) return false;
  const hasMetrics = Boolean(context.ultimoRegistro) || Boolean(context.proximaPreventiva);
  return !hasMetrics;
}

export function _createEquipRenderEvalContext() {
  const regsById = new Map();
  const riskById = new Map();
  const priorityById = new Map();
  const actionPriorityById = new Map();
  const maintenanceCtxById = new Map();
  const suggestedActionById = new Map();
  const fullyIdleById = new Map();

  const getRegs = (id) => {
    if (!regsById.has(id)) regsById.set(id, regsForEquip(id));
    return regsById.get(id);
  };
  const getRisk = (eq) => {
    if (!riskById.has(eq.id)) riskById.set(eq.id, evaluateEquipmentRisk(eq, getRegs(eq.id)));
    return riskById.get(eq.id);
  };
  const getPriority = (eq) => {
    if (!priorityById.has(eq.id))
      priorityById.set(eq.id, evaluateEquipmentPriority(eq, getRegs(eq.id)));
    return priorityById.get(eq.id);
  };
  const getActionPriority = (eq) => {
    if (!actionPriorityById.has(eq.id))
      actionPriorityById.set(eq.id, getActionPriorityScore(eq, getRegs(eq.id)));
    return actionPriorityById.get(eq.id);
  };
  const getMaintenanceContextCached = (eq) => {
    if (!maintenanceCtxById.has(eq.id))
      maintenanceCtxById.set(eq.id, getEquipmentMaintenanceContext(eq, getRegs(eq.id)));
    return maintenanceCtxById.get(eq.id);
  };
  const getSuggestedActionCached = (eq) => {
    if (!suggestedActionById.has(eq.id))
      suggestedActionById.set(eq.id, evaluateEquipmentSuggestedAction(eq, getRegs(eq.id)));
    return suggestedActionById.get(eq.id);
  };
  const isFullyIdle = (eq) => {
    if (fullyIdleById.has(eq.id)) return fullyIdleById.get(eq.id);
    const context = getMaintenanceContextCached(eq);
    const scls = Utils.safeStatus(eq.status);
    if (scls !== 'ok') {
      fullyIdleById.set(eq.id, false);
      return false;
    }
    const risk = getRisk(eq);
    if (risk.classification !== 'baixo') {
      fullyIdleById.set(eq.id, false);
      return false;
    }
    const suggestedAction = getSuggestedActionCached(eq);
    const hasAction =
      suggestedAction.actionCode !== ACTION_CODE.NONE &&
      suggestedAction.actionCode !== ACTION_CODE.MONITOR;
    if (hasAction) {
      fullyIdleById.set(eq.id, false);
      return false;
    }
    const hasMetrics = Boolean(context.ultimoRegistro) || Boolean(context.proximaPreventiva);
    const result = !hasMetrics;
    fullyIdleById.set(eq.id, result);
    return result;
  };

  return {
    getRegs,
    getRisk,
    getPriority,
    getActionPriority,
    getMaintenanceContext: getMaintenanceContextCached,
    getSuggestedAction: getSuggestedActionCached,
    isFullyIdle,
  };
}

export function _idleClusterHtml(idleCards, count) {
  // Markup: summary button (clickable row w/ counter + CTA) + hidden cards
  // container. O toggle-idle-cluster handler só flipa `data-expanded` — CSS
  // cuida de mostrar/esconder a lista. Zero re-render necessário.
  const label = `${count} equipamento${count === 1 ? '' : 's'} novo${count === 1 ? '' : 's'} aguardando linha de base`;
  return `<div class="equip-idle-cluster" data-expanded="false" role="group" aria-label="${label}">
    <button type="button" class="equip-idle-cluster__summary" data-action="toggle-idle-cluster" aria-expanded="false">
      <div class="equip-idle-cluster__icon" aria-hidden="true">+</div>
      <div class="equip-idle-cluster__text">
        <div class="equip-idle-cluster__title"><b>${count}</b> equipamento${count === 1 ? '' : 's'} novo${count === 1 ? '' : 's'}</div>
        <div class="equip-idle-cluster__sub">aguardando linha de base</div>
      </div>
      <span class="equip-idle-cluster__cta">
        <span class="equip-idle-cluster__cta-text">Ver todos</span>
        <span class="equip-idle-cluster__cta-caret" aria-hidden="true">▾</span>
      </span>
    </button>
    <div class="equip-idle-cluster__cards" role="list">
      ${idleCards}
    </div>
  </div>`;
}

function equipCardIconBlock(eq) {
  const visual = getEquipmentVisualMeta(eq);
  const photoUrl = visual.photoUrl;
  const toneClass = `equip-card__type-icon--fallback-t${visual.tone}`;
  const fallbackHtml = `<span class="equip-card__fallback-initials">${Utils.escapeHtml(visual.initials)}</span>
    <span class="equip-card__fallback-glyph" aria-hidden="true">${visual.icon}</span>`;
  if (photoUrl) {
    const safeUrl = Utils.escapeAttr(photoUrl);
    return `<div class="equip-card__type-icon equip-card__type-icon--lg equip-card__type-icon--photo ${toneClass}" aria-hidden="true">
      <img src="${safeUrl}" alt="" loading="lazy" />
      ${fallbackHtml}
    </div>`;
  }
  return `<div class="equip-card__type-icon equip-card__type-icon--lg equip-card__type-icon--fallback ${toneClass}" aria-hidden="true">${fallbackHtml}</div>`;
}

export function equipCardHtml(eq, { showLocal: _showLocal = true, evalCtx = null } = {}) {
  const eqRegs = evalCtx?.getRegs ? evalCtx.getRegs(eq.id) : regsForEquip(eq.id);
  const context = evalCtx?.getMaintenanceContext
    ? evalCtx.getMaintenanceContext(eq)
    : getEquipmentMaintenanceContext(eq, eqRegs);
  const last = context.ultimoRegistro;
  const score = calcHealthScore(eq.id);
  const hcls = getHealthClass(score);
  const scls = Utils.safeStatus(eq.status);
  const safeId = Utils.escapeAttr(eq.id);
  const prioridadeLabel = PRIORIDADE_LABEL[eq.criticidade] || PRIORIDADE_LABEL.media;
  const risk = evalCtx?.getRisk ? evalCtx.getRisk(eq) : evaluateEquipmentRisk(eq, eqRegs);
  const riskTrend = evaluateEquipmentRiskTrend(eq, eqRegs);
  const suggestedAction = evalCtx?.getSuggestedAction
    ? evalCtx.getSuggestedAction(eq)
    : evaluateEquipmentSuggestedAction(eq, eqRegs);

  function getCtaByAction(actionCode) {
    if (actionCode === ACTION_CODE.REGISTER_CORRECTIVE_IMMEDIATE)
      return 'Registrar serviço corretivo agora';
    if (actionCode === ACTION_CODE.REGISTER_CORRECTIVE) return 'Registrar serviço corretivo';
    if (actionCode === ACTION_CODE.REGISTER_PREVENTIVE) return 'Registrar serviço preventivo';
    if (actionCode === ACTION_CODE.SCHEDULE_PREVENTIVE) return 'Programar serviço preventivo';
    if (actionCode === ACTION_CODE.COLLECT_DATA) return 'Registrar última manutenção';
    return 'Registrar serviço';
  }

  function recencia(data) {
    const diff = Math.round((new Date() - new Date(data)) / 86400000);
    if (diff === 0) return 'hoje';
    if (diff === 1) return 'ontem';
    if (diff < 30) return `há ${diff} dias`;
    if (diff < 60) return 'há 1 mês';
    return `há ${Math.floor(diff / 30)} meses`;
  }

  // ─── Próxima preventiva label + tom ───────────────────────────────────────
  let proximaLabel = null;
  let proximaTone = 'neutral';
  if (context.proximaPreventiva) {
    const diff = Utils.daysDiff(context.proximaPreventiva);
    if (diff < 0) {
      proximaLabel = `vencida há ${Math.abs(diff)}d`;
      proximaTone = 'danger';
    } else if (diff === 0) {
      proximaLabel = 'hoje';
      proximaTone = 'danger';
    } else if (diff <= 7) {
      proximaLabel = `${diff} dia${diff > 1 ? 's' : ''}`;
      proximaTone = 'warn';
    } else {
      proximaLabel = `${diff} dias`;
    }
  }

  // ─── Estados do card (redesign V2 — port Claude Design) ───────────────────
  //
  // Três densidades pra evitar o "wall of text" da V1:
  //
  //  · isFullyIdle  → equip em rotina sem registros/agenda/alerta. Renderiza
  //                   só header + bloco de onboarding dashed cyan.
  //  · hasAction    → actionCode ≠ NONE/MONITOR → mostra bloco "Ação
  //                   recomendada" com meta autor/tempo do último registro.
  //  · hasMetrics   → pelo menos registro prévio OU preventiva agendada →
  //                   mostra timeline strip (Última ──── Próx.)
  //
  // Em estado ativo (não idle) o card ganha: header com score lateral +
  // EFICIÊNCIA em CAPS no lugar da pill de status, barra full-width,
  // chips compactos em linha, timeline strip e CTA tonal full-width no
  // rodapé (gradient tonal pro scls).
  const hasAction =
    suggestedAction.actionCode !== ACTION_CODE.NONE &&
    suggestedAction.actionCode !== ACTION_CODE.MONITOR;
  const hasMetrics = Boolean(last) || Boolean(context.proximaPreventiva);
  const isFullyIdle = scls === 'ok' && risk.classification === 'baixo' && !hasAction && !hasMetrics;
  const cardModifiers = `equip-card--${scls}${isFullyIdle ? ' equip-card--idle' : ''}`;

  const isActivationPending = !last && suggestedAction.actionCode === ACTION_CODE.COLLECT_DATA;
  const ctaLabel = !last && !hasAction ? 'Começar' : getCtaByAction(suggestedAction.actionCode);

  // ─── Header right-side: idle = tone-pill V3 / ativo = score + EFICIÊNCIA ───
  //
  // V3: substituímos o risk-chip idle pelo mesmo tone-pill do Setor Card
  // (Estável/Em atenção/Crítico) pra alinhar vocabulário visual em todas
  // as superfícies de equipamento. O ativo mantém o score block porque
  // o % carrega informação adicional ao tom.
  const toneLabel = _EQUIP_TONE_LABELS[scls] || _EQUIP_TONE_LABELS.ok;
  const headerRightHtml = isFullyIdle
    ? `<span class="equip-card__tone-pill equip-card__tone-pill--${scls}">
        <span class="equip-card__tone-pill-dot" aria-hidden="true"></span>
        ${toneLabel}
      </span>`
    : `<div class="equip-card__score-block">
        <span class="equip-card__score-value equip-card__score-value--${hcls}">${score}%</span>
        <span class="equip-card__score-label">Eficiência</span>
      </div>`;

  // E4: delete removido do header do card (V3). A ação destrutiva vive agora
  // só dentro do modal de detalhe do equipamento pra reduzir cliques
  // acidentais em list view — mesmo padrão do Setor Card V3 onde delete está
  // escondido no kebab overflow.
  const deleteBtnHtml = '';

  // ─── Idle body: onboarding dashed cyan (substitui bar/risk/metrics/action)
  if (isFullyIdle) {
    return `<div class="equip-card ${cardModifiers}" data-action="view-equip" data-id="${safeId}" role="listitem" tabindex="0" aria-label="${Utils.escapeHtml(eq.nome)} — ${STATUS_OPERACIONAL[scls]}">
      <div class="equip-card__header">
        ${equipCardIconBlock(eq)}
        <div class="equip-card__meta">
          <div class="equip-card__name">${Utils.escapeHtml(eq.nome)}</div>
          <div class="equip-card__tag">${Utils.escapeHtml(eq.tag || '—')} · ${Utils.escapeHtml(eq.fluido || eq.tipo)} · ${Utils.escapeHtml(prioridadeLabel)}</div>
          <div class="equip-card__subtitle">${Utils.escapeHtml(eq.local || 'Local não informado')}</div>
        </div>
        ${headerRightHtml}
        ${deleteBtnHtml}
      </div>
      <div class="equip-card__onboard">
        <div class="equip-card__onboard-text">
          <!--
            Label small-caps espelha o "PRÓXIMA AÇÃO / AÇÃO URGENTE" do card
            ativo. Além de unificar a gramática visual, guia o técnico no
            idle state dizendo *o que é esse estado* (primeiro serviço do
            equipamento) antes do CTA. O título antigo "Novo equipamento"
            era redundante com o nome no header; promovemos a sub pra
            título e deixamos uma sub mais curta de contexto.
          -->
          <div class="equip-card__onboard-label">PRIMEIRO SERVIÇO</div>
          <div class="equip-card__onboard-title">Crie a linha de base</div>
          <div class="equip-card__onboard-sub">O primeiro registro define o histórico</div>
        </div>
        <button class="equip-card__onboard-cta" data-action="go-register-equip" data-id="${safeId}">
          ${ctaLabel} <span aria-hidden="true">→</span>
        </button>
      </div>
    </div>`;
  }

  // ─── Ativo: chips (c/ timeline inline) + primary row (action + CTA fundidos) ─
  //
  // PR2 §12: __action + __cta-bar fundidos em __primary (grid 1fr auto).
  // Timeline migra pra __timeline-inline dentro do chips row. Tree anterior
  // (5 zonas: header / bar / chips / timeline / action / cta-bar) colapsa
  // em 3 zonas de leitura (header / chips+timeline / primary). Reduz ~40%
  // da altura visual do card sem perder informação.
  //
  // E9: factors positivos ganham variante --positive (tom verde discreto);
  // os demais ficam --neutral. Dá hierarquia imediata de leitura sem
  // aumentar densidade.
  const timelineInlineHtml = hasMetrics
    ? `<span class="equip-card__timeline-inline">
        Últ. <b>${last ? Utils.escapeHtml(recencia(last.data)) : '—'}</b>
        <span class="equip-card__timeline-sep" aria-hidden="true"></span>
        Próx. <b class="equip-card__timeline-inline-next--${proximaTone}">${proximaLabel ? Utils.escapeHtml(proximaLabel) : 'sem agenda'}</b>
      </span>`
    : '';

  const chipsHtml = `<div class="equip-card__chips">
      <span class="equip-card__risk-chip equip-card__risk-chip--${risk.classification}">${RISK_CLASS_LABEL[risk.classification]} · ${risk.score}</span>
      ${renderTrendBadge(riskTrend)}
      ${risk.factors
        .slice(0, 3)
        .map(
          (f) =>
            `<span class="equip-card__chip-ctx equip-card__chip-ctx--${_classifyFactor(f)}">${Utils.escapeHtml(f)}</span>`,
        )
        .join('')}
      ${timelineInlineHtml}
    </div>`;

  // PR2 §12.2 — label contextual do __primary: binário (urgente | próxima).
  // Regra: danger OR factor inclui "parado desde"/"preventiva vencida".
  // "PRÓXIMA ROTINA" do mockup foi descartado — ruído cognitivo pro tech.
  const isUrgent =
    scls === 'danger' ||
    risk.factors.some((f) => /parado desde|preventiva vencida/i.test(String(f)));
  const primaryLabelText = isActivationPending
    ? 'STATUS INICIAL'
    : isUrgent
      ? 'AÇÃO URGENTE'
      : 'PRÓXIMA AÇÃO';
  const primaryTitle = isActivationPending
    ? 'Sem manutenção recente ⚠️'
    : hasAction
      ? suggestedAction.actionLabel
      : ctaLabel;
  const primaryMetaHtml =
    hasAction && last?.tecnico
      ? `<div class="equip-card__primary-meta">Por ${Utils.escapeHtml(last.tecnico)} · ${Utils.escapeHtml(recencia(last.data))}</div>`
      : '';

  return `<div class="equip-card ${cardModifiers}" data-action="view-equip" data-id="${safeId}" role="listitem" tabindex="0" aria-label="${Utils.escapeHtml(eq.nome)} — ${STATUS_OPERACIONAL[scls]}">
    <div class="equip-card__header">
      ${equipCardIconBlock(eq)}
      <div class="equip-card__meta">
        <div class="equip-card__name ${scls === 'danger' ? 'equip-card__name--danger' : ''}">${Utils.escapeHtml(eq.nome)}</div>
        <div class="equip-card__tag">${Utils.escapeHtml(eq.tag || '—')} · ${Utils.escapeHtml(eq.fluido || eq.tipo)} · ${Utils.escapeHtml(prioridadeLabel)}</div>
        <div class="equip-card__subtitle">${Utils.escapeHtml(eq.local || 'Local não informado')}</div>
      </div>
      ${headerRightHtml}
      ${deleteBtnHtml}
    </div>
    <div class="equip-card__health-bar-full">
      <div class="equip-card__health-fill equip-card__health-fill--${hcls}" style="width:${score}%"></div>
    </div>
    ${chipsHtml}
    <div class="equip-card__primary">
      <div class="equip-card__primary-text">
        <div class="equip-card__primary-label">${primaryLabelText}</div>
        <div class="equip-card__primary-title">${Utils.escapeHtml(primaryTitle)}</div>
        ${primaryMetaHtml}
      </div>
      <button class="equip-card__primary-cta" data-action="go-register-equip" data-id="${safeId}" aria-label="${Utils.escapeHtml(ctaLabel)}">
        <svg class="equip-card__primary-cta-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>
      </button>
    </div>
  </div>`;
}

// ─── Setor (PRO) ──────────────────────────────────────────────────────────────

// Equipment route context lives in ./equipamentos/contextState.js.
