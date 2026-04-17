/**
 * CoolTrack Pro - Dashboard / metrics
 * Helpers puros de métricas: contagens mensais, sparkline, trend tag,
 * severidade de alertas e wrappers de health score.
 */

import { findEquip, regsForEquip } from '../../../core/state.js';
import {
  calculateHealthScore,
  getHealthClass as getMaintenanceHealthClass,
} from '../../../domain/maintenance.js';
import { ALERT_SEVERITY_WEIGHT } from './constants.js';

export function getMostSevereAlert(alerts = []) {
  return [...alerts].sort(
    (a, b) =>
      (ALERT_SEVERITY_WEIGHT[b?.severity] || 0) - (ALERT_SEVERITY_WEIGHT[a?.severity] || 0) ||
      (b?.sortScore || 0) - (a?.sortScore || 0),
  )[0];
}

export function getMonthRange(monthsAgo = 0) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
  const end = new Date(now.getFullYear(), now.getMonth() - monthsAgo + 1, 1);
  return { start, end };
}

export function countRegistrosNoMes(registros, monthsAgo = 0) {
  const { start, end } = getMonthRange(monthsAgo);
  return registros.filter((r) => {
    const d = new Date(r.data);
    return d >= start && d < end;
  }).length;
}

export function sparklineData(registros, months = 6) {
  return Array.from({ length: months }, (_, i) => countRegistrosNoMes(registros, months - 1 - i));
}

export function trendTag(current, previous) {
  if (previous === 0 && current === 0) return { text: 'Sem dados anteriores', cls: 'neutral' };
  if (previous === 0 && current > 0) return { text: `+${current} este mês`, cls: 'up' };
  const diff = current - previous;
  if (diff === 0) return { text: 'Igual ao mês passado', cls: 'neutral' };
  if (diff > 0) return { text: `&uarr; ${diff} vs mês passado`, cls: 'up' };
  return { text: `&darr; ${Math.abs(diff)} vs mês passado`, cls: 'down' };
}

export function sparklineHtml(data, color = 'var(--primary)') {
  const max = Math.max(...data, 1);
  const bars = data
    .map((v, i) => {
      const pct = Math.round((v / max) * 100);
      const isLast = i === data.length - 1;
      const fill = isLast ? color : 'var(--surface-3)';
      const height = Math.max(pct, 8);
      return `<div class="kpi-spark__bar${isLast ? ' kpi-spark__bar--last' : ''}"
      style="height:${height}%;background:${fill}"
      title="${v} serviço${v !== 1 ? 's' : ''}"></div>`;
    })
    .join('');
  return `<div class="kpi-spark">${bars}</div>`;
}

export function alertContextText(count) {
  if (count === 0) return { text: 'Sem alertas', cls: 'ok' };
  if (count === 1) return { text: '1 alerta ativo', cls: 'warn' };
  return { text: `${count} alertas ativos`, cls: 'danger' };
}

export function calcHealthScore(eqId) {
  const eq = findEquip(eqId);
  if (!eq) return 0;
  return calculateHealthScore(eq, regsForEquip(eqId));
}

export function getHealthClass(score) {
  return getMaintenanceHealthClass(score);
}
