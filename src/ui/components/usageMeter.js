import { PLAN_CODE_FREE, PLAN_CODE_PLUS, PLAN_CODE_PRO } from '../../core/subscriptionPlans.js';
import { getState } from '../../core/state.js';

const FREE_PLAN_EQUIP_LIMIT = 3;
const FREE_PLAN_REPORT_LIMIT = 10;

function clampPercent(value, total) {
  if (!total) return 0;
  return Math.min(100, Math.max(0, Math.round((value / total) * 100)));
}

function normalizePlanCode(planCode) {
  const lower = String(planCode || '').toLowerCase();
  if (lower === PLAN_CODE_PRO) return PLAN_CODE_PRO;
  if (lower === PLAN_CODE_PLUS) return PLAN_CODE_PLUS;
  return PLAN_CODE_FREE;
}

function countReportsThisMonth(registros = []) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  return registros.filter((registro) => {
    const date = new Date(registro?.data);
    return !Number.isNaN(date.getTime()) && date >= start && date < end;
  }).length;
}

function getReportBarColor(percent) {
  if (percent > 90) return 'var(--danger)';
  if (percent > 70) return 'var(--warning)';
  return 'var(--primary)';
}

// Classe CSS correspondente ao tom (cores via var() no <style> do render,
// assim trocam no tema claro sem alterar JS).
function getReportBarTone(percent) {
  if (percent > 90) return 'danger';
  if (percent > 70) return 'warn';
  return 'primary';
}

function getUsageState(equipmentCount, reportsThisMonth) {
  const equipmentOverLimit = equipmentCount > FREE_PLAN_EQUIP_LIMIT;
  const reportOverLimit = reportsThisMonth > FREE_PLAN_REPORT_LIMIT;
  const hasOverLimit = equipmentOverLimit || reportOverLimit;

  const equipmentPercent = clampPercent(equipmentCount, FREE_PLAN_EQUIP_LIMIT);
  const reportPercent = clampPercent(reportsThisMonth, FREE_PLAN_REPORT_LIMIT);
  const hasNearLimit = !hasOverLimit && (equipmentPercent >= 80 || reportPercent >= 80);

  return {
    equipmentPercent,
    reportPercent,
    equipmentOverLimit,
    hasOverLimit,
    hasNearLimit,
  };
}

// Paleta canônica por tier (alinhada com pricing + account modal + header):
//   Pro  = dourado (#e8b94a)
//   Plus = azul    (#3a8ee6)
function getPaidMeterAccent(planCode) {
  if (planCode === PLAN_CODE_PLUS) {
    return {
      solid: '#3a8ee6',
      soft: 'rgba(58, 142, 230, 0.16)',
      border: 'rgba(58, 142, 230, 0.3)',
    };
  }
  // Pro default
  return { solid: '#e8b94a', soft: 'rgba(232, 185, 74, 0.16)', border: 'rgba(232, 185, 74, 0.3)' };
}

function renderPaidMeter(
  equipmentCount,
  reportsThisMonth,
  {
    planCode = PLAN_CODE_PRO,
    planLabel = 'Pro',
    planCopy = 'Recursos premium e limites expandidos liberados.',
  } = {},
) {
  const accent = getPaidMeterAccent(planCode);
  return `
    <section class="usage-meter usage-meter--paid usage-meter--${planCode}" aria-label="Consumo do plano ${planLabel}" style="--um-accent:${accent.solid};--um-accent-soft:${accent.soft};--um-accent-border:${accent.border};">
      <style>
        .usage-meter {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 16px;
          margin: 10px 0 14px;
          display: grid;
          gap: 10px;
        }

        .usage-meter__row {
          display: grid;
          gap: 6px;
        }

        .usage-meter__label {
          font-size: 12px;
          color: var(--text-3);
        }

        .usage-meter__value {
          color: var(--text);
          font-weight: 600;
        }

        .usage-meter__track {
          height: 6px;
          border-radius: 3px;
          background: var(--surface-3);
          overflow: hidden;
        }

        .usage-meter__fill {
          height: 100%;
          border-radius: 3px;
          transition: width 0.3s ease;
        }

        .usage-meter__actions {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
        }

        .usage-meter__upgrade {
          font-size: 12px;
          color: var(--primary);
          text-decoration: none;
          font-weight: 600;
        }

        .usage-meter__badge {
          font-size: 11px;
          font-weight: 700;
          border-radius: 999px;
          padding: 4px 8px;
          letter-spacing: 0.04em;
          animation: usage-meter-pulse 1.2s ease-in-out infinite;
        }

        .usage-meter__badge--warn {
          background: var(--warning-soft);
          color: var(--warning);
          border: 1px solid color-mix(in srgb, var(--warning) 30%, transparent);
        }

        .usage-meter__badge--danger {
          background: var(--danger-soft);
          color: var(--danger);
          border: 1px solid color-mix(in srgb, var(--danger) 30%, transparent);
        }

        .usage-meter--paid {
          border-color: var(--um-accent-border);
          background: linear-gradient(
            135deg,
            color-mix(in srgb, var(--um-accent) 10%, var(--surface)),
            color-mix(in srgb, var(--primary) 7%, var(--surface))
          );
        }

        .usage-meter__pro-badge {
          justify-self: start;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.06em;
          color: var(--um-accent);
          background: var(--um-accent-soft);
          border: 1px solid var(--um-accent-border);
          border-radius: 999px;
          padding: 4px 10px;
        }

        .usage-meter__pro-copy {
          font-size: 12px;
          color: var(--text-2);
        }

        @keyframes usage-meter-pulse {
          0% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.06);
            opacity: 0.85;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
      </style>

      <span class="usage-meter__pro-badge">PLANO ${planLabel.toUpperCase()} ATIVO</span>
      <div class="usage-meter__pro-copy">${planCopy}</div>
      <div class="usage-meter__row">
        <div class="usage-meter__label">Equipamentos cadastrados: <span class="usage-meter__value">${equipmentCount}</span></div>
      </div>
      <div class="usage-meter__row">
        <div class="usage-meter__label">Relatórios neste mês: <span class="usage-meter__value">${reportsThisMonth}</span></div>
      </div>
    </section>
  `;
}

function renderFreeMeter(equipmentCount, reportsThisMonth) {
  const usageState = getUsageState(equipmentCount, reportsThisMonth);
  const equipmentTone = usageState.equipmentOverLimit ? 'danger' : 'primary';
  const reportTone = usageState.hasOverLimit
    ? 'danger'
    : getReportBarTone(usageState.reportPercent);
  const upgradeText = usageState.hasOverLimit
    ? 'Você precisa do plano Pro para continuar &rarr;'
    : 'Desbloquear ilimitado &rarr;';
  const badgeHtml = usageState.hasOverLimit
    ? '<span class="usage-meter__badge usage-meter__badge--danger">LIMITE ULTRAPASSADO</span>'
    : usageState.hasNearLimit
      ? '<span class="usage-meter__badge usage-meter__badge--warn">QUASE NO LIMITE</span>'
      : '';

  return `
    <section class="usage-meter" aria-label="Consumo do plano grátis">
      <style>
        .usage-meter {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 16px;
          margin: 10px 0 14px;
          display: grid;
          gap: 10px;
        }

        .usage-meter__row {
          display: grid;
          gap: 6px;
        }

        .usage-meter__label {
          font-size: 12px;
          color: var(--text-3);
        }

        .usage-meter__value {
          color: var(--text);
          font-weight: 600;
        }

        .usage-meter__track {
          height: 6px;
          border-radius: 3px;
          background: var(--surface-3);
          overflow: hidden;
        }

        .usage-meter__fill {
          height: 100%;
          border-radius: 3px;
          transition: width 0.3s ease;
        }

        .usage-meter__fill--primary {
          background: var(--primary);
        }

        .usage-meter__fill--warn {
          background: var(--warning);
        }

        .usage-meter__fill--danger {
          background: var(--danger);
        }

        .usage-meter__actions {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
        }

        .usage-meter__upgrade {
          font-size: 12px;
          color: var(--primary);
          text-decoration: none;
          font-weight: 600;
        }

        .usage-meter__badge {
          font-size: 11px;
          font-weight: 700;
          border-radius: 999px;
          padding: 4px 8px;
          letter-spacing: 0.04em;
          animation: usage-meter-pulse 1.2s ease-in-out infinite;
        }

        .usage-meter__badge--warn {
          background: var(--warning-soft);
          color: var(--warning);
          border: 1px solid color-mix(in srgb, var(--warning) 30%, transparent);
        }

        .usage-meter__badge--danger {
          background: var(--danger-soft);
          color: var(--danger);
          border: 1px solid color-mix(in srgb, var(--danger) 30%, transparent);
        }

        @keyframes usage-meter-pulse {
          0% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.06);
            opacity: 0.85;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
      </style>

      <div class="usage-meter__row">
        <div class="usage-meter__label">Equipamentos: <span class="usage-meter__value">${equipmentCount} / ${FREE_PLAN_EQUIP_LIMIT}</span> no plano grátis</div>
        <div class="usage-meter__track">
          <div class="usage-meter__fill usage-meter__fill--${equipmentTone}" style="width:${usageState.equipmentPercent}%"></div>
        </div>
      </div>

      <div class="usage-meter__row">
        <div class="usage-meter__label">Relatórios este mês: <span class="usage-meter__value">${reportsThisMonth} / ${FREE_PLAN_REPORT_LIMIT}</span> no plano grátis</div>
        <div class="usage-meter__track">
          <div class="usage-meter__fill usage-meter__fill--${reportTone}" style="width:${usageState.reportPercent}%"></div>
        </div>
      </div>

      <div class="usage-meter__actions">
        <a class="usage-meter__upgrade" href="#" data-action="open-upgrade" data-upgrade-source="usage_meter">${upgradeText}</a>
        ${badgeHtml}
      </div>
    </section>
  `;
}

export const UsageMeter = {
  render({ planCode = PLAN_CODE_FREE } = {}) {
    const { equipamentos, registros } = getState();
    const equipmentCount = equipamentos.length;
    const reportsThisMonth = countReportsThisMonth(registros);
    const normalizedPlanCode = normalizePlanCode(planCode);

    if (normalizedPlanCode === PLAN_CODE_PRO) {
      return renderPaidMeter(equipmentCount, reportsThisMonth, {
        planCode: PLAN_CODE_PRO,
        planLabel: 'Pro',
        planCopy: 'Recursos premium e limites expandidos liberados.',
      });
    }

    if (normalizedPlanCode === PLAN_CODE_PLUS) {
      return renderPaidMeter(equipmentCount, reportsThisMonth, {
        planCode: PLAN_CODE_PLUS,
        planLabel: 'Plus',
        planCopy: 'Até 25 equipamentos, registros e histórico ilimitados.',
      });
    }

    return renderFreeMeter(equipmentCount, reportsThisMonth);
  },
};

export const UsageMeterInternal = {
  clampPercent,
  countReportsThisMonth,
  getReportBarColor,
  getUsageState,
  normalizePlanCode,
};
