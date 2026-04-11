import { getState } from '../../core/state.js';

const FREE_PLAN_EQUIP_LIMIT = 5;
const FREE_PLAN_REPORT_LIMIT = 10;

function clampPercent(value, total) {
  if (!total) return 0;
  return Math.min(100, Math.max(0, Math.round((value / total) * 100)));
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

export const UsageMeter = {
  render() {
    const { equipamentos, registros } = getState();
    const equipmentCount = equipamentos.length;
    const reportsThisMonth = countReportsThisMonth(registros);

    const equipmentPercent = clampPercent(equipmentCount, FREE_PLAN_EQUIP_LIMIT);
    const reportPercent = clampPercent(reportsThisMonth, FREE_PLAN_REPORT_LIMIT);
    const reportColor = getReportBarColor(reportPercent);
    const showAlmostLimitBadge = equipmentPercent > 80 || reportPercent > 80;

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
            color: #0b1c29;
            background: #e8a020;
            border-radius: 999px;
            padding: 4px 8px;
            letter-spacing: 0.04em;
            animation: usage-meter-pulse 1.2s ease-in-out infinite;
          }

          @keyframes usage-meter-pulse {
            0% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.06); opacity: 0.85; }
            100% { transform: scale(1); opacity: 1; }
          }
        </style>

        <div class="usage-meter__row">
          <div class="usage-meter__label">Equipamentos: <span class="usage-meter__value">${equipmentCount} / ${FREE_PLAN_EQUIP_LIMIT}</span> no plano gratis</div>
          <div class="usage-meter__track">
            <div class="usage-meter__fill" style="width:${equipmentPercent}%;background:#00C8E8"></div>
          </div>
        </div>

        <div class="usage-meter__row">
          <div class="usage-meter__label">Relatorios este mes: <span class="usage-meter__value">${reportsThisMonth} / ${FREE_PLAN_REPORT_LIMIT}</span> no plano gratis</div>
          <div class="usage-meter__track">
            <div class="usage-meter__fill" style="width:${reportPercent}%;background:${reportColor}"></div>
          </div>
        </div>

        <div class="usage-meter__actions">
          <a class="usage-meter__upgrade" href="#" data-action="open-upgrade">Desbloquear ilimitado →</a>
          ${showAlmostLimitBadge ? '<span class="usage-meter__badge">QUASE NO LIMITE</span>' : ''}
        </div>
      </section>
    `;
  },
};

export const UsageMeterInternal = {
  clampPercent,
  countReportsThisMonth,
  getReportBarColor,
};
