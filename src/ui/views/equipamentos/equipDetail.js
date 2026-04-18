/**
 * CoolTrack Pro - Equipamentos / equipDetail
 * Renderiza o modal de detalhe do equipamento (viewEquip).
 */

import { Utils } from '../../../core/utils.js';
import { getState, findEquip, regsForEquip } from '../../../core/state.js';
import { getHealthClass } from '../dashboard.js';
import { ErrorCodes, handleError } from '../../../core/errors.js';
import { evaluateEquipmentHealth, evaluateEquipmentRisk } from '../../../domain/maintenance.js';
import { STATUS_OPERACIONAL, CONDICAO_OBSERVADA, PRIORIDADE_LABEL } from './constants.js';

/**
 * Handler invocado quando o select inline de setor muda.
 * Injetado pelo orquestrador para evitar ciclos de import com equipamentos.js.
 * @type {(equipId: string, setorId: string | null) => void}
 */
let _onSetorChange = () => {};
export function setSetorChangeHandler(fn) {
  _onSetorChange = typeof fn === 'function' ? fn : () => {};
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
        <button class="eq-edit-link" data-action="edit-equip" data-id="${safeId}">
          ✏️ Editar identificação
        </button>
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
      _onSetorChange(id, e.target.value || null);
    });
  }

  try {
    const { Modal: M } = await import('../../../core/modal.js');
    M.open('modal-eq-det');
  } catch (error) {
    handleError(error, {
      code: ErrorCodes.NETWORK_ERROR,
      message: 'Não foi possível abrir os detalhes do equipamento.',
      context: { action: 'equipamentos.viewEquip.openModal', id },
    });
  }
}
