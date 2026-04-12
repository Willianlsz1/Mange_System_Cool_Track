/**
 * CoolTrack Pro - Equipamentos View v5.0
 * Funções: renderEquip, saveEquip, viewEquip, deleteEquip, populateEquipSelects
 */

import { Utils, TIPO_ICON } from '../../core/utils.js';
import { getState, findEquip, setState, regsForEquip, findSetor } from '../../core/state.js';
import { Storage } from '../../core/storage.js';
import { Toast } from '../../core/toast.js';
import { OnboardingBanner } from '../components/onboarding.js';
import { withSkeleton } from '../components/skeleton.js';
import { Profile } from '../../features/profile.js';
import { calcHealthScore, getHealthClass, updateHeader } from './dashboard.js';
import { ErrorCodes, handleError } from '../../core/errors.js';
import { checkPlanLimit, isGuestMode } from '../../core/guestLimits.js';
import { GuestConversionModal } from '../components/guestConversionModal.js';
import { trackEvent } from '../../core/telemetry.js';
import {
  evaluateEquipmentHealth,
  evaluateEquipmentRisk,
  getEquipmentMaintenanceContext,
  getSuggestedPreventiveDays,
  normalizePeriodicidadePreventivaDias,
} from '../../domain/maintenance.js';
import { evaluateEquipmentPriority } from '../../domain/priorityEngine.js';
import { ACTION_CODE, evaluateEquipmentSuggestedAction } from '../../domain/suggestedAction.js';
import { getActionPriorityScore } from '../../domain/actionPriority.js';
import { getPreventivaDueEquipmentIds } from '../../domain/alerts.js';
import { emptyStateHtml } from '../components/emptyState.js';
import { validateEquipamentoPayload } from '../../core/inputValidation.js';

const STATUS_OPERACIONAL = {
  ok: 'OPERANDO NORMALMENTE',
  warn: 'OPERANDO COM RESTRIÇÕES',
  danger: 'FORA DE OPERAÇÃO',
};
const CONDICAO_OBSERVADA = {
  ok: 'Sem anormalidades',
  warn: 'Condição fora do padrão',
  danger: 'Intervenção necessária',
  unknown: 'Não avaliado',
};
const PRIORIDADE_LABEL = { baixa: 'Baixa', media: 'Média', alta: 'Alta', critica: 'Crítica' };
const RISK_CLASS_LABEL = { baixo: 'Baixo risco', medio: 'Médio risco', alto: 'Alto risco' };

export function equipCardHtml(eq, { showLocal = true } = {}) {
  const icon = TIPO_ICON[eq.tipo] ?? '⚙️';
  const context = getEquipmentMaintenanceContext(eq, regsForEquip(eq.id));
  const last = context.ultimoRegistro;
  const score = calcHealthScore(eq.id);
  const hcls = getHealthClass(score);
  const scls = Utils.safeStatus(eq.status);
  const safeId = Utils.escapeAttr(eq.id);
  const prioridadeLabel = PRIORIDADE_LABEL[eq.criticidade] || PRIORIDADE_LABEL.media;
  const eqRegs = regsForEquip(eq.id);
  const risk = evaluateEquipmentRisk(eq, eqRegs);
  const priority = evaluateEquipmentPriority(eq, eqRegs);
  const suggestedAction = evaluateEquipmentSuggestedAction(eq, eqRegs);
  const riskFactors = risk.factors.length ? risk.factors.join(' · ') : 'rotina estável';

  function getCtaByAction(actionCode) {
    if (actionCode === ACTION_CODE.REGISTER_CORRECTIVE_IMMEDIATE)
      return 'Registrar corretiva agora →';
    if (actionCode === ACTION_CODE.REGISTER_CORRECTIVE) return 'Registrar corretiva →';
    if (actionCode === ACTION_CODE.REGISTER_PREVENTIVE) return 'Registrar preventiva →';
    if (actionCode === ACTION_CODE.SCHEDULE_PREVENTIVE) return 'Programar preventiva →';
    return 'Registrar serviço →';
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
      proximaIcon = '🔴';
    } else if (diff === 0) {
      proximaLabel = 'Hoje';
      proximaCls = 'equip-card__metric-value--danger';
      proximaIcon = '🔴';
    } else if (diff <= 7) {
      proximaLabel = `Em ${diff} dia${diff > 1 ? 's' : ''}`;
      proximaCls = 'equip-card__metric-value--warn';
      proximaIcon = '⚠️';
    } else {
      proximaLabel = `Em ${diff} dias`;
    }
  }

  let ctaLabel = getCtaByAction(suggestedAction.actionCode);
  if (!last && suggestedAction.actionCode === ACTION_CODE.NONE) ctaLabel = 'Primeiro registro →';

  return `<div class="equip-card equip-card--${scls}" data-action="view-equip" data-id="${safeId}" role="listitem" tabindex="0" aria-label="${Utils.escapeHtml(eq.nome)} — ${STATUS_OPERACIONAL[scls]}">
    <div class="equip-card__header">
      <div class="equip-card__type-icon equip-card__type-icon--lg">${icon}</div>
      <div class="equip-card__meta">
        <div class="equip-card__name ${scls === 'danger' ? 'equip-card__name--danger' : ''}">${Utils.escapeHtml(eq.nome)}</div>
        <div class="equip-card__tag">${Utils.escapeHtml(eq.tag || '—')} · ${Utils.escapeHtml(eq.fluido || eq.tipo)} · Prioridade ${Utils.escapeHtml(prioridadeLabel)}</div>
      </div>
      <span class="equip-card__status equip-card__status--${scls}"><span class="status-dot status-dot--${scls}"></span>${STATUS_OPERACIONAL[scls]}</span>
      <div class="equip-card__actions">
        <button class="equip-card__delete" data-action="delete-equip" data-id="${safeId}" aria-label="Excluir ${Utils.escapeHtml(eq.nome)}">
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
      <span class="equip-card__risk-factors">${Utils.escapeHtml(riskFactors)} · Base ${risk.technicalBaseScore} × Criticidade ${risk.criticidadeMultiplier.toFixed(2)}</span>
    </div>
    <div class="equip-card__priority">
      <span class="equip-card__priority-badge equip-card__priority-badge--${priority.priorityLevel}">${Utils.escapeHtml(priority.priorityLabel)}</span>
      <span class="equip-card__priority-reasons">${Utils.escapeHtml(priority.priorityReasons.join(' · '))}</span>
    </div>
    <div class="equip-card__suggested-action">
      <span class="equip-card__suggested-action-label">Ação recomendada (baseada nos registros)</span>
      <span class="equip-card__suggested-action-title">${Utils.escapeHtml(suggestedAction.actionLabel)}</span>
      <span class="equip-card__suggested-action-reasons">${Utils.escapeHtml(suggestedAction.actionReasons.join(' · '))}</span>
    </div>
    <div class="equip-card__metrics">
      <div class="equip-card__metric">
        <div class="equip-card__metric-label">Último serviço</div>
        <div class="equip-card__metric-value">${last ? Utils.escapeHtml(recencia(last.data)) : '<span class="equip-card__metric-empty">Nenhum registro</span>'}</div>
        ${last ? `<div class="equip-card__metric-sub">${Utils.escapeHtml(Utils.truncate(last.tipo, 22))}</div>` : ''}
      </div>
      ${
        showLocal
          ? `<div class="equip-card__metric">
        <div class="equip-card__metric-label">Localização</div>
        <div class="equip-card__metric-value equip-card__metric-value--muted">${Utils.escapeHtml(Utils.truncate(eq.local, 24))}</div>
      </div>`
          : ''
      }
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

// ─── Setor (PRO) ──────────────────────────────────────────────────────────────

/** ID do setor atualmente expandido; null = vista de grid de setores. */
let _activeSectorId = null;

const _SETOR_CORES = ['#00bcd4', '#00c853', '#ffab40', '#ff5252', '#7c4dff', '#448aff'];

/** Status "pior" de uma lista de equipamentos: danger > warn > ok. */
function worstStatus(eqs) {
  if (eqs.some((e) => Utils.safeStatus(e.status) === 'danger')) return 'danger';
  if (eqs.some((e) => Utils.safeStatus(e.status) === 'warn')) return 'warn';
  return 'ok';
}

/** Retorna o rótulo legível do status. */
const STATUS_LABEL = { ok: 'Normal', warn: 'Atenção', danger: 'Crítico' };

/** Próxima preventiva mais próxima dentre os equipamentos do setor. */
function _soonestPreventiva(eqs, _registros) {
  let min = Infinity;
  eqs.forEach((eq) => {
    const regs = regsForEquip(eq.id);
    const { getEquipmentMaintenanceContext } = require('../../domain/maintenance.js');
    try {
      const ctx = getEquipmentMaintenanceContext(eq, regs);
      if (ctx.proximaPreventiva) {
        const diff = Utils.daysDiff(ctx.proximaPreventiva);
        if (diff < min) min = diff;
      }
    } catch {
      /* ignora */
    }
  });
  if (min === Infinity) return null;
  return min;
}

/** Último técnico a trabalhar em qualquer equip. do setor. */
function lastTecnicoInSetor(eqs) {
  let latestReg = null;
  eqs.forEach((eq) => {
    const regs = regsForEquip(eq.id);
    regs.forEach((r) => {
      if (!latestReg || r.data > latestReg.data) latestReg = r;
    });
  });
  return latestReg?.tecnico ?? null;
}

function _soonestPreventivaLabel(eqs) {
  let min = Infinity;
  eqs.forEach((eq) => {
    const regs = regsForEquip(eq.id);
    try {
      const { getEquipmentMaintenanceContext } = _maintenanceModule || {};
      if (!getEquipmentMaintenanceContext) return;
      const ctx = getEquipmentMaintenanceContext(eq, regs);
      if (ctx.proximaPreventiva) {
        const diff = Utils.daysDiff(ctx.proximaPreventiva);
        if (diff < min) min = diff;
      }
    } catch {
      /* ignora */
    }
  });
  if (min === Infinity) return '—';
  if (min < 0) return `Vencida há ${Math.abs(min)}d`;
  if (min === 0) return 'Hoje';
  return `Em ${min} dias`;
}

// Módulo de manutenção cacheado para uso síncrono nos cards
let _maintenanceModule = null;
import('../../domain/maintenance.js')
  .then((m) => {
    _maintenanceModule = m;
  })
  .catch(() => {});

export function setorCardHtml(setor, equipamentosDoSetor) {
  const count = equipamentosDoSetor.length;
  const ws = worstStatus(equipamentosDoSetor);
  const wsLabel = STATUS_LABEL[ws];
  const cor = setor.cor || '#00bcd4';
  const safeId = Utils.escapeAttr(setor.id);

  // Próxima preventiva
  let prevLabel = '—';
  let prevCls = '';
  equipamentosDoSetor.forEach((eq) => {
    try {
      if (!_maintenanceModule) return;
      const ctx = _maintenanceModule.getEquipmentMaintenanceContext(eq, regsForEquip(eq.id));
      if (ctx.proximaPreventiva) {
        const diff = Utils.daysDiff(ctx.proximaPreventiva);
        if (prevLabel === '—' || diff < parseInt(prevLabel)) {
          if (diff < 0) {
            prevLabel = `Vencida ${Math.abs(diff)}d`;
            prevCls = 'setor-card__val--danger';
          } else if (diff <= 7) {
            prevLabel = `Em ${diff}d`;
            prevCls = 'setor-card__val--warn';
          } else prevLabel = `Em ${diff} dias`;
        }
      }
    } catch {
      /* ignora */
    }
  });

  const tecnico = lastTecnicoInSetor(equipamentosDoSetor);
  const tecLabel = tecnico
    ? Utils.truncate(
        tecnico.split(' ')[0] + (tecnico.split(' ')[1] ? ' ' + tecnico.split(' ')[1][0] + '.' : ''),
        16,
      )
    : '—';

  return `
    <div class="setor-card setor-card--${ws}" data-action="open-setor" data-id="${safeId}"
         style="--setor-cor:${Utils.escapeHtml(cor)}" role="button" tabindex="0"
         aria-label="Setor ${Utils.escapeHtml(setor.nome)}: ${count} equipamento${count !== 1 ? 's' : ''}">

      <div class="setor-card__head">
        <div class="setor-card__info">
          <div class="setor-card__nome">${Utils.escapeHtml(setor.nome)}</div>
          <div class="setor-card__count">
            <span class="setor-card__count-dot"></span>
            ${count} equipamento${count !== 1 ? 's' : ''}
          </div>
        </div>
        <span class="setor-card__status setor-card__status--${ws}">${wsLabel}</span>
      </div>

      <div class="setor-card__metrics">
        <div class="setor-card__metric">
          <span class="setor-card__lbl">Próx. preventiva</span>
          <span class="setor-card__val ${prevCls}">${prevLabel}</span>
        </div>
        <div class="setor-card__metric">
          <span class="setor-card__lbl">Último técnico</span>
          <span class="setor-card__val">${Utils.escapeHtml(tecLabel)}</span>
        </div>
      </div>

      <div class="setor-card__cta">
        <span>Ver equipamentos</span>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M5 3l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>

      <button class="setor-card__delete" data-action="delete-setor" data-id="${safeId}"
              aria-label="Excluir setor ${Utils.escapeHtml(setor.nome)}" title="Excluir setor">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
        </svg>
      </button>
    </div>`;
}

/** Atualiza a toolbar da view de equipamentos. */
function _setToolbar({ title, extraBtn } = {}) {
  const titleEl = Utils.getEl('equip-page-title');
  const actionsEl = Utils.getEl('equip-toolbar-actions');
  if (titleEl) titleEl.textContent = title || 'Parque de Equipamentos';
  if (actionsEl) {
    actionsEl.innerHTML = `
      ${extraBtn || ''}
      <button class="btn btn--primary btn--sm" data-action="open-modal" data-id="modal-add-eq">+ Novo equipamento</button>
    `;
  }
}

/** Popula o select de setores no modal de cadastro de equipamento. */
export function populateSetorSelect(isPro = false) {
  const wrapper = Utils.getEl('eq-setor-wrapper');
  const select = Utils.getEl('eq-setor');
  if (!wrapper || !select) return;

  if (!isPro) {
    wrapper.style.display = 'none';
    return;
  }

  const { setores } = getState();
  if (!setores.length) {
    wrapper.style.display = 'none';
    return;
  }

  wrapper.style.display = '';
  select.innerHTML = '<option value="">Sem setor</option>';
  setores.forEach((s) => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.nome;
    select.appendChild(opt);
  });
}

/** Navega para dentro de um setor (ou volta ao grid se id === null). */
export function setActiveSector(id) {
  _activeSectorId = id ?? null;
  renderEquip();
}

/** Renderiza a grade de setores (vista PRO). */
function renderSetorGrid() {
  const el = Utils.getEl('lista-equip');
  if (!el) return;

  const { setores, equipamentos } = getState();
  const searchBar = Utils.getEl('equip-search-bar');
  if (searchBar) searchBar.style.display = 'none'; // grade não usa busca

  _setToolbar({
    title: 'Setores',
    extraBtn: `<button class="btn btn--outline btn--sm" data-action="open-setor-modal">+ Novo setor</button>`,
  });

  if (!setores.length) {
    el.innerHTML = emptyStateHtml({
      icon: '🗂️',
      title: 'Nenhum setor criado',
      description: 'Crie setores para organizar seus equipamentos por local ou área de trabalho.',
      cta: {
        label: '+ Criar primeiro setor',
        action: 'open-setor-modal',
        tone: 'primary',
        size: 'sm',
        autoWidth: true,
      },
    });
    return;
  }

  const setorCards = setores.map((s) => {
    const eqs = equipamentos.filter((e) => e.setorId === s.id);
    return setorCardHtml(s, eqs);
  });

  // Grupo automático "Sem setor"
  const semSetor = equipamentos.filter((e) => !e.setorId);
  const semSetorCard = semSetor.length
    ? setorCardHtml({ id: '__sem_setor__', nome: 'Sem setor', cor: '#6b7280' }, semSetor)
    : '';

  el.innerHTML = `<div class="setor-grid">${setorCards.join('')}${semSetorCard}</div>`;
}

/** Renderiza a lista flat de equipamentos (FREE ou drill-down de um setor). */
function renderFlatList(filtro = '', options = {}, setorId = null) {
  const { equipamentos, registros } = getState();
  const q = filtro.toLowerCase();
  const preventivas7dIds =
    options.statusFilter === 'preventiva-7d'
      ? new Set(getPreventivaDueEquipmentIds(registros, 7))
      : null;

  let list = equipamentos.filter((e) => {
    // Filtra por setor se estiver em drill-down
    if (setorId === '__sem_setor__') {
      if (e.setorId) return false;
    } else if (setorId) {
      if (e.setorId !== setorId) return false;
    }
    const matchesStatus = !preventivas7dIds || preventivas7dIds.has(e.id);
    const matchesSearch =
      !q ||
      e.nome.toLowerCase().includes(q) ||
      e.local.toLowerCase().includes(q) ||
      (e.tag || '').toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const el = Utils.getEl('lista-equip');
  if (!el) return;

  const sortedList = [...list].sort((a, b) => {
    const apA = getActionPriorityScore(a, regsForEquip(a.id));
    const apB = getActionPriorityScore(b, regsForEquip(b.id));
    if (apB.actionPriorityScore !== apA.actionPriorityScore)
      return apB.actionPriorityScore - apA.actionPriorityScore;
    const pa = evaluateEquipmentPriority(a, regsForEquip(a.id));
    const pb = evaluateEquipmentPriority(b, regsForEquip(b.id));
    if (pb.priorityLevel !== pa.priorityLevel) return pb.priorityLevel - pa.priorityLevel;
    const ra = evaluateEquipmentRisk(a, regsForEquip(a.id)).score;
    const rb = evaluateEquipmentRisk(b, regsForEquip(b.id)).score;
    return rb - ra;
  });

  withSkeleton(
    el,
    { enabled: true, variant: 'equipment', count: Math.min(Math.max(list.length, 3), 5) },
    () => {
      el.innerHTML = sortedList.length
        ? sortedList.map((eq) => equipCardHtml(eq, { showLocal: !setorId })).join('')
        : emptyStateHtml({
            icon: '🔧',
            title: setorId ? 'Nenhum equipamento neste setor' : 'Nenhum equipamento encontrado',
            description: setorId
              ? 'Atribua equipamentos a este setor ao cadastrá-los.'
              : 'Tente outro termo ou cadastre um novo.',
            cta: {
              label: '+ Novo equipamento',
              action: 'open-modal',
              id: 'modal-add-eq',
              tone: 'primary',
              size: 'sm',
              autoWidth: true,
            },
          });
    },
  );
}

export async function renderEquip(filtro = '', options = {}) {
  // Detecta plano PRO
  let isPro = false;
  try {
    const { fetchMyProfileBilling } = await import('../../core/monetization.js');
    const { hasProAccess } = await import('../../core/subscriptionPlans.js');
    const { profile } = await fetchMyProfileBilling();
    isPro = hasProAccess(profile);
    populateSetorSelect(isPro);
  } catch {
    /* fallback FREE */
  }

  const searchBar = Utils.getEl('equip-search-bar');

  if (isPro && _activeSectorId === null) {
    // Vista PRO: grade de setores
    renderSetorGrid();
    return;
  }

  // Vista lista (FREE ou drill-down de setor)
  if (searchBar) searchBar.style.display = '';

  if (_activeSectorId) {
    // Drill-down: mostra equipamentos do setor
    const setor =
      _activeSectorId === '__sem_setor__' ? { nome: 'Sem setor' } : findSetor(_activeSectorId);
    const nome = setor?.nome ?? 'Setor';
    _setToolbar({
      title: Utils.truncate(nome, 28),
      extraBtn: `<button class="btn btn--outline btn--sm" data-action="back-to-setores">← Setores</button>`,
    });
  } else {
    // Vista FREE: toolbar padrão
    _setToolbar({ title: 'Parque de Equipamentos' });
  }

  renderFlatList(filtro, options, _activeSectorId);
}

// ─── Setor CRUD ───────────────────────────────────────────────────────────────

/** Inicializa o color picker do modal de setor. */
export function initSetorColorPicker() {
  const picker = Utils.getEl('setor-color-picker');
  const hiddenInput = Utils.getEl('setor-cor');
  if (!picker || !hiddenInput) return;

  picker.querySelectorAll('.setor-color-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      picker.querySelectorAll('.setor-color-btn').forEach((b) => {
        b.classList.remove('setor-color-btn--selected');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('setor-color-btn--selected');
      btn.setAttribute('aria-pressed', 'true');
      if (hiddenInput) hiddenInput.value = btn.dataset.cor;
    });
  });
}

export async function saveSetor() {
  const nome = (Utils.getVal('setor-nome') || '').trim();
  if (!nome) {
    Toast.warning('Digite um nome para o setor.');
    return false;
  }

  const cor = Utils.getEl('setor-cor')?.value || '#00bcd4';

  setState((prev) => ({
    ...prev,
    setores: [...(prev.setores || []), { id: Utils.uid(), nome, cor }],
  }));

  try {
    const { Modal: M } = await import('../../core/modal.js');
    M.close('modal-add-setor');
  } catch {
    /* ignora */
  }

  // Limpa form
  Utils.setVal('setor-nome', '');
  const picker = Utils.getEl('setor-color-picker');
  if (picker) {
    picker.querySelectorAll('.setor-color-btn').forEach((b, i) => {
      b.classList.toggle('setor-color-btn--selected', i === 0);
      b.setAttribute('aria-pressed', i === 0 ? 'true' : 'false');
    });
    const hi = Utils.getEl('setor-cor');
    if (hi) hi.value = '#00bcd4';
  }

  Toast.success(`Setor "${nome}" criado.`);
  renderEquip();
  return true;
}

export async function deleteSetor(id) {
  if (id === '__sem_setor__') return;

  // Remove setorId dos equipamentos que pertencem ao setor
  setState((prev) => ({
    ...prev,
    setores: (prev.setores || []).filter((s) => s.id !== id),
    equipamentos: prev.equipamentos.map((e) => (e.setorId === id ? { ...e, setorId: null } : e)),
  }));

  if (_activeSectorId === id) _activeSectorId = null;
  Toast.info('Setor removido. Os equipamentos foram movidos para "Sem setor".');
  renderEquip();
}

/**
 * Atribui (ou remove) um setor a um equipamento já cadastrado.
 * Chamado pelo select inline no modal de detalhes.
 */
export function assignEquipToSetor(equipId, setorId) {
  const eq = findEquip(equipId);
  if (!eq) return;
  setState((prev) => ({
    ...prev,
    equipamentos: prev.equipamentos.map((e) =>
      e.id === equipId ? { ...e, setorId: setorId || null } : e,
    ),
  }));
  const setor = setorId ? findSetor(setorId) : null;
  const label = setor ? `"${setor.nome}"` : '"Sem setor"';
  Toast.success(`${Utils.escapeHtml(eq.nome)} movido para ${label}.`);
  renderEquip(); // atualiza os cards de setor em background
}

export async function saveEquip() {
  const isGuest = isGuestMode();
  const { equipamentos } = getState();
  const planLimit = await checkPlanLimit('equipamentos', equipamentos.length);
  if (planLimit.blocked) {
    trackEvent('limit_reached', {
      resource: 'equipamentos',
      current: planLimit.current,
      limit: planLimit.limit,
      planCode: planLimit.planCode,
    });
    if (planLimit.isGuest) {
      // Usuário não logado — convite para criar conta
      GuestConversionModal.open({ reason: 'limit_equipamentos', source: 'save-equip' });
    } else if (planLimit.planCode === 'pro') {
      // Usuário Pro que atingiu o teto de 30 equipamentos
      GuestConversionModal.open({ reason: 'limit_pro_equipamentos', source: 'save-equip-pro' });
    } else {
      // Usuário Free logado — convite para fazer upgrade
      GuestConversionModal.open({ reason: 'limit_equipamentos', source: 'save-equip' });
    }
    return false;
  }
  const tipo = Utils.getVal('eq-tipo');
  const criticidade = Utils.getVal('eq-criticidade') || 'media';
  const prioridadeOperacional = Utils.getVal('eq-prioridade') || 'normal';
  const payloadValidation = validateEquipamentoPayload(
    {
      nome: Utils.getVal('eq-nome'),
      local: Utils.getVal('eq-local'),
      tag: Utils.getVal('eq-tag'),
      modelo: Utils.getVal('eq-modelo'),
    },
    { existingEquipamentos: equipamentos },
  );

  if (!payloadValidation.valid) {
    Toast.warning(payloadValidation.errors[0]);
    return false;
  }

  const periodicidadePreventivaDias = normalizePeriodicidadePreventivaDias(
    Utils.getVal('eq-periodicidade'),
    tipo,
    criticidade,
  );

  const setorId = Utils.getVal('eq-setor') || null;

  setState((prev) => ({
    ...prev,
    equipamentos: [
      ...prev.equipamentos,
      {
        id: Utils.uid(),
        nome: payloadValidation.value.nome,
        local: payloadValidation.value.local,
        status: 'ok',
        tag: payloadValidation.value.tag,
        tipo,
        modelo: payloadValidation.value.modelo,
        fluido: Utils.getVal('eq-fluido'),
        criticidade,
        prioridadeOperacional,
        periodicidadePreventivaDias,
        setorId,
      },
    ],
  }));
  try {
    const { Modal: M } = await import('../../core/modal.js');
    M.close('modal-add-eq');
  } catch (error) {
    handleError(error, {
      code: ErrorCodes.NETWORK_ERROR,
      message: 'Não foi possível fechar o modal de cadastro.',
      context: { action: 'equipamentos.saveEquip.closeModal' },
      severity: 'warning',
    });
  }

  Utils.clearVals('eq-nome', 'eq-tag', 'eq-local', 'eq-modelo', 'eq-periodicidade');
  Utils.setVal('eq-tipo', 'Split Hi-Wall');
  Utils.setVal('eq-fluido', 'R-410A');
  Utils.setVal('eq-criticidade', 'media');
  Utils.setVal('eq-prioridade', 'normal');
  Utils.setVal('eq-periodicidade', String(getSuggestedPreventiveDays('Split Hi-Wall', 'media')));
  const periodicidadeInput = Utils.getEl('eq-periodicidade');
  if (periodicidadeInput) periodicidadeInput.dataset.manual = '0';

  OnboardingBanner.remove();
  try {
    const { renderDashboard } = await import('./dashboard.js');
    renderDashboard();
  } catch (error) {
    handleError(error, {
      code: ErrorCodes.NETWORK_ERROR,
      message: 'Equipamento salvo, mas houve falha ao atualizar o painel.',
      context: { action: 'equipamentos.saveEquip.renderDashboard' },
      severity: 'warning',
    });
  }
  renderEquip();
  updateHeader();
  Toast.success('Equipamento cadastrado.');

  if (isGuest) {
    GuestConversionModal.open({ reason: 'save_attempt', source: 'save-equip' });
  }

  return true;
}

export async function viewEquip(id) {
  const eq = findEquip(id);
  if (!eq) return;
  const regs = regsForEquip(id).sort((a, b) => b.data.localeCompare(a.data));
  const health = evaluateEquipmentHealth(eq, regs);
  const score = health.score;
  const cls = getHealthClass(score);
  const safeId = Utils.escapeAttr(id);
  const context = health.context;
  const risk = evaluateEquipmentRisk(eq, regs);
  const prioridadeLabel = PRIORIDADE_LABEL[eq.criticidade] || PRIORIDADE_LABEL.media;
  const proximaPreventiva = context?.proximaPreventiva
    ? Utils.formatDate(context.proximaPreventiva)
    : 'Sem agenda';
  const healthSummary = health.reasons.length
    ? Utils.escapeHtml(health.reasons.slice(0, 2).join(' | '))
    : 'Historico dentro da rotina prevista';
  const statusCode = Utils.safeStatus(eq.status);
  const statusOperacional = STATUS_OPERACIONAL[statusCode] || CONDICAO_OBSERVADA.unknown;
  const condicaoObservada = CONDICAO_OBSERVADA[statusCode] || CONDICAO_OBSERVADA.unknown;
  const fatorOperacao =
    statusCode === 'ok'
      ? 'Sem restrições no momento'
      : statusCode === 'warn'
        ? 'Operação com restrições'
        : 'Fora de operação';
  const fatorPreventiva =
    context?.daysToNext == null
      ? 'Preventiva sem agenda'
      : context.daysToNext < 0
        ? `Preventiva vencida há ${Math.abs(context.daysToNext)} dia${Math.abs(context.daysToNext) > 1 ? 's' : ''}`
        : context.daysToNext === 0
          ? 'Preventiva vence hoje'
          : `Preventiva em ${context.daysToNext} dia${context.daysToNext > 1 ? 's' : ''}`;
  const _fatorCriticidade = `Criticidade operacional ${prioridadeLabel.toLowerCase()}`;

  // SVG ring progress
  const ringR = 30;
  const ringC = +(2 * Math.PI * ringR).toFixed(1);
  const ringOffset = +(ringC * (1 - score / 100)).toFixed(1);

  // Cor do fator preventiva
  const prevStatCls =
    context?.daysToNext == null
      ? ''
      : context.daysToNext < 0
        ? ' eq-hero-stat__val--danger'
        : context.daysToNext <= 7
          ? ' eq-hero-stat__val--warn'
          : '';
  const opStatCls = statusCode !== 'ok' ? ` eq-hero-stat__val--${statusCode}` : '';

  // Setor select (inline na ficha técnica)
  const setorSelectHtml = (() => {
    const { setores: _setores } = getState();
    if (!_setores.length) return '';
    const opts = _setores
      .map(
        (s) =>
          `<option value="${Utils.escapeAttr(s.id)}"${eq.setorId === s.id ? ' selected' : ''}>${Utils.escapeHtml(s.nome)}</option>`,
      )
      .join('');
    return `<div class="info-row info-row--setor">
      <span class="info-row__label">Setor</span>
      <span class="info-row__value">
        <select class="info-row__setor-select" id="eq-det-setor-${safeId}" data-eq-id="${safeId}">
          <option value=""${!eq.setorId ? ' selected' : ''}>Sem setor</option>
          ${opts}
        </select>
      </span>
    </div>`;
  })();

  // Timeline de serviços
  const svcTimeline =
    regs.length === 0
      ? `<div class="eq-svc-empty">Nenhum serviço registrado ainda.</div>`
      : `<div class="eq-svc-timeline">
        ${regs
          .slice(0, 5)
          .map(
            (r) => `
          <div class="eq-svc-item">
            <div class="eq-svc-item__dot"></div>
            <div class="eq-svc-item__content">
              <span class="eq-svc-item__tipo">${Utils.escapeHtml(r.tipo)}</span>
              <span class="eq-svc-item__data">${Utils.formatDatetime(r.data)}</span>
            </div>
          </div>`,
          )
          .join('')}
        ${regs.length > 5 ? `<div class="eq-svc-more">+${regs.length - 5} serviços anteriores</div>` : ''}
      </div>`;

  Utils.getEl('eq-det-corpo').innerHTML = `
    <div class="eq-detail-view">

      <div class="modal__title" id="eq-det-title">${Utils.escapeHtml(eq.nome)}</div>

      <!-- ── Hero: score + status + mini-stats ── -->
      <div class="eq-detail-hero eq-detail-hero--${cls}">
        <div class="eq-hero-score">
          <div class="eq-score-ring-wrap">
            <svg class="eq-score-ring" viewBox="0 0 72 72" aria-hidden="true">
              <circle class="eq-score-ring__track" cx="36" cy="36" r="${ringR}"/>
              <circle class="eq-score-ring__fill eq-score-ring__fill--${cls}" cx="36" cy="36" r="${ringR}"
                stroke-dasharray="${ringC}" stroke-dashoffset="${ringOffset}"/>
            </svg>
            <div class="eq-score-ring__num eq-score-ring__num--${cls}" aria-label="Score ${score}%">${score}%</div>
          </div>
          <div class="eq-hero-score__info">
            <div class="eq-hero-score__label">SCORE OPERACIONAL</div>
            <div class="eq-hero-score__status eq-hero-score__status--${cls}">
              ${cls === 'ok' ? CONDICAO_OBSERVADA.ok : cls === 'warn' ? CONDICAO_OBSERVADA.warn : CONDICAO_OBSERVADA.danger}
            </div>
            <div class="eq-hero-score__summary">${healthSummary}</div>
          </div>
        </div>
        <div class="eq-hero-stats">
          <div class="eq-hero-stat">
            <span class="eq-hero-stat__lbl">Operação</span>
            <span class="eq-hero-stat__val${opStatCls}">${Utils.escapeHtml(fatorOperacao)}</span>
          </div>
          <div class="eq-hero-stat">
            <span class="eq-hero-stat__lbl">Preventiva</span>
            <span class="eq-hero-stat__val${prevStatCls}">${Utils.escapeHtml(fatorPreventiva)}</span>
          </div>
          <div class="eq-hero-stat">
            <span class="eq-hero-stat__lbl">Prioridade</span>
            <span class="eq-hero-stat__val">${Utils.escapeHtml(prioridadeLabel)}</span>
          </div>
        </div>
      </div>

      <!-- ── Painel de risco ── -->
      <div class="eq-risk-panel eq-risk-panel--${risk.classification}">
        <div class="eq-risk-panel__header">
          <div>
            <div class="eq-risk-panel__label">PRIORIDADE DE ATENÇÃO</div>
            <div class="eq-risk-panel__class">${Utils.escapeHtml(risk.classificationLabel)} · Score ${risk.score}</div>
          </div>
          <span class="eq-risk-panel__badge eq-risk-panel__badge--${risk.classification}">${Utils.escapeHtml(risk.classificationLabel)}</span>
        </div>
        <div class="eq-risk-panel__summary">${Utils.escapeHtml(risk.explanation)}</div>
        <div class="eq-risk-panel__factors">
          ${(risk.factors.length ? risk.factors : ['rotina estável'])
            .map((f) => `<span class="eq-risk-panel__factor">${Utils.escapeHtml(f)}</span>`)
            .join('')}
        </div>
        <details class="eq-risk-panel__analysis">
          <summary>Ver análise detalhada</summary>
          <ul class="eq-risk-panel__analysis-list">
            ${risk.details
              .map(
                (d) =>
                  `<li><strong>${Utils.escapeHtml(d.label)}</strong>: ${Utils.escapeHtml(d.detail)}</li>`,
              )
              .join('')}
          </ul>
          <p class="eq-risk-panel__note">Este score orienta a priorização e não substitui a decisão técnica em campo.</p>
        </details>
      </div>

      <!-- ── Ficha técnica ── -->
      <div class="eq-tech-sheet">
        <div class="eq-tech-sheet__section">
          <div class="eq-tech-sheet__title">Identificação</div>
          <div class="info-list info-list--spaced info-list--soft">
            <div class="info-row"><span class="info-row__label">TAG</span><span class="info-row__value info-row__value--mono">${Utils.escapeHtml(eq.tag || '—')}</span></div>
            <div class="info-row"><span class="info-row__label">Tipo</span><span class="info-row__value">${Utils.escapeHtml(eq.tipo)}</span></div>
            <div class="info-row"><span class="info-row__label">Fluido</span><span class="info-row__value">${Utils.escapeHtml(eq.fluido || '—')}</span></div>
            <div class="info-row"><span class="info-row__label">Modelo</span><span class="info-row__value">${Utils.escapeHtml(eq.modelo || '—')}</span></div>
            <div class="info-row"><span class="info-row__label">Local</span><span class="info-row__value">${Utils.escapeHtml(eq.local)}</span></div>
            ${setorSelectHtml}
          </div>
        </div>
        <div class="eq-tech-sheet__section">
          <div class="eq-tech-sheet__title">Operação</div>
          <div class="info-list info-list--spaced info-list--soft">
            <div class="info-row"><span class="info-row__label">Estado operacional</span><span class="info-row__value">${Utils.escapeHtml(statusOperacional)}</span></div>
            <div class="info-row"><span class="info-row__label">Condição observada</span><span class="info-row__value">${Utils.escapeHtml(condicaoObservada)}</span></div>
            <div class="info-row"><span class="info-row__label">Prioridade</span><span class="info-row__value">${Utils.escapeHtml(prioridadeLabel)}</span></div>
            <div class="info-row"><span class="info-row__label">Rotina preventiva</span><span class="info-row__value">${Utils.escapeHtml(`${context?.periodicidadeDias || eq.periodicidadePreventivaDias} dias`)}</span></div>
            <div class="info-row"><span class="info-row__label">Próxima preventiva</span><span class="info-row__value">${Utils.escapeHtml(proximaPreventiva)}</span></div>
          </div>
        </div>
      </div>

      <!-- ── Histórico de serviços ── -->
      <div class="eq-svc-section">
        <div class="eq-svc-section__header">
          <span class="eq-svc-section__title">Histórico de serviços</span>
          <button class="btn btn--primary btn--sm" data-action="go-register-equip" data-id="${safeId}">
            + Registrar serviço
          </button>
        </div>
        ${svcTimeline}
      </div>

      <!-- ── Footer ── -->
      <div class="eq-modal-footer">
        <button class="eq-delete-link" data-action="delete-equip" data-id="${safeId}">
          <svg class="eq-delete-link__icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
          </svg>
          Excluir equipamento
        </button>
      </div>

    </div>`;

  // Listener para troca de setor inline
  const setorSel = document.getElementById(`eq-det-setor-${safeId}`);
  if (setorSel) {
    setorSel.addEventListener('change', (e) => {
      assignEquipToSetor(id, e.target.value || null);
    });
  }

  try {
    const { Modal: M } = await import('../../core/modal.js');
    M.open('modal-eq-det');
  } catch (error) {
    handleError(error, {
      code: ErrorCodes.NETWORK_ERROR,
      message: 'Não foi possível abrir os detalhes do equipamento.',
      context: { action: 'equipamentos.viewEquip.openModal', id },
    });
  }
}

export async function deleteEquip(id) {
  const { registros } = getState();
  const linkedRegistros = registros.filter((r) => r.equipId === id).map((r) => r.id);
  Storage.markEquipDeleted(id, linkedRegistros);

  setState((prev) => ({
    ...prev,
    equipamentos: prev.equipamentos.filter((e) => e.id !== id),
    registros: prev.registros.filter((r) => r.equipId !== id),
  }));
  try {
    const { Modal: M } = await import('../../core/modal.js');
    M.close('modal-eq-det');
  } catch (error) {
    handleError(error, {
      code: ErrorCodes.NETWORK_ERROR,
      message: 'Equipamento removido, mas não foi possível fechar o modal.',
      context: { action: 'equipamentos.deleteEquip.closeModal', id },
      severity: 'warning',
    });
  }
  renderEquip();
  updateHeader();
  Toast.info('Equipamento removido.');
}

export function populateEquipSelects() {
  const { equipamentos, tecnicos } = getState();
  const selectConfigs = [
    { id: 'r-equip', placeholder: 'Selecione o equipamento...' },
    { id: 'hist-equip', placeholder: 'Todos os equipamentos' },
    { id: 'rel-equip', placeholder: 'Todos' },
  ];

  selectConfigs.forEach(({ id, placeholder }) => {
    const el = Utils.getEl(id);
    if (!el) return;

    el.textContent = '';
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = placeholder;
    el.appendChild(defaultOption);

    equipamentos.forEach((equipamento) => {
      const option = document.createElement('option');
      option.value = String(equipamento.id || '');
      option.textContent = `${equipamento.nome || '—'} — ${equipamento.local || '—'}`;
      el.appendChild(option);
    });
  });

  co