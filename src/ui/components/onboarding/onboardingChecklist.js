/**
 * OnboardingChecklist — card de "Primeiros passos" no Painel.
 * ─────────────────────────────────────────────────────────────────
 * Ataca o gargalo "usuário cria conta e não cadastra nada" mostrando
 * um checklist persistente de 5 passos no topo do painel:
 *
 *   1) Cadastrar 1 cliente
 *   2) Cadastrar 1 equipamento
 *   3) Registrar 1 serviço
 *   4) Abrir um relatório
 *   5) Gerar/baixar 1 PDF
 *
 * Estratégia de detecção:
 *   - Os 3 primeiros são detectados AUTOMATICAMENTE via getState()
 *     quando o card é renderizado (length > 0 nas listas).
 *   - Os 2 últimos exigem hook explícito (relatorio aberto, pdf gerado)
 *     via OnboardingChecklist.markStep('relatorio'|'pdf').
 *
 * Persistência:
 *   - localStorage: `ct:<uid>:onboarding-checklist`
 *   - Estrutura: {
 *       cliente: bool, equipamento: bool, servico: bool,
 *       relatorio: bool, pdf: bool, dismissed: bool
 *     }
 *   - Quando o card chega a 5/5 ou usuário dispensa, NUNCA volta a aparecer.
 *
 * Telemetria:
 *   - Cada markStep() emite trackEvent('onboarding_step_completed', { step })
 *   - dismiss() emite trackEvent('onboarding_dismissed', { progress })
 *   - completePass() (5/5) emite trackEvent('onboarding_completed', {})
 */

import { getState } from '../../../core/state.js';
import { trackEvent } from '../../../core/telemetry.js';
import { isCachedPlanPro } from '../../../core/plans/planCache.js';

const STEPS = [
  {
    id: 'cliente',
    label: 'Cadastre seu primeiro cliente',
    sub: 'Pra associar a serviços e PDFs',
    nav: 'clientes',
    requiresPro: true,
  },
  {
    id: 'equipamento',
    label: 'Cadastre seu primeiro equipamento',
    sub: 'A foto da etiqueta preenche os dados',
    nav: 'equipamentos',
  },
  {
    id: 'servico',
    label: 'Registre seu primeiro serviço',
    sub: 'Foto, observação e assinatura do cliente',
    nav: 'registro',
  },
  {
    id: 'relatorio',
    label: 'Abra o relatório',
    sub: 'Veja o histórico organizado',
    nav: 'relatorio',
  },
  {
    id: 'pdf',
    label: 'Gere seu primeiro PDF',
    sub: 'Compartilhe com o cliente em segundos',
    nav: 'historico',
  },
];

/**
 * Filtra os STEPS visíveis pro plano atual. Steps com requiresPro: true
 * só aparecem pra usuários Pro (Clientes é uma feature exclusiva Pro hoje).
 */
function _visibleSteps() {
  const isPro = isCachedPlanPro();
  return STEPS.filter((s) => !s.requiresPro || isPro);
}

const KEY_PREFIX = 'ct:';
const KEY_SUFFIX = ':onboarding-checklist';

function _safeStorage() {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

function _resolveKey(userId) {
  const uid = String(userId || '').trim() || 'anon';
  return `${KEY_PREFIX}${uid}${KEY_SUFFIX}`;
}

function _emptyState() {
  return {
    cliente: false,
    equipamento: false,
    servico: false,
    relatorio: false,
    pdf: false,
    dismissed: false,
  };
}

function _readState(userId) {
  const ls = _safeStorage();
  if (!ls) return _emptyState();
  try {
    const raw = ls.getItem(_resolveKey(userId));
    if (!raw) return _emptyState();
    const parsed = JSON.parse(raw);
    return { ..._emptyState(), ...parsed };
  } catch {
    return _emptyState();
  }
}

function _writeState(userId, next) {
  const ls = _safeStorage();
  if (!ls) return;
  try {
    ls.setItem(_resolveKey(userId), JSON.stringify(next));
  } catch {
    // localStorage quota / disabled — silencioso
  }
}

/**
 * Lê do state global do app pra inferir progresso dos 3 primeiros passos
 * sem precisar plugar hooks em upsertCliente / saveEquip / saveRegistro.
 */
function _evalFromGlobalState(current) {
  const { clientes = [], equipamentos = [], registros = [] } = getState();
  return {
    ...current,
    cliente: current.cliente || clientes.length > 0,
    equipamento: current.equipamento || equipamentos.length > 0,
    servico: current.servico || registros.length > 0,
  };
}

function _countCompleted(s) {
  const visibleIds = _visibleSteps().map((step) => step.id);
  return visibleIds.filter((k) => s[k]).length;
}

function _isAllDone(s) {
  return _countCompleted(s) === _visibleSteps().length;
}

let _currentUserId = null;

function _renderHtml(state) {
  const visibleSteps = _visibleSteps();
  const completed = _countCompleted(state);
  const total = visibleSteps.length;
  const percent = total ? Math.round((completed / total) * 100) : 0;

  const itemsHtml = visibleSteps
    .map((step, idx) => {
      const isDone = state[step.id] === true;
      const order = idx + 1;
      const action = isDone ? '' : `data-nav="${step.nav}"`;
      return `
      <li class="onb-step ${isDone ? 'is-done' : ''}" ${action} role="${isDone ? 'presentation' : 'button'}" ${isDone ? '' : 'tabindex="0"'}>
        <span class="onb-step__check" aria-hidden="true">
          ${
            isDone
              ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`
              : `<span class="onb-step__num">${order}</span>`
          }
        </span>
        <span class="onb-step__body">
          <span class="onb-step__label">${step.label}</span>
          <span class="onb-step__sub">${step.sub}</span>
        </span>
        ${
          isDone
            ? ''
            : `<svg class="onb-step__chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 6 15 12 9 18"/></svg>`
        }
      </li>`;
    })
    .join('');

  return `
    <article class="onb-card" role="region" aria-label="Primeiros passos">
      <header class="onb-card__head">
        <div class="onb-card__head-text">
          <h3 class="onb-card__title">Primeiros passos</h3>
          <p class="onb-card__sub">${completed} de ${total} concluídos · ${percent}%</p>
        </div>
        <button type="button" class="onb-card__close" data-action="onboarding-dismiss"
          aria-label="Dispensar checklist">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </header>

      <div class="onb-card__progress" aria-hidden="true">
        <div class="onb-card__progress-fill" style="width: ${percent}%"></div>
      </div>

      <ol class="onb-card__steps" role="list">
        ${itemsHtml}
      </ol>
    </article>`;
}

export const OnboardingChecklist = {
  /**
   * Inicializa pro usuário atual (chamar 1x no bootstrap).
   */
  init(userId) {
    _currentUserId = userId || null;
  },

  /**
   * Renderiza o card no host fornecido. Auto-detecta os 3 primeiros passos
   * via getState() e oculta o card se 5/5 ou dispensado.
   *
   * @param {HTMLElement|string} host — elemento ou id
   * @returns {boolean} true se renderizou, false se ocultou (completo/dispensado)
   */
  render(host) {
    const el = typeof host === 'string' ? document.getElementById(host) : host;
    if (!el) return false;

    let state = _readState(_currentUserId);

    // Se já completou ou dispensou, NÃO renderiza nada — limpa o slot.
    if (state.dismissed || _isAllDone(state)) {
      const stale = el.querySelector('.onb-card');
      if (stale) stale.remove();
      return false;
    }

    // Auto-detecta progresso dos 3 primeiros via state global.
    const next = _evalFromGlobalState(state);
    const justCompletedAuto = ['cliente', 'equipamento', 'servico'].filter(
      (k) => !state[k] && next[k],
    );
    if (justCompletedAuto.length) {
      _writeState(_currentUserId, next);
      justCompletedAuto.forEach((step) =>
        trackEvent('onboarding_step_completed', { step, source: 'auto' }),
      );
      state = next;

      // Se a auto-detecção acabou de fechar 5/5 (improvável, mas possível),
      // dispara completed e limpa.
      if (_isAllDone(state)) {
        trackEvent('onboarding_completed', {});
        const stale = el.querySelector('.onb-card');
        if (stale) stale.remove();
        return false;
      }
    }

    // Substitui o card existente (idempotente em re-renders do dashboard).
    const stale = el.querySelector('.onb-card');
    if (stale) stale.remove();
    el.insertAdjacentHTML('beforeend', _renderHtml(state));
    return true;
  },

  /**
   * Marca um passo como concluído explicitamente (uso pra 'relatorio' e 'pdf'
   * que não saem do state global). Idempotente: marcar 2x não duplica
   * eventos de telemetria.
   */
  markStep(stepId) {
    if (!STEPS.some((s) => s.id === stepId)) return;
    const cur = _readState(_currentUserId);
    if (cur[stepId]) return; // já marcado, no-op

    const next = { ...cur, [stepId]: true };
    _writeState(_currentUserId, next);
    trackEvent('onboarding_step_completed', { step: stepId, source: 'explicit' });

    if (_isAllDone(next)) {
      trackEvent('onboarding_completed', {});
    }
  },

  /**
   * Dispensa permanentemente. Não volta a aparecer mesmo com sessões novas.
   */
  dismiss() {
    const cur = _readState(_currentUserId);
    const completed = _countCompleted(cur);
    const next = { ...cur, dismissed: true };
    _writeState(_currentUserId, next);
    trackEvent('onboarding_dismissed', { progress: completed, total: STEPS.length });
  },

  /**
   * Retorna estado atual (uso em testes ou componentes externos que queiram
   * exibir progresso em outro lugar — ex.: badge no header).
   */
  getProgress() {
    const s = _readState(_currentUserId);
    return {
      completed: _countCompleted(s),
      total: STEPS.length,
      dismissed: s.dismissed === true,
      done: _isAllDone(s),
      steps: STEPS.map((step) => ({ ...step, completed: s[step.id] === true })),
    };
  },
};
