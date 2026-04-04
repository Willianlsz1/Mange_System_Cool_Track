/**
 * CoolTrack Pro - UI Orchestrator v4.0
 * Redesign industrial HVAC:
 * - Microcopy técnico (sem saudações, foco em operação)
 * - Cards com estrutura header/body/footer
 * - Alert strip no topo do dashboard
 * - KPIs com semântica HVAC
 * - Indicadores de status no header
 */

import { Utils, TIPO_ICON, STATUS_LABEL } from './utils.js';
import { getState, findEquip, lastRegForEquip, regsForEquip, setState } from './state.js';
import { Storage } from './storage.js';
import { Charts } from './charts.js';
import { Toast } from './toast.js';
import { Alerts } from './alerts.js';
import { Photos } from './photos.js';

export { Modal, CustomConfirm } from './modal.js';
export { Photos } from './photos.js';

// ── Status labels técnicos ─────────────────────────────
const STATUS_TECH = { ok: 'OPERANDO', warn: 'ATENÇÃO', danger: 'FALHA' };

// ── HVAC type icons (mantém compatibilidade) ───────────
const TIPO_ICON_SVG = {
  'Split Hi-Wall':   '❄️',
  'Split Cassette':  '🌀',
  'Split Piso Teto': '📐',
  'Fan Coil':        '💨',
  'Chiller':         '🧊',
  'Câmara Fria':     '🏔️',
  'VRF / VRV':       '🔁',
};

// ════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════
function empty(icon, msg, sub = '') {
  return `<div class="empty-state">
    <div class="empty-state__icon" aria-hidden="true">${icon}</div>
    <div class="empty-state__title">${msg}</div>
    ${sub ? `<div class="empty-state__sub">${sub}</div>` : ''}
  </div>`;
}

function calcHealthScore(eqId) {
  const eq = findEquip(eqId);
  if (!eq) return 0;
  let score = 100;
  const lastReg = lastRegForEquip(eqId);
  if (eq.status === 'warn')   score -= 20;
  if (eq.status === 'danger') score -= 50;
  if (lastReg) {
    const days = Utils.daysDiff(lastReg.data.slice(0, 10)) * -1;
    if (days > 90)      score -= 25;
    else if (days > 60) score -= 15;
    else if (days > 30) score -= 10;
  } else {
    score -= 30;
  }
  if (lastReg?.proxima && Utils.daysDiff(lastReg.proxima) < 0) score -= 20;
  return Math.max(0, Math.min(100, score));
}

function getHealthClass(score) {
  return score >= 80 ? 'ok' : score >= 50 ? 'warn' : 'danger';
}

// ════════════════════════════════════════════════════════
// HEADER — atualiza stats e status do sistema
// ════════════════════════════════════════════════════════
export function updateHeader() {
  const { equipamentos, registros } = getState();
  const today   = new Date();
  const iniMes  = new Date(today.getFullYear(), today.getMonth(), 1);
  const alerts  = Alerts.getAll();
  const alertCount  = alerts.length;
  const faultCount  = equipamentos.filter(e => e.status === 'danger').length;
  const mesCount    = registros.filter(r => new Date(r.data) >= iniMes).length;
  const activeCount = equipamentos.filter(e => e.status !== 'danger').length;

  // Data técnica no header
  Utils.getEl('hdr-date').textContent = today.toLocaleDateString('pt-BR', {
    weekday: 'short', day: '2-digit', month: 'short'
  }).toUpperCase();

  // Stats bar
  Utils.getEl('hst-total').textContent = equipamentos.length ? `${activeCount}/${equipamentos.length}` : '—';
  Utils.getEl('hst-mes').textContent   = mesCount || '—';
  Utils.getEl('hst-alert').textContent = alertCount || '0';

  // KPIs do bento
  Utils.getEl('hst-mes-bento').textContent  = mesCount || '0';
  const subMes = Utils.getEl('hst-mes-bento-sub');
  if (subMes) subMes.textContent = mesCount === 1 ? 'registro realizado' : 'registros realizados';

  Utils.getEl('hst-fail-bento').textContent = faultCount;

  // Equipamentos ativos KPI
  const bentAlert = Utils.getEl('hst-alert-bento');
  const bentAlertSub = Utils.getEl('hst-alert-bento-sub');
  if (bentAlert) {
    bentAlert.textContent = `${activeCount}`;
    bentAlert.className = `bento-kpi__value bento-kpi__value--${faultCount > 0 ? 'warn' : 'ok'}`;
  }
  if (bentAlertSub) {
    bentAlertSub.textContent = faultCount > 0
      ? `${faultCount} fora de operação`
      : 'todos operando';
  }

  // Badge de alertas na nav
  const badge = Utils.getEl('alerta-badge');
  if (badge) {
    badge.textContent = String(alertCount);
    badge.classList.toggle('is-visible', alertCount > 0);
  }

  // Indicadores de status no header
  const statusSistema = Utils.getEl('status-sistema');
  const statusFalhas  = Utils.getEl('status-falhas');
  const statusFalhasTxt = Utils.getEl('status-falhas-txt');

  if (statusSistema && statusFalhas) {
    if (faultCount > 0) {
      statusSistema.style.display = 'none';
      statusFalhas.style.display  = 'flex';
      if (statusFalhasTxt) statusFalhasTxt.textContent = `${faultCount} falha${faultCount > 1 ? 's' : ''} ativa${faultCount > 1 ? 's' : ''}`;
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

  renderGlobalEfficiency();
  updateStorageIndicator();
}

function renderGlobalEfficiency() {
  const { equipamentos } = getState();
  const el    = Utils.getEl('hst-health');
  const barEl = Utils.getEl('health-bar-fill');
  if (!equipamentos.length) {
    if (el) el.textContent = '—';
    if (barEl) barEl.style.width = '0%';
    return;
  }
  const avg = Math.round(
    equipamentos.reduce((acc, eq) => acc + calcHealthScore(eq.id), 0) / equipamentos.length
  );
  const cls = getHealthClass(avg);
  if (el) {
    el.textContent = `${avg}%`;
    el.className = `bento-kpi__value bento-kpi__value--${cls === 'ok' ? 'cyan' : cls}`;
  }
  if (barEl) {
    barEl.style.width = `${avg}%`;
    barEl.className = `health-bar__fill health-bar__fill--${cls}`;
  }
}

function updateStorageIndicator() {
  const indicator = Utils.getEl('storage-indicator');
  if (!indicator) return;
  const { used, total, percent } = Storage.usage();
  if (percent < 50) { indicator.style.display = 'none'; return; }
  indicator.style.display = 'block';
  const cls = percent >= 85 ? 'danger' : percent >= 65 ? 'warn' : 'info';
  indicator.className = `storage-indicator storage-indicator--${cls}`;
  indicator.innerHTML = `
    <div class="storage-indicator__label">
      <span>Armazenamento local</span>
      <span>${Utils.formatBytes(used)} / ${Utils.formatBytes(total)}</span>
    </div>
    <div class="storage-indicator__bar">
      <div class="storage-indicator__fill storage-indicator__fill--${cls}" style="width:${percent}%"></div>
    </div>`;
}

// ════════════════════════════════════════════════════════
// SELECTS
// ════════════════════════════════════════════════════════
export function populateSelects() {
  const { equipamentos, tecnicos } = getState();
  const opts = equipamentos.map(e =>
    `<option value="${e.id}">${Utils.escapeHtml(e.nome)} — ${Utils.escapeHtml(e.local)}</option>`
  ).join('');

  [
    { id: 'r-equip',    prefix: '<option value="">Selecione o equipamento...</option>' },
    { id: 'hist-equip', prefix: '<option value="">Todos os equipamentos</option>' },
    { id: 'rel-equip',  prefix: '<option value="">Todos</option>' },
  ].forEach(({ id, prefix }) => {
    const el = Utils.getEl(id);
    if (el) el.innerHTML = prefix + opts;
  });

  const tecDatalist = Utils.getEl('lista-tecnicos');
  if (tecDatalist) {
    tecDatalist.innerHTML = (tecnicos || [])
      .map(t => `<option value="${Utils.escapeHtml(t)}">`)
      .join('');
  }
}

// ════════════════════════════════════════════════════════
// EQUIPMENT CARD — módulo de controle técnico
// ════════════════════════════════════════════════════════
function equipCardHtml(eq, { showLocal = true } = {}) {
  const icon  = TIPO_ICON_SVG[eq.tipo] ?? '⚙️';
  const last  = lastRegForEquip(eq.id);
  const score = calcHealthScore(eq.id);
  const hcls  = getHealthClass(score);
  const scls  = eq.status;

  // Próxima manutenção
  let proximaHtml = '—';
  if (last?.proxima) {
    const diff = Utils.daysDiff(last.proxima);
    if (diff < 0)       proximaHtml = `<span class="equip-card__data-value--danger">Vencida (${Math.abs(diff)}d)</span>`;
    else if (diff <= 7) proximaHtml = `<span class="equip-card__data-value--warn">em ${diff} dia${diff !== 1 ? 's' : ''}</span>`;
    else                proximaHtml = `<span>em ${diff} dias</span>`;
  }

  return `
  <div class="equip-card equip-card--${scls}"
    data-action="view-equip"
    data-id="${eq.id}"
    role="listitem"
    tabindex="0"
    aria-label="${Utils.escapeHtml(eq.nome)} — ${STATUS_TECH[scls]}">

    <div class="equip-card__header">
      <div class="equip-card__type-icon" aria-hidden="true">${icon}</div>
      <div class="equip-card__meta">
        <div class="equip-card__name ${scls === 'danger' ? 'equip-card__name--danger' : ''}">${Utils.escapeHtml(eq.nome)}</div>
        <div class="equip-card__tag">${Utils.escapeHtml(eq.tag || eq.tipo)} · ${Utils.escapeHtml(eq.fluido || '')}</div>
      </div>
      <span class="equip-card__status equip-card__status--${scls}">
        <span class="status-dot status-dot--${scls}"></span>
        ${STATUS_TECH[scls]}
      </span>
      <div class="equip-card__actions">
        <button
          class="equip-card__delete"
          data-action="delete-equip"
          data-id="${eq.id}"
          aria-label="Excluir ${Utils.escapeHtml(eq.nome)}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
          </svg>
        </button>
      </div>
    </div>

    <div class="equip-card__body">
      ${showLocal ? `
      <div class="equip-card__data">
        <div class="equip-card__data-label">LOCAL</div>
        <div class="equip-card__data-value equip-card__data-value--muted">${Utils.escapeHtml(Utils.truncate(eq.local, 28))}</div>
      </div>` : ''}
      <div class="equip-card__data">
        <div class="equip-card__data-label">FLUIDO</div>
        <div class="equip-card__data-value">${Utils.escapeHtml(eq.fluido || '—')}</div>
      </div>
      <div class="equip-card__data">
        <div class="equip-card__data-label">ÚLTIMO SERVIÇO</div>
        <div class="equip-card__data-value equip-card__data-value--muted">${last ? Utils.formatDatetime(last.data) : '—'}</div>
      </div>
      <div class="equip-card__data">
        <div class="equip-card__data-label">PRÓXIMA PREV.</div>
        <div class="equip-card__data-value">${proximaHtml}</div>
      </div>
    </div>

    <div class="equip-card__footer">
      <span class="equip-card__footer-text">
        ${last ? `${Utils.escapeHtml(last.tipo)} · ${Utils.escapeHtml(last.tecnico || '—')}` : 'Nenhum serviço registrado'}
      </span>
      <span class="equip-card__footer-action">Ver detalhes →</span>
    </div>
  </div>`;
}

export function renderEquip(filtro = '') {
  const { equipamentos } = getState();
  const q    = filtro.toLowerCase();
  const list = equipamentos.filter(e =>
    !q ||
    e.nome.toLowerCase().includes(q) ||
    e.local.toLowerCase().includes(q) ||
    (e.tag || '').toLowerCase().includes(q)
  );
  const el = Utils.getEl('lista-equip');
  el.innerHTML = list.length
    ? list.map(eq => equipCardHtml(eq)).join('')
    : empty('🔧', 'Nenhum equipamento cadastrado', 'Clique em "+ Cadastrar" para adicionar');
}

// ════════════════════════════════════════════════════════
// ALERT STRIP — falhas críticas no topo do dashboard
// ════════════════════════════════════════════════════════
function renderAlertStrip() {
  const el = Utils.getEl('dash-alert-strip');
  if (!el) return;

  const { equipamentos } = getState();
  const faults = equipamentos.filter(e => e.status === 'danger');

  if (!faults.length) {
    el.innerHTML = `
      <div class="alert-strip alert-strip--none">
        <div class="alert-strip__icon" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6.5" stroke="var(--success)" stroke-width="1.3"/>
            <path d="M5 8l2 2 4-4" stroke="var(--success)" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div>
          <div class="alert-strip__title">Todos os equipamentos operando normalmente</div>
          <div class="alert-strip__desc">Nenhuma falha crítica detectada no momento</div>
        </div>
      </div>`;
    return;
  }

  // Mostra a falha mais recente na strip
  const primary = faults[0];
  const lastReg = lastRegForEquip(primary.id);
  el.innerHTML = `
    <div class="alert-strip" role="alert" aria-live="assertive">
      <div class="alert-strip__icon" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8 2L1.5 13.5h13L8 2Z" stroke="var(--danger)" stroke-width="1.3" stroke-linejoin="round"/>
          <path d="M8 6.5v3.5M8 11.5v.5" stroke="var(--danger)" stroke-width="1.3" stroke-linecap="round"/>
        </svg>
      </div>
      <div>
        <div class="alert-strip__title">${Utils.escapeHtml(primary.nome)} — Falha detectada</div>
        <div class="alert-strip__desc">${Utils.escapeHtml(primary.tag || primary.tipo)} · ${Utils.escapeHtml(primary.local)}${faults.length > 1 ? ` · +${faults.length - 1} outro${faults.length > 2 ? 's' : ''}` : ''}</div>
      </div>
      ${lastReg ? `<div class="alert-strip__time">Últ. serviço: ${Utils.formatDatetime(lastReg.data)}</div>` : ''}
    </div>`;
}

// ════════════════════════════════════════════════════════
// ALERT CARD
// ════════════════════════════════════════════════════════
function alertCardHtml({ kind, reg, eq }) {
  if (kind === 'critical') {
    return `<div class="alert-card alert-card--critical" data-nav="alertas" role="listitem">
      <span class="alert-card__icon" aria-hidden="true">🔴</span>
      <div>
        <div class="alert-card__title">Equipamento fora de operação</div>
        <div class="alert-card__sub">Requer intervenção imediata</div>
        <div class="alert-card__equip">${Utils.escapeHtml(eq.nome)} · ${Utils.escapeHtml(eq.local)}</div>
      </div>
    </div>`;
  }
  const equip = findEquip(reg.equipId);
  if (kind === 'overdue') {
    return `<div class="alert-card alert-card--critical" data-nav="alertas" role="listitem">
      <span class="alert-card__icon" aria-hidden="true">⚠️</span>
      <div>
        <div class="alert-card__title">Manutenção preventiva vencida</div>
        <div class="alert-card__sub">${Utils.escapeHtml(reg.tipo)}</div>
        <div class="alert-card__equip">${Utils.escapeHtml(equip?.nome ?? '—')}</div>
      </div>
    </div>`;
  }
  return `<div class="alert-card" data-nav="alertas" role="listitem">
    <span class="alert-card__icon" aria-hidden="true">🔔</span>
    <div>
      <div class="alert-card__title">Manutenção em ${Utils.daysDiff(reg.proxima)} dia(s)</div>
      <div class="alert-card__sub">${Utils.escapeHtml(reg.tipo)}</div>
      <div class="alert-card__equip">${Utils.escapeHtml(equip?.nome ?? '—')}</div>
    </div>
  </div>`;
}

// ════════════════════════════════════════════════════════
// DASHBOARD
// ════════════════════════════════════════════════════════
let _lastChartHash = null;

function getChartHash() {
  const { registros, equipamentos } = getState();
  return `${equipamentos.length}:${registros.length}:${equipamentos.map(e => e.status).join('')}`;
}

function renderStatusChart() {
  const viewInicio = Utils.getEl('view-inicio');
  if (!viewInicio?.classList.contains('active')) return;
  const hash = getChartHash();
  if (hash === _lastChartHash) return;
  _lastChartHash = hash;
  setTimeout(() => Charts.refreshAll(), 50);
}

export function renderInicio() {
  const { equipamentos, registros } = getState();
  const faults   = equipamentos.filter(e => e.status === 'danger').length;
  const critical = equipamentos.filter(e => e.status !== 'ok');
  const alerts   = Alerts.getAll();

  // Título técnico
  const greetEl = Utils.getEl('dash-greeting');
  if (greetEl) {
    greetEl.textContent = faults > 0
      ? `${faults} Falha${faults > 1 ? 's' : ''} Detectada${faults > 1 ? 's' : ''}`
      : 'Sistema Operacional';
  }

  // Se não há equipamentos, mostra empty state no bento inteiro
  const bento = document.querySelector('.dashboard-bento');
  if (!bento) return;

  if (equipamentos.length === 0) {
    bento.innerHTML = empty(
      '🔧',
      'Nenhum equipamento cadastrado',
      `<button class="btn btn--primary" data-action="open-modal" data-id="modal-add-eq" style="width:auto;margin-top:16px;">+ Cadastrar Primeiro Equipamento</button>`
    );
    return;
  }

  // ── Alert strip ──────────────────────────────────
  const stripEl = Utils.getEl('dash-alert-strip');
  if (stripEl) renderAlertStrip();

  // ── KPI row ───────────────────────────────────────
  // KPIs são atualizados via updateHeader() — nada a fazer aqui

  // ── Equipamentos críticos ─────────────────────────
  const criticosEl = Utils.getEl('dash-criticos');
  if (criticosEl) {
    criticosEl.innerHTML = critical.length
      ? `<div class="dash-criticos-list">${critical.map(eq => equipCardHtml(eq, { showLocal: true })).join('')}</div>`
      : `<div style="padding:var(--space-4);font-size:12px;color:var(--text-3);text-align:center;background:var(--card);border:1px solid var(--border);border-radius:var(--radius-sm);">Todos os equipamentos operando normalmente</div>`;
  }

  // ── Alertas sidebar ───────────────────────────────
  const alertsMini = Utils.getEl('dash-alertas-mini');
  if (alertsMini) {
    if (alerts.length) {
      alertsMini.innerHTML = `<div class="dash-alertas-list">${alerts.slice(0, 4).map(alertCardHtml).join('')}</div>`;
    } else {
      alertsMini.innerHTML = `<div style="padding:var(--space-4);font-size:12px;color:var(--text-3);text-align:center;background:var(--success-dim);border:1px solid rgba(0,200,112,0.15);border-radius:var(--radius-sm);">Nenhum alerta ativo</div>`;
    }
  }

  // ── Últimos serviços ──────────────────────────────
  const recentEl = Utils.getEl('dash-recentes');
  if (recentEl) {
    const recent = [...registros].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 3);
    recentEl.innerHTML = recent.length
      ? `<div class="dash-recentes-grid">${recent.map(r => {
          const eq = findEquip(r.equipId);
          return `<article class="card recent-card" data-nav="historico">
            <div class="recent-card__date">${Utils.formatDatetime(r.data)}</div>
            <div class="recent-card__title">${Utils.escapeHtml(r.tipo)}</div>
            <div class="recent-card__equip">${Utils.escapeHtml(eq?.nome ?? '—')} · ${Utils.escapeHtml(eq?.tag ?? '')}</div>
            <div class="recent-card__obs">${Utils.escapeHtml(Utils.truncate(r.obs, 70))}</div>
          </article>`;
        }).join('')}</div>`
      : empty('📋', 'Nenhum serviço registrado', 'Registre o primeiro serviço');
  }

  renderStatusChart();
}

// ════════════════════════════════════════════════════════
// ALERTAS
// ════════════════════════════════════════════════════════
export function renderAlertas() {
  const list = Alerts.getAll();
  Utils.getEl('lista-alertas').innerHTML = list.length
    ? list.map(alertCardHtml).join('')
    : empty('✅', 'Sem alertas ativos', 'Todos os equipamentos dentro do prazo');
}

// ════════════════════════════════════════════════════════
// HISTÓRICO
// ════════════════════════════════════════════════════════
export function renderHist() {
  const { registros } = getState();
  const busca  = Utils.getVal('hist-busca').toLowerCase();
  const filtEq = Utils.getVal('hist-equip');

  let list = [...registros].sort((a, b) => b.data.localeCompare(a.data));
  if (filtEq)  list = list.filter(r => r.equipId === filtEq);
  if (busca)   list = list.filter(r => {
    const eq = findEquip(r.equipId);
    return r.obs.toLowerCase().includes(busca)
      || r.tipo.toLowerCase().includes(busca)
      || (eq?.nome || '').toLowerCase().includes(busca)
      || (r.tecnico || '').toLowerCase().includes(busca);
  });

  const el = Utils.getEl('timeline');
  if (!list.length) {
    el.innerHTML = empty('📋', 'Nenhum registro encontrado');
    return;
  }

  el.innerHTML = `<div class="timeline">${list.map(r => {
    const eq     = findEquip(r.equipId);
    const dotMod = r.status !== 'ok' ? `timeline__dot--${r.status}` : '';
    return `<div class="timeline__item" role="listitem">
      <div class="timeline__dot ${dotMod}"></div>
      <div class="timeline__item-inner">
        <div class="timeline__item-body">
          <div class="timeline__date">${Utils.formatDatetime(r.data)}</div>
          <div class="timeline__title">${Utils.escapeHtml(r.tipo)}</div>
          <div class="timeline__equip">${Utils.escapeHtml(eq?.nome ?? '—')} · ${Utils.escapeHtml(eq?.tag ?? eq?.local ?? '')}</div>
          <div class="timeline__obs">${Utils.escapeHtml(r.obs)}</div>
          ${r.pecas   ? `<div class="timeline__parts">Peças: ${Utils.escapeHtml(r.pecas)}</div>` : ''}
          ${r.tecnico ? `<div class="timeline__parts">Técnico: ${Utils.escapeHtml(r.tecnico)}</div>` : ''}
          ${r.proxima ? `<div class="timeline__next">Próxima: ${Utils.formatDate(r.proxima)}</div>` : ''}
        </div>
        <button
          class="timeline__delete"
          data-action="delete-reg"
          data-id="${r.id}"
          aria-label="Excluir registro de ${Utils.escapeHtml(r.tipo)}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
          </svg>
        </button>
      </div>
    </div>`;
  }).join('')}</div>`;
}

// ════════════════════════════════════════════════════════
// RELATÓRIO
// ════════════════════════════════════════════════════════
export function renderRelatorio() {
  const { registros } = getState();
  const filtEq = Utils.getVal('rel-equip');
  const de     = Utils.getVal('rel-de');
  const ate    = Utils.getVal('rel-ate');

  let list = [...registros].sort((a, b) => b.data.localeCompare(a.data));
  if (filtEq) list = list.filter(r => r.equipId === filtEq);
  if (de)     list = list.filter(r => r.data >= de);
  if (ate)    list = list.filter(r => r.data <= `${ate}T23:59`);

  const el = Utils.getEl('relatorio-corpo');
  if (!list.length) { el.innerHTML = empty('📋', 'Sem registros no período selecionado'); return; }

  const today = new Date().toLocaleDateString('pt-BR');
  el.innerHTML = `
    <div class="card">
      <div class="report-header">RELATÓRIO DE MANUTENÇÃO — COOLTRACK PRO</div>
      <div class="report-meta">Gerado em ${today} · ${list.length} registro(s)</div>
    </div>
    ${list.map(r => {
      const eq = findEquip(r.equipId);
      return `<div class="card report-record">
        <div class="report-record__head">
          <div>
            <div class="report-record__title">${Utils.escapeHtml(r.tipo)}</div>
            <div class="report-record__date">${Utils.formatDatetime(r.data)}</div>
          </div>
          <span class="badge badge--${r.status}">
            <span class="status-dot status-dot--${r.status}"></span>
            ${STATUS_LABEL[r.status]}
          </span>
        </div>
        <div class="info-list">
          <div class="info-row"><span class="info-row__label">Equipamento</span><span class="info-row__value">${Utils.escapeHtml(eq?.nome ?? '—')}</span></div>
          <div class="info-row"><span class="info-row__label">TAG</span><span class="info-row__value" style="font-family:var(--font-mono)">${Utils.escapeHtml(eq?.tag ?? '—')}</span></div>
          <div class="info-row"><span class="info-row__label">Local</span><span class="info-row__value">${Utils.escapeHtml(eq?.local ?? '—')}</span></div>
          <div class="info-row"><span class="info-row__label">Fluido</span><span class="info-row__value">${Utils.escapeHtml(eq?.fluido ?? '—')}</span></div>
          <div class="info-row"><span class="info-row__label">Técnico</span><span class="info-row__value">${Utils.escapeHtml(r.tecnico ?? '—')}</span></div>
          ${r.pecas ? `<div class="info-row"><span class="info-row__label">Peças / Materiais</span><span class="info-row__value">${Utils.escapeHtml(r.pecas)}</span></div>` : ''}
          ${r.proxima ? `<div class="info-row"><span class="info-row__label">Próxima Manutenção</span><span class="info-row__value">${Utils.formatDate(r.proxima)}</span></div>` : ''}
        </div>
        <div class="report-record__obs">${Utils.escapeHtml(r.obs)}</div>
      </div>`;
    }).join('')}`;
}

// ════════════════════════════════════════════════════════
// EQUIPAMENTOS MODULE
// ════════════════════════════════════════════════════════
export const Equipamentos = {
  save() {
    const nome  = Utils.getVal('eq-nome').trim();
    const local = Utils.getVal('eq-local').trim();
    if (!nome || !local) { Toast.warning('Preencha nome e localização.'); return; }

    const rawTag = Utils.getVal('eq-tag').trim();
    const normalizedTag = rawTag.toUpperCase();
    const { equipamentos } = getState();

    if (normalizedTag && equipamentos.some(e => (e.tag || '').toUpperCase() === normalizedTag)) {
      Toast.error('Já existe equipamento com esta TAG.'); return;
    }

    setState(prev => ({
      ...prev,
      equipamentos: [...prev.equipamentos, {
        id: Utils.uid(), nome, local, status: 'ok',
        tag: normalizedTag,
        tipo: Utils.getVal('eq-tipo'),
        modelo: Utils.getVal('eq-modelo').trim(),
        fluido: Utils.getVal('eq-fluido')
      }]
    }));

    import('./modal.js').then(({ Modal: M }) => M.close('modal-add-eq'));
    Utils.clearVals('eq-nome', 'eq-tag', 'eq-local', 'eq-modelo');
    renderEquip();
    updateHeader();
    Toast.success('Equipamento cadastrado.');
  },

  view(id) {
    const eq = findEquip(id);
    if (!eq) return;
    const regs  = regsForEquip(id).sort((a, b) => b.data.localeCompare(a.data));
    const score = calcHealthScore(id);
    const cls   = getHealthClass(score);

    Utils.getEl('eq-det-corpo').innerHTML = `
      <div class="modal__title" id="eq-det-title">${Utils.escapeHtml(eq.nome)}</div>

      <div class="eq-modal-health">
        <div class="eq-modal-health__circle eq-modal-health__circle--${cls}">${score}%</div>
        <div class="eq-modal-health__text">
          <div class="eq-modal-health__label">EFICIÊNCIA DO EQUIPAMENTO</div>
          <div class="eq-modal-health__status">${cls === 'ok' ? 'Operando bem' : cls === 'warn' ? 'Atenção requerida' : 'Falha detectada'}</div>
        </div>
      </div>

      <div class="info-list" style="margin-bottom:var(--space-3)">
        <div class="info-row"><span class="info-row__label">TAG</span><span class="info-row__value" style="font-family:var(--font-mono)">${Utils.escapeHtml(eq.tag || '—')}</span></div>
        <div class="info-row"><span class="info-row__label">Tipo</span><span class="info-row__value">${Utils.escapeHtml(eq.tipo)}</span></div>
        <div class="info-row"><span class="info-row__label">Fluido</span><span class="info-row__value">${Utils.escapeHtml(eq.fluido || '—')}</span></div>
        <div class="info-row"><span class="info-row__label">Modelo</span><span class="info-row__value">${Utils.escapeHtml(eq.modelo || '—')}</span></div>
        <div class="info-row"><span class="info-row__label">Local</span><span class="info-row__value">${Utils.escapeHtml(eq.local)}</span></div>
      </div>

      <div class="btn-group" style="margin-bottom:var(--space-4);">
        <button class="btn btn--outline btn--sm" data-action="go-register-equip" data-id="${id}">+ Registrar Serviço</button>
        <button class="btn btn--danger btn--sm" data-action="delete-equip" data-id="${id}">Excluir</button>
      </div>

      <div class="eq-modal-summary">${regs.length} serviço(s) registrado(s)</div>
      ${regs.slice(0, 3).map(r =>
        `<div class="eq-modal-quick">${Utils.escapeHtml(r.tipo)} · ${Utils.formatDatetime(r.data)} · ${Utils.escapeHtml(r.tecnico || '—')}</div>`
      ).join('')}`;

    import('./modal.js').then(({ Modal: M }) => M.open('modal-eq-det'));
  },

  delete(id) {
    setState(prev => ({
      ...prev,
      equipamentos: prev.equipamentos.filter(e => e.id !== id),
      registros:    prev.registros.filter(r => r.equipId !== id)
    }));
    import('./modal.js').then(({ Modal: M }) => M.close('modal-eq-det'));
    renderEquip();
    updateHeader();
    Toast.info('Equipamento removido.');
  }
};

// ════════════════════════════════════════════════════════
// REGISTRO MODULE
// ════════════════════════════════════════════════════════
export const Registro = {
  save() {
    const equipId = Utils.getVal('r-equip');
    const data    = Utils.getVal('r-data');
    const tipo    = Utils.getVal('r-tipo');
    const obs     = Utils.getVal('r-obs').trim();
    const tecnico = Utils.getVal('r-tecnico').trim();

    const missing = [];
    if (!equipId) missing.push('Equipamento');
    if (!data)    missing.push('Data');
    if (!tipo)    missing.push('Tipo de Serviço');
    if (!tecnico) missing.push('Técnico Responsável');
    if (!obs || obs.length < 10) missing.push('Descrição (mín. 10 caracteres)');

    if (missing.length) {
      Toast.warning(`Campos obrigatórios: ${missing.join(', ')}`);
      return;
    }

    const proxima = Utils.getVal('r-proxima');
    if (proxima && proxima < data.slice(0, 10)) {
      Toast.error('A próxima manutenção não pode ser anterior à data do serviço.');
      return;
    }

    const status = Utils.getVal('r-status');

    setState(prev => {
      const currentTecs = prev.tecnicos || [];
      const updatedTecs = tecnico && !currentTecs.includes(tecnico)
        ? [...currentTecs, tecnico]
        : currentTecs;
      return {
        ...prev,
        tecnicos: updatedTecs,
        registros: [...prev.registros, {
          id: Utils.uid(), equipId, data, tipo, obs, status,
          pecas:   Utils.getVal('r-pecas').trim(),
          proxima,
          fotos:   [...Photos.pending],
          tecnico
        }],
        equipamentos: prev.equipamentos.map(e =>
          e.id === equipId ? { ...e, status } : e
        )
      };
    });

    this.clear();
    Toast.success('Serviço registrado com sucesso.');
    goView('historico');
  },

  clear(preserveEquip = false) {
    const toClear = ['r-tipo', 'r-pecas', 'r-obs', 'r-proxima', 'r-tecnico'];
    if (!preserveEquip) toClear.push('r-equip');
    Utils.clearVals(...toClear);
    Utils.setVal('r-status', 'ok');
    Utils.setVal('r-data', Utils.nowDatetime());
    Photos.clear();
    document.getElementById('form-progress-container-unique-v333')?.remove();
  }
};

// ════════════════════════════════════════════════════════
// HISTÓRICO MODULE
// ════════════════════════════════════════════════════════
export const Historico = {
  delete(id) {
    setState(prev => {
      const regToDelete   = prev.registros.find(r => r.id === id);
      const registros     = prev.registros.filter(r => r.id !== id);
      if (!regToDelete)   return { ...prev, registros };
      const lastRemaining = registros
        .filter(r => r.equipId === regToDelete.equipId)
        .sort((a, b) => b.data.localeCompare(a.data))[0];
      const equipamentos  = prev.equipamentos.map(eq =>
        eq.id === regToDelete.equipId
          ? { ...eq, status: lastRemaining?.status || 'ok' }
          : eq
      );
      return { ...prev, registros, equipamentos };
    });
    renderHist();
    updateHeader();
    Toast.warning('Registro removido do histórico.');
  }
};

// ════════════════════════════════════════════════════════
// VIEW TRANSITIONS
// ════════════════════════════════════════════════════════
let _isTransitioning = false;

export function goView(name) {
  if (_isTransitioning) return;
  const activeView = document.querySelector('.view.active');
  const newView    = Utils.getEl(`view-${name}`);
  if (!newView || activeView === newView) return;

  if (activeView) {
    _isTransitioning = true;
    activeView.classList.add('is-exiting');
    setTimeout(() => {
      try {
        activeView.classList.remove('active', 'is-exiting');
        activateNewView(name);
      } finally {
        _isTransitioning = false;
      }
    }, 150);
  } else {
    activateNewView(name);
  }
}

function activateNewView(name) {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('is-active'));
  const newView = Utils.getEl(`view-${name}`);
  if (newView) newView.classList.add('active');
  Utils.getEl(`nav-${name}`)?.classList.add('is-active');

  if (name === 'inicio')       renderInicio();
  if (name === 'equipamentos') renderEquip();
  if (name === 'registro')     { populateSelects(); Utils.setVal('r-data', Utils.nowDatetime()); }
  if (name === 'historico')    { populateSelects(); renderHist(); }
  if (name === 'alertas')      renderAlertas();
  if (name === 'relatorio')    { populateSelects(); renderRelatorio(); }

  updateHeader();

  const main = Utils.getEl('main-content');
  if (main) main.focus();
  window.scrollTo(0, 0);
}

// ════════════════════════════════════════════════════════
// ACTIONS MODULE
// ════════════════════════════════════════════════════════
export const Actions = {
  init() {
    this.initThemeToggle();
    this.initFormValidation();
    this.initSmartSearch();
    this.initEquipChangeWarning();
  },

  initEquipChangeWarning() {
    const rEquipSelect = Utils.getEl('r-equip');
    if (!rEquipSelect) return;

    rEquipSelect.addEventListener('change', () => {
      const id = rEquipSelect.value;
      let warningDiv = Utils.getEl('reg-pending-warning');
      if (!id) { if (warningDiv) warningDiv.remove(); return; }
      const lastReg   = lastRegForEquip(id);
      const hasPending = lastReg && Utils.daysDiff(lastReg.proxima) >= 0;
      if (hasPending) {
        if (!warningDiv) {
          warningDiv = document.createElement('div');
          warningDiv.id = 'reg-pending-warning';
          warningDiv.style.cssText = 'color:var(--warning);margin-bottom:12px;font-size:11px;line-height:1.4;padding:8px 10px;background:var(--warning-dim);border:1px solid rgba(232,160,32,0.2);border-radius:var(--radius-xs);';
          rEquipSelect.parentNode.parentNode.insertBefore(warningDiv, rEquipSelect.parentNode.nextSibling);
        }
        warningDiv.textContent = '⚠ Manutenção preventiva agendada para este equipamento. Registre apenas em caso de emergência ou intervenção não planejada.';
      } else {
        warningDiv?.remove();
      }
    });

    document.addEventListener('click', e => {
      const btn = e.target.closest('[data-action="go-register-equip"]');
      if (!btn) return;
      const equipId = btn.dataset.id;
      import('./modal.js').then(({ Modal: M }) => M.close('modal-eq-det'));
      goView('registro');
      setTimeout(() => {
        Utils.setVal('r-equip', equipId);
        rEquipSelect.dispatchEvent(new Event('change'));
      }, 50);
    });
  },

  initThemeToggle() {
    const toggleBtn = Utils.getEl('theme-toggle');
    const themeIcon = Utils.getEl('theme-icon');
    if (!toggleBtn || !themeIcon) return;

    const getPreferred = () =>
      localStorage.getItem('cooltrack-theme') ||
      (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');

    const applyTheme = theme => {
      if (theme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
        themeIcon.textContent = '☀️';
        toggleBtn.setAttribute('aria-label', 'Mudar para modo escuro');
      } else {
        document.documentElement.removeAttribute('data-theme');
        themeIcon.textContent = '🌙';
        toggleBtn.setAttribute('aria-label', 'Mudar para modo claro');
      }
      localStorage.setItem('cooltrack-theme', theme);
    };

    applyTheme(getPreferred());

    toggleBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const next    = current === 'light' ? 'dark' : 'light';
      applyTheme(next);
      requestAnimationFrame(() => { _lastChartHash = null; Charts.refreshAll(); });
    });

    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', e => {
      if (!localStorage.getItem('cooltrack-theme')) {
        applyTheme(e.matches ? 'light' : 'dark');
        requestAnimationFrame(() => { _lastChartHash = null; Charts.refreshAll(); });
      }
    });
  },

  initFormValidation() {
    const formView = Utils.getEl('view-registro');
    if (!formView) return;

    const fields = [
      { id: 'r-equip',   label: 'Equipamento',        validate: v => v !== '' },
      { id: 'r-data',    label: 'Data',                validate: v => v !== '' },
      { id: 'r-tipo',    label: 'Tipo de Serviço',     validate: v => v !== '' },
      { id: 'r-tecnico', label: 'Técnico',             validate: v => v.trim() !== '' },
      { id: 'r-obs',     label: 'Descrição do serviço', validate: v => v.trim().length >= 10 }
    ];

    const CONTAINER_ID = 'form-progress-container-unique-v333';

    const ensureBar = () => {
      if (document.getElementById(CONTAINER_ID)) return;
      const formCard = formView.querySelector('.card');
      if (!formCard) return;
      const c = document.createElement('div');
      c.id = CONTAINER_ID;
      c.className = 'form-progress';
      c.innerHTML = `
        <div class="form-progress__text">
          <span>Campos preenchidos</span>
          <span id="form-progress-count">0/${fields.length}</span>
        </div>
        <div class="form-progress__bar">
          <div class="form-progress__fill" id="form-progress-fill" style="width:0%"></div>
        </div>`;
      formCard.insertBefore(c, formCard.firstChild);
    };

    const updateField = fieldConfig => {
      const input = Utils.getEl(fieldConfig.id);
      if (!input) return;
      const value   = input.value;
      const isValid = fieldConfig.validate(value);
      input.classList.remove('is-valid', 'is-invalid');
      input.parentElement.querySelector('.form-error')?.remove();
      if (!value || !value.trim()) return;
      if (isValid) {
        input.classList.add('is-valid');
      } else {
        input.classList.add('is-invalid');
        const err = document.createElement('div');
        err.className   = 'form-error';
        err.textContent = fieldConfig.label + ' inválido';
        input.parentElement.appendChild(err);
      }
    };

    const updateBar = () => {
      ensureBar();
      const filled  = fields.filter(f => { const i = Utils.getEl(f.id); return i && f.validate(i.value); }).length;
      const pct     = (filled / fields.length) * 100;
      const bar     = document.getElementById('form-progress-fill');
      const cnt     = document.getElementById('form-progress-count');
      if (bar) bar.style.width = `${pct}%`;
      if (cnt) cnt.textContent = `${filled}/${fields.length}`;
    };

    fields.forEach(field => {
      const input = Utils.getEl(field.id);
      if (input) {
        input.addEventListener('input', () => { updateField(field); updateBar(); });
        input.addEventListener('blur',  () => updateField(field));
      }
    });

    updateBar();
  },

  initSmartSearch() {
    const wrapper = document.querySelector('#view-equipamentos .search-bar');
    const input   = document.querySelector('#view-equipamentos .search-bar__input');
    if (!input || !wrapper) return;

    if (!wrapper.querySelector('.search-bar__clear')) {
      const clearBtn = document.createElement('button');
      clearBtn.type  = 'button';
      clearBtn.className = 'search-bar__clear';
      clearBtn.innerHTML = '✕';
      clearBtn.setAttribute('aria-label', 'Limpar busca');
      wrapper.classList.add('search-bar__wrapper');
      wrapper.appendChild(clearBtn);
      input.classList.add('search-bar__input--with-clear');
      clearBtn.addEventListener('click', () => {
        input.value = '';
        wrapper.classList.remove('search-bar__has-value');
        renderEquip('');
        input.focus();
      });
    }

    input.addEventListener('input', () => {
      wrapper.classList.toggle('search-bar__has-value', input.value.length > 0);
    });
  }
};

export function highlightText(text, searchTerm) {
  if (!searchTerm || !text) return Utils.escapeHtml(text);
  const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex   = new RegExp(`(${escaped})`, 'gi');
  return Utils.escapeHtml(text).replace(regex, '<mark class="mark-highlight">$1</mark>');
}