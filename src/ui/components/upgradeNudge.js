import { Utils } from '../../core/utils.js';
import { PLAN_CODE_FREE, PLAN_CODE_PLUS, PLAN_CODE_PRO } from '../../core/subscriptionPlans.js';

/**
 * Upgrade Nudge — card de upsell mostrado no dashboard.
 * Conteúdo muda conforme o plano atual:
 *  - Free  → destaca o Plus (próximo passo natural) + menção leve ao Pro
 *  - Plus  → destaca o Pro (features de escala: setores, suporte, ilimitado)
 *  - Pro   → não renderiza (o dashboard mostra _renderProStatusCard)
 */

// ── Config por plano de destino ────────────────────────────────────────────
const NUDGE_CONFIGS = {
  fromFree: {
    targetPlan: PLAN_CODE_PLUS,
    badge: 'POPULAR',
    icon: '⚡',
    title: 'Turbine com o CoolTrack Plus',
    bullets: [
      'Até 25 equipamentos cadastrados',
      'Registros e histórico ilimitados',
      'PDFs sem marca d\u2019água + assinatura do cliente',
      '50 envios de WhatsApp/mês',
    ],
    footer:
      'Tem frota maior? Conheça também o <strong>Pro</strong> — equipamentos ilimitados, tudo sem limite e setores.',
    ctaLabel: 'Ver planos',
    highlightPlan: 'plus',
  },
  fromPlus: {
    targetPlan: PLAN_CODE_PRO,
    badge: 'ESCALA',
    icon: '🚀',
    title: 'Quer escalar? Conheça o Pro',
    bullets: [
      'Equipamentos ilimitados',
      'PDF e WhatsApp ilimitados',
      'Agrupamento por setores',
      'Suporte prioritário',
    ],
    footer: null,
    ctaLabel: 'Fazer upgrade para Pro',
    highlightPlan: 'pro',
  },
};

function pickConfig(planCode) {
  if (planCode === PLAN_CODE_PLUS) return NUDGE_CONFIGS.fromPlus;
  // Free, guest, ou qualquer outro estado → sempre destaca Plus
  return NUDGE_CONFIGS.fromFree;
}

// ── Cores por plano de destino ─────────────────────────────────────────────
const PLAN_COLORS = {
  plus: {
    border: 'rgba(58, 142, 230, 0.25)',
    bgFrom: 'rgba(58, 142, 230, 0.08)',
    bgTo: 'rgba(58, 142, 230, 0.03)',
    accent: '#3a8ee6',
    ctaFrom: '#3a8ee6',
    ctaTo: '#2a6fb8',
    ctaText: '#ffffff',
  },
  pro: {
    border: 'rgba(0, 200, 112, 0.25)',
    bgFrom: 'rgba(0, 200, 112, 0.08)',
    bgTo: 'rgba(0, 200, 112, 0.03)',
    accent: '#00c870',
    ctaFrom: '#00c870',
    ctaTo: '#00a85c',
    ctaText: '#07111f',
  },
};

export const UpgradeNudge = {
  /**
   * @param {Object} [params]
   * @param {'free'|'plus'|'pro'} [params.planCode] plano atual do usuário
   */
  renderDashboardCard(params = {}) {
    const planCode = params.planCode ?? PLAN_CODE_FREE;
    if (planCode === PLAN_CODE_PRO) return ''; // segurança extra — dashboard já filtra

    const cfg = pickConfig(planCode);
    const colors = PLAN_COLORS[cfg.highlightPlan];

    return `
      <article class="upgrade-nudge-card upgrade-nudge-card--${cfg.highlightPlan}" aria-label="Upgrade para plano ${cfg.highlightPlan}">
        <style>
          .upgrade-nudge-card {
            position: relative;
            background: linear-gradient(135deg, ${colors.bgFrom}, ${colors.bgTo});
            border: 1px solid ${colors.border};
            border-radius: 14px;
            padding: 24px;
            display: grid;
            gap: 14px;
          }

          .upgrade-nudge-card__badge {
            position: absolute;
            top: 12px;
            right: 12px;
            font-size: 10px;
            color: ${colors.accent};
            background: ${colors.bgFrom};
            border: 1px solid ${colors.border};
            border-radius: 999px;
            padding: 4px 10px;
            letter-spacing: 0.08em;
            font-weight: 700;
          }

          .upgrade-nudge-card__title {
            margin: 0;
            color: #e8f2fa;
            font-size: 18px;
            line-height: 1.35;
            max-width: 34ch;
          }

          .upgrade-nudge-card__icon {
            font-size: 24px;
          }

          .upgrade-nudge-card__list {
            margin: 0;
            padding: 0;
            list-style: none;
            display: grid;
            gap: 8px;
          }

          .upgrade-nudge-card__item {
            font-size: 13px;
            color: #8aaac8;
          }

          .upgrade-nudge-card__check {
            color: ${colors.accent};
            margin-right: 8px;
            font-weight: 700;
          }

          .upgrade-nudge-card__footer {
            margin: 0;
            font-size: 12px;
            color: #4a6880;
            line-height: 1.5;
          }

          .upgrade-nudge-card__footer strong {
            color: #8aaac8;
          }

          .upgrade-nudge-card__cta {
            justify-self: start;
            border: none;
            border-radius: 10px;
            padding: 12px 16px;
            background: linear-gradient(135deg, ${colors.ctaFrom}, ${colors.ctaTo});
            color: ${colors.ctaText};
            font-weight: 700;
            font-size: 14px;
            cursor: pointer;
          }

          @media (max-width: 640px) {
            .upgrade-nudge-card {
              padding: 18px;
            }

            .upgrade-nudge-card__title {
              font-size: 16px;
            }

            .upgrade-nudge-card__cta {
              width: 100%;
            }
          }
        </style>

        <span class="upgrade-nudge-card__badge">${Utils.escapeHtml(cfg.badge)}</span>
        <div class="upgrade-nudge-card__icon" aria-hidden="true">${cfg.icon}</div>
        <h3 class="upgrade-nudge-card__title">${Utils.escapeHtml(cfg.title)}</h3>
        <ul class="upgrade-nudge-card__list">
          ${cfg.bullets
            .map(
              (bullet) =>
                `<li class="upgrade-nudge-card__item"><span class="upgrade-nudge-card__check">&#10003;</span>${Utils.escapeHtml(bullet)}</li>`,
            )
            .join('')}
        </ul>
        ${cfg.footer ? `<p class="upgrade-nudge-card__footer">${cfg.footer}</p>` : ''}
        <button
          class="upgrade-nudge-card__cta"
          type="button"
          data-action="open-upgrade"
          data-upgrade-source="dashboard"
          data-highlight-plan="${cfg.highlightPlan}"
        >${Utils.escapeHtml(cfg.ctaLabel)} &rarr;</button>
      </article>
    `;
  },

  /**
   * Hint inline mostrado quando uma feature é bloqueada.
   * @param {string} feature nome da feature bloqueada
   * @param {Object} [params]
   * @param {'free'|'plus'|'pro'} [params.planCode] plano atual do usuário
   * @param {'plus'|'pro'} [params.requiredPlan] plano mínimo que libera a feature
   */
  renderInlineHint(feature, params = {}) {
    const safeFeature = Utils.escapeHtml(feature || 'Recurso');
    const requiredPlan = params.requiredPlan === 'pro' ? 'Pro' : 'Plus';

    return `
      <div class="upgrade-inline-hint" role="note">
        <style>
          .upgrade-inline-hint {
            margin-top: 10px;
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            align-items: center;
            font-size: 12px;
            color: #4a6880;
            padding: 8px 12px;
            background: rgba(255, 255, 255, 0.02);
            border-radius: 6px;
          }

          .upgrade-inline-hint__link {
            color: #00c8e8;
            text-decoration: none;
            font-weight: 500;
          }
        </style>

        <span>&#128274; ${safeFeature} disponível a partir do plano ${requiredPlan}</span>
        <a href="#" class="upgrade-inline-hint__link" data-action="open-upgrade" data-upgrade-source="upgrade_nudge">Conhecer &rarr;</a>
      </div>
    `;
  },
};
