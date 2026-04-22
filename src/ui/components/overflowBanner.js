/**
 * OverflowBanner — aviso fino de limite ultrapassado + modal one-shot.
 *
 * Motivação: o dashboard antigo mostrava um usage-meter (com barras e badge
 * "LIMITE ULTRAPASSADO") e logo abaixo o card de upgrade ("Fazer upgrade para
 * o CoolTrack Plus"). Para o usuário Free, isso era 2 blocos grandes
 * competindo por atenção logo no topo, com a mesma mensagem dita duas vezes.
 *
 * A troca: uma linha fina no topo indicando especificamente qual limite foi
 * ultrapassado + um modal one-shot que aparece UMA ÚNICA VEZ por flag no
 * localStorage quando o usuário cruza o limite pela primeira vez. Depois
 * disso, só o banner fino fica, e o usuário continua trabalhando.
 *
 * UX:
 *   - Banner é permanente enquanto o usuário estiver acima do limite (não é
 *     dismissível — ao contrário de um popup diário, que o usuário aprende a
 *     fechar no reflexo). Deixa de aparecer quando o uso volta ao limite ou o
 *     usuário faz upgrade.
 *   - Modal aparece só 1x por limite atingido (flag por tipo — equipamentos,
 *     registros ou ambos). Se o usuário volta ao Free após cancelamento ou
 *     reduz o uso, a flag é preservada — não queremos assediar.
 *
 * API:
 *   OverflowBanner.computeState({ equipamentos, registros })  → { overLimit, ... }
 *   OverflowBanner.render({ state })                          → HTML string
 *   OverflowBanner.maybeShowFirstTimeModal({ state })         → mostra modal se 1ª vez
 */

import { Utils } from '../../core/utils.js';
import { attachDialogA11y } from '../../core/modal.js';
import { trackEvent } from '../../core/telemetry.js';
import { PLAN_CATALOG, PLAN_CODE_FREE } from '../../core/plans/subscriptionPlans.js';

const FREE_EQUIP_LIMIT = PLAN_CATALOG[PLAN_CODE_FREE].limits.equipamentos;
const FREE_REPORT_LIMIT = PLAN_CATALOG[PLAN_CODE_FREE].limits.registros;
const HAS_FREE_REPORT_LIMIT = Number.isFinite(FREE_REPORT_LIMIT) && FREE_REPORT_LIMIT > 0;

// Chave do localStorage que marca que o modal one-shot já foi exibido.
// Mantemos granularidade por tipo de limite para que o usuário que bate no
// limite de equipamentos e depois no de registros veja o contexto específico
// da segunda vez. Depois disso, nunca mais.
const STORAGE_KEY = 'cooltrack:overflow-onboarded';

// Handle de cleanup do focus trap do modal ativo (se houver).
let _modalA11yCleanup = null;
const MODAL_ID = 'dash-overflow-modal';

function countRegistrosThisMonth(registros = []) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return registros.filter((registro) => {
    const date = new Date(registro?.data);
    return !Number.isNaN(date.getTime()) && date >= start && date < end;
  }).length;
}

function readOnboardedSet() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((item) => typeof item === 'string'));
  } catch {
    return new Set();
  }
}

function persistOnboardedSet(set) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // localStorage pode estar cheio ou bloqueado — o pior cenário é o modal
    // reaparecer numa próxima sessão, não vale quebrar o dashboard por isso.
  }
}

function removeModal() {
  if (_modalA11yCleanup) {
    _modalA11yCleanup();
    _modalA11yCleanup = null;
  }
  document.getElementById(MODAL_ID)?.remove();
}

function closeModal({ action = 'dismiss' } = {}) {
  removeModal();
  trackEvent('overflow_modal_closed', { action });
}

export const OverflowBanner = {
  /**
   * Calcula o estado de overflow para o usuário Free atual.
   * Tratar sempre como Free nesse componente — os chamadores garantem que o
   * banner só é invocado quando planCode é Free (Plus já tem registros
   * ilimitados e 15 equipamentos; Pro não tem limites relevantes aqui).
   */
  computeState({ equipamentos = [], registros = [] } = {}) {
    const equipCount = Array.isArray(equipamentos) ? equipamentos.length : 0;
    const reportCount = countRegistrosThisMonth(Array.isArray(registros) ? registros : []);

    const equipOver = equipCount > FREE_EQUIP_LIMIT;
    const reportOver = HAS_FREE_REPORT_LIMIT && reportCount > FREE_REPORT_LIMIT;

    // Tipo dominante pra copy do banner. Se os dois estiverem acima, damos
    // preferência a equipamentos (limite estrutural, não mensal) porque
    // bloqueia mais ações no produto.
    let limitType = null;
    if (equipOver && reportOver) limitType = 'both';
    else if (equipOver) limitType = 'equipamentos';
    else if (reportOver) limitType = 'registros';

    return {
      overLimit: Boolean(limitType),
      limitType,
      equipCount,
      reportCount,
      equipLimit: FREE_EQUIP_LIMIT,
      reportLimit: FREE_REPORT_LIMIT,
      equipOver,
      reportOver,
    };
  },

  /**
   * Gera o HTML do banner fino. Só chame se state.overLimit === true.
   */
  render({ state } = {}) {
    if (!state?.overLimit) return '';

    const copy = buildBannerCopy(state);
    const safeCopy = Utils.escapeHtml(copy);

    return `
      <aside class="dash-overflow-banner" role="status" aria-live="polite" data-limit-type="${state.limitType}">
        <style>
          .dash-overflow-banner {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 10px 14px;
            margin: 10px 0 14px;
            background: color-mix(in srgb, var(--danger) 8%, var(--surface));
            border: 1px solid color-mix(in srgb, var(--danger) 28%, transparent);
            border-left: 3px solid var(--danger);
            border-radius: 10px;
            font-size: 13px;
            color: var(--text);
          }

          .dash-overflow-banner__icon {
            flex: 0 0 auto;
            width: 18px;
            height: 18px;
            color: var(--danger);
          }

          .dash-overflow-banner__text {
            flex: 1 1 auto;
            line-height: 1.4;
          }

          .dash-overflow-banner__text strong {
            color: var(--text);
            font-weight: 700;
          }

          .dash-overflow-banner__cta {
            flex: 0 0 auto;
            border: 1px solid color-mix(in srgb, var(--danger) 45%, transparent);
            background: transparent;
            color: var(--danger);
            font-weight: 700;
            font-size: 12px;
            padding: 6px 12px;
            border-radius: 8px;
            cursor: pointer;
            white-space: nowrap;
          }

          .dash-overflow-banner__cta:hover,
          .dash-overflow-banner__cta:focus-visible {
            background: color-mix(in srgb, var(--danger) 10%, transparent);
          }

          @media (max-width: 640px) {
            .dash-overflow-banner {
              flex-wrap: wrap;
              gap: 8px;
            }

            .dash-overflow-banner__text {
              flex-basis: 100%;
              order: 2;
            }

            .dash-overflow-banner__cta {
              order: 3;
              margin-left: auto;
            }
          }
        </style>

        <svg class="dash-overflow-banner__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 3L2 20h20L12 3z" />
          <path d="M12 10v4M12 17.5v.01" />
        </svg>
        <span class="dash-overflow-banner__text">${safeCopy}</span>
        <button
          type="button"
          class="dash-overflow-banner__cta"
          data-action="open-upgrade"
          data-upgrade-source="overflow_banner"
          data-highlight-plan="plus"
        >Ver planos &rarr;</button>
      </aside>
    `;
  },

  /**
   * Exibe o modal one-shot se o usuário ainda não viu esse tipo de overflow.
   * Marca a flag no localStorage imediatamente ao exibir (mesmo antes do
   * usuário fechar) pra evitar que um reload rápido mostre de novo.
   */
  maybeShowFirstTimeModal({ state } = {}) {
    if (!state?.overLimit) return;
    const seen = readOnboardedSet();
    // Quando o limite é "both", consideramos satisfeito se o usuário já viu
    // qualquer um dos dois tipos isolados — evita spam pro usuário que
    // primeiro bate equipamentos e depois bate também registros.
    const alreadySeen =
      seen.has(state.limitType) ||
      (state.limitType === 'both' && (seen.has('equipamentos') || seen.has('registros')));
    if (alreadySeen) return;

    seen.add(state.limitType);
    persistOnboardedSet(seen);
    openModal(state);
  },

  // Exposto para testes.
  _internals: {
    STORAGE_KEY,
    readOnboardedSet,
    persistOnboardedSet,
    countRegistrosThisMonth,
    buildBannerCopy,
  },
};

function buildBannerCopy(state) {
  if (state.limitType === 'equipamentos') {
    return `Você cadastrou ${state.equipCount} equipamentos — o plano grátis permite ${state.equipLimit}.`;
  }
  if (state.limitType === 'registros') {
    return `Você registrou ${state.reportCount} serviços este mês — o plano grátis permite ${state.reportLimit}.`;
  }
  // both
  return `Você ultrapassou os limites do plano grátis (equipamentos e registros).`;
}

function buildModalCopy(state) {
  if (state.limitType === 'equipamentos') {
    return {
      title: 'Seu parque passou dos 3 equipamentos',
      description:
        'O plano grátis permite 3 equipamentos cadastrados. Você continua vendo os atuais, mas para cadastrar novos o Plus destrava até 15 equipamentos.',
      ctaLabel: 'Ver o plano Plus',
      highlightPlan: 'plus',
    };
  }
  if (state.limitType === 'registros') {
    return {
      title: 'Você chegou ao limite de registros do plano grátis',
      description:
        'Seu plano grátis atual já permite registros ilimitados. Se esta mensagem aparecer, atualize o app para sincronizar as novas regras de plano.',
      ctaLabel: 'Ver o plano Plus',
      highlightPlan: 'plus',
    };
  }
  return {
    title: 'Você ultrapassou os limites do plano grátis',
    description:
      'Você ultrapassou os limites do plano grátis. O Plus cobre até 15 equipamentos e o Pro cobre frota grande com equipamentos ilimitados.',
    ctaLabel: 'Ver planos',
    highlightPlan: 'plus',
  };
}

function openModal(state) {
  removeModal();
  const copy = buildModalCopy(state);

  const overlay = document.createElement('div');
  overlay.id = MODAL_ID;
  overlay.className = 'overflow-modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'overflow-modal-title');

  overlay.innerHTML = `
    <style>
      .overflow-modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(4, 10, 22, 0.55);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9000;
        padding: 16px;
        animation: overflow-modal-fade-in 160ms ease-out;
      }

      .overflow-modal {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 14px;
        padding: 24px;
        max-width: 460px;
        width: 100%;
        display: grid;
        gap: 14px;
        box-shadow: 0 18px 40px rgba(0, 0, 0, 0.35);
        animation: overflow-modal-rise 180ms cubic-bezier(0.22, 1, 0.36, 1);
      }

      .overflow-modal__header {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .overflow-modal__icon-wrap {
        flex: 0 0 auto;
        width: 36px;
        height: 36px;
        border-radius: 10px;
        background: color-mix(in srgb, var(--danger) 14%, transparent);
        color: var(--danger);
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .overflow-modal__title {
        margin: 0;
        font-size: 17px;
        font-weight: 700;
        color: var(--text);
        line-height: 1.3;
      }

      .overflow-modal__desc {
        margin: 0;
        font-size: 14px;
        color: var(--text-2);
        line-height: 1.55;
      }

      .overflow-modal__actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        margin-top: 4px;
      }

      .overflow-modal__btn {
        border: none;
        border-radius: 10px;
        padding: 10px 16px;
        font-weight: 600;
        font-size: 14px;
        cursor: pointer;
      }

      .overflow-modal__btn--primary {
        background: linear-gradient(135deg, #3a8ee6, #2a6fb8);
        color: #fff;
      }

      .overflow-modal__btn--primary:hover,
      .overflow-modal__btn--primary:focus-visible {
        filter: brightness(1.05);
      }

      .overflow-modal__btn--ghost {
        background: transparent;
        color: var(--text-2);
        border: 1px solid var(--border);
      }

      .overflow-modal__btn--ghost:hover,
      .overflow-modal__btn--ghost:focus-visible {
        background: color-mix(in srgb, var(--text-3) 8%, transparent);
      }

      @keyframes overflow-modal-fade-in {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      @keyframes overflow-modal-rise {
        from {
          opacity: 0;
          transform: translateY(12px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .overflow-modal-overlay,
        .overflow-modal {
          animation: none;
        }
      }

      @media (max-width: 640px) {
        .overflow-modal__actions {
          flex-direction: column-reverse;
        }

        .overflow-modal__btn {
          width: 100%;
        }
      }
    </style>

    <div class="overflow-modal">
      <div class="overflow-modal__header">
        <div class="overflow-modal__icon-wrap" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 3L2 20h20L12 3z" />
            <path d="M12 10v4M12 17.5v.01" />
          </svg>
        </div>
        <h3 class="overflow-modal__title" id="overflow-modal-title">${Utils.escapeHtml(copy.title)}</h3>
      </div>
      <p class="overflow-modal__desc">${Utils.escapeHtml(copy.description)}</p>
      <div class="overflow-modal__actions">
        <button type="button" class="overflow-modal__btn overflow-modal__btn--ghost" data-action="dismiss">
          Continuar assim
        </button>
        <button
          type="button"
          class="overflow-modal__btn overflow-modal__btn--primary"
          data-action="open-upgrade"
          data-upgrade-source="overflow_modal"
          data-highlight-plan="${copy.highlightPlan}"
        >${Utils.escapeHtml(copy.ctaLabel)} &rarr;</button>
      </div>
    </div>
  `;

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) {
      closeModal({ action: 'overlay' });
    }
  });

  overlay.querySelector('[data-action="dismiss"]')?.addEventListener('click', () => {
    closeModal({ action: 'dismiss' });
  });

  // O clique no botão primário é tratado pelo handler global 'open-upgrade'
  // (via data-action). Aqui só garantimos que o modal fecha após o clique,
  // para o usuário não voltar e ver o modal por cima da página de pricing.
  overlay.querySelector('[data-action="open-upgrade"]')?.addEventListener('click', () => {
    // Fechamos antes do router navegar — evita flicker do overlay.
    closeModal({ action: 'upgrade_clicked' });
  });

  document.body.appendChild(overlay);
  _modalA11yCleanup = attachDialogA11y(overlay, {
    onDismiss: () => closeModal({ action: 'escape' }),
  });
  trackEvent('overflow_modal_shown', { limit_type: state.limitType });
}
