import { Utils } from '../../core/utils.js';

const BULLETS = [
  'Equipamentos ilimitados',
  'Relatorios PDF ilimitados',
  'Compartilhamento WhatsApp direto',
];

export const UpgradeNudge = {
  renderDashboardCard() {
    return `
      <article class="upgrade-nudge-card" aria-label="Upgrade para plano Pro">
        <style>
          .upgrade-nudge-card {
            position: relative;
            background: linear-gradient(135deg, rgba(0, 200, 232, 0.06), rgba(0, 168, 255, 0.03));
            border: 1px solid rgba(0, 200, 232, 0.12);
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
            color: #00c870;
            background: rgba(0, 200, 112, 0.15);
            border-radius: 999px;
            padding: 4px 8px;
            letter-spacing: 0.06em;
            font-weight: 600;
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
            color: #00c870;
            margin-right: 8px;
            font-weight: 700;
          }

          .upgrade-nudge-card__cta {
            justify-self: start;
            border: none;
            border-radius: 10px;
            padding: 12px 16px;
            background: linear-gradient(135deg, #00c8e8, #00a8ff);
            color: #07111f;
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

        <span class="upgrade-nudge-card__badge">POPULAR</span>
        <div class="upgrade-nudge-card__icon" aria-hidden="true">⚡</div>
        <h3 class="upgrade-nudge-card__title">Desbloqueie o CoolTrack Pro completo</h3>
        <ul class="upgrade-nudge-card__list">
          ${BULLETS.map((bullet) => `<li class="upgrade-nudge-card__item"><span class="upgrade-nudge-card__check">✓</span>${bullet}</li>`).join('')}
        </ul>
        <button class="upgrade-nudge-card__cta" type="button" data-action="open-upgrade" data-upgrade-source="dashboard">Ver planos →</button>
      </article>
    `;
  },

  renderInlineHint(feature) {
    const safeFeature = Utils.escapeHtml(feature || 'Recurso');
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

        <span>🔒 ${safeFeature} disponivel no plano Pro</span>
        <a href="#" class="upgrade-inline-hint__link" data-action="open-upgrade" data-upgrade-source="upgrade_nudge">Conhecer →</a>
      </div>
    `;
  },
};
