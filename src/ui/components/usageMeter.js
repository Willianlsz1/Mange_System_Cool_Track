import { PLAN_CODE_FREE, PLAN_CODE_PRO } from '../../core/subscriptionPlans.js';
import { getState } from '../../core/state.js';

const FREE_PLAN_EQUIP_LIMIT = 3;
const FREE_PLAN_REPORT_LIMIT = 10;

function clampPercent(value, total) {
  if (!total) return 0;
  return Math.min(100, Math.max(0, Math.round((value / total) * 100)));
}

function normalizePlanCode(planCode) {
  return String(planCode || '').toLowerCase() === PLAN_CODE_PRO ? PLAN_CODE_PRO : PLAN_CODE_FREE;
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
  if (percent > 90) return '#e03040';
  if (percent > 70) return '#e8a020';
  return '#00C8E8';
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

function renderProMeter(equipmentCount, reportsThisMonth) {
  return `
    <section class="usage-meter usage-meter--pro" aria-label="Consumo do plano Pro">
      <style>
        .usage-meter {
          background: rgba(0, 200, 232, 0.05);
          border: 1px solid rgba(0, 200, 232, 0.1);
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
          color: #6a8ba8;
        }

        .usage-meter__value {
          color: #e8f2fa;
        }

        .usage-meter__track {
          height: 6px;
          border-radius: 3px;
          background: rgba(255, 255, 255, 0.06);
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
          color: #00c8e8;
          text-decoration: none;
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
          background: rgba(232, 160, 32, 0.15);
          color: #e8a020;
        }

        .usage-meter__badge--danger {
          background: rgba(224, 48, 64, 0.15);
          color: #e03040;
        }

        .usage-meter--pro {
          border-color: rgba(0, 200, 112, 0.26);
          background: linear-gradient(135deg, rgba(0, 200, 112, 0.11), rgba(0, 200, 232, 0.08));
        }

        .usage-meter__pro-badge {
          justify-self: start;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.06em;
          color: #00c870;
          background: rgba(0, 200, 112, 0.16);
          border: 1px solid rgba(0, 200, 112, 0.3);
          border-radius: 999px;
          padding: 4px 10px;
        }

        .usage-meter__pro-copy {
          font-size: 12px;
          color: #d8f6ee;
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

      <span class="usage-meter__pro-badge">PLANO PRO ATIVO</span>
      <div class="usage-meter__pro-copy">Recursos premium e limites expandidos liberados.</div>
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
  const equipmentBarColor = usageState.equipmentOverLimit ? '#e03040' : '#00C8E8';
  const reportColor = usageState.hasOverLimit
    ? '#e03040'
    : getReportBarColor(usageState.reportPercent);
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
          background: rgba(0, 200, 232, 0.05);
          border: 1px solid rgba(0, 200, 232, 0.1);
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
          color: #6a8ba8;
        }

        .usage-meter__value {
          color: #e8f2fa;
        }

        .usage-meter__track {
          height: 6px;
          border-radius: 3px;
          background: rgba(255, 255, 255, 0.06);
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
          color: #00c8e8;
          text-decoration: none;
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
          background: rgba(232, 160, 32, 0.15);
          color: #e8a020;
        }

        .usage-meter__badge--danger {
          background: rgba(224, 48, 64, 0.15);
          color: #e03040;
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
          <div class="usage-meter__fill" style="width:${usageState.equipmentPercent}%;background:${equipmentBarColor}"></div>
        </div>
      </div>

      <div class="usage-meter__row">
        <div class="usage-meter__label">Relatórios este mês: <span class="usage-meter__value">${reportsThisMonth} / ${FREE_PLAN_REPORT_LIMIT}</span> no plano grátis</div>
        <div class="usage-meter__track">
          <div class="usage-meter__fill" style="width:${usageState.reportPercent}%;background:${reportColor}"></div>
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
      return renderProMeter(equipmentCount, reportsThisMonth);
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
