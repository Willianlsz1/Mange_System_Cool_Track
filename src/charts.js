/**
 * CoolTrack Pro - Charts Module v1.1 (P2 Fixes)
 *
 * Correções aplicadas:
 * [FIX-CHART-1] Cores hardcoded substituídas por leitura dinâmica via getComputedStyle
 *               Gráficos agora respondem corretamente ao light/dark mode
 * [FIX-CHART-2] refreshAll() agora verifica se a view "início" está ativa antes de renderizar
 *               Evita trabalho desnecessário e flickering ao chamar updateHeader() de outras views
 */

import { Chart, registerables } from 'chart.js';
import { getState } from './state.js';
import { Utils } from './utils.js';

Chart.register(...registerables);

// Cache de instâncias (evita memory leak ao recriar gráficos)
const chartInstances = {};

function destroyChart(canvasId) {
  if (chartInstances[canvasId]) {
    chartInstances[canvasId].destroy();
    delete chartInstances[canvasId];
  }
}

// ════════════════════════════════════════════════════════
// [FIX-CHART-1] CORES DINÂMICAS POR TEMA
//
// Em vez de hardcodar "#EDF2F7" (texto claro do dark mode),
// lemos os valores das custom properties do CSS em tempo de execução.
// Assim, quando o usuário troca para light mode, os gráficos
// recriados já usam as cores corretas automaticamente.
// ════════════════════════════════════════════════════════

/**
 * Lê uma custom property CSS do :root e retorna seu valor.
 * Ex: getCSSVar('--text') → '#EDF2F7' (dark) ou '#1E293B' (light)
 */
function getCSSVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/**
 * Retorna o objeto de cores atual, baseado no tema ativo.
 * Chamado no momento de criação de cada gráfico — não cacheado —
 * para garantir que sempre reflete o tema correto.
 */
function getThemeColors() {
  return {
    // Status semânticos (fixos — mesmos no light e dark)
    success:  '#00E5A0',
    warning:  '#FFB800',
    danger:   '#FF3D5A',
    primary:  '#00D4FF',

    // Tipografia e superfície — lidos do CSS para respeitar o tema
    text:     getCSSVar('--text'),          // '#EDF2F7' dark / '#1E293B' light
    muted:    getCSSVar('--muted'),         // '#7B8DA6' dark / '#64748B' light
    surface:  getCSSVar('--surface'),       // '#0D1528' dark / '#FFFFFF' light
    border:   getCSSVar('--border'),        // rgba dark  / rgba light
  };
}

// ════════════════════════════════════════════════════════
// [FIX-CHART-2] GUARD — só renderiza se a view está ativa
// ════════════════════════════════════════════════════════

/**
 * Verifica se a view de início está ativa no DOM.
 * Previne que refreshAll() rode em background quando o usuário
 * está em outra view (histórico, equipamentos, etc).
 */
function isInicioActive() {
  return Utils.getEl('view-inicio')?.classList.contains('active') ?? false;
}

// ════════════════════════════════════════════════════════
// CHARTS MODULE
// ════════════════════════════════════════════════════════
export const Charts = {

  /**
   * Gráfico 1: Status dos Equipamentos (Doughnut)
   * Normal / Atenção / Crítico
   */
  renderStatusPie(canvasId) {
    destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const { equipamentos } = getState();
    const C = getThemeColors(); // ← cores do tema atual

    const statusCount = {
      ok:     equipamentos.filter(e => e.status === 'ok').length,
      warn:   equipamentos.filter(e => e.status === 'warn').length,
      danger: equipamentos.filter(e => e.status === 'danger').length,
    };

    const total = equipamentos.length || 1;
    const ctx = canvas.getContext('2d');

    chartInstances[canvasId] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['✅ Normal', '⚠️ Atenção', '🔴 Crítico'],
        datasets: [{
          data: [statusCount.ok, statusCount.warn, statusCount.danger],
          backgroundColor: [C.success, C.warning, C.danger],
          borderColor: C.surface,   // ← usa surface do tema (dark ou branco)
          borderWidth: 3,
          hoverOffset: 10,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: C.text,         // ← texto da legenda adapta ao tema
              padding: 16,
              font: { family: "'Inter', sans-serif", size: 12, weight: '600' },
              usePointStyle: true,
              pointStyle: 'circle',
            }
          },
          tooltip: {
            backgroundColor: C.surface,
            titleColor: C.text,
            bodyColor: C.muted,
            borderColor: C.border,
            borderWidth: 1,
            padding: 12,
            displayColors: true,
            callbacks: {
              label(context) {
                const value = context.parsed;
                const pct = ((value / total) * 100).toFixed(1);
                return ` ${context.label}: ${value} (${pct}%)`;
              }
            }
          }
        },
        animation: { animateRotate: true, animateScale: true, duration: 1000, easing: 'easeOutQuart' }
      }
    });
  },

  /**
   * Gráfico 2: Manutenções por Mês (Bar)
   */
  renderMaintenanceTrend(canvasId) {
    destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const { registros } = getState();
    const C = getThemeColors(); // ← cores do tema atual

    // Agrupa por mês
    const monthlyData = {};
    registros.forEach(reg => {
      if (!reg.data) return;
      try {
        const date = new Date(reg.data);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthlyData[key] = (monthlyData[key] || 0) + 1;
      } catch (_) { /* ignora datas inválidas */ }
    });

    const sortedMonths = Object.keys(monthlyData).sort().slice(-6);
    const labels = sortedMonths.map(m => {
      const [year, month] = m.split('-');
      return new Date(year, month - 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
    });
    const data = sortedMonths.map(m => monthlyData[m]);

    if (labels.length === 0) {
      _drawEmptyMessage(canvas, C.muted, 'Sem dados suficientes');
      return;
    }

    const ctx = canvas.getContext('2d');
    chartInstances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Manutenções',
          data,
          backgroundColor: 'rgba(0, 212, 255, 0.6)',
          borderColor: C.primary,
          borderWidth: 2,
          borderRadius: 8,
          borderSkipped: false,
          hoverBackgroundColor: C.primary,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            grid: { color: C.border, drawBorder: false },
            ticks: { color: C.muted, font: { size: 11 } },
          },
          y: {
            beginAtZero: true,
            grid: { color: C.border, drawBorder: false },
            ticks: { color: C.muted, font: { size: 11 }, stepSize: 1 },
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: C.surface,
            titleColor: C.text,
            bodyColor: C.muted,
            borderColor: C.border,
            borderWidth: 1,
            padding: 12,
            callbacks: { label: (ctx) => ` Manutenções: ${ctx.parsed.y}` }
          }
        },
        animation: { duration: 800, easing: 'easeOutQuart' }
      }
    });
  },

  /**
   * Gráfico 3: Tipos de Serviço Mais Frequentes (Horizontal Bar)
   */
  renderServiceTypes(canvasId) {
    destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const { registros } = getState();
    const C = getThemeColors(); // ← cores do tema atual

    const typeCount = {};
    registros.forEach(reg => {
      if (!reg.tipo) return;
      const tipo = reg.tipo.length > 25 ? reg.tipo.substring(0, 25) + '...' : reg.tipo;
      typeCount[tipo] = (typeCount[tipo] || 0) + 1;
    });

    const sortedTypes = Object.entries(typeCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    if (sortedTypes.length === 0) {
      _drawEmptyMessage(canvas, C.muted, 'Sem dados de serviços');
      return;
    }

    const labels = sortedTypes.map(t => t[0]).reverse();
    const data   = sortedTypes.map(t => t[1]).reverse();

    // Gradiente de opacidade: mais frequente = mais opaco
    const backgroundColors = data.map((_, i) => {
      const alpha = 1 - (i * 0.15);
      return `rgba(0, 212, 255, ${Math.max(alpha, 0.25)})`;
    });

    const ctx = canvas.getContext('2d');
    chartInstances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Quantidade',
          data,
          backgroundColor: backgroundColors,
          borderColor: C.primary,
          borderWidth: 1,
          borderRadius: 6,
          borderSkipped: false,
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            beginAtZero: true,
            grid: { color: C.border, drawBorder: false },
            ticks: { color: C.muted, font: { size: 11 }, stepSize: 1 },
          },
          y: {
            grid: { display: false },
            ticks: { color: C.text, font: { size: 11, weight: '500' } }, // ← C.text adapta ao tema
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: C.surface,
            titleColor: C.text,
            bodyColor: C.muted,
            borderColor: C.border,
            borderWidth: 1,
            padding: 12,
            callbacks: { label: (ctx) => ` ${ctx.parsed.x} ocorrência(s)` }
          }
        },
        animation: { duration: 1000, easing: 'easeOutQuart' }
      }
    });
  },

  /**
   * Atualiza todos os gráficos.
   *
   * [FIX-CHART-2] Guard adicionado: só executa se a view início estiver ativa.
   * Antes, qualquer chamada a updateHeader() de qualquer view disparava
   * renderInicio() → renderStatusChart() → Charts.refreshAll(), criando
   * instâncias de Chart desnecessárias em background.
   */
  refreshAll() {
    if (!isInicioActive()) return; // ← guard

    this.renderStatusPie('chart-status-pie');
    this.renderMaintenanceTrend('chart-trend-line');
    this.renderServiceTypes('chart-types-bar');
  },

  /**
   * Destrói todos os gráficos (limpeza ao trocar de view ou encerrar)
   */
  destroyAll() {
    Object.keys(chartInstances).forEach(id => destroyChart(id));
  }
};

// ════════════════════════════════════════════════════════
// HELPER INTERNO
// ════════════════════════════════════════════════════════

/**
 * Desenha mensagem "sem dados" diretamente no canvas,
 * usando a cor muted do tema atual.
 */
function _drawEmptyMessage(canvas, mutedColor, message) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = '14px Inter, sans-serif';
  ctx.fillStyle = mutedColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(message, canvas.width / 2, canvas.height / 2);
}

export default Charts;