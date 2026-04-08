/**
 * CoolTrack Pro - Dashboard View v5.0
 * Funções: updateHeader, renderDashboard (renderInicio)
 */

import { Utils, TIPO_ICON } from '../../core/utils.js';
import { getState, findEquip, regsForEquip } from '../../core/state.js';
import { Storage } from '../../core/storage.js';
import { Alerts } from '../../domain/alerts.js';
import { Charts } from '../components/charts.js';
import { OnboardingBanner } from '../components/onboarding.js';
import {
  calculateHealthScore,
  CRITICIDADE_LABEL,
  getEquipmentMaintenanceContext,
  getHealthClass as getMaintenanceHealthClass,
} from '../../domain/maintenance.js';

// ── Labels internos ────────────────────────────────────
const STATUS_TECH = { ok: 'OPERANDO', warn: 'ATENÇÃO', danger: 'FALHA' };

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
  if (diff > 0) return { text: `↑ ${diff} vs mês passado`, cls: 'up' };
  return { text: `↓ ${Math.abs(diff)} vs mês passado`, cls: 'down' };
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
  if (count === 0) return { text: '✅ Excelente — nenhum alerta', cls: 'ok' };
  if (count === 1) return { text: '⚠️ 1 alerta requer atenção', cls: 'warn' };
  return { text: `🔴 ${count} alertas críticos`, cls: 'danger' };
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
        ? `<span class="kpi-trend kpi-trend--ok">↑ Excelente — parque saudável</span>`
        : avg >= 75
          ? `<span class="kpi-trend kpi-trend--ok">Bom — manutenção em dia</span>`
          : avg >= 50
            ? `<span class="kpi-trend kpi-trend--warn">⚠ Atenção recomendada</span>`
            : `<span class="kpi-trend kpi-trend--down">↓ Intervenção necessária</span>`;
    subEl.innerHTML = ctx;
  }
}

function _updateStorageIndicator() {
  const indicator = Utils.getEl('storage-indicator');
  if (!indicator) return;
  const { used, total, percent } = Storage.usage();
  if (percent < 50) {
    indicator.style.display = 'none';
    return;
  }
  indicator.style.display = 'block';
  const cls = percent >= 85 ? 'danger' : 'warn';
  indicator.className = `storage-indicator storage-indicator--${cls}`;
  indicator.innerHTML = `<div class="storage-indicator__label"><span>Armazenamento local</span><span>${Utils.formatBytes(used)} / ${Utils.formatBytes(total)}</span></div><div class="storage-indicator__bar"><div class="storage-indicator__fill storage-indicator__fill--${cls}" style="width:${percent}%"></div></div>`;
}

// ── Alert strip ────────────────────────────────────────
function _renderAlertStrip(alerts) {
  const el = Utils.getEl('dash-alert-strip');
  if (!el) return;
  const primary = alerts[0];
  if (!primary) {
    el.innerHTML = `<div class="alert-strip alert-strip--none">
      <div class="alert-strip__icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="var(--success)" stroke-width="1.3"/><path d="M5 8l2 2 4-4" stroke="var(--success)" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
      <div><div class="alert-strip__title">Todos os equipamentos operando normalmente</div><div class="alert-strip__desc">Nenhuma falha crítica detectada</div></div>
    </div>`;
    return;
  }

  const detail = [primary.eq?.nome, primary.subtitle]
    .filter(Boolean)
    .map((value) => Utils.escapeHtml(value))
    .join(' · ');
  const meta = primary.reg?.data
    ? `Ult. serviço: ${Utils.formatDatetime(primary.reg.data)}`
    : primary.nextDueDate
      ? `Próxima preventiva: ${Utils.formatDate(primary.nextDueDate)}`
      : '';

  el.innerHTML = `<div class="alert-strip" role="alert" aria-live="assertive">
    <div class="alert-strip__icon" aria-hidden="true">${Utils.escapeHtml(primary.icon || '!')}</div>
    <div><div class="alert-strip__title">${Utils.escapeHtml(primary.title)}</div><div class="alert-strip__desc">${detail}</div></div>
    ${meta ? `<div class="alert-strip__time">${Utils.escapeHtml(meta)}</div>` : ''}
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
  return `<div class="alert-card${toneClass}" data-action="${actionMeta.action}" data-id="${actionMeta.id}" role="listitem" tabindex="0">
    <span class="alert-card__icon">${Utils.escapeHtml(alert.icon || '!')}</span>
    <div>
      <div class="alert-card__title">${Utils.escapeHtml(alert.title)}</div>
      <div class="alert-card__sub">${Utils.escapeHtml(alert.subtitle || '')}</div>
      <div class="alert-card__equip">${Utils.escapeHtml(alert.eq?.nome ?? alert.equipmentName ?? '—')}</div>
    </div>
  </div>`;
}

// ── Próxima ação (D3) ──────────────────────────────────
function _renderNextAction(equipamentos, alerts) {
  const el = Utils.getEl('dash-next-action');
  if (!el) return;
  if (!equipamentos.length) {
    el.innerHTML = '';
    return;
  }

  const primaryAlert = alerts[0];
  if (primaryAlert) {
    const actionMeta = _getAlertActionMeta(primaryAlert);
    const cardClass =
      primaryAlert.severity === 'danger'
        ? 'next-action-card next-action-card--urgent'
        : primaryAlert.kind === 'no-history'
          ? 'next-action-card next-action-card--invite'
          : 'next-action-card';

    el.innerHTML = `<div class="${cardClass}" data-action="${actionMeta.action}" data-id="${actionMeta.id}">
      <div class="next-action-card__icon">${Utils.escapeHtml(primaryAlert.icon || '!')}</div>
      <div class="next-action-card__body">
        <div class="next-action-card__label">${Utils.escapeHtml(primaryAlert.title.toUpperCase())}</div>
        <div class="next-action-card__title">${Utils.escapeHtml(primaryAlert.eq?.nome || '—')}</div>
        <div class="next-action-card__sub">${Utils.escapeHtml(primaryAlert.subtitle || '')}</div>
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
  const criticidadeLabel = Utils.escapeHtml(
    CRITICIDADE_LABEL[eq.criticidade] || CRITICIDADE_LABEL.media,
  );

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

  let ctaLabel = 'Registrar serviço →';
  if (scls === 'danger') ctaLabel = 'Registrar corretiva →';
  else if (context.proximaPreventiva && Utils.daysDiff(context.proximaPreventiva) <= 7) {
    ctaLabel = 'Registrar preventiva →';
  } else if (!last) {
    ctaLabel = 'Primeiro registro →';
  }

  return `<div class="equip-card equip-card--${scls}" data-action="view-equip" data-id="${safeId}" role="listitem" tabindex="0" aria-label="${Utils.escapeHtml(eq?.nome ?? '—')} — ${STATUS_TECH[scls]}">
    <div class="equip-card__header">
      <div class="equip-card__type-icon equip-card__type-icon--lg">${icon}</div>
      <div class="equip-card__meta">
        <div class="equip-card__name ${scls === 'danger' ? 'equip-card__name--danger' : ''}">${Utils.escapeHtml(eq?.nome ?? '—')}</div>
        <div class="equip-card__tag">${Utils.escapeHtml(eq.tag || '—')} · ${Utils.escapeHtml(eq.fluido || eq.tipo)} · Crit. ${criticidadeLabel}</div>
      </div>
      <span class="equip-card__status equip-card__status--${scls}"><span class="status-dot status-dot--${scls}"></span>${STATUS_TECH[scls]}</span>
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
    <div class="equip-card__metrics">
      <div class="equip-card__metric">
        <div class="equip-card__metric-label">Último serviço</div>
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

  const statusSistema = Utils.getEl('status-sistema');
  const statusFalhas = Utils.getEl('status-falhas');
  const statusFalhasTxt = Utils.getEl('status-falhas-txt');
  if (statusSistema && statusFalhas) {
    if (faultCount > 0) {
      statusSistema.style.display = 'none';
      statusFalhas.style.display = 'flex';
      if (statusFalhasTxt)
        statusFalhasTxt.textContent = `${faultCount} falha${faultCount > 1 ? 's' : ''} ativa${faultCount > 1 ? 's' : ''}`;
    } else if (alertCount > 0) {
      statusSistema.innerHTML = `<span class="status-indicator__dot status-indicator__dot--warn"></span><span>Atenção requerida</span>`;
      statusSistema.style.display = 'flex';
      statusFalhas.style.display = 'none';
    } else {
      statusSistema.innerHTML = `<span class="status-indicator__dot status-indicator__dot--ok"></span><span>Sistema operacional</span>`;
      statusSistema.style.display = 'flex';
      statusFalhas.style.display = 'none';
    }
  }

  const syncStatusEl = Utils.getEl('sync-status');
  const syncStatusTxt = Utils.getEl('sync-status-txt');
  if (syncStatusEl && syncStatusTxt) {
    const syncStatus = Storage.getSyncStatus();
    const dot = syncStatusEl.querySelector('.status-indicator__dot');
    if (syncStatus.state === 'syncing') {
      syncStatusEl.style.display = 'flex';
      if (dot) dot.className = 'status-indicator__dot status-indicator__dot--ok';
      syncStatusTxt.textContent =
        syncStatus.pendingOps > 1 ? 'Sincronizando alterações...' : 'Sincronizando...';
    } else if (syncStatus.state === 'pending') {
      syncStatusEl.style.display = 'flex';
      if (dot) dot.className = 'status-indicator__dot status-indicator__dot--warn';
      syncStatusTxt.textContent =
        syncStatus.pendingOps > 0
          ? `Sincronização pendente (${syncStatus.pendingOps})`
          : 'Sincronização pendente';
    } else {
      syncStatusEl.style.display = 'none';
    }
  }

  // KPIs
  const bentAlert = Utils.getEl('hst-alert-bento');
  if (bentAlert) {
    bentAlert.textContent = String(activeCount);
    bentAlert.className = `bento-kpi__value bento-kpi__value--${faultCount > 0 ? 'warn' : 'ok'}`;
  }
  const bentAlertSub = Utils.getEl('hst-alert-bento-sub');
  if (bentAlertSub)
    bentAlertSub.innerHTML =
      faultCount > 0
        ? `<span class="kpi-trend kpi-trend--down">${faultCount} fora de operação</span>`
        : `<span class="kpi-trend kpi-trend--ok">todos operando</span>`;

  const failEl = Utils.getEl('hst-fail-bento');
  if (failEl) failEl.textContent = String(faultCount);
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

export function renderDashboard() {
  const { equipamentos, registros } = getState();
  const faults = equipamentos.filter((e) => e.status === 'danger').length;
  const alerts = Alerts.getAll();
  const critical = equipamentos
    .map((eq) => ({
      eq,
      score: calcHealthScore(eq.id),
      hasAlert: alerts.some((alert) => alert.eq?.id === eq.id),
    }))
    .filter(({ eq, score, hasAlert }) => hasAlert || eq.status !== 'ok' || score < 80)
    .sort((a, b) => a.score - b.score || Number(b.hasAlert) - Number(a.hasAlert))
    .map(({ eq }) => eq)
    .slice(0, 4);

  const greetEl = Utils.getEl('dash-greeting');
  if (greetEl) {
    greetEl.textContent =
      faults > 0
        ? `${faults} Falha${faults > 1 ? 's' : ''} Detectada${faults > 1 ? 's' : ''}`
        : alerts.length > 0
          ? `${alerts.length} alerta${alerts.length > 1 ? 's' : ''} de manutenção`
          : 'Sistema Operacional';
  }

  const bento = document.querySelector('.dashboard-bento');
  if (!bento) return;

  if (!equipamentos.length) {
    bento.innerHTML = `<div class="dash-empty-shell">
      <div class="empty-state">
        <div class="empty-state__icon">🔧</div>
        <div class="empty-state__title">Seu painel está pronto</div>
        <div class="empty-state__sub">Cadastre o primeiro equipamento para ver eficiência, alertas e histórico em tempo real.</div>
        <div class="dash-empty-shell__actions"><button class="btn btn--primary btn--auto btn--centered" data-action="open-modal" data-id="modal-add-eq">+ Cadastrar meu primeiro equipamento →</button></div>
      </div></div>`;
    return;
  }

  OnboardingBanner.render();
  _renderAlertStrip(alerts);
  _renderNextAction(equipamentos, alerts);

  const criticosEl = Utils.getEl('dash-criticos');
  if (criticosEl) {
    criticosEl.innerHTML = critical.length
      ? `<div class="dash-criticos-list">${critical.map((eq) => _equipCardMini(eq)).join('')}</div>`
      : `<div class="dash-state-box dash-state-box--success">✅ Todos os equipamentos operando normalmente</div>`;
  }

  const alertsMini = Utils.getEl('dash-alertas-mini');
  if (alertsMini) {
    alertsMini.innerHTML = alerts.length
      ? `<div class="dash-alertas-list">${alerts.slice(0, 4).map(_alertCardHtml).join('')}</div>`
      : `<div class="dash-state-box dash-state-box--muted">Nenhum alerta ativo</div>`;
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
            <div class="recent-card__equip">${Utils.escapeHtml(eq?.nome ?? '—')} · ${Utils.escapeHtml(eq?.tag ?? '')}</div>
            <div class="recent-card__obs">${Utils.escapeHtml(Utils.truncate(r.obs, 70))}</div>
          </article>`;
          })
          .join('')}</div>`
      : `<div class="empty-state"><div class="empty-state__icon">📋</div><div class="empty-state__title">Nenhum serviço registrado</div><div class="empty-state__sub">Registre o primeiro serviço</div></div>`;
  }

  _renderStatusChart();
}
