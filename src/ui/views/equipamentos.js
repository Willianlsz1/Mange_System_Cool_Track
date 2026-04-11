/**
 * CoolTrack Pro - Equipamentos View v5.0
 * Funções: renderEquip, saveEquip, viewEquip, deleteEquip, populateEquipSelects
 */

import { Utils, TIPO_ICON } from '../../core/utils.js';
import { getState, findEquip, setState, regsForEquip } from '../../core/state.js';
import { Storage } from '../../core/storage.js';
import { Toast } from '../../core/toast.js';
import { OnboardingBanner } from '../components/onboarding.js';
import { withSkeleton } from '../components/skeleton.js';
import { Profile } from '../../features/profile.js';
import { calcHealthScore, getHealthClass, updateHeader } from './dashboard.js';
import { ErrorCodes, handleError } from '../../core/errors.js';
import { checkGuestLimit, isGuestMode } from '../../core/guestLimits.js';
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

function _empty(icon, msg, sub = '', cta = '') {
  return `<div class="empty-state">
    <div class="empty-state__icon">${icon}</div>
    <div class="empty-state__title">${msg}</div>
    ${sub ? `<div class="empty-state__sub">${sub}</div>` : ''}
    ${cta ? `<div class="empty-state__cta">${cta}</div>` : ''}
  </div>`;
}

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

export function renderEquip(filtro = '', options = {}) {
  const { equipamentos, registros } = getState();
  const q = filtro.toLowerCase();
  const preventivas7dIds =
    options.statusFilter === 'preventiva-7d'
      ? new Set(getPreventivaDueEquipmentIds(registros, 7))
      : null;
  const list = equipamentos.filter((e) => {
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
    if (apB.actionPriorityScore !== apA.actionPriorityScore) {
      return apB.actionPriorityScore - apA.actionPriorityScore;
    }
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
        ? sortedList.map((eq) => equipCardHtml(eq)).join('')
        : _empty(
            '🔧',
            'Nenhum equipamento encontrado',
            'Tente outro termo ou cadastre um novo.',
            `<button class="btn btn--primary btn--sm btn--auto" data-action="open-modal" data-id="modal-add-eq">+ Novo equipamento</button>`,
          );
    },
  );
}

export async function saveEquip() {
  const isGuest = isGuestMode();
  const guestLimit = checkGuestLimit('equipamentos');
  if (guestLimit.blocked) {
    trackEvent('limit_reached', {
      resource: 'equipamentos',
      current: guestLimit.current,
      limit: 5,
    });
    GuestConversionModal.open({ reason: 'limit_equipamentos', source: 'save-equip' });
    return false;
  }
  const nome = Utils.getVal('eq-nome').trim();
  const local = Utils.getVal('eq-local').trim();
  if (!nome || !local) {
    Toast.warning('Preencha nome e localização.');
    return false;
  }

  const tipo = Utils.getVal('eq-tipo');
  const criticidade = Utils.getVal('eq-criticidade') || 'media';
  const prioridadeOperacional = Utils.getVal('eq-prioridade') || 'normal';
  const rawTag = Utils.getVal('eq-tag').trim();
  const normalizedTag = rawTag.toUpperCase();
  const periodicidadePreventivaDias = normalizePeriodicidadePreventivaDias(
    Utils.getVal('eq-periodicidade'),
    tipo,
    criticidade,
  );
  const { equipamentos } = getState();
  if (normalizedTag && equipamentos.some((e) => (e.tag || '').toUpperCase() === normalizedTag)) {
    Toast.error('Já existe equipamento com esta TAG.');
    return false;
  }

  setState((prev) => ({
    ...prev,
    equipamentos: [
      ...prev.equipamentos,
      {
        id: Utils.uid(),
        nome,
        local,
        status: 'ok',
        tag: normalizedTag,
        tipo,
        modelo: Utils.getVal('eq-modelo').trim(),
        fluido: Utils.getVal('eq-fluido'),
        criticidade,
        prioridadeOperacional,
        periodicidadePreventivaDias,
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
  const fatorCriticidade = `Criticidade operacional ${prioridadeLabel.toLowerCase()}`;

  Utils.getEl('eq-det-corpo').innerHTML = `
    <div class="eq-detail-view">
      <div class="modal__title" id="eq-det-title">${Utils.escapeHtml(eq.nome)}</div>
      <div class="eq-detail-hero">
        <div class="eq-modal-health">
          <div class="eq-modal-health__circle eq-modal-health__circle--${cls}">${score}%</div>
          <div class="eq-modal-health__text">
            <div class="eq-modal-health__label">SCORE OPERACIONAL</div>
            <div class="eq-modal-health__status">${cls === 'ok' ? CONDICAO_OBSERVADA.ok : cls === 'warn' ? CONDICAO_OBSERVADA.warn : CONDICAO_OBSERVADA.danger}</div>
          </div>
        </div>
        <div class="eq-detail-hero__badges">
          <span class="eq-detail-badge">${Utils.escapeHtml(statusOperacional)}</span>
          <span class="eq-detail-badge">${Utils.escapeHtml(condicaoObservada)}</span>
          <span class="eq-detail-badge">Prioridade ${Utils.escapeHtml(prioridadeLabel)}</span>
        </div>
        <div class="eq-modal-summary">${healthSummary}</div>
        <div class="eq-score-factors">
          <div class="eq-score-factors__item"><strong>Operação:</strong> ${Utils.escapeHtml(fatorOperacao)}</div>
          <div class="eq-score-factors__item"><strong>Preventiva:</strong> ${Utils.escapeHtml(fatorPreventiva)}</div>
          <div class="eq-score-factors__item"><strong>Criticidade:</strong> ${Utils.escapeHtml(fatorCriticidade)}</div>
        </div>
      </div>
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
            .map(
              (factor) => `<span class="eq-risk-panel__factor">${Utils.escapeHtml(factor)}</span>`,
            )
            .join('')}
        </div>
        <details class="eq-risk-panel__analysis">
          <summary>Ver análise</summary>
          <ul class="eq-risk-panel__analysis-list">
            ${risk.details
              .map(
                (detail) =>
                  `<li><strong>${Utils.escapeHtml(detail.label)}</strong>: ${Utils.escapeHtml(detail.detail)}</li>`,
              )
              .join('')}
          </ul>
          <p class="eq-risk-panel__note">Este score orienta a priorização e não substitui a decisão técnica em campo.</p>
        </details>
      </div>
      <div class="eq-tech-sheet">
        <div class="eq-tech-sheet__section">
          <div class="eq-tech-sheet__title">Identificação</div>
          <div class="info-list info-list--spaced info-list--soft">
            <div class="info-row"><span class="info-row__label">TAG</span><span class="info-row__value info-row__value--mono">${Utils.escapeHtml(eq.tag || '—')}</span></div>
            <div class="info-row"><span class="info-row__label">Tipo</span><span class="info-row__value">${Utils.escapeHtml(eq.tipo)}</span></div>
            <div class="info-row"><span class="info-row__label">Fluido</span><span class="info-row__value">${Utils.escapeHtml(eq.fluido || '—')}</span></div>
            <div class="info-row"><span class="info-row__label">Modelo</span><span class="info-row__value">${Utils.escapeHtml(eq.modelo || '—')}</span></div>
            <div class="info-row"><span class="info-row__label">Local</span><span class="info-row__value">${Utils.escapeHtml(eq.local)}</span></div>
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
      <div class="eq-detail-cta">
        <button class="btn btn--primary btn--full" data-action="go-register-equip" data-id="${safeId}">+ Registrar Serviço</button>
      </div>
      <div class="eq-modal-summary">${regs.length} serviço(s) registrado(s)</div>
      ${regs
        .slice(0, 3)
        .map(
          (r) =>
            `<div class="eq-modal-quick">${Utils.escapeHtml(r.tipo)} · ${Utils.formatDatetime(r.data)}</div>`,
        )
        .join('')}
      <div class="eq-modal-footer">
        <button class="eq-delete-link" data-action="delete-equip" data-id="${safeId}">
          <svg class="eq-delete-link__icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
          Excluir equipamento
        </button>
      </div>
    </div>`;

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
  const opts = equipamentos
    .map(
      (e) =>
        `<option value="${Utils.escapeAttr(e.id)}">${Utils.escapeHtml(e.nome)} — ${Utils.escapeHtml(e.local)}</option>`,
    )
    .join('');

  [
    {
      id: 'r-equip',
      prefix: '<option value="">Selecione o equipamento...</option>',
    },
    {
      id: 'hist-equip',
      prefix: '<option value="">Todos os equipamentos</option>',
    },
    { id: 'rel-equip', prefix: '<option value="">Todos</option>' },
  ].forEach(({ id, prefix }) => {
    const el = Utils.getEl(id);
    if (el) el.innerHTML = prefix + opts;
  });

  const tecDatalist = Utils.getEl('lista-tecnicos');
  if (tecDatalist) {
    tecDatalist.innerHTML = (tecnicos || [])
      .map((t) => `<option value="${Utils.escapeAttr(t)}">`)
      .join('');
  }

  const rTecnico = Utils.getEl('r-tecnico');
  if (rTecnico && !rTecnico.value) {
    const def = Profile.getDefaultTecnico();
    if (def) rTecnico.value = def;
  }
}
