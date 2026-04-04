/**
 * CoolTrack Pro - Charts Module v3.4.1
 * Fix: Chart.js v4 com Vite usa import default, não named imports de subpaths.
 */

import Chart from 'chart.js/auto';

import { getState } from './state.js';
import { Utils } from './utils.js';

let _charts = { pie: null, line: null, bar: null };

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || null;
}

function getThemeColors() {
  return {
    primary: cssVar('--primary')  || '#00D4FF',
    success: cssVar('--success')  || '#00E5A0',
    warning: cssVar('--warning')  || '#FFB800',
    danger:  cssVar('--danger')   || '#FF3D5A',
    muted:   cssVar('--muted')    || '#7B8DA6',
    text:    cssVar('--text')     || '#EDF2F7',
    border:  cssVar('--border')   || 'rgba(255,255,255,0.08)',
    surface: cssVar('--surface')  || '#0D1528',
  };
}

function applyGlobalDefaults(colors) {
  Chart.defaults.color                           = colors.text;
  Chart.defaults.borderColor                     = colors.border;
  Chart.defaults.plugins.legend.labels.color     = colors.text;
  Chart.defaults.plugins.tooltip.backgroundColor = colors.surface;
  Chart.defaults.plugins.tooltip.titleColor      = colors.text;
  Chart.defaults.plugins.tooltip.bodyColor       = colors.muted;
  Chart.defaults.plugins.tooltip.borderColor     = colors.border;
  Chart.defaults.plugins.tooltip.borderWidth     = 1;
  Chart.defaults.plugins.tooltip.padding         = 10;
  Chart.defaults.plugins.tooltip.cornerRadius    = 8;
}

function destroyAll() {
  Object.values(_charts).forEach(c => { if (c) c.destroy(); });
  _charts = { pie: null, line: null, bar: null };
}

function buildStatusData(equipamentos, colors) {
  const counts = { ok: 0, warn: 0, danger: 0 };
  equipamentos.forEach(e => { if (counts[e.status] !== undefined) counts[e.status]++; });
  return {
    labels: ['Normal', 'Atenção', 'Crítico'],
    datasets: [{
      data: [counts.ok, counts.warn, counts.danger],
      backgroundColor: [`${colors.success}CC`, `${colors.warning}CC`, `${colors.danger}CC`],
      borderColor:     [colors.success, colors.warning, colors.danger],
      borderWidth: 2,
      hoverOffset: 8,
    }]
  };
}

function buildTrendData(registros, colors) {
  const now = new Date();
  const labels = [];
  const counts = [];
  for (let i = 5; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end   = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    labels.push(start.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }));
    counts.push(registros.filter(r => { const d = new Date(r.data); return d >= start && d < end; }).length);
  }
  return {
    labels,
    datasets: [{
      label: 'Manutenções',
      data: counts,
      borderColor: colors.primary,
      backgroundColor: `${colors.primary}20`,
      borderWidth: 2.5,
      pointBackgroundColor: colors.primary,
      pointBorderColor: colors.surface,
      pointBorderWidth: 2,
      pointRadius: 5,
      pointHoverRadius: 7,
      tension: 0.4,
      fill: true,
    }]
  };
}

function buildTypesData(registros, colors) {
  const freq = {};
  registros.forEach(r => { freq[r.tipo] = (freq[r.tipo] || 0) + 1; });
  const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 7);
  const palette = [colors.primary, colors.success, colors.warning, colors.danger, '#A78BFA', '#34D399', '#F472B6'];
  return {
    labels: sorted.map(([tipo]) => tipo.length > 24 ? tipo.slice(0, 24) + '…' : tipo),
    datasets: [{
      label: 'Ocorrências',
      data: sorted.map(([, n]) => n),
      backgroundColor: sorted.map((_, i) => `${palette[i % palette.length]}BB`),
      borderColor:     sorted.map((_, i) => palette[i % palette.length]),
      borderWidth: 1.5,
      borderRadius: 6,
      borderSkipped: false,
    }]
  };
}

function renderPie(canvas, equipamentos, colors) {
  if (!canvas) return;
  const data = buildStatusData(equipamentos, colors);
  if (data.datasets[0].data.every(v => v === 0)) return;
  _charts.pie = new Chart(canvas, {
    type: 'doughnut',
    data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: { position: 'bottom', labels: { padding: 14, boxWidth: 12, font: { size: 12 } } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed} equipamento(s)` } }
      }
    }
  });
}

function renderLine(canvas, registros, colors) {
  if (!canvas) return;
  _charts.line = new Chart(canvas, {
    type: 'line',
    data: buildTrendData(registros, colors),
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.y} manutenção(ões)` } }
      },
      scales: {
        x: { grid: { color: colors.border }, ticks: { color: colors.muted, font: { size: 11 } } },
        y: { grid: { color: colors.border }, ticks: { color: colors.muted, font: { size: 11 }, stepSize: 1 }, beginAtZero: true }
      }
    }
  });
}

function renderBar(canvas, registros, colors) {
  if (!canvas || !registros.length) return;
  _charts.bar = new Chart(canvas, {
    type: 'bar',
    data: buildTypesData(registros, colors),
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.x} ocorrência(s)` } }
      },
      scales: {
        x: { grid: { color: colors.border }, ticks: { color: colors.muted, font: { size: 11 }, stepSize: 1 }, beginAtZero: true },
        y: { grid: { display: false }, ticks: { color: colors.text, font: { size: 12 } } }
      }
    }
  });
}

export const Charts = {
  refreshAll() {
    const { equipamentos, registros } = getState();
    const colors = getThemeColors();
    applyGlobalDefaults(colors);
    destroyAll();
    renderPie(document.getElementById('chart-status-pie'),  equipamentos, colors);
    renderLine(document.getElementById('chart-trend-line'), registros,    colors);
    renderBar(document.getElementById('chart-types-bar'),   registros,    colors);
  },
  destroyAll
};