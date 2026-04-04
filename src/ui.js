/**
 * CoolTrack Pro - UI Orchestrator v5.0 (SaaS)
 *
 * Integrações novas:
 * - Onboarding banner (C1)
 * - Empty state orientado (C2)
 * - Hierarquia correta no modal de equipamento (C3)
 * - Técnico padrão pré-preenchido (H1)
 * - Tagline no header (H2)
 * - Highlight pós-save no histórico (H5)
 * - Campos de custo no formulário (D2)
 * - Próxima ação recomendada no dashboard (D3)
 * - Modo cliente (D4)
 */

import { Utils, TIPO_ICON, STATUS_LABEL }             from './utils.js';
import { getState, findEquip, lastRegForEquip,
         regsForEquip, setState }                     from './state.js';
import { Storage }                                    from './storage.js';
import { Charts }                                     from './charts.js';
import { Toast }                                      from './toast.js';
import { Alerts }                                     from './alerts.js';
import { Photos }                                     from './photos.js';
import { OnboardingBanner, Profile,
         SavedHighlight }                             from './onboarding.js';
import { ClientMode }                                 from './clientmode.js';

export { Modal, CustomConfirm } from './modal.js';
export { Photos }               from './photos.js';

// ── Labels técnicos ────────────────────────────────────
const STATUS_TECH = { ok: 'OPERANDO', warn: 'ATENÇÃO', danger: 'FALHA' };

// ════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════
function empty(icon, msg, sub = '', cta = '') {
  return `<div class="empty-state">
    <div class="empty-state__icon" aria-hidden="true">${icon}</div>
    <div class="empty-state__title">${msg}</div>
    ${sub  ? `<div class="empty-state__sub">${sub}</div>`  : ''}
    ${cta  ? `<div style="margin-top:16px">${cta}</div>`  : ''}
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
  } else { score -= 30; }
  if (lastReg?.proxima && Utils.daysDiff(lastReg.proxima) < 0) score -= 20;
  return Math.max(0, Math.min(100, score));
}

function getHealthClass(score) {
  return score >= 80 ? 'ok' : score >= 50 ? 'warn' : 'danger';
}

// ════════════════════════════════════════════════════════
// HEADER
// ════════════════════════════════════════════════════════
export function updateHeader() {
  const { equipamentos, registros } = getState();
  const today       = new Date();
  const iniMes      = new Date(today.getFullYear(), today.getMonth(), 1);
  const alerts      = Alerts.getAll();
  const alertCount  = alerts.length;
  const faultCount  = equipamentos.filter(e => e.status === 'danger').length;
  const mesCount    = registros.filter(r => new Date(r.data) >= iniMes).length;
  const activeCount = equipamentos.filter(e => e.status !== 'danger').length;

  // Data
  const dateEl = Utils.getEl('hdr-date');
  if (dateEl) dateEl.textContent = today.toLocaleDateString('pt-BR', {
    weekday: 'short', day: '2-digit', month: 'short'
  }).toUpperCase();

  // Stats bar
  const totalEl = Utils.getEl('hst-total');
  if (totalEl) totalEl.textContent = equipamentos.length ? `${activeCount}/${equipamentos.length}` : '—';
  const mesEl = Utils.getEl('hst-mes');
  if (mesEl) mesEl.textContent = mesCount || '—';
  const alertEl = Utils.getEl('hst-alert');
  if (alertEl) alertEl.textContent = alertCount || '0';

  // KPIs bento
  const bentAlert = Utils.getEl('hst-alert-bento');
  const bentAlertSub = Utils.getEl('hst-alert-bento-sub');
  if (bentAlert) {
    bentAlert.textContent = String(activeCount);
    bentAlert.className = `bento-kpi__value bento-kpi__value--${faultCount > 0 ? 'warn' : 'ok'}`;
  }
  if (bentAlertSub) bentAlertSub.textContent = faultCount > 0 ? `${faultCount} fora de operação` : 'todos operando';

  const failEl = Utils.getEl('hst-fail-bento');
  if (failEl) failEl.textContent = String(faultCount);

  const mesB = Utils.getEl('hst-mes-bento');
  if (mesB) mesB.textContent = String(mesCount);
  const mesBSub = Utils.getEl('hst-mes-bento-sub');
  if (mesBSub) mesBSub.textContent = mesCount === 1 ? 'registro realizado' : 'registros realizados';

  // Badge
  const badge = Utils.getEl('alerta-badge');
  if (badge) { badge.textContent = String(alertCount); badge.classList.toggle('is-visible', alertCount > 0); }

  // Status no header
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
  const avg = Math.round(equipamentos.reduce((acc, eq) => acc + calcHealthScore(eq.id), 0) / equipamentos.length);
  const cls = getHealthClass(avg);
  if (el) { el.textContent = `${avg}%`; el.className = `bento-kpi__value bento-kpi__value--${cls === 'ok' ? 'cyan' : cls}`; }
  if (barEl) { barEl.style.width = `${avg}%`; barEl.className = `health-bar__fill health-bar__fill--${cls}`; }
}

function updateStorageIndicator() {
  const indicator = Utils.getEl('storage-indicator');
  if (!indicator) return;
  const { used, total, percent } = Storage.usage();
  if (percent < 50) { indicator.style.display = 'none'; return; }
  indicator.style.display = 'block';
  const cls = percent >= 85 ? 'danger' : 'warn';
  indicator.className = `storage-indicator storage-indicator--${cls}`;
  indicator.innerHTML = `<div class="storage-indicator__label"><span>Armazenamento local</span><span>${Utils.formatBytes(used)} / ${Utils.formatBytes(total)}</span></div><div class="storage-indicator__bar"><div class="storage-indicator__fill storage-indicator__fill--${cls}" style="width:${percent}%"></div></div>`;
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
    tecDatalist.innerHTML = (tecnicos || []).map(t => `<option value="${Utils.escapeHtml(t)}">`).join('');
  }

  // H1: Pré-preencher técnico padrão
  const rTecnico = Utils.getEl('r-tecnico');
  if (rTecnico && !rTecnico.value) {
    const defaultTec = Profile.getDefaultTecnico();
    if (defaultTec) rTecnico.value = defaultTec;
  }
}

// ════════════════════════════════════════════════════════
// EQUIPMENT CARD
// ════════════════════════════════════════════════════════
function equipCardHtml(eq, { showLocal = true } = {}) {
  const icon  = TIPO_ICON[eq.tipo] ?? '⚙️';
  const last  = lastRegForEquip(eq.id);
  const score = calcHealthScore(eq.id);
  const hcls  = getHealthClass(score);
  const scls  = eq.status;

  let proximaHtml = '<span style="color:var(--text-3)">—</span>';
  if (last?.proxima) {
    const diff = Utils.daysDiff(last.proxima);
    if (diff < 0)       proximaHtml = `<span class="equip-card__data-value--danger">Vencida há ${Math.abs(diff)}d</span>`;
    else if (diff === 0) proximaHtml = `<span class="equip-card__data-value--warn">Hoje</span>`;
    else if (diff <= 7) proximaHtml = `<span class="equip-card__data-value--warn">em ${diff}d</span>`;
    else                proximaHtml = `<span>em ${diff} dias</span>`;
  }

  return `
  <div class="equip-card equip-card--${scls}"
    data-action="view-equip" data-id="${eq.id}"
    role="listitem" tabindex="0"
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
        <button class="equip-card__delete" data-action="delete-equip" data-id="${eq.id}"
          aria-label="Excluir ${Utils.escapeHtml(eq.nome)}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
          </svg>
        </button>
      </div>
    </div>
    <div class="equip-card__body">
      ${showLocal ? `<div class="equip-card__data"><div class="equip-card__data-label">LOCAL</div><div class="equip-card__data-value equip-card__data-value--muted">${Utils.escapeHtml(Utils.truncate(eq.local, 26))}</div></div>` : ''}
      <div class="equip-card__data"><div class="equip-card__data-label">FLUIDO</div><div class="equip-card__data-value">${Utils.escapeHtml(eq.fluido || '—')}</div></div>
      <div class="equip-card__data"><div class="equip-card__data-label">ÚLTIMO</div><div class="equip-card__data-value equip-card__data-value--muted">${last ? Utils.formatDate(last.data.slice(0,10)) : '—'}</div></div>
      <div class="equip-card__data"><div class="equip-card__data-label">PRÓXIMA</div><div class="equip-card__data-value">${proximaHtml}</div></div>
    </div>
    <div class="equip-card__footer">
      <span class="equip-card__footer-text">${last ? `${Utils.escapeHtml(Utils.truncate(last.tipo, 30))} · ${Utils.escapeHtml(last.tecnico || '—')}` : 'Nenhum serviço registrado'}</span>
      <span class="equip-card__footer-action">Ver detalhes →</span>
    </div>
  </div>`;
}

export function renderEquip(filtro = '') {
  const { equipamentos } = getState();
  const q    = filtro.toLowerCase();
  const list = equipamentos.filter(e => !q || e.nome.toLowerCase().includes(q) || e.local.toLowerCase().includes(q) || (e.tag || '').toLowerCase().includes(q));
  const el   = Utils.getEl('lista-equip');
  if (!el) return;
  el.innerHTML = list.length
    ? list.map(eq => equipCardHtml(eq)).join('')
    : empty('🔧', 'Nenhum equipamento encontrado', 'Tente outro termo ou cadastre um novo.',
        `<button class="btn btn--primary btn--sm" data-action="open-modal" data-id="modal-add-eq" style="width:auto">+ Cadastrar</button>`);
}

// ════════════════════════════════════════════════════════
// ALERT STRIP
// ════════════════════════════════════════════════════════
function renderAlertStrip() {
  const el = Utils.getEl('dash-alert-strip');
  if (!el) return;
  const { equipamentos } = getState();
  const faults = equipamentos.filter(e => e.status === 'danger');
  if (!faults.length) {
    el.innerHTML = `<div class="alert-strip alert-strip--none">
      <div class="alert-strip__icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="var(--success)" stroke-width="1.3"/><path d="M5 8l2 2 4-4" stroke="var(--success)" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
      <div><div class="alert-strip__title">Todos os equipamentos operando normalmente</div><div class="alert-strip__desc">Nenhuma falha crítica detectada</div></div>
    </div>`;
    return;
  }
  const primary = faults[0];
  const lastReg = lastRegForEquip(primary.id);
  el.innerHTML = `<div class="alert-strip" role="alert" aria-live="assertive">
    <div class="alert-strip__icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2L1.5 13.5h13L8 2Z" stroke="var(--danger)" stroke-width="1.3" stroke-linejoin="round"/><path d="M8 6.5v3.5M8 11.5v.5" stroke="var(--danger)" stroke-width="1.3" stroke-linecap="round"/></svg></div>
    <div><div class="alert-strip__title">${Utils.escapeHtml(primary.nome)} — Falha detectada</div><div class="alert-strip__desc">${Utils.escapeHtml(primary.tag || primary.tipo)} · ${Utils.escapeHtml(primary.local)}${faults.length > 1 ? ` · +${faults.length - 1} outro(s)` : ''}</div></div>
    ${lastReg ? `<div class="alert-strip__time">Últ. serviço: ${Utils.formatDatetime(lastReg.data)}</div>` : ''}
  </div>`;
}

// ════════════════════════════════════════════════════════
// ALERT CARD
// ════════════════════════════════════════════════════════
function alertCardHtml({ kind, reg, eq }) {
  if (kind === 'critical') return `<div class="alert-card alert-card--critical" data-nav="alertas" role="listitem"><span class="alert-card__icon" aria-hidden="true">🔴</span><div><div class="alert-card__title">Equipamento fora de operação</div><div class="alert-card__sub">Requer intervenção imediata</div><div class="alert-card__equip">${Utils.escapeHtml(eq.nome)}</div></div></div>`;
  const equip = findEquip(reg.equipId);
  if (kind === 'overdue') return `<div class="alert-card alert-card--critical" data-nav="alertas" role="listitem"><span class="alert-card__icon" aria-hidden="true">⚠️</span><div><div class="alert-card__title">Manutenção preventiva vencida</div><div class="alert-card__sub">${Utils.escapeHtml(reg.tipo)}</div><div class="alert-card__equip">${Utils.escapeHtml(equip?.nome ?? '—')}</div></div></div>`;
  return `<div class="alert-card" data-nav="alertas" role="listitem"><span class="alert-card__icon" aria-hidden="true">🔔</span><div><div class="alert-card__title">Manutenção em ${Utils.daysDiff(reg.proxima)} dia(s)</div><div class="alert-card__sub">${Utils.escapeHtml(reg.tipo)}</div><div class="alert-card__equip">${Utils.escapeHtml(equip?.nome ?? '—')}</div></div></div>`;
}

// ════════════════════════════════════════════════════════
// PRÓXIMA AÇÃO RECOMENDADA (D3)
// ════════════════════════════════════════════════════════
function renderNextAction() {
  const el = Utils.getEl('dash-next-action');
  if (!el) return;

  const { equipamentos, registros } = getState();

  // Sem equipamentos — não mostrar nada
  if (!equipamentos.length) { el.innerHTML = ''; return; }

  // ── 1. Manutenção vencida (urgente) ───────────────────
  let vencida = null;
  registros.forEach(r => {
    if (!r.proxima) return;
    const diff = Utils.daysDiff(r.proxima);
    if (diff < 0) {
      if (!vencida || diff < Utils.daysDiff(vencida.proxima)) vencida = r;
    }
  });

  if (vencida) {
    const eq  = findEquip(vencida.equipId);
    const dias = Math.abs(Utils.daysDiff(vencida.proxima));
    el.innerHTML = `
      <div class="next-action-card next-action-card--urgent"
        data-action="go-register-equip" data-id="${eq?.id || ''}">
        <div class="next-action-card__icon" aria-hidden="true">🔴</div>
        <div class="next-action-card__body">
          <div class="next-action-card__label">MANUTENÇÃO VENCIDA HÁ ${dias} DIA${dias !== 1 ? 'S' : ''}</div>
          <div class="next-action-card__title">${Utils.escapeHtml(eq?.nome || '—')}</div>
          <div class="next-action-card__sub">${Utils.escapeHtml(vencida.tipo)} · prevista para ${Utils.formatDate(vencida.proxima)}</div>
        </div>
        <button class="btn btn--danger btn--sm" style="white-space:nowrap;flex-shrink:0"
          data-action="go-register-equip" data-id="${eq?.id || ''}">
          Registrar agora
        </button>
      </div>`;
    return;
  }

  // ── 2. Manutenção próxima (≤ 7 dias) ─────────────────
  let urgente = null;
  let urgenteDiff = Infinity;
  registros.forEach(r => {
    if (!r.proxima) return;
    const diff = Utils.daysDiff(r.proxima);
    if (diff >= 0 && diff <= 7 && diff < urgenteDiff) { urgenteDiff = diff; urgente = r; }
  });

  if (urgente) {
    const eq = findEquip(urgente.equipId);
    const label = urgenteDiff === 0 ? 'HOJE' : `EM ${urgenteDiff} DIA${urgenteDiff !== 1 ? 'S' : ''}`;
    el.innerHTML = `
      <div class="next-action-card"
        data-action="go-register-equip" data-id="${eq?.id || ''}">
        <div class="next-action-card__icon" aria-hidden="true">📅</div>
        <div class="next-action-card__body">
          <div class="next-action-card__label">PREVENTIVA ${label}</div>
          <div class="next-action-card__title">${Utils.escapeHtml(eq?.nome || '—')}</div>
          <div class="next-action-card__sub">${Utils.escapeHtml(urgente.tipo)}</div>
        </div>
        <button class="btn btn--primary btn--sm" style="white-space:nowrap;flex-shrink:0"
          data-action="go-register-equip" data-id="${eq?.id || ''}">
          Agendar registro
        </button>
      </div>`;
    return;
  }

  // ── 3. Equipamento sem nenhum registro ────────────────
  const semRegistro = equipamentos.find(eq => !registros.find(r => r.equipId === eq.id));
  if (semRegistro) {
    el.innerHTML = `
      <div class="next-action-card next-action-card--info"
        data-action="go-register-equip" data-id="${semRegistro.id}">
        <div class="next-action-card__icon" aria-hidden="true">📋</div>
        <div class="next-action-card__body">
          <div class="next-action-card__label">SEM HISTÓRICO</div>
          <div class="next-action-card__title">${Utils.escapeHtml(semRegistro.nome)} não tem nenhum registro</div>
          <div class="next-action-card__sub">Registre o primeiro serviço para ativar o monitoramento</div>
        </div>
        <button class="btn btn--outline btn--sm" style="white-space:nowrap;flex-shrink:0"
          data-action="go-register-equip" data-id="${semRegistro.id}">
          Registrar serviço
        </button>
      </div>`;
    return;
  }

  // ── 4. Tudo em dia — estado positivo real ─────────────
  // Só mostra se há pelo menos uma data de próxima manutenção registrada
  const temProxima = registros.some(r => r.proxima && Utils.daysDiff(r.proxima) >= 0);
  if (temProxima) {
    // Próxima manutenção mais distante (> 7 dias) — tudo OK
    el.innerHTML = `
      <div class="next-action-card next-action-card--ok">
        <div class="next-action-card__icon" aria-hidden="true">✅</div>
        <div class="next-action-card__body">
          <div class="next-action-card__label">NENHUMA AÇÃO URGENTE</div>
          <div class="next-action-card__title">Todas as manutenções estão dentro do prazo</div>
          <div class="next-action-card__sub">Continue registrando os serviços para manter o histórico atualizado</div>
        </div>
      </div>`;
    return;
  }

  // Sem datas de próxima manutenção — não inventar nada
  el.innerHTML = '';
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
  if (greetEl) greetEl.textContent = faults > 0 ? `${faults} Falha${faults > 1 ? 's' : ''} Detectada${faults > 1 ? 's' : ''}` : 'Sistema Operacional';

  const bento = document.querySelector('.dashboard-bento');
  if (!bento) return;

  // C2: Empty state orientado quando não há equipamentos reais
  if (equipamentos.length === 0) {
    bento.innerHTML = `<div style="padding:var(--space-6) var(--space-4)">
      ${empty('🔧', 'Seu painel está pronto',
        'Cadastre o primeiro equipamento para ver eficiência, alertas e histórico em tempo real.',
        `<button class="btn btn--primary" data-action="open-modal" data-id="modal-add-eq" style="width:auto;max-width:260px;margin:0 auto">+ Cadastrar Primeiro Equipamento</button>`
      )}
    </div>`;
    return;
  }

  // C1: Banner de onboarding
  OnboardingBanner.render();

  // Alert strip
  renderAlertStrip();

  // Próxima ação (D3)
  renderNextAction();

  // Equipamentos críticos
  const criticosEl = Utils.getEl('dash-criticos');
  if (criticosEl) {
    criticosEl.innerHTML = critical.length
      ? `<div class="dash-criticos-list">${critical.map(eq => equipCardHtml(eq, { showLocal: true })).join('')}</div>`
      : `<div style="padding:var(--space-4);font-size:13px;color:var(--text-2);text-align:center;background:var(--success-dim);border:1px solid rgba(0,200,112,0.15);border-radius:var(--radius-sm);">✅ Todos os equipamentos operando normalmente</div>`;
  }

  // Alertas mini
  const alertsMini = Utils.getEl('dash-alertas-mini');
  if (alertsMini) {
    alertsMini.innerHTML = alerts.length
      ? `<div class="dash-alertas-list">${alerts.slice(0, 4).map(alertCardHtml).join('')}</div>`
      : `<div style="padding:var(--space-4);font-size:12px;color:var(--text-3);text-align:center;">Nenhum alerta ativo</div>`;
  }

  // Últimos serviços
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
  const el   = Utils.getEl('lista-alertas');
  if (!el) return;
  el.innerHTML = list.length
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
  if (filtEq) list = list.filter(r => r.equipId === filtEq);
  if (busca)  list = list.filter(r => {
    const eq = findEquip(r.equipId);
    return r.obs.toLowerCase().includes(busca) || r.tipo.toLowerCase().includes(busca)
      || (eq?.nome || '').toLowerCase().includes(busca) || (r.tecnico || '').toLowerCase().includes(busca);
  });

  const el = Utils.getEl('timeline');
  if (!el) return;

  if (!list.length) { el.innerHTML = empty('📋', 'Nenhum registro encontrado'); return; }

  el.innerHTML = `<div class="timeline">${list.map(r => {
    const eq     = findEquip(r.equipId);
    const dotMod = r.status !== 'ok' ? `timeline__dot--${r.status}` : '';
    const custoTotal = (parseFloat(r.custoPecas || 0) + parseFloat(r.custoMaoObra || 0));
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
          ${custoTotal > 0 ? `<div class="timeline__parts timeline__custo">Total: R$ ${custoTotal.toFixed(2).replace('.', ',')}</div>` : ''}
          ${r.proxima ? `<div class="timeline__next">Próxima: ${Utils.formatDate(r.proxima)}</div>` : ''}
          ${r.assinatura ? `<div class="timeline__signed"><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" stroke="var(--success)" stroke-width="1"/><path d="M3.5 6l1.5 1.5 3-3" stroke="var(--success)" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg> Assinado pelo cliente</div>` : ''}
        </div>
        <button class="timeline__delete" data-action="delete-reg" data-id="${r.id}" aria-label="Excluir registro">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
        </button>
      </div>
    </div>`;
  }).join('')}</div>`;

  // H5: Highlight do item recém-salvo
  SavedHighlight.applyIfPending();
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
  if (!el) return;

  if (!list.length) { el.innerHTML = empty('📋', 'Sem registros no período selecionado'); return; }

  const hoje  = new Date().toLocaleDateString('pt-BR');
  const total = list.reduce((acc, r) => acc + (parseFloat(r.custoPecas || 0) + parseFloat(r.custoMaoObra || 0)), 0);

  el.innerHTML = `
    <div class="card">
      <div class="report-header">RELATÓRIO DE MANUTENÇÃO — COOLTRACK PRO</div>
      <div class="report-meta">Gerado em ${hoje} · ${list.length} registro(s)${total > 0 ? ` · Total: R$ ${total.toFixed(2).replace('.', ',')}` : ''}</div>
    </div>
    ${list.map(r => {
      const eq = findEquip(r.equipId);
      const custoTotal = (parseFloat(r.custoPecas || 0) + parseFloat(r.custoMaoObra || 0));
      return `<div class="card report-record">
        <div class="report-record__head">
          <div>
            <div class="report-record__title">${Utils.escapeHtml(r.tipo)}</div>
            <div class="report-record__date">${Utils.formatDatetime(r.data)}</div>
          </div>
          <span class="badge badge--${r.status}"><span class="status-dot status-dot--${r.status}"></span>${STATUS_LABEL[r.status]}</span>
        </div>
        <div class="info-list">
          <div class="info-row"><span class="info-row__label">Equipamento</span><span class="info-row__value">${Utils.escapeHtml(eq?.nome ?? '—')}</span></div>
          <div class="info-row"><span class="info-row__label">TAG</span><span class="info-row__value" style="font-family:var(--font-mono)">${Utils.escapeHtml(eq?.tag ?? '—')}</span></div>
          <div class="info-row"><span class="info-row__label">Local</span><span class="info-row__value">${Utils.escapeHtml(eq?.local ?? '—')}</span></div>
          <div class="info-row"><span class="info-row__label">Fluido</span><span class="info-row__value">${Utils.escapeHtml(eq?.fluido ?? '—')}</span></div>
          <div class="info-row"><span class="info-row__label">Técnico</span><span class="info-row__value">${Utils.escapeHtml(r.tecnico ?? '—')}</span></div>
          ${r.pecas ? `<div class="info-row"><span class="info-row__label">Peças / Materiais</span><span class="info-row__value">${Utils.escapeHtml(r.pecas)}</span></div>` : ''}
          ${r.custoPecas > 0 ? `<div class="info-row"><span class="info-row__label">Custo de Peças</span><span class="info-row__value">R$ ${parseFloat(r.custoPecas).toFixed(2).replace('.', ',')}</span></div>` : ''}
          ${r.custoMaoObra > 0 ? `<div class="info-row"><span class="info-row__label">Mão de Obra</span><span class="info-row__value">R$ ${parseFloat(r.custoMaoObra).toFixed(2).replace('.', ',')}</span></div>` : ''}
          ${custoTotal > 0 ? `<div class="info-row" style="border-top:1px solid var(--border-2);font-weight:700"><span class="info-row__label" style="color:var(--text)">Total do Serviço</span><span class="info-row__value" style="color:var(--primary)">R$ ${custoTotal.toFixed(2).replace('.', ',')}</span></div>` : ''}
          ${r.proxima ? `<div class="info-row"><span class="info-row__label">Próxima Manutenção</span><span class="info-row__value">${Utils.formatDate(r.proxima)}</span></div>` : ''}
          ${r.assinatura ? `<div class="info-row"><span class="info-row__label">Assinatura</span><span class="info-row__value" style="color:var(--success)">✓ Assinado pelo cliente</span></div>` : ''}
        </div>
        <div class="report-record__obs">${Utils.escapeHtml(r.obs)}</div>
      </div>`;
    }).join('')}`;
}

// ════════════════════════════════════════════════════════
// EQUIPAMENTOS MODULE — C3: hierarquia correta
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
        tag: normalizedTag, tipo: Utils.getVal('eq-tipo'),
        modelo: Utils.getVal('eq-modelo').trim(), fluido: Utils.getVal('eq-fluido')
      }]
    }));
    import('./modal.js').then(({ Modal: M }) => M.close('modal-add-eq'));
    Utils.clearVals('eq-nome', 'eq-tag', 'eq-local', 'eq-modelo');
    // Dispensar banner de onboarding após cadastrar equipamento real
    OnboardingBanner.dismiss();
    OnboardingBanner.remove();
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

    // C3: "Registrar Serviço" é o CTA primário; "Excluir" é link discreto no rodapé
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

      <!-- C3: Registrar como btn primário, excluir como ação secundária discreta -->
      <button class="btn btn--primary" data-action="go-register-equip" data-id="${id}" style="margin-bottom:var(--space-2)">
        + Registrar Serviço
      </button>
      <div class="eq-modal-summary">${regs.length} serviço(s) registrado(s)</div>
      ${regs.slice(0, 3).map(r => `<div class="eq-modal-quick">${Utils.escapeHtml(r.tipo)} · ${Utils.formatDatetime(r.data)}</div>`).join('')}

      <!-- Excluir: link no rodapé, discreto -->
      <div style="margin-top:var(--space-4);padding-top:var(--space-3);border-top:1px solid var(--border);text-align:center;">
        <button class="eq-delete-link" data-action="delete-equip" data-id="${id}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
          Excluir equipamento
        </button>
      </div>`;

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
// REGISTRO MODULE — H1, D2, assinatura
// ════════════════════════════════════════════════════════
export const Registro = {
  async save() {
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
    if (missing.length) { Toast.warning(`Campos obrigatórios: ${missing.join(', ')}`); return; }

    const proxima = Utils.getVal('r-proxima');
    if (proxima && proxima < data.slice(0, 10)) { Toast.error('Próxima manutenção não pode ser anterior ao serviço.'); return; }

    const status      = Utils.getVal('r-status');
    const custoPecas  = parseFloat(Utils.getVal('r-custo-pecas')  || '0') || 0;
    const custoMaoObra = parseFloat(Utils.getVal('r-custo-mao-obra') || '0') || 0;
    const novoId      = Utils.uid();

    // H1: Salvar técnico padrão
    Profile.saveLastTecnico(tecnico);

    // D1: Solicitar assinatura do cliente
    let assinatura = null;
    const { SignatureModal, saveSignatureForRecord } = await import('./signature.js');
    const eq = findEquip(equipId);
    assinatura = await SignatureModal.request(novoId, eq?.nome || 'Equipamento');
    if (assinatura) saveSignatureForRecord(novoId, assinatura);

    setState(prev => {
      const currentTecs = prev.tecnicos || [];
      const updatedTecs = tecnico && !currentTecs.includes(tecnico) ? [...currentTecs, tecnico] : currentTecs;
      return {
        ...prev,
        tecnicos: updatedTecs,
        registros: [...prev.registros, {
          id: novoId, equipId, data, tipo, obs, status,
          pecas:        Utils.getVal('r-pecas').trim(),
          proxima,
          fotos:        [...Photos.pending],
          tecnico,
          custoPecas,
          custoMaoObra,
          assinatura:   assinatura ? true : false,
        }],
        equipamentos: prev.equipamentos.map(e => e.id === equipId ? { ...e, status } : e)
      };
    });

    // H5: Marcar para highlight
    SavedHighlight.markForHighlight(novoId);
    this.clear();
    Toast.success('Serviço registrado com sucesso.');
    goView('historico');
  },

  clear(preserveEquip = false) {
    const toClear = ['r-tipo', 'r-pecas', 'r-obs', 'r-proxima', 'r-tecnico', 'r-custo-pecas', 'r-custo-mao-obra'];
    if (!preserveEquip) toClear.push('r-equip');
    Utils.clearVals(...toClear);
    Utils.setVal('r-status', 'ok');
    Utils.setVal('r-data', Utils.nowDatetime());
    Photos.clear();
    document.getElementById('form-progress-container-unique-v333')?.remove();

    // H1: Repor técnico padrão
    const rTecnico = Utils.getEl('r-tecnico');
    if (rTecnico) rTecnico.value = Profile.getDefaultTecnico();
  }
};

// ════════════════════════════════════════════════════════
// HISTÓRICO MODULE
// ════════════════════════════════════════════════════════
export const Historico = {
  delete(id) {
    setState(prev => {
      const reg    = prev.registros.find(r => r.id === id);
      const regs   = prev.registros.filter(r => r.id !== id);
      if (!reg) return { ...prev, registros: regs };
      const last   = regs.filter(r => r.equipId === reg.equipId).sort((a, b) => b.data.localeCompare(a.data))[0];
      const equips = prev.equipamentos.map(eq => eq.id === reg.equipId ? { ...eq, status: last?.status || 'ok' } : eq);
      return { ...prev, registros: regs, equipamentos: equips };
    });
    // Limpar assinatura associada
    localStorage.removeItem(`cooltrack-sig-${id}`);
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
      try { activeView.classList.remove('active', 'is-exiting'); activateNewView(name); }
      finally { _isTransitioning = false; }
    }, 150);
  } else { activateNewView(name); }
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
  Utils.getEl('main-content')?.focus();
  window.scrollTo(0, 0);
}

// ════════════════════════════════════════════════════════
// ACTIONS
// ════════════════════════════════════════════════════════
export const Actions = {
  init() {
    this.initThemeToggle();
    this.initFormValidation();
    this.initSmartSearch();
    this.initEquipChangeWarning();
    ClientMode.restore();
    ClientMode.initToggleButton();
  },

  initEquipChangeWarning() {
    const sel = Utils.getEl('r-equip');
    if (!sel) return;
    sel.addEventListener('change', () => {
      const id = sel.value;
      document.getElementById('reg-pending-warning')?.remove();
      if (!id) return;
      const lastReg = lastRegForEquip(id);
      if (lastReg && Utils.daysDiff(lastReg.proxima) >= 0) {
        const w = document.createElement('div');
        w.id = 'reg-pending-warning';
        w.style.cssText = 'color:var(--warning);margin-bottom:12px;font-size:12px;line-height:1.4;padding:8px 10px;background:var(--warning-dim);border:1px solid rgba(232,160,32,0.2);border-radius:var(--radius-xs);';
        w.textContent = '⚠ Manutenção preventiva agendada. Registre apenas em emergência.';
        sel.parentNode.parentNode.insertBefore(w, sel.parentNode.nextSibling);
      }
    });
    document.addEventListener('click', e => {
      const btn = e.target.closest('[data-action="go-register-equip"]');
      if (!btn) return;
      const equipId = btn.dataset.id;
      import('./modal.js').then(({ Modal: M }) => M.close('modal-eq-det'));
      goView('registro');
      setTimeout(() => { Utils.setVal('r-equip', equipId); sel.dispatchEvent(new Event('change')); }, 50);
    });
  },

  initThemeToggle() {
    const toggleBtn = Utils.getEl('theme-toggle');
    const themeIcon = Utils.getEl('theme-icon');
    if (!toggleBtn || !themeIcon) return;
    const getPreferred = () => localStorage.getItem('cooltrack-theme') || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    const applyTheme = theme => {
      if (theme === 'light') { document.documentElement.setAttribute('data-theme', 'light'); themeIcon.textContent = '☀️'; }
      else { document.documentElement.removeAttribute('data-theme'); themeIcon.textContent = '🌙'; }
      localStorage.setItem('cooltrack-theme', theme);
    };
    applyTheme(getPreferred());
    toggleBtn.addEventListener('click', () => {
      const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      applyTheme(next);
      requestAnimationFrame(() => { _lastChartHash = null; Charts.refreshAll(); });
    });
  },

  initFormValidation() {
    const formView = Utils.getEl('view-registro');
    if (!formView) return;
    const fields = [
      { id: 'r-equip',   validate: v => v !== '' },
      { id: 'r-data',    validate: v => v !== '' },
      { id: 'r-tipo',    validate: v => v !== '' },
      { id: 'r-tecnico', validate: v => v.trim() !== '' },
      { id: 'r-obs',     validate: v => v.trim().length >= 10 }
    ];
    const CONTAINER_ID = 'form-progress-container-unique-v333';
    const ensureBar = () => {
      if (document.getElementById(CONTAINER_ID)) return;
      const c = document.createElement('div');
      c.id = CONTAINER_ID; c.className = 'form-progress';
      c.innerHTML = `<div class="form-progress__text"><span>Campos preenchidos</span><span id="form-progress-count">0/${fields.length}</span></div><div class="form-progress__bar"><div class="form-progress__fill" id="form-progress-fill" style="width:0%"></div></div>`;
      formView.querySelector('.card')?.insertBefore(c, formView.querySelector('.card').firstChild);
    };
    const updateBar = () => {
      ensureBar();
      const filled = fields.filter(f => { const i = Utils.getEl(f.id); return i && f.validate(i.value); }).length;
      const bar = document.getElementById('form-progress-fill');
      const cnt = document.getElementById('form-progress-count');
      if (bar) bar.style.width = `${(filled / fields.length) * 100}%`;
      if (cnt) cnt.textContent = `${filled}/${fields.length}`;
    };
    fields.forEach(f => { const i = Utils.getEl(f.id); if (i) { i.addEventListener('input', updateBar); i.addEventListener('change', updateBar); } });
    updateBar();
  },

  initSmartSearch() {
    const wrapper = document.querySelector('#view-equipamentos .search-bar');
    const input   = document.querySelector('#view-equipamentos .search-bar__input');
    if (!input || !wrapper) return;
    if (!wrapper.querySelector('.search-bar__clear')) {
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'search-bar__clear'; btn.innerHTML = '✕'; btn.setAttribute('aria-label', 'Limpar busca');
      wrapper.classList.add('search-bar__wrapper'); wrapper.appendChild(btn);
      input.classList.add('search-bar__input--with-clear');
      btn.addEventListener('click', () => { input.value = ''; wrapper.classList.remove('search-bar__has-value'); renderEquip(''); input.focus(); });
    }
    input.addEventListener('input', () => wrapper.classList.toggle('search-bar__has-value', input.value.length > 0));
  }
};

export function highlightText(text, searchTerm) {
  if (!searchTerm || !text) return Utils.escapeHtml(text);
  const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return Utils.escapeHtml(text).replace(new RegExp(`(${escaped})`, 'gi'), '<mark class="mark-highlight">$1</mark>');
}