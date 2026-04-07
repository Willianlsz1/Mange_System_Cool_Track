/**
 * CoolTrack Pro - Charts Module v4.0
 * Paleta industrial HVAC: navy/cyan/amber/red
 * Tipografia técnica, grids discretos, sem decoração
 */

import Chart from 'chart.js/auto';
import { getState } from '../../core/state.js';

// ── CSS vars → valores resolvidos ─────────────────────
function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || null;
}

function getThemeColors() {
  return {
    primary: cssVar('--primary') || '#00C8E8',
    success: cssVar('--success') || '#00C870',
    warning: cssVar('--warning') || '#E8A020',
    danger: cssVar('--danger') || '#E03040',
    text: cssVar('--text') || '#E8F2FA',
    text2: cssVar('--text-2') || '#8AAAC8',
    text3: cssVar('--text-3') || '#4A6880',
    border: cssVar('--border') || 'rgba(255,255,255,0.07)',
    border2: cssVar('--border-2') || 'rgba(255,255,255,0.12)',
    surface2: cssVar('--surface-2') || '#112236',
    surface3: cssVar('--surface-3') || '#172D45',
  };
}

// ── Defaults globais do Chart.js ──────────────────────
function applyGlobalDefaults(c) {
  Chart.defaults.font.family = "'Inter', 'JetBrains Mono', sans-serif";
  Chart.defaults.font.size = 11;
  Chart.defaults.color = c.text2;
  Chart.defaults.borderColor = c.border;

  // Tooltip industrial — escuro, bordas finas
  Object.assign(Chart.defaults.plugins.tooltip, {
    backgroundColor: c.surface2,
    titleColor: c.text,
    bodyColor: c.text2,
    borderColor: c.border2,
    borderWidth: 1,
    padding: 10,
    cornerRadius: 4,
    displayColors: true,
    boxWidth: 10,
    boxHeight: 10,
    boxPadding: 4,
    usePointStyle: true,
  });

  // Legenda discreta
  Object.assign(Chart.defaults.plugins.legend.labels, {
    color: c.text2,
    boxWidth: 10,
    boxHeight: 10,
    padding: 16,
    usePointStyle: true,
    pointStyle: 'rectRounded',
    font: { size: 11 },
  });
}

// ── Instâncias ativas ─────────────────────────────────
let _charts = { pie: null, line: null, bar: null };

function destroyAll() {
  Object.values(_charts).forEach((ch) => {
    if (ch) ch.destroy();
  });
  _charts = { pie: null, line: null, bar: null };
}

// ── Dados: status do parque ───────────────────────────
function buildStatusData(equipamentos, c) {
  const counts = { ok: 0, warn: 0, danger: 0 };
  equipamentos.forEach((e) => {
    if (counts[e.status] !== undefined) counts[e.status]++;
  });

  return {
    labels: ['Operando', 'Atenção', 'Falha'],
    datasets: [
      {
        data: [counts.ok, counts.warn, counts.danger],
        backgroundColor: [`${c.success}BB`, `${c.warning}BB`, `${c.danger}BB`],
        borderColor: [c.success, c.warning, c.danger],
        borderWidth: 1.5,
        hoverOffset: 6,
        hoverBorderWidth: 2,
      },
    ],
  };
}

// ── Dados: serviços por mês (últimos 6) ───────────────
function buildTrendData(registros, c) {
  const now = new Date();
  const labels = [];
  const counts = [];

  for (let i = 5; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    labels.push(start.toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase());
    counts.push(
      registros.filter((r) => {
        const d = new Date(r.data);
        return d >= start && d < end;
      }).length,
    );
  }

  return {
    labels,
    datasets: [
      {
        label: 'Serviços',
        data: counts,
        borderColor: c.primary,
        backgroundColor: `${c.primary}18`,
        borderWidth: 2,
        pointBackgroundColor: c.primary,
        pointBorderColor: c.surface2,
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointHoverBorderWidth: 2,
        tension: 0.35,
        fill: true,
      },
    ],
  };
}

// ── Dados: tipos de serviço ───────────────────────────
function buildTypesData(registros, c) {
  const freq = {};
  registros.forEach((r) => {
    freq[r.tipo] = (freq[r.tipo] || 0) + 1;
  });
  const sorted = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  // Paleta técnica fixa para os tipos
  const palette = [c.primary, c.success, c.warning, c.danger, '#7CB8D0', '#8AAAC8'];

  return {
    labels: sorted.map(([tipo]) => (tipo.length > 26 ? tipo.slice(0, 26) + '…' : tipo)),
    datasets: [
      {
        label: 'Ocorrências',
        data: sorted.map(([, n]) => n),
        backgroundColor: sorted.map((_, i) => `${palette[i % palette.length]}AA`),
        borderColor: sorted.map((_, i) => palette[i % palette.length]),
        borderWidth: 1,
        borderRadius: 3,
        borderSkipped: false,
      },
    ],
  };
}

// ── Render: doughnut status ───────────────────────────
function renderPie(canvas, equipamentos, c) {
  if (!canvas) return;
  const data = buildStatusData(equipamentos, c);
  if (data.datasets[0].data.every((v) => v === 0)) return;

  _charts.pie = new Chart(canvas, {
    type: 'doughnut',
    data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { padding: 14, font: { size: 11 } },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => `  ${ctx.label}: ${ctx.parsed} unidade(s)`,
          },
        },
      },
    },
  });
}

// ── Render: line trend ────────────────────────────────
function renderLine(canvas, registros, c) {
  if (!canvas) return;

  _charts.line = new Chart(canvas, {
    type: 'line',
    data: buildTrendData(registros, c),
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `  ${ctx.parsed.y} serviço(s)`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: c.border, lineWidth: 0.5 },
          ticks: {
            color: c.text3,
            font: { size: 10, family: "'JetBrains Mono', monospace" },
            maxRotation: 0,
          },
          border: { color: c.border2 },
        },
        y: {
          grid: { color: c.border, lineWidth: 0.5 },
          ticks: { color: c.text3, font: { size: 10 }, stepSize: 1 },
          beginAtZero: true,
          border: { color: c.border2 },
        },
      },
    },
  });
}

// ── Render: horizontal bar tipos ─────────────────────
function renderBar(canvas, registros, c) {
  if (!canvas || !registros.length) return;

  _charts.bar = new Chart(canvas, {
    type: 'bar',
    data: buildTypesData(registros, c),
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `  ${ctx.parsed.x} ocorrência(s)`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: c.border, lineWidth: 0.5 },
          ticks: { color: c.text3, font: { size: 10 }, stepSize: 1 },
          beginAtZero: true,
          border: { color: c.border2 },
        },
        y: {
          grid: { display: false },
          ticks: { color: c.text2, font: { size: 11 } },
          border: { display: false },
        },
      },
    },
  });
}

// ── API pública ───────────────────────────────────────
export const Charts = {
  refreshAll() {
    const { equipamentos, registros } = getState();
    const colors = getThemeColors();
    applyGlobalDefaults(colors);
    destroyAll();

    renderPie(document.getElementById('chart-status-pie'), equipamentos, colors);
    renderLine(document.getElementById('chart-trend-line'), registros, colors);
    renderBar(document.getElementById('chart-types-bar'), registros, colors);
  },

  destroyAll,
};
