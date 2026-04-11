/**
 * CoolTrack Pro - Dashboard View v5.0
 * Funções: updateHeader, renderDashboard (renderInicio)
 */

import { Utils, TIPO_ICON } from '../../core/utils.js';
import { getState, findEquip, regsForEquip } from '../../core/state.js';
import { Storage } from '../../core/storage.js';
import { Auth } from '../../core/auth.js';
import { Alerts } from '../../domain/alerts.js';
import { Charts } from '../components/charts.js';
import { emptyStateHtml } from '../components/emptyState.js';
import { OnboardingBanner } from '../components/onboarding.js';
import { UpgradeNudge } from '../components/upgradeNudge.js';
import { UsageMeter } from '../components/usageMeter.js';
import { withViewSkeleton } from '../components/skeleton.js';
import { fetchMyProfileBilling } from '../../core/monetization.js';
import { PLAN_CODE_FREE, getEffectivePlan, hasProAccess } from '../../core/subscriptionPlans.js';
import {
  calculateHealthScore,
  evaluateEquipmentRisk,
  getEquipmentMaintenanceContext,
  getHealthClass as getMaintenanceHealthClass,
} from '../../domain/maintenance.js';
import { evaluateEquipmentPriority } from '../../domain/priorityEngine.js';
import { ACTION_CODE, evaluateEquipmentSuggestedAction } from '../../domain/suggestedAction.js';
import { getActionPriorityScore } from '../../domain/actionPriority.js';
import { getOperationalStatus } from '../../core/equipmentRules.js';

// ── Labels internos ────────────────────────────────────
const STATUS_OPERACIONAL = {
  ok: 'OPERANDO NORMALMENTE',
  warn: 'OPERANDO COM RESTRIÇÕES',
  danger: 'FORA DE OPERAÇÃO',
};
const PRIORIDADE_LABEL = { baixa: 'Baixa', media: 'Média', alta: 'Alta', critica: 'Crítica' };
const RISK_CLASS_LABEL = { baixo: 'Baixo risco', medio: 'Médio risco', alto: 'Alto risco' };

const ALERT_SEVERITY_WEIGHT = { danger: 3, warn: 2, info: 1 };

function _getMostSevereAlert(alerts = []) {
  return [...alerts].sort(
    (a, b) =>
      (ALERT_SEVERITY_WEIGHT[b?.severity] || 0) - (ALERT_SEVERITY_WEIGHT[a?.severity] || 0) ||
      (b?.sortScore || 0) - (a?.sortScore || 0),
  )[0];
}

// ── Helpers privados de métricas ───────────────────────
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
  if (diff > 0) return { text: `&uarr; ${diff} vs mês passado`, cls: 'up' };
  return { text: `&darr; ${Math.abs(diff)} vs mês passado`, cls: 'down' };
}

function _sparklineHtml(data, color = 'var(--primary)') {
  const max = Math.max(...data, 1);
  const bars = data
    .map((v, i) => {
      const pct = Math.round((v / max) * 100);
      const isLast = i === data.length - 1;
      const fill = isLast ? color : 'var(--surface-3)';
      const height = Math.max(pct, 8);
      return `<div class="kpi-spark__bar${isLast ? ' kpi-spark__bar--last' : ''}"
      style="height:${height}%;background:${fill}"
      title="${v} serviço${v !== 1 ? 's' : ''}"></div>`;
    })
    .join('');
  return `<div class="kpi-spark">${bars}</div>`;
}

function _alertContextText(count) {
  if (count === 0) return { text: 'Sem alertas', cls: 'ok' };
  if (count === 1) return { text: '1 alerta ativo', cls: 'warn' };
  return { text: `${count} alertas ativos`, cls: 'danger' };
}

export function calcHealthScore(eqId) {
  const eq = findEquip(eqId);
  if (!eq) return 0;
  return calculateHealthScore(eq, regsForEquip(eqId));
}

export function getHealthClass(score) {
  return getMaintenanceHealthClass(score);
}

function _renderGlobalEfficiency(equipamentos) {
  const el = Utils.getEl('hst-health');
  const barEl = Utils.getEl('health-bar-fill');
  const subEl = Utils.getEl('hst-health-sub');
  if (!equipamentos.length) {
    if (el) el.textContent = '—';
    if (barEl) barEl.style.width = '0%';
    if (subEl) subEl.innerHTML = '';
    return;
  }
  const scores = equipamentos.map((eq) => calcHealthScore(eq.id));
  const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  const cls = getHealthClass(avg);
  if (el) {
    el.textContent = `${avg}%`;
    el.className = `bento-kpi__value bento-kpi__value--${cls === 'ok' ? 'cyan' : cls}`;
  }
  if (barEl) {
    barEl.style.width = `${avg}%`;
    barEl.className = `health-bar__fill health-bar__fill--${cls}`;
  }
  if (subEl) {
    const ctx =
      avg >= 90
        ? `<span class="kpi-trend kpi-trend--ok">&uarr; Excelente - parque saudavel</span>`
        : avg >= 75
          ? `<span class="kpi-trend kpi-trend--ok">Bom - manutencao em dia</span>`
          : avg >= 50
            ? `<span class="kpi-trend kpi-trend--warn">&#9888; Atencao recomendada</span>`
            : `<span class="kpi-trend kpi-trend--down">&darr; Intervencao necessaria</span>`;
    subEl.innerHTML = ctx;
  }
}

function _updateStorageIndicator() {
  const indicator = Utils.getEl('storage-indicator');
  if (!indicator) return;
  const { used, total, percent } = Storage.usage();
  if (percent < 50) {
    indicator.hidden = true;
    return;
  }
  indicator.hidden = false;
  const cls = percent >= 85 ? 'danger' : 'warn';
  indicator.className = `storage-indicator storage-indicator--${cls}`;
  indicator.innerHTML = `<div class="storage-indicator__label"><span>Armazenamento local</span><span>${Utils.formatBytes(used)} / ${Utils.formatBytes(total)}</span></div><div class="storage-indicator__bar"><div class="storage-indicator__fill storage-indicator__fill--${cls}" style="width:${percent}%"></div></div>`;
}

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
    return { planCode: PLAN_CODE_FREE, hasPro: false };
  }
}

// ── Alert strip ────────────────────────────────────────
function _renderAlertStrip(alerts, hasCritical = false) {
  const el = Utils.getEl('dash-alert-strip');
  if (!el) return;
  const primary = _getMostSevereAlert(alerts);
  if (!hasCritical && !primary) {
    el.innerHTML = `<div class="alert-strip alert-strip--none">
      <div class="alert-strip__icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="var(--success)" stroke-width="1.3"/><path d="M5 8l2 2 4-4" stroke="var(--success)" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
      <div><div class="alert-strip__title">Todos os equipamentos operando normalmente</div><div class="alert-strip__desc">Sem anormalidades críticas registradas em campo</div></div>
    </div>`;
    return;
  }
  if (!primary) {
    el.innerHTML = '';
    return;
  }

  if (hasCritical) {
    const actionMeta = _getAlertActionMeta(primary);
    const preventiveText = primary.nextDueDate
      ? `🛠 Prev.: ${Utils.formatDate(primary.nextDueDate)}`
      : '🛠 Preventiva em atraso';
    el.innerHTML = `<div class="critical-incident" role="alert" aria-live="assertive">
      <div class="critical-incident__label">SITUAÇÃO CRÍTICA</div>
      <div class="critical-incident__title">${Utils.escapeHtml(primary.eq?.nome || 'Equipamento não identificado')}</div>
      <div class="critical-incident__desc">&#9888; ${Utils.truncate(primary.title || primary.subtitle || 'Intervenção imediata necessária.', 92)}</div>
      <div class="critical-incident__meta">${Utils.escapeHtml(preventiveText)} &middot; &rarr; Ação imediata</div>
      <button class="btn btn--danger btn--sm btn--fit-content critical-incident__cta" data-action="${actionMeta.action}" data-id="${actionMeta.id}">Registrar agora</button>
    </div>`;
    return;
  }

  const detailParts = [];
  if (primary.eq?.nome) detailParts.push(Utils.escapeHtml(primary.eq.nome));
  if (primary.subtitle) detailParts.push(primary.subtitle);
  const detail = detailParts.join(' &middot; ');
  const meta = primary.reg?.data
    ? `Ult. serviço: ${Utils.formatDatetime(primary.reg.data)}`
    : primary.nextDueDate
      ? `Próxima preventiva: ${Utils.formatDate(primary.nextDueDate)}`
      : '';
  const actionMeta = _getAlertActionMeta(primary);
  const toneClass =
    primary.severity === 'danger'
      ? 'alert-strip--critical'
      : primary.severity === 'warn'
        ? 'alert-strip--warn'
        : 'alert-strip--info';

  el.innerHTML = `<div class="alert-strip ${toneClass}" role="alert" aria-live="assertive">
    <div class="alert-strip__icon" aria-hidden="true">${primary.icon || '!'}</div>
    <div class="alert-strip__content">
      <div class="alert-strip__title">${primary.title}</div>
      <div class="alert-strip__desc">${detail}</div>
      ${meta ? `<div class="alert-strip__time">${Utils.escapeHtml(meta)}</div>` : ''}
    </div>
    <button class="btn ${primary.severity === 'danger' ? 'btn--danger' : 'btn--primary'} btn--sm btn--fit-content alert-strip__cta" data-action="${actionMeta.action}" data-id="${actionMeta.id}">${actionMeta.label}</button>
  </div>`;
}

// ── Alert card ─────────────────────────────────────────
function _getAlertActionMeta(alert) {
  const id = Utils.escapeAttr(alert.eq?.id || '');
  switch (alert.recommendedAction) {
    case 'register-now':
      return { action: 'go-register-equip', id, label: 'Registrar agora' };
    case 'schedule':
      return { action: 'go-register-equip', id, label: 'Registrar preventiva' };
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

// ── Próxima ação (D3) ──────────────────────────────────
function _renderNextAction(equipamentos, alerts) {
  const el = Utils.getEl('dash-next-action');
  if (!el) return;
  if (!equipamentos.length) {
    el.innerHTML = '';
    return;
  }

  const primaryAlert = _getMostSevereAlert(alerts);
  if (primaryAlert) {
    const actionMeta = _getAlertActionMeta(primaryAlert);
    const cardClass =
      primaryAlert.severity === 'danger'
        ? 'next-action-card next-action-card--urgent'
        : primaryAlert.kind === 'no-history'
          ? 'next-action-card next-action-card--invite'
          : 'next-action-card';

    el.innerHTML = `<div class="${cardClass}" data-action="${actionMeta.action}" data-id="${actionMeta.id}">
      <div class="next-action-card__icon">${primaryAlert.icon || '!'}</div>
      <div class="next-action-card__body">
        <div class="next-action-card__label">${primaryAlert.title.toUpperCase()}</div>
        <div class="next-action-card__title">${Utils.escapeHtml(primaryAlert.eq?.nome || '—')}</div>
        <div class="next-action-card__sub">${primaryAlert.subtitle || ''}</div>
      </div>
      <button class="btn ${primaryAlert.severity === 'danger' ? 'btn--danger' : 'btn--primary'} btn--sm btn--fit-content" data-action="${actionMeta.action}" data-id="${actionMeta.id}">${actionMeta.label}</button>
    </div>`;
    return;
  }

  el.innerHTML = `<div class="next-action-card next-action-card--ok">
    <div class="next-action-card__icon">OK</div>
    <div class="next-action-card__body">
      <div class="next-action-card__label">NENHUMA AÇÃO URGENTE</div>
      <div class="next-action-card__title">Todas as rotinas estão dentro do prazo</div>
      <div class="next-action-card__sub">Continue registrando os serviços para manter o histórico atualizado</div>
    </div>
  </div>`;
}

// ── equip card (miniatura para o dashboard) ────────────
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
  const priority = evaluateEquipmentPriority(eq, eqRegs);
  const suggestedAction = evaluateEquipmentSuggestedAction(eq, eqRegs);

  function getCtaByAction(actionCode) {
    if (actionCode === ACTION_CODE.REGISTER_CORRECTIVE_IMMEDIATE)
      return 'Registrar corretiva agora &rarr;';
    if (actionCode === ACTION_CODE.REGISTER_CORRECTIVE) return 'Registrar corretiva &rarr;';
    if (actionCode === ACTION_CODE.REGISTER_PREVENTIVE) return 'Registrar preventiva &rarr;';
    if (actionCode === ACTION_CODE.SCHEDULE_PREVENTIVE) return 'Programar preventiva &rarr;';
    return 'Registrar serviço &rarr;';
  }
  function recencia(data) {
    const diff = Math.round((new Date() - new Date(data)) / 86400000);
    if (diff === 0) return 'Hoje';
    if (diff === 1) return 'Ontem';
    if (diff < 30) return `Há ${diff} dias`;
    if (diff < 60) return 'Há 1 mês';
    return `Há ${Math.floor(diff / 30)} meses`;
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
      <div class="equip-card__actions">
        <button class="equip-card__delete" data-action="delete-equip" data-id="${safeId}" aria-label="Excluir ${Utils.escapeHtml(eq?.nome ?? '—')}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
        </button>
      </div>
    </div>
    <div class="equip-card__health">
      <div class="equip-card__health-bar"><div class="equip-card__health-fill equip-card__health-fill--${hcls}" style="width:${score}%"></div></div>
      <div class="equip-card__health-meta"><span class="equip-card__health-label">Eficiência</span><span class="equip-card__health-value equip-card__health-value--${hcls}">${score}%</span></div>
    </div>
    <div class="equip-card__risk">
      <span class="equip-card__risk-badge equip-card__risk-badge--${risk.classification}">${RISK_CLASS_LABEL[risk.classification]}</span>
      <span class="equip-card__risk-score">Score ${risk.score}</span>
      <span class="equip-card__risk-factors">Base ${risk.technicalBaseScore} × Criticidade ${risk.criticidadeMultiplier.toFixed(2)}</span>
    </div>
    <div class="equip-card__priority">
      <span class="equip-card__priority-badge equip-card__priority-badge--${priority.priorityLevel}">${priority.priorityLabel}</span>
      <span class="equip-card__priority-reasons">${priority.priorityReasons.join(' &middot; ')}</span>
    </div>
    <div class="equip-card__suggested-action">
      <span class="equip-card__suggested-action-label">Ação recomendada (baseada nos registros)</span>
      <span class="equip-card__suggested-action-title">${suggestedAction.actionLabel}</span>
      <span class="equip-card__suggested-action-reasons">${suggestedAction.actionReasons.join(' &middot; ')}</span>
    </div>
    <div class="equip-card__metrics">
      <div class="equip-card__metric">
        <div class="equip-card__metric-label">Última manutenção</div>
        <div class="equip-card__metric-value">${last ? Utils.escapeHtml(recencia(last.data)) : '<span class="equip-card__metric-empty">Nenhum registro</span>'}</div>
        ${last ? `<div class="equip-card__metric-sub">${Utils.escapeHtml(Utils.truncate(last.tipo, 22))}</div>` : ''}
      </div>
      <div class="equip-card__metric">
        <div class="equip-card__metric-label">Localização</div>
        <div class="equip-card__metric-value equip-card__metric-value--muted">${Utils.escapeHtml(Utils.truncate(eq.local, 24))}</div>
      </div>
      <div class="equip-card__metric">
        <div class="equip-card__metric-label">Próxima prev.</div>
        <div class="equip-card__metric-value ${proximaCls}">${proximaIcon ? `<span>${proximaIcon}</span> ` : ''}${proximaLabel}</div>
      </div>
    </div>
    <div class="equip-card__footer">
      <span class="equip-card__footer-tecnico">${last?.tecnico ? `👷 ${Utils.escapeHtml(last.tecnico)}` : ''}</span>
      <button class="equip-card__cta" data-action="go-register-equip" data-id="${safeId}">${ctaLabel}</button>
    </div>
  </div>`;
}

// ── Gráficos ───────────────────────────────────────────
let _lastChartHash = null;

function _renderStatusChart() {
  const viewInicio = Utils.getEl('view-inicio');
  if (!viewInicio?.classList.contains('active')) return;
  const { registros, equipamentos } = getState();
  const hash = `${equipamentos.length}:${registros.length}:${equipamentos.map((e) => e.status).join('')}`;
  if (hash === _lastChartHash) return;
  _lastChartHash = hash;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => Charts.refreshAll());
  });
}

// ═══════════════════════════════════════════════════════
// API PÚBLICA
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

export function updateHeader() {
  const { equipamentos, registros } = getState();
  const today = new Date();
  const alerts = Alerts.getAll();
  const alertCount = alerts.length;
  const faultCount = equipamentos.filter((e) => e.status === 'danger').length;
  const activeCount = equipamentos.filter((e) => e.status !== 'danger').length;
  const mesCount = _countRegistrosNoMes(registros, 0);
  const mesPrev = _countRegistrosNoMes(registros, 1);
  const sparkData = _sparklineData(registros, 6);

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
        statusFalhasTxt.textContent = `${faultCount} situação${faultCount > 1 ? 'ões' : ''} crítica${faultCount > 1 ? 's' : ''} em aberto`;
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

  // KPIs
  const bentAlert = Utils.getEl('hst-alert-bento');
  if (bentAlert) {
    bentAlert.textContent = String(activeCount);
    bentAlert.className = `bento-kpi__value bento-kpi__value--${faultCount > 0 ? 'danger' : 'ok'}`;
  }
  const bentAlertSub = Utils.getEl('hst-alert-bento-sub');
  if (bentAlertSub)
    bentAlertSub.innerHTML =
      faultCount > 0
        ? `<span class="kpi-trend kpi-trend--down">${faultCount} fora</span>`
        : `<span class="kpi-trend kpi-trend--ok">estável</span>`;

  const failEl = Utils.getEl('hst-fail-bento');
  if (failEl) {
    failEl.textContent = String(faultCount);
    failEl.className = `bento-kpi__value bento-kpi__value--${faultCount > 0 ? 'danger' : 'ok'}`;
  }
  const failSub = Utils.getEl('hst-fail-bento-sub');
  if (failSub) {
    const ctx = _alertContextText(alertCount);
    failSub.innerHTML = `<span class="kpi-trend kpi-trend--${ctx.cls}">${ctx.text}</span>`;
  }

  const mesB = Utils.getEl('hst-mes-bento');
  if (mesB) mesB.textContent = String(mesCount);
  const mesBSub = Utils.getEl('hst-mes-bento-sub');
  if (mesBSub) {
    const trend = _trendTag(mesCount, mesPrev);
    mesBSub.innerHTML = `<span class="kpi-trend kpi-trend--${trend.cls}">${trend.text}</span>`;
  }
  const mesSpark = Utils.getEl('hst-mes-spark');
  if (mesSpark) mesSpark.innerHTML = _sparklineHtml(sparkData, 'var(--primary)');

  _renderGlobalEfficiency(equipamentos);
  _updateStorageIndicator();
}

export async function renderDashboard() {
  const planContext = await resolveDashboardPlanContext();
  const { equipamentos, registros } = getState();
  const faults = equipamentos.filter((e) => e.status === 'danger').length;
  const alerts = Alerts.getAll();
  const hasCritical = alerts.some((alert) => alert.severity === 'danger');
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

  const viewInicio = Utils.getEl('view-inicio');
  if (!viewInicio) return;

  withViewSkeleton(viewInicio, { enabled: true, variant: 'generic', count: 4 }, () => {
    const greetEl = Utils.getEl('dash-greeting');
    if (greetEl) {
      greetEl.textContent =
        faults > 0
          ? `${faults} situação${faults > 1 ? 'ões' : ''} exigindo intervenção`
          : alerts.length > 0
            ? `${alerts.length} alerta${alerts.length > 1 ? 's' : ''} de manutenção`
            : 'Sistema Operacional';

      let usageMeterHost = document.getElementById('dash-usage-meter');
      if (!usageMeterHost) {
        usageMeterHost = document.createElement('div');
        usageMeterHost.id = 'dash-usage-meter';
        greetEl.insertAdjacentElement('afterend', usageMeterHost);
      }
      usageMeterHost.innerHTML = UsageMeter.render({ planCode: planContext.planCode });
    }

    const bento = document.querySelector('.dashboard-bento');
    if (!bento) return;

    let upgradeCardHost = document.getElementById('dash-upgrade-card');
    if (!upgradeCardHost) {
      upgradeCardHost = document.createElement('div');
      upgradeCardHost.id = 'dash-upgrade-card';
      bento.appendChild(upgradeCardHost);
    } else if (upgradeCardHost.parentElement !== bento) {
      bento.appendChild(upgradeCardHost);
    }
    upgradeCardHost.innerHTML = planContext.hasPro
      ? _renderProStatusCard()
      : UpgradeNudge.renderDashboardCard();

    if (!equipamentos.length) {
      bento.innerHTML = `<div class="dash-empty-shell">${emptyStateHtml({
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
      })}</div>`;
      return;
    }

    OnboardingBanner.render();
    _renderAlertStrip(alerts, hasCritical);
    if (hasCritical) {
      const nextActionEl = Utils.getEl('dash-next-action');
      if (nextActionEl) nextActionEl.innerHTML = '';
    } else {
      _renderNextAction(equipamentos, alerts);
    }

    const criticosEl = Utils.getEl('dash-criticos');
    if (criticosEl) {
      criticosEl.innerHTML = critical.length
        ? `<div class="dash-criticos-list">${critical.map((eq) => _equipCardMini(eq)).join('')}</div>`
        : `<div class="dash-state-box dash-state-box--success">✅ Todos os equipamentos operando normalmente</div>`;
    }

    const criticalNowEl = Utils.getEl('dash-critical-now');
    const criticalNowCountEl = Utils.getEl('dash-critical-now-count');
    if (criticalNowEl) {
      const actionQueue = equipamentos
        .map((eq) => {
          const score = getActionPriorityScore(eq, regsForEquip(eq.id));
          return { eq, score };
        })
        .sort((a, b) => b.score.actionPriorityScore - a.score.actionPriorityScore)
        .slice(0, 9);

      const groups = {
        critico: actionQueue.filter((item) => item.score.group === 'critico').slice(0, 3),
        atencao: actionQueue.filter((item) => item.score.group === 'atencao').slice(0, 3),
        monitoramento: actionQueue
          .filter((item) => item.score.group === 'monitoramento')
          .slice(0, 3),
      };

      const renderActionItems = (items, tone = 'warn') =>
        items.length
          ? items
              .map(({ eq, score }) => {
                const actionMeta = _getActionButton(score.suggestedAction.actionCode);
                return _criticalNowItemHtml({
                  icon:
                    score.group === 'critico' ? '!!' : score.group === 'atencao' ? '!' : '&bull;',
                  tone,
                  title: `${eq.nome || 'Equipamento'} &middot; ${score.suggestedAction.actionLabel}`,
                  subtitle: score.reasons.join(' &middot; ') || 'Sem sinais críticos no momento',
                  action: actionMeta.action,
                  id: eq.id,
                  ctaLabel: actionMeta.ctaLabel,
                });
              })
              .join('')
          : '<div class="dash-state-box dash-state-box--muted">Nenhum equipamento nesta faixa</div>';

      const totalCount =
        groups.critico.length + groups.atencao.length + groups.monitoramento.length;
      criticalNowEl.innerHTML = totalCount
        ? `<div class="critical-now-group">
          <div class="critical-now-group__label">Crítico agora</div>
          <div class="critical-now-list">${renderActionItems(groups.critico, 'danger')}</div>
        </div>
        <div class="critical-now-group">
          <div class="critical-now-group__label">Atenção</div>
          <div class="critical-now-list">${renderActionItems(groups.atencao, 'warn')}</div>
        </div>
        <div class="critical-now-group">
          <div class="critical-now-group__label">Monitoramento</div>
          <div class="critical-now-list">${renderActionItems(groups.monitoramento, 'warn')}</div>
        </div>`
        : `<div class="dash-state-box dash-state-box--success">✅ Sem ações pendentes no momento</div>`;

      if (criticalNowCountEl) {
        criticalNowCountEl.textContent = String(totalCount);
      }
    }

    const alertsMini = Utils.getEl('dash-alertas-mini');
    if (alertsMini) {
      alertsMini.innerHTML = alerts.length
        ? `<div class="dash-alertas-list">${alerts.slice(0, 4).map(_alertCardHtml).join('')}</div>`
        : `<div class="dash-state-box dash-state-box--muted">Nenhum alerta ativo</div>`;

      let inlineHintHost = document.getElementById('dash-upgrade-inline-hint');
      if (!inlineHintHost) {
        inlineHintHost = document.createElement('div');
        inlineHintHost.id = 'dash-upgrade-inline-hint';
        alertsMini.insertAdjacentElement('afterend', inlineHintHost);
      }
      inlineHintHost.innerHTML = planContext.hasPro
        ? ''
        : UpgradeNudge.renderInlineHint('Exportar relatorio em lote');
    }

    const recentEl = Utils.getEl('dash-recentes');
    if (recentEl) {
      const recent = [...registros].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 3);
      recentEl.innerHTML = recent.length
        ? `<div class="dash-recentes-grid">${recent
            .map((r) => {
              const eq = findEquip(r.equipId);
              return `<article class="card recent-card" data-nav="historico">
            <div class="recent-card__date">${Utils.formatDatetime(r.data)}</div>
            <div class="recent-card__title">${Utils.escapeHtml(r.tipo)}</div>
            <div class="recent-card__equip">${Utils.escapeHtml(eq?.nome ?? '—')} &middot; ${Utils.escapeHtml(eq?.tag ?? '')}</div>
            <div class="recent-card__obs">${Utils.escapeHtml(Utils.truncate(r.obs, 70))}</div>
          </article>`;
            })
            .join('')}</div>`
        : emptyStateHtml({
            icon: '📋',
            title: 'Nenhum serviço registrado',
            description: 'Registre o primeiro serviço para acompanhar a operação.',
            cta: {
              label: 'Registrar serviço',
              nav: 'registro',
              tone: 'outline',
              size: 'sm',
              autoWidth: true,
            },
          });
    }

    _renderStatusChart();
  });
}
