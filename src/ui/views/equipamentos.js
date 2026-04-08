/**
 * CoolTrack Pro - Equipamentos View v5.0
 * Funções: renderEquip, saveEquip, viewEquip, deleteEquip, populateEquipSelects
 */

import { Utils, TIPO_ICON } from '../../core/utils.js';
import { getState, findEquip, setState, regsForEquip } from '../../core/state.js';
import { Storage } from '../../core/storage.js';
import { Toast } from '../../core/toast.js';
import { OnboardingBanner } from '../components/onboarding.js';
import { Profile } from '../../features/profile.js';
import { calcHealthScore, getHealthClass, updateHeader } from './dashboard.js';
import { ErrorCodes, handleError } from '../../core/errors.js';
import {
  CRITICIDADE_LABEL,
  PRIORIDADE_OPERACIONAL_LABEL,
  evaluateEquipmentHealth,
  getEquipmentMaintenanceContext,
  getSuggestedPreventiveDays,
  normalizePeriodicidadePreventivaDias,
} from '../../domain/maintenance.js';

const STATUS_TECH = { ok: 'OPERANDO', warn: 'ATENÇÃO', danger: 'FALHA' };

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
  const criticidadeLabel = CRITICIDADE_LABEL[eq.criticidade] || CRITICIDADE_LABEL.media;

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

  let ctaLabel = 'Registrar serviço →';
  if (scls === 'danger') ctaLabel = 'Registrar corretiva →';
  else if (context.proximaPreventiva && Utils.daysDiff(context.proximaPreventiva) <= 7)
    ctaLabel = 'Registrar preventiva →';
  else if (!last) ctaLabel = 'Primeiro registro →';

  return `<div class="equip-card equip-card--${scls}" data-action="view-equip" data-id="${safeId}" role="listitem" tabindex="0" aria-label="${Utils.escapeHtml(eq.nome)} — ${STATUS_TECH[scls]}">
    <div class="equip-card__header">
      <div class="equip-card__type-icon equip-card__type-icon--lg">${icon}</div>
      <div class="equip-card__meta">
        <div class="equip-card__name ${scls === 'danger' ? 'equip-card__name--danger' : ''}">${Utils.escapeHtml(eq.nome)}</div>
        <div class="equip-card__tag">${Utils.escapeHtml(eq.tag || '—')} · ${Utils.escapeHtml(eq.fluido || eq.tipo)} · Crit. ${Utils.escapeHtml(criticidadeLabel)}</div>
      </div>
      <span class="equip-card__status equip-card__status--${scls}"><span class="status-dot status-dot--${scls}"></span>${STATUS_TECH[scls]}</span>
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

export function renderEquip(filtro = '') {
  const { equipamentos } = getState();
  const q = filtro.toLowerCase();
  const list = equipamentos.filter(
    (e) =>
      !q ||
      e.nome.toLowerCase().includes(q) ||
      e.local.toLowerCase().includes(q) ||
      (e.tag || '').toLowerCase().includes(q),
  );
  const el = Utils.getEl('lista-equip');
  if (!el) return;
  el.innerHTML = list.length
    ? list.map((eq) => equipCardHtml(eq)).join('')
    : _empty(
        '🔧',
        'Nenhum equipamento encontrado',
        'Tente outro termo ou cadastre um novo.',
        `<button class="btn btn--primary btn--sm btn--auto" data-action="open-modal" data-id="modal-add-eq">+ Novo equipamento</button>`,
      );
}

export async function saveEquip() {
  if (localStorage.getItem('cooltrack-guest-mode') === '1') {
    Toast.info('Crie uma conta grátis para salvar equipamentos.');
    try {
      const { AuthScreen } = await import('../components/authscreen.js');
      AuthScreen.show();
    } catch (error) {
      handleError(error, {
        code: ErrorCodes.NETWORK_ERROR,
        message: 'Não foi possível abrir a tela de login agora.',
        context: { action: 'equipamentos.saveEquip.authscreen' },
      });
    }
    return;
  }
  const nome = Utils.getVal('eq-nome').trim();
  const local = Utils.getVal('eq-local').trim();
  if (!nome || !local) {
    Toast.warning('Preencha nome e localização.');
    return;
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
    return;
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

  OnboardingBanner.dismiss();
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
  const criticidadeLabel = CRITICIDADE_LABEL[eq.criticidade] || CRITICIDADE_LABEL.media;
  const prioridadeLabel =
    PRIORIDADE_OPERACIONAL_LABEL[eq.prioridadeOperacional] || PRIORIDADE_OPERACIONAL_LABEL.normal;
  const proximaPreventiva = context?.proximaPreventiva
    ? Utils.formatDate(context.proximaPreventiva)
    : 'Sem agenda';
  const healthSummary = health.reasons.length
    ? Utils.escapeHtml(health.reasons.slice(0, 2).join(' | '))
    : 'Historico dentro da rotina prevista';

  Utils.getEl('eq-det-corpo').innerHTML = `
    <div class="modal__title" id="eq-det-title">${Utils.escapeHtml(eq.nome)}</div>
    <div class="eq-modal-health">
      <div class="eq-modal-health__circle eq-modal-health__circle--${cls}">${score}%</div>
      <div class="eq-modal-health__text">
        <div class="eq-modal-health__label">EFICIÊNCIA DO EQUIPAMENTO</div>
        <div class="eq-modal-health__status">${cls === 'ok' ? 'Operando bem' : cls === 'warn' ? 'Atenção requerida' : 'Falha detectada'}</div>
      </div>
    </div>
    <div class="eq-modal-summary">${healthSummary}</div>
    <div class="info-list info-list--spaced">
      <div class="info-row"><span class="info-row__label">TAG</span><span class="info-row__value info-row__value--mono">${Utils.escapeHtml(eq.tag || '—')}</span></div>
      <div class="info-row"><span class="info-row__label">Tipo</span><span class="info-row__value">${Utils.escapeHtml(eq.tipo)}</span></div>
      <div class="info-row"><span class="info-row__label">Fluido</span><span class="info-row__value">${Utils.escapeHtml(eq.fluido || '—')}</span></div>
      <div class="info-row"><span class="info-row__label">Modelo</span><span class="info-row__value">${Utils.escapeHtml(eq.modelo || '—')}</span></div>
      <div class="info-row"><span class="info-row__label">Local</span><span class="info-row__value">${Utils.escapeHtml(eq.local)}</span></div>
      <div class="info-row"><span class="info-row__label">Criticidade</span><span class="info-row__value">${Utils.escapeHtml(criticidadeLabel)}</span></div>
      <div class="info-row"><span class="info-row__label">Prioridade operacional</span><span class="info-row__value">${Utils.escapeHtml(prioridadeLabel)}</span></div>
      <div class="info-row"><span class="info-row__label">Rotina preventiva</span><span class="info-row__value">${context?.periodicidadeDias || eq.periodicidadePreventivaDias} dias</span></div>
      <div class="info-row"><span class="info-row__label">Próxima preventiva</span><span class="info-row__value">${Utils.escapeHtml(proximaPreventiva)}</span></div>
    </div>
    <button class="btn btn--primary btn--spaced-bottom" data-action="go-register-equip" data-id="${safeId}">+ Registrar Serviço</button>
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
