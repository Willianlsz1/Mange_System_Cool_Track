/**
 * CoolTrack Pro - Dashboard View v6.0 (V2Refined)
 *
 * Sistema visual: tier accent via `--dsh-accent` (gold Pro, blue Plus, cyan Free).
 * Layout: Hero Status Card + KPI Grid 2×2 (mobile) / 1×4 (desktop) + Próxima ação
 * + Último serviço + seções preservadas (A fazer agora, Alertas, Recentes) +
 * Análise (accordion mobile / grid desktop).
 *
 * Exports públicos: calcHealthScore, getHealthClass, updateHeader, renderDashboard.
 */

import { Utils, TIPO_ICON } from '../../core/utils.js';
import { getState, findEquip, regsForEquip } from '../../core/state.js';
import { Storage } from '../../core/storage.js';
import { Auth } from '../../core/auth.js';
import { Alerts } from '../../domain/alerts.js';
// Charts é dynamic-imported em _refreshCharts() pra evitar bundlar Chart.js
// (~100 KB gz) no chunk principal. Só baixa quando o dashboard efetivamente
// vai desenhar os gráficos.
import { emptyStateHtml } from '../components/emptyState.js';
import { OnboardingBanner } from '../components/onboarding.js';
import { UpgradeNudge } from '../components/upgradeNudge.js';
import { UsageMeter } from '../components/usageMeter.js';
import { withSkeleton } from '../components/skeleton.js';
import { fetchMyProfileBilling } from '../../core/monetization.js';
import {
  PLAN_CODE_FREE,
  PLAN_CODE_PLUS,
  PLAN_CODE_PRO,
  getEffectivePlan,
  hasProAccess,
} from '../../core/subscriptionPlans.js';
import {
  calculateHealthScore,
  evaluateEquipmentRisk,
  evaluateEquipmentRiskTrend,
  getEquipmentMaintenanceContext,
  getHealthClass as getMaintenanceHealthClass,
} from '../../domain/maintenance.js';
import { evaluateEquipmentPriority } from '../../domain/priorityEngine.js';
import { ACTION_CODE, evaluateEquipmentSuggestedAction } from '../../domain/suggestedAction.js';
import { getActionPriorityScore } from '../../domain/actionPriority.js';
import { getOperationalStatus } from '../../core/equipmentRules.js';

// ═══════════════════════════════════════════════════════
// Labels internos
// ═══════════════════════════════════════════════════════
const STATUS_OPERACIONAL = {
  ok: 'OPERANDO NORMALMENTE',
  warn: 'OPERANDO COM RESTRIÇÕES',
  danger: 'FORA DE OPERAÇÃO',
};
const PRIORIDADE_LABEL = { baixa: 'Baixa', media: 'Média', alta: 'Alta', critica: 'Crítica' };
const RISK_CLASS_LABEL = { baixo: 'Baixo risco', medio: 'Médio risco', alto: 'Alto risco' };

const ALERT_SEVERITY_WEIGHT = { danger: 3, warn: 2, info: 1 };

// Ícones SVG inline (stroke 1.6–2, currentColor) pro hero + pills
const DASH_SVG = {
  crown:
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7l4 4 5-7 5 7 4-4-2 12H5L3 7z"/></svg>',
  alert:
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3L2 20h20L12 3z"/><path d="M12 10v4M12 17.5v.01"/></svg>',
  check:
    '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l5 5L20 6"/></svg>',
};

// ═══════════════════════════════════════════════════════
// Helpers de métricas (preservados)
// ═══════════════════════════════════════════════════════
function _getMostSevereAlert(alerts = []) {
  return [...alerts].sort(
    (a, b) =>
      (ALERT_SEVERITY_WEIGHT[b?.severity] || 0) - (ALERT_SEVERITY_WEIGHT[a?.severity] || 0) ||
      (b?.sortScore || 0) - (a?.sortScore || 0),
  )[0];
}

function _getMonthRange(monthsAgo = 0) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
  const end = new Date(now.getFullYear(), now.getMonth() - monthsAgo + 1, 1);
  return { start, end };
}

function _countRegistrosNoMes(registros, monthsAgo = 0) {
  const { start, end } = _getMonthRange(monthsAgo);
  return registros.filter((r) => {
    const d = new Date(r.data);
    return d >= start && d < end;
  }).length;
}

function _sparklineData(registros, months = 6) {
  return Array.from({ length: months }, (_, i) => _countRegistrosNoMes(registros, months - 1 - i));
}

function _trendTag(current, previous) {
  if (previous === 0 && current === 0) return { text: 'Sem dados anteriores', cls: 'neutral' };
  if (previous === 0 && current > 0) return { text: `+${current} este mês`, cls: 'up' };
  const diff = current - previous;
  if (diff === 0) return { text: 'Igual ao mês passado', cls: 'neutral' };
  if (diff > 0) return { text: `+${diff} vs mês passado`, cls: 'up' };
  return { text: `-${Math.abs(diff)} vs mês passado`, cls: 'down' };
}

// Sparkline SVG inline — gradient fill + linha com ponto final destacado
function _sparklineSvg(data) {
  if (!data || !data.length) return '';
  const w = 100;
  const h = 20;
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => {
    const x = (i / Math.max(data.length - 1, 1)) * w;
    const y = h - 2 - (v / max) * (h - 4);
    return [x, y];
  });
  const line = pts.map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`)).join(' ');
  const area = `${line} L${w},${h} L0,${h} Z`;
  const dots = pts
    .map(([x, y], i) => {
      const r = data[i] > 0 ? 1.8 : 1;
      const last = i === pts.length - 1;
      return `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${last ? 2.2 : r}" fill="var(--dsh-accent,currentColor)" opacity="${last ? 1 : 0.6}"/>`;
    })
    .join('');
  return `<svg width="100%" height="20" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <linearGradient id="dsh-spark" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="var(--dsh-accent,currentColor)" stop-opacity="0.28"/>
        <stop offset="100%" stop-color="var(--dsh-accent,currentColor)" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <path d="${area}" fill="url(#dsh-spark)"/>
    <path d="${line}" fill="none" stroke="var(--dsh-accent,currentColor)" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
    ${dots}
  </svg>`;
}

function _recencia(data) {
  const diff = Math.round((new Date() - new Date(data)) / 86400000);
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Ontem';
  if (diff < 30) return `há ${diff} dias`;
  if (diff < 60) return 'há 1 mês';
  return `há ${Math.floor(diff / 30)} meses`;
}

function _formatDateTimePill() {
  const now = new Date();
  const weekday = now.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
  const dateStr = now
    .toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
    .replace('.', '');
  const time = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${dateStr} · ${time}`;
}

function _planTier(planCode) {
  if (planCode === PLAN_CODE_PRO) return 'pro';
  if (planCode === PLAN_CODE_PLUS) return 'plus';
  return 'free';
}

function _planLabel(tier) {
  if (tier === 'pro') return 'Plano Pro ativo';
  if (tier === 'plus') return 'Plano Plus ativo';
  return 'Plano Free';
}

function _planPillText(tier) {
  if (tier === 'pro') return 'PRO';
  if (tier === 'plus') return 'PLUS';
  return 'FREE';
}

function _initialsFromName(raw) {
  const src = (raw || '').trim();
  if (!src) return '—';
  // email → usa as duas primeiras letras antes do @
  if (src.includes('@')) {
    const local = src
      .split('@')[0]
      .replace(/[._-]+/g, ' ')
      .trim();
    if (!local) return '—';
    const parts = local.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return local.slice(0, 2).toUpperCase();
  }
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0].slice(0, 2).toUpperCase();
}

function _populateHeaderIdentity({ tier, userName }) {
  const header = Utils.getEl('app-header');
  if (header) header.setAttribute('data-tier', tier);

  const pill = Utils.getEl('app-logo-pill');
  const pillText = Utils.getEl('app-logo-pill-text');
  if (pill) {
    pill.setAttribute('data-tier', tier);
    pill.hidden = false;
    if (pillText) pillText.textContent = _planPillText(tier);
  }

  const avatar = Utils.getEl('header-avatar');
  const initialsEl = Utils.getEl('header-avatar-initials');
  if (avatar) avatar.setAttribute('data-tier', tier);
  if (initialsEl) initialsEl.textContent = _initialsFromName(userName);
}

// ═══════════════════════════════════════════════════════
// Health / risk (mantido; exportado pra outras views)
// ═══════════════════════════════════════════════════════
export function calcHealthScore(eqId) {
  const eq = findEquip(eqId);
  if (!eq) return 0;
  return calculateHealthScore(eq, regsForEquip(eqId));
}

export function getHealthClass(score) {
  return getMaintenanceHealthClass(score);
}

// ═══════════════════════════════════════════════════════
// Plan context
// ═══════════════════════════════════════════════════════
async function resolveDashboardPlanContext() {
  if (localStorage.getItem('cooltrack-guest-mode') === '1') {
    return { planCode: PLAN_CODE_FREE, hasPro: false };
  }

  const user = await Auth.getUser();
  if (!user?.id) return { planCode: PLAN_CODE_FREE, hasPro: false };

  try {
    const { profile } = await fetchMyProfileBilling();
    return {
      planCode: getEffectivePlan(profile),
      hasPro: hasProAccess(profile),
    };
  } catch {
    const fallbackPlan = getEffectivePlan(null);
    return { planCode: fallbackPlan, hasPro: fallbackPlan === PLAN_CODE_PRO };
  }
}

// ═══════════════════════════════════════════════════════
// Pro status card (preservado — aparece só quando tier=pro)
// ═══════════════════════════════════════════════════════
function _renderProStatusCard() {
  return `
    <article class="upgrade-nudge-card upgrade-nudge-card--pro-active" aria-label="Plano Pro ativo">
      <span class="upgrade-nudge-card__badge">PRO ATIVO</span>
      <div class="upgrade-nudge-card__icon" aria-hidden="true">&#10003;</div>
      <h3 class="upgrade-nudge-card__pro-title">Plano Pro ativo</h3>
      <p class="upgrade-nudge-card__pro-copy">Todos os recursos premium estao liberados para sua conta.</p>
    </article>
  `;
}

// ═══════════════════════════════════════════════════════
// Action / alert helpers (preservados para mini-cards)
// ═══════════════════════════════════════════════════════
function _getAlertActionMeta(alert) {
  const id = Utils.escapeAttr(alert.eq?.id || '');
  switch (alert.recommendedAction) {
    case 'register-now':
      return { action: 'go-register-equip', id, label: 'Registrar agora' };
    case 'schedule':
      return { action: 'go-register-equip', id, label: 'Registrar serviço preventivo' };
    case 'start-history':
      return { action: 'go-register-equip', id, label: 'Iniciar historico' };
    case 'inspect':
      return { action: 'view-equip', id, label: 'Abrir equipamento' };
    default:
      return { action: 'view-equip', id, label: 'Ver equipamento' };
  }
}

function _alertCardHtml(alert) {
  const actionMeta = _getAlertActionMeta(alert);
  const toneClass = alert.severity === 'danger' ? ' alert-card--critical' : '';
  const sub = Utils.truncate(alert.subtitle || '', 56);
  return `<div class="alert-card${toneClass}" data-action="${actionMeta.action}" data-id="${actionMeta.id}" role="listitem" tabindex="0">
    <span class="alert-card__icon">${alert.icon || '!'}</span>
    <div class="alert-card__body">
      <div class="alert-card__equip">${Utils.escapeHtml(alert.eq?.nome ?? alert.equipmentName ?? '—')}</div>
      <div class="alert-card__title">${alert.title}</div>
      ${sub ? `<div class="alert-card__sub">${sub}</div>` : ''}
    </div>
    <span class="alert-card__action">&rarr; Agir</span>
  </div>`;
}

function _criticalNowItemHtml({
  icon = '!',
  tone = 'danger',
  title = 'Ação imediata',
  subtitle = '',
  action = 'view-equip',
  id = '',
  ctaLabel = 'Abrir',
}) {
  return `<button class="critical-now-item critical-now-item--${tone}" data-action="${Utils.escapeAttr(action)}" data-id="${Utils.escapeAttr(id)}">
    <span class="critical-now-item__icon" aria-hidden="true">${icon}</span>
    <span class="critical-now-item__body">
      <span class="critical-now-item__title">${title}</span>
      ${subtitle ? `<span class="critical-now-item__subtitle">${subtitle}</span>` : ''}
    </span>
    <span class="critical-now-item__cta">${ctaLabel}</span>
  </button>`;
}

function _getActionButton(actionCode) {
  if (
    actionCode === ACTION_CODE.REGISTER_CORRECTIVE_IMMEDIATE ||
    actionCode === ACTION_CODE.REGISTER_CORRECTIVE ||
    actionCode === ACTION_CODE.REGISTER_PREVENTIVE
  ) {
    return { action: 'go-register-equip', ctaLabel: 'Registrar' };
  }
  if (actionCode === ACTION_CODE.SCHEDULE_PREVENTIVE) {
    return { action: 'go-register-equip', ctaLabel: 'Programar' };
  }
  return { action: 'view-equip', ctaLabel: 'Ver' };
}

// Badge de tendência de risco (últimos 30 dias) — usa HTML entities pois os
// cards mini vão para innerHTML direto sem passar por sanitização que resolva
// caracteres Unicode de setas.
function _renderTrendBadge(trend) {
  if (!trend || trend.trend === 'stable') {
    return `<span class="equip-card__risk-trend equip-card__risk-trend--stable" title="Tendência estável nos últimos 30 dias" aria-label="Tendência estável">&rarr; estável</span>`;
  }
  if (trend.trend === 'improving') {
    return `<span class="equip-card__risk-trend equip-card__risk-trend--improving" title="Risco caiu ${Math.abs(trend.delta)} pontos nos últimos 30 dias" aria-label="Tendência melhorando">&darr; ${Math.abs(trend.delta)}</span>`;
  }
  return `<span class="equip-card__risk-trend equip-card__risk-trend--worsening" title="Risco subiu ${trend.delta} pontos nos últimos 30 dias" aria-label="Tendência piorando">&uarr; ${trend.delta}</span>`;
}

// Cards "com ocorrência" (preservados) —————————————————
function _equipCardMini(eq) {
  const icon = TIPO_ICON[eq.tipo] ?? '⚙️';
  const context = getEquipmentMaintenanceContext(eq, regsForEquip(eq.id));
  const last = context.ultimoRegistro;
  const score = calcHealthScore(eq.id);
  const hcls = getHealthClass(score);
  const scls = Utils.safeStatus(eq.status);
  const safeId = Utils.escapeAttr(eq.id);
  const eqRegs = regsForEquip(eq.id);
  const risk = evaluateEquipmentRisk(eq, eqRegs);
  const riskTrend = evaluateEquipmentRiskTrend(eq, eqRegs);
  const priority = evaluateEquipmentPriority(eq, eqRegs);
  const suggestedAction = evaluateEquipmentSuggestedAction(eq, eqRegs);

  function getCtaByAction(actionCode) {
    if (actionCode === ACTION_CODE.REGISTER_CORRECTIVE_IMMEDIATE)
      return 'Registrar serviço corretivo agora &rarr;';
    if (actionCode === ACTION_CODE.REGISTER_CORRECTIVE) return 'Registrar serviço corretivo &rarr;';
    if (actionCode === ACTION_CODE.REGISTER_PREVENTIVE)
      return 'Registrar serviço preventivo &rarr;';
    if (actionCode === ACTION_CODE.SCHEDULE_PREVENTIVE)
      return 'Programar serviço preventivo &rarr;';
    return 'Registrar serviço &rarr;';
  }

  let proximaLabel = '—';
  let proximaCls = 'equip-card__metric-value--muted';
  let proximaIcon = '';
  if (context.proximaPreventiva) {
    const diff = Utils.daysDiff(context.proximaPreventiva);
    if (diff < 0) {
      proximaLabel = `Vencida há ${Math.abs(diff)}d`;
      proximaCls = 'equip-card__metric-value--danger';
      proximaIcon = '!!';
    } else if (diff === 0) {
      proximaLabel = 'Hoje';
      proximaCls = 'equip-card__metric-value--danger';
      proximaIcon = '!!';
    } else if (diff <= 7) {
      proximaLabel = `Em ${diff} dia${diff > 1 ? 's' : ''}`;
      proximaCls = 'equip-card__metric-value--warn';
      proximaIcon = '!';
    } else {
      proximaLabel = `Em ${diff} dias`;
    }
  }

  let ctaLabel = getCtaByAction(suggestedAction.actionCode);
  if (!last && suggestedAction.actionCode === ACTION_CODE.NONE)
    ctaLabel = 'Primeiro registro &rarr;';

  return `<div class="equip-card equip-card--${scls}" data-action="view-equip" data-id="${safeId}" role="listitem" tabindex="0" aria-label="${Utils.escapeHtml(eq?.nome ?? '—')} — ${STATUS_OPERACIONAL[scls]}">
    <div class="equip-card__status-band equip-card__status-band--${scls}"></div>
    <div class="equip-card__header">
      <div class="equip-card__type-icon equip-card__type-icon--lg">${icon}</div>
      <div class="equip-card__meta">
        <div class="equip-card__name ${scls === 'danger' ? 'equip-card__name--danger' : ''}">${Utils.escapeHtml(eq?.nome ?? '—')}</div>
        <div class="equip-card__tag">${Utils.escapeHtml(eq.fluido || eq.tipo)} &middot; Prioridade ${PRIORIDADE_LABEL[eq.criticidade] || PRIORIDADE_LABEL.media}</div>
      </div>
      <span class="equip-card__status equip-card__status--${scls}"><span class="status-dot status-dot--${scls}"></span>${STATUS_OPERACIONAL[scls]}</span>
    </div>
    <div class="equip-card__health">
      <div class="equip-card__health-bar"><div class="equip-card__health-fill equip-card__health-fill--${hcls}" style="width:${score}%"></div></div>
      <div class="equip-card__health-meta"><span class="equip-card__health-label">Eficiência</span><span class="equip-card__health-value equip-card__health-value--${hcls}">${score}%</span></div>
    </div>
    <div class="equip-card__risk">
      <span class="equip-card__risk-badge equip-card__risk-badge--${risk.classification}">${RISK_CLASS_LABEL[risk.classification]}</span>
      <span class="equip-card__risk-score">Score ${risk.score}</span>
      ${_renderTrendBadge(riskTrend)}
    </div>
    <div class="equip-card__priority">
      <span class="equip-card__priority-badge equip-card__priority-badge--${priority.priorityLevel}">${priority.priorityLabel}</span>
    </div>
    <div class="equip-card__metrics">
      <div class="equip-card__metric">
        <div class="equip-card__metric-label">Última manutenção</div>
        <div class="equip-card__metric-value">${last ? Utils.escapeHtml(_recencia(last.data)) : '<span class="equip-card__metric-empty">Nenhum registro</span>'}</div>
        ${last ? `<div class="equip-card__metric-sub">${Utils.escapeHtml(Utils.truncate(last.tipo, 22))}</div>` : ''}
      </div>
      <div class="equip-card__metric">
        <div class="equip-card__metric-label">Próxima prev.</div>
        <div class="equip-card__metric-value ${proximaCls}">${proximaIcon ? `<span>${proximaIcon}</span> ` : ''}${proximaLabel}</div>
      </div>
    </div>
    <div class="equip-card__footer">
      <button class="equip-card__cta" data-action="go-register-equip" data-id="${safeId}">${ctaLabel}</button>
    </div>
  </div>`;
}

// ═══════════════════════════════════════════════════════
// Hero Status Card
// ═══════════════════════════════════════════════════════
function _chipHtml(label) {
  return `<span class="dash__chip"><span class="dash__chip-check" aria-hidden="true">${DASH_SVG.check}</span>${Utils.escapeHtml(label)}</span>`;
}

function _renderHero({
  tier,
  tone,
  userName,
  equipCount,
  alertCount,
  efficiency,
  mesCount,
  primaryAlert,
}) {
  const hero = document.getElementById('dash-hero');
  const dashRoot = document.getElementById('dash');
  if (!hero || !dashRoot) return;

  dashRoot.setAttribute('data-tier', tier);
  dashRoot.setAttribute('data-tone', tone);
  hero.setAttribute('data-tone', tone);

  // Pill
  const pillIcon = document.getElementById('dash-hero-pill-icon');
  const pillText = document.getElementById('dash-hero-pill-text');
  if (pillIcon) pillIcon.innerHTML = tone === 'alert' ? DASH_SVG.alert : DASH_SVG.crown;
  if (pillText) pillText.textContent = tone === 'alert' ? 'AÇÃO NECESSÁRIA' : 'TUDO OPERANDO';

  // Greeting + datetime
  const greetingEl = document.getElementById('dash-hero-greeting');
  if (greetingEl) {
    const name = (userName || '').trim().split(/\s+/)[0] || 'Técnico';
    greetingEl.textContent = `Olá, ${name}`;
  }
  const dtEl = document.getElementById('dash-hero-datetime');
  if (dtEl) dtEl.textContent = _formatDateTimePill();

  // Description
  const descEl = document.getElementById('dash-hero-desc');
  if (descEl) {
    if (tone === 'alert' && primaryAlert) {
      const title = Utils.escapeHtml(primaryAlert.title || 'Intervenção necessária');
      const eqName = Utils.escapeHtml(primaryAlert.eq?.nome || 'equipamento');
      const sub = Utils.escapeHtml(
        Utils.truncate(primaryAlert.subtitle || 'Verifique o histórico recente.', 80),
      );
      descEl.innerHTML = `<strong class="dash__hero-desc-strong">${title}</strong> em <em>${eqName}</em>. ${sub}`;
    } else if (equipCount === 0) {
      descEl.textContent =
        'Cadastre seu primeiro equipamento para começar a acompanhar a operação.';
    } else {
      const plural = equipCount === 1 ? 'equipamento' : 'equipamentos';
      descEl.textContent = `Seu parque está saudável. ${equipCount} ${plural}, ${alertCount} alerta${alertCount === 1 ? '' : 's'} crítico${alertCount === 1 ? '' : 's'}.`;
    }
  }

  // Chips (só no estado "ok")
  const chipsEl = document.getElementById('dash-hero-chips');
  if (chipsEl) {
    if (tone === 'ok' && equipCount > 0) {
      const efLabel = efficiency != null ? `Eficiência ${efficiency}%` : null;
      const mesLabel =
        mesCount > 0
          ? `${mesCount} serviço${mesCount === 1 ? '' : 's'} este mês`
          : 'Nenhum serviço este mês';
      const planLabel = _planLabel(tier);
      chipsEl.innerHTML = [efLabel, mesLabel, planLabel].filter(Boolean).map(_chipHtml).join('');
    } else {
      chipsEl.innerHTML = '';
    }
  }

  // CTA
  const ctaBtn = document.getElementById('dash-hero-cta');
  const ctaLabel = document.getElementById('dash-hero-cta-label');
  if (ctaBtn && ctaLabel) {
    if (tone === 'alert' && primaryAlert) {
      const actionMeta = _getAlertActionMeta(primaryAlert);
      ctaBtn.setAttribute('data-action', actionMeta.action);
      ctaBtn.setAttribute('data-id', actionMeta.id);
      ctaBtn.removeAttribute('data-nav');
      ctaLabel.textContent = actionMeta.label;
    } else if (equipCount === 0) {
      ctaBtn.setAttribute('data-action', 'open-modal');
      ctaBtn.setAttribute('data-id', 'modal-add-eq');
      ctaBtn.removeAttribute('data-nav');
      ctaLabel.textContent = 'Cadastrar equipamento';
    } else {
      ctaBtn.setAttribute('data-nav', 'registro');
      ctaBtn.removeAttribute('data-action');
      ctaBtn.removeAttribute('data-id');
      ctaLabel.textContent = 'Registrar serviço';
    }
  }
}

// ═══════════════════════════════════════════════════════
// KPI Grid
// ═══════════════════════════════════════════════════════
function _renderKPIs({ equipamentos, registros, alerts }) {
  const total = equipamentos.length;
  const active = equipamentos.filter((e) => e.status !== 'danger').length;
  const faults = total - active;
  const alertCount = alerts.length;
  const mesCount = _countRegistrosNoMes(registros, 0);
  const mesPrev = _countRegistrosNoMes(registros, 1);
  const sparkData = _sparklineData(registros, 6);

  // Ativos
  const ativosEl = document.getElementById('dash-kpi-ativos');
  const ativosSub = document.getElementById('dash-kpi-ativos-sub');
  if (ativosEl) ativosEl.textContent = total ? `${active}/${total}` : '—';
  if (ativosSub) {
    ativosSub.textContent = !total ? 'sem cadastro' : faults > 0 ? `${faults} fora` : 'estável';
    ativosSub.dataset.tone = faults > 0 ? 'danger' : 'ok';
  }

  // Eficiência
  let efficiency = null;
  const efEl = document.getElementById('dash-kpi-ef');
  const efSub = document.getElementById('dash-kpi-ef-sub');
  const efSpark = document.getElementById('dash-kpi-ef-spark');
  if (total) {
    const scores = equipamentos.map((eq) => calcHealthScore(eq.id));
    efficiency = Math.round(scores.reduce((a, b) => a + b, 0) / Math.max(scores.length, 1));
    if (efEl) efEl.textContent = `${efficiency}%`;
    const cls = getHealthClass(efficiency);
    if (efEl) efEl.dataset.tone = cls === 'ok' ? 'ok' : cls === 'warn' ? 'warn' : 'danger';
    if (efSub) {
      efSub.textContent =
        efficiency >= 90
          ? 'excelente'
          : efficiency >= 75
            ? 'saudável'
            : efficiency >= 50
              ? 'atenção'
              : 'intervenção';
      efSub.dataset.tone = cls === 'ok' ? 'ok' : cls === 'warn' ? 'warn' : 'danger';
    }
    if (efSpark) efSpark.innerHTML = _sparklineSvg(scores.slice(-6));
  } else {
    if (efEl) efEl.textContent = '—';
    if (efEl) efEl.dataset.tone = 'muted';
    if (efSub) efSub.textContent = 'sem dados';
    if (efSpark) efSpark.innerHTML = '';
  }

  // Anomalias
  const anomEl = document.getElementById('dash-kpi-anom');
  const anomSub = document.getElementById('dash-kpi-anom-sub');
  if (anomEl) {
    anomEl.textContent = String(alertCount);
    anomEl.dataset.tone = alertCount > 0 ? 'danger' : 'ok';
  }
  if (anomSub) {
    anomSub.textContent = !alertCount
      ? 'sem alerta'
      : alertCount === 1
        ? '1 alerta ativo'
        : `${alertCount} alertas ativos`;
    anomSub.dataset.tone = alertCount > 0 ? 'danger' : 'ok';
  }

  // Serviços / mês
  const mesEl = document.getElementById('dash-kpi-mes');
  const mesSub = document.getElementById('dash-kpi-mes-sub');
  const mesSpark = document.getElementById('dash-kpi-mes-spark');
  if (mesEl) mesEl.textContent = String(mesCount);
  if (mesSub) {
    const tr = _trendTag(mesCount, mesPrev);
    mesSub.textContent = tr.text;
    mesSub.dataset.tone = tr.cls === 'up' ? 'ok' : tr.cls === 'down' ? 'warn' : 'muted';
  }
  if (mesSpark) mesSpark.innerHTML = _sparklineSvg(sparkData);

  return { efficiency, mesCount };
}

// ═══════════════════════════════════════════════════════
// Próxima Ação + Último Serviço
// ═══════════════════════════════════════════════════════
function _renderNextActionCard({ alerts, equipCount }) {
  const cardEl = document.getElementById('dash-next-action-card');
  const titleEl = document.getElementById('dash-next-title');
  const subEl = document.getElementById('dash-next-sub');
  const ctaEl = document.getElementById('dash-next-cta');
  const ctaLabelEl = document.getElementById('dash-next-cta-label');
  if (!cardEl || !titleEl || !subEl || !ctaEl || !ctaLabelEl) return;

  const primary = _getMostSevereAlert(alerts);
  if (primary) {
    const actionMeta = _getAlertActionMeta(primary);
    cardEl.setAttribute('data-tone', primary.severity === 'danger' ? 'danger' : 'warn');
    titleEl.textContent = primary.title || 'Verificar equipamento';
    subEl.textContent =
      primary.subtitle || (primary.eq?.nome ? `em ${primary.eq.nome}` : 'Ação recomendada');
    ctaEl.setAttribute('data-action', actionMeta.action);
    ctaEl.setAttribute('data-id', actionMeta.id);
    ctaEl.removeAttribute('data-nav');
    ctaLabelEl.textContent = actionMeta.label;
    return;
  }

  cardEl.setAttribute('data-tone', 'ok');
  if (!equipCount) {
    titleEl.textContent = 'Cadastre o primeiro equipamento';
    subEl.textContent = 'Depois você poderá registrar manutenções e acompanhar alertas.';
    ctaEl.setAttribute('data-action', 'open-modal');
    ctaEl.setAttribute('data-id', 'modal-add-eq');
    ctaEl.removeAttribute('data-nav');
    ctaLabelEl.textContent = 'Cadastrar';
  } else {
    titleEl.textContent = 'Nenhuma ação urgente';
    subEl.textContent = 'Todas as rotinas dentro do prazo.';
    ctaEl.setAttribute('data-nav', 'historico');
    ctaEl.removeAttribute('data-action');
    ctaEl.removeAttribute('data-id');
    ctaLabelEl.textContent = 'Ver histórico';
  }
}

function _renderLastServiceCard({ registros }) {
  const card = document.getElementById('dash-last-service');
  const titleEl = document.getElementById('dash-last-title');
  const subEl = document.getElementById('dash-last-sub');
  const descEl = document.getElementById('dash-last-desc');
  if (!card || !titleEl || !subEl || !descEl) return;

  if (!registros.length) {
    card.hidden = true;
    return;
  }

  const last = [...registros].sort((a, b) => b.data.localeCompare(a.data))[0];
  const eq = findEquip(last.equipId);
  card.hidden = false;
  titleEl.textContent = last.tipo || 'Serviço';
  subEl.textContent = [eq?.nome || '—', _recencia(last.data)].filter(Boolean).join(' · ');
  descEl.textContent = last.obs ? Utils.truncate(last.obs, 92) : '';
}

// ═══════════════════════════════════════════════════════
// Seções secundárias (critical-now, alertas-mini, criticos, recentes)
// ═══════════════════════════════════════════════════════
function _renderCriticalNowSection(equipamentos) {
  const section = document.getElementById('dash-critical-section');
  const container = document.getElementById('dash-critical-now');
  const countEl = document.getElementById('dash-critical-now-count');
  if (!section || !container) return;

  if (!equipamentos.length) {
    section.hidden = true;
    return;
  }

  const actionQueue = equipamentos
    .map((eq) => ({ eq, score: getActionPriorityScore(eq, regsForEquip(eq.id)) }))
    .sort((a, b) => b.score.actionPriorityScore - a.score.actionPriorityScore)
    .slice(0, 9);

  const groups = {
    critico: actionQueue.filter((i) => i.score.group === 'critico').slice(0, 3),
    atencao: actionQueue.filter((i) => i.score.group === 'atencao').slice(0, 3),
  };

  const render = (items, tone) =>
    items
      .map(({ eq, score }) => {
        const actionMeta = _getActionButton(score.suggestedAction.actionCode);
        return _criticalNowItemHtml({
          icon: score.group === 'critico' ? '!!' : '!',
          tone,
          title: `${eq.nome || 'Equipamento'} · ${score.suggestedAction.actionLabel}`,
          subtitle: score.reasons.join(' · ') || 'Ação recomendada',
          action: actionMeta.action,
          id: eq.id,
          ctaLabel: actionMeta.ctaLabel,
        });
      })
      .join('');

  const total = groups.critico.length + groups.atencao.length;
  if (!total) {
    section.hidden = true;
    return;
  }

  section.hidden = false;
  if (countEl) countEl.textContent = String(total);
  container.innerHTML = `
    ${
      groups.critico.length
        ? `<div class="critical-now-group">
            <div class="critical-now-group__label">Crítico agora</div>
            <div class="critical-now-list">${render(groups.critico, 'danger')}</div>
          </div>`
        : ''
    }
    ${
      groups.atencao.length
        ? `<div class="critical-now-group">
            <div class="critical-now-group__label">Atenção</div>
            <div class="critical-now-list">${render(groups.atencao, 'warn')}</div>
          </div>`
        : ''
    }
  `;
}

function _renderAlertsMiniSection({ alerts, planContext }) {
  const section = document.getElementById('dash-alerts-section');
  const list = document.getElementById('dash-alertas-mini');
  const hint = document.getElementById('dash-upgrade-inline-hint');
  if (!section || !list) return;
  if (!alerts.length) {
    section.hidden = true;
    if (hint) hint.innerHTML = '';
    return;
  }
  section.hidden = false;
  list.innerHTML = `<div class="dash-alertas-list">${alerts.slice(0, 4).map(_alertCardHtml).join('')}</div>`;
  if (hint) {
    hint.innerHTML = planContext.hasPro
      ? ''
      : UpgradeNudge.renderInlineHint('Exportar relatorio em lote', {
          planCode: planContext.planCode,
          requiredPlan: 'plus',
        });
  }
}

function _renderCriticosSection({ equipamentos, alerts }) {
  const section = document.getElementById('dash-criticos-section');
  const container = document.getElementById('dash-criticos');
  if (!section || !container) return;

  const critical = equipamentos
    .map((eq) => {
      const eqRegs = regsForEquip(eq.id);
      return {
        eq,
        score: calcHealthScore(eq.id),
        riskScore: evaluateEquipmentRisk(eq, eqRegs).score,
        priority: evaluateEquipmentPriority(eq, eqRegs),
        hasAlert: alerts.some((alert) => alert.eq?.id === eq.id),
      };
    })
    .filter(
      ({ eq, score, priority, hasAlert }) =>
        hasAlert ||
        getOperationalStatus({ status: eq.status }).code !== 'ok' ||
        score < 80 ||
        priority.priorityLevel >= 2,
    )
    .sort(
      (a, b) =>
        b.priority.priorityLevel - a.priority.priorityLevel ||
        Number(b.hasAlert) - Number(a.hasAlert) ||
        b.riskScore - a.riskScore ||
        a.score - b.score,
    )
    .map(({ eq }) => eq)
    .slice(0, 4);

  if (!critical.length) {
    section.hidden = true;
    return;
  }
  section.hidden = false;
  container.innerHTML = `<div class="dash-criticos-list">${critical.map((eq) => _equipCardMini(eq)).join('')}</div>`;
}

function _renderRecentesSection({ registros }) {
  const section = document.getElementById('dash-recentes-section');
  const container = document.getElementById('dash-recentes');
  if (!section || !container) return;
  if (registros.length < 2) {
    // Com < 2 registros, o "Último serviço" já cobre. Evita duplicar.
    section.hidden = true;
    return;
  }
  const recent = [...registros].sort((a, b) => b.data.localeCompare(a.data)).slice(1, 4);
  if (!recent.length) {
    section.hidden = true;
    return;
  }
  section.hidden = false;
  container.innerHTML = `<div class="dash-recentes-grid">${recent
    .map((r) => {
      const eq = findEquip(r.equipId);
      return `<article class="card recent-card" data-nav="historico">
        <div class="recent-card__date">${Utils.formatDatetime(r.data)}</div>
        <div class="recent-card__title">${Utils.escapeHtml(r.tipo)}</div>
        <div class="recent-card__equip">${Utils.escapeHtml(eq?.nome ?? '—')} · ${Utils.escapeHtml(eq?.tag ?? '')}</div>
        <div class="recent-card__obs">${Utils.escapeHtml(Utils.truncate(r.obs, 70))}</div>
      </article>`;
    })
    .join('')}</div>`;
}

// ═══════════════════════════════════════════════════════
// Charts refresh (debounced)
// ═══════════════════════════════════════════════════════
let _lastChartHash = null;
let _chartsModulePromise = null;
function _loadCharts() {
  // Cacheia a promise pra que múltiplas chamadas concorrentes reusem o mesmo
  // import — o chunk do Chart.js só é baixado uma vez.
  if (!_chartsModulePromise) {
    _chartsModulePromise = import('../components/charts.js').then((m) => m.Charts);
  }
  return _chartsModulePromise;
}
function _refreshCharts() {
  const viewInicio = document.getElementById('view-inicio');
  if (!viewInicio?.classList.contains('active')) return;
  const { registros, equipamentos } = getState();
  const hash = `${equipamentos.length}:${registros.length}:${equipamentos.map((e) => e.status).join('')}`;
  if (hash === _lastChartHash) return;
  _lastChartHash = hash;
  _loadCharts().then((Charts) => {
    requestAnimationFrame(() => requestAnimationFrame(() => Charts.refreshAll()));
  });
}

// ═══════════════════════════════════════════════════════
// Header status (app-wide — não-dashboard-específico)
// ═══════════════════════════════════════════════════════
function _setStatusIndicatorState(el, tone, options = {}) {
  if (!el) return;
  const { live = false, syncing = false } = options;
  el.classList.remove(
    'status-indicator--ok',
    'status-indicator--warn',
    'status-indicator--danger',
    'status-indicator--live',
    'status-indicator--syncing',
  );
  el.classList.add(`status-indicator--${tone}`);
  if (live) el.classList.add('status-indicator--live');
  if (syncing) el.classList.add('status-indicator--syncing');
}

function _updateGlobalHeader({ equipamentos, registros, alerts }) {
  const today = new Date();
  const alertCount = alerts.length;
  const faultCount = equipamentos.filter((e) => e.status === 'danger').length;
  const activeCount = equipamentos.filter((e) => e.status !== 'danger').length;
  const mesCount = _countRegistrosNoMes(registros, 0);

  const dateEl = Utils.getEl('hdr-date');
  if (dateEl)
    dateEl.textContent = today
      .toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })
      .toUpperCase();

  const totalEl = Utils.getEl('hst-total');
  if (totalEl)
    totalEl.textContent = equipamentos.length ? `${activeCount}/${equipamentos.length}` : '—';
  const mesEl = Utils.getEl('hst-mes');
  if (mesEl) mesEl.textContent = mesCount || '—';
  const alertEl = Utils.getEl('hst-alert');
  if (alertEl) alertEl.textContent = alertCount || '0';

  const badge = Utils.getEl('alerta-badge');
  if (badge) {
    badge.textContent = String(alertCount);
    badge.classList.toggle('is-visible', alertCount > 0);
  }

  const preventivas7dCount = Alerts.countPreventivas7Dias();
  const headerAlertPill = Utils.getEl('header-alert-pill');
  const headerAlertTooltip = Utils.getEl('header-alert-tooltip');
  const headerAlertBtn = document.querySelector('.header-alert-btn');
  if (headerAlertPill && headerAlertTooltip && headerAlertBtn) {
    headerAlertPill.textContent = String(preventivas7dCount);
    headerAlertPill.hidden = preventivas7dCount <= 0;
    headerAlertPill.classList.toggle('is-visible', preventivas7dCount > 0);
    headerAlertTooltip.textContent = `${preventivas7dCount} equipamento${preventivas7dCount > 1 ? 's' : ''} com preventiva nos próximos 7 dias`;
    headerAlertTooltip.hidden = preventivas7dCount <= 0;
    headerAlertBtn.setAttribute('title', headerAlertTooltip.textContent);
  }

  const statusSistema = Utils.getEl('status-sistema');
  const statusFalhas = Utils.getEl('status-falhas');
  const statusFalhasTxt = Utils.getEl('status-falhas-txt');
  if (statusSistema && statusFalhas) {
    if (faultCount > 0) {
      statusSistema.hidden = true;
      statusFalhas.hidden = false;
      _setStatusIndicatorState(statusFalhas, 'danger', { live: true });
      if (statusFalhasTxt)
        statusFalhasTxt.textContent = `${faultCount} situaç${faultCount > 1 ? 'ões' : 'ão'} crítica${faultCount > 1 ? 's' : ''} em aberto`;
    } else if (alertCount > 0) {
      statusSistema.innerHTML = `<span class="status-indicator__dot status-indicator__dot--warn"></span><span>Atenção requerida</span>`;
      statusSistema.hidden = false;
      statusFalhas.hidden = true;
      _setStatusIndicatorState(statusSistema, 'warn', { live: true });
      _setStatusIndicatorState(statusFalhas, 'danger');
    } else {
      statusSistema.innerHTML = `<span class="status-indicator__dot status-indicator__dot--ok"></span><span>Sistema operacional</span>`;
      statusSistema.hidden = false;
      statusFalhas.hidden = true;
      _setStatusIndicatorState(statusSistema, 'ok');
      _setStatusIndicatorState(statusFalhas, 'danger');
    }
  }

  const syncStatusEl = Utils.getEl('sync-status');
  const syncStatusTxt = Utils.getEl('sync-status-txt');
  if (syncStatusEl && syncStatusTxt) {
    const syncStatus = Storage.getSyncStatus();
    const dot = syncStatusEl.querySelector('.status-indicator__dot');
    if (syncStatus.state === 'syncing') {
      syncStatusEl.hidden = false;
      if (dot) dot.className = 'status-indicator__dot status-indicator__dot--ok';
      _setStatusIndicatorState(syncStatusEl, 'ok', { live: true, syncing: true });
      syncStatusTxt.textContent =
        syncStatus.pendingOps > 1 ? 'Sincronizando alterações...' : 'Sincronizando...';
    } else if (syncStatus.state === 'pending') {
      syncStatusEl.hidden = false;
      if (dot) dot.className = 'status-indicator__dot status-indicator__dot--warn';
      _setStatusIndicatorState(syncStatusEl, 'warn', { live: true });
      syncStatusTxt.textContent =
        syncStatus.pendingOps > 0
          ? `Sincronização pendente (${syncStatus.pendingOps})`
          : 'Sincronização pendente';
    } else {
      syncStatusEl.hidden = true;
      _setStatusIndicatorState(syncStatusEl, 'ok');
    }
  }
}

// ═══════════════════════════════════════════════════════
// API PÚBLICA
// ═══════════════════════════════════════════════════════

export function updateHeader() {
  const { equipamentos, registros } = getState();
  const alerts = Alerts.getAll();
  _updateGlobalHeader({ equipamentos, registros, alerts });
  // KPIs também são populadas aqui para respostas em tempo real a mudanças vindas de outras views.
  _renderKPIs({ equipamentos, registros, alerts });
}

export async function renderDashboard() {
  const viewInicio = Utils.getEl('view-inicio');
  if (!viewInicio) return;

  // Skeleton cobre TODO o ciclo — incluindo o await do planContext — para
  // que o usuário nunca veja a view em branco enquanto buscamos billing.
  withSkeleton(viewInicio, { enabled: true, variant: 'generic', count: 4 }, async () => {
    const planContext = await resolveDashboardPlanContext();
    const { equipamentos, registros } = getState();
    const alerts = Alerts.getAll();

    const tier = _planTier(planContext.planCode);

    // Tier no root pra theming
    const dashRoot = document.getElementById('dash');
    if (dashRoot) dashRoot.setAttribute('data-tier', tier);

    // Empty state curto quando sem equipamentos — mantém hero + KPIs desligados
    const emptyHost = document.getElementById('dash-empty');
    if (!equipamentos.length && emptyHost) {
      emptyHost.hidden = false;
      emptyHost.innerHTML = emptyStateHtml({
        icon: '🔧',
        title: 'Seu painel está pronto',
        description:
          'Cadastre o primeiro equipamento para ver eficiência, alertas e histórico em tempo real.',
        cta: {
          label: '+ Cadastrar meu primeiro equipamento',
          action: 'open-modal',
          id: 'modal-add-eq',
          tone: 'primary',
          autoWidth: true,
          centered: true,
        },
      });
    } else if (emptyHost) {
      emptyHost.hidden = true;
      emptyHost.innerHTML = '';
    }

    // KPIs (retorna eficiência e mesCount pro hero)
    const { efficiency, mesCount } = _renderKPIs({ equipamentos, registros, alerts });

    // Tone do hero
    const hasCritical = alerts.some((a) => a.severity === 'danger');
    const primaryAlert = _getMostSevereAlert(alerts);
    const tone = hasCritical ? 'alert' : 'ok';

    // Nome do usuário
    let userName = '';
    try {
      const user = await Auth.getUser();
      userName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || '';
    } catch {
      // sem fallback: userName fica vazio e o hero cai em "Técnico"
    }

    _renderHero({
      tier,
      tone,
      userName,
      equipCount: equipamentos.length,
      alertCount: alerts.length,
      efficiency,
      mesCount,
      primaryAlert,
    });

    _populateHeaderIdentity({ tier, userName });

    _renderNextActionCard({ alerts, equipCount: equipamentos.length });
    _renderLastServiceCard({ registros });

    // Seções secundárias
    _renderCriticalNowSection(equipamentos);
    _renderAlertsMiniSection({ alerts, planContext });
    _renderCriticosSection({ equipamentos, alerts });
    _renderRecentesSection({ registros });

    // Plan extras: onboarding + usage meter + upgrade card
    OnboardingBanner.render();

    const usageMeterHost = document.getElementById('dash-usage-meter');
    if (usageMeterHost) {
      usageMeterHost.innerHTML = UsageMeter.render({ planCode: planContext.planCode });
    }

    const upgradeCardHost = document.getElementById('dash-upgrade-card');
    if (upgradeCardHost) {
      upgradeCardHost.innerHTML = planContext.hasPro
        ? _renderProStatusCard()
        : UpgradeNudge.renderDashboardCard({ planCode: planContext.planCode });
    }

    // Header global (status, sync, badges)
    _updateGlobalHeader({ equipamentos, registros, alerts });

    // Charts
    _refreshCharts();
  });
}
