/**
 * CoolTrack Pro - Charts Module v1.0
 * 
 * Gráficos interativos usando Chart.js v4
 * Integração com dashboard existente
 */

import { Chart, registerables } from 'chart.js';
import { getState } from './state.js';
import { Utils } from './utils.js';

// Registrar todos os componentes do Chart.js
Chart.register(...registerables);

// Cache para instâncias dos gráficos (evita recriar)
const chartInstances = {};

/**
 * Destroi gráfico anterior se existir (previne memory leak)
 */
function destroyChart(canvasId) {
  if (chartInstances[canvasId]) {
    chartInstances[canvasId].destroy();
    delete chartInstances[canvasId];
  }
}

/**
 * Cores do Design System CoolTrack Pro
 */
const COLORS = {
  success: '#00E5A0',
  warning: '#FFB800', 
  danger: '#FF3D5A',
  primary: '#00D4FF',
  text: '#EDF2F7',
  muted: '#7B8DA6',
  surface: '#0D1528',
  border: 'rgba(255, 255, 255, 0.08)'
};

export const Charts = {
  
  /**
   * Gráfico 1: Status dos Equipamentos (Pizza/Doughnut)
   * Mostra distribuição: Normal / Atenção / Crítico
   */
  renderStatusPie(canvasId) {
    destroyChart(canvasId);
    
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    
    const { equipamentos } = getState();
    
    // Conta equipamentos por status
    const statusCount = {
      ok: equipamentos.filter(e => e.status === 'ok').length,
      warn: equipamentos.filter(e => e.status === 'warn').length,
      danger: equipamentos.filter(e => e.status === 'danger').length
    };
    
    const total = equipamentos.length || 1;
    
    const ctx = canvas.getContext('2d');
    chartInstances[canvasId] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['✅ Normal', '⚠️ Atenção', '🔴 Crítico'],
        datasets: [{
          data: [statusCount.ok, statusCount.warn, statusCount.danger],
          backgroundColor: [
            COLORS.success,
            COLORS.warning,
            COLORS.danger
          ],
          borderColor: COLORS.surface,
          borderWidth: 3,
          hoverOffset: 10
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
              color: COLORS.text,
              padding: 16,
              font: {
                family: "'Inter', sans-serif",
                size: 12,
                weight: '600'
              },
              usePointStyle: true,
              pointStyle: 'circle'
            }
          },
          tooltip: {
            backgroundColor: COLORS.surface,
            titleColor: COLORS.text,
            bodyColor: COLORS.muted,
            borderColor: COLORS.border,
            borderWidth: 1,
            padding: 12,
            displayColors: true,
            callbacks: {
              label: function(context) {
                const value = context.parsed;
                const percentage = ((value / total) * 100).toFixed(1);
                return ` ${context.label}: ${value} (${percentage}%)`;
              }
            }
          }
        },
        animation: {
          animateRotate: true,
          animateScale: true,
          duration: 1000,
          easing: 'easeOutQuart'
        }
      }
    });
  },

  /**
   * Gráfico 2: Manutenções por Mês (Linha/Barras)
   * Mostra tendência de manutenções ao longo do tempo
   */
  renderMaintenanceTrend(canvasId) {
    destroyChart(canvasId);
    
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    
    const { registros } = getState();
    
    // Agrupa registros por mês
    const monthlyData = {};
    
    registros.forEach(reg => {
      if (!reg.data) return;
      
      try {
        const date = new Date(reg.data);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        monthlyData[monthKey] = (monthlyData[monthKey] || 0) + 1;
      } catch (e) {
        // Ignora datas inválidas
      }
    });
    
    // Ordena e pega últimos 6 meses
    const sortedMonths = Object.keys(monthlyData).sort().slice(-6);
    const labels = sortedMonths.map(m => {
      const [year, month] = m.split('-');
      const date = new Date(year, month - 1);
      return date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
    });
    
    const data = sortedMonths.map(m => monthlyData[m]);
    
    // Se não tiver dados, mostra mensagem
    if (labels.length === 0) {
      const ctx = canvas.getContext('2d');
      ctx.font = '14px Inter';
      ctx.fillStyle = COLORS.muted;
      ctx.textAlign = 'center';
      ctx.fillText('Sem dados suficientes', canvas.width / 2, canvas.height / 2);
      return;
    }
    
    const ctx = canvas.getContext('2d');
    chartInstances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Manutenções',
          data: data,
          backgroundColor: 'rgba(0, 212, 255, 0.6)',
          borderColor: COLORS.primary,
          borderWidth: 2,
          borderRadius: 8,
          borderSkipped: false,
          hoverBackgroundColor: COLORS.primary
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            grid: {
              color: 'rgba(255, 255, 255, 0.04)',
              drawBorder: false
            },
            ticks: {
              color: COLORS.muted,
              font: { size: 11 }
            }
          },
          y: {
            beginAtZero: true,
            grid: {
              color: 'rgba(255, 255, 255, 0.04)',
              drawBorder: false
            },
            ticks: {
              color: COLORS.muted,
              font: { size: 11 },
              stepSize: 1
            }
          }
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: COLORS.surface,
            titleColor: COLORS.text,
            bodyColor: COLORS.muted,
            borderColor: COLORS.border,
            borderWidth: 1,
            padding: 12,
            callbacks: {
              label: function(context) {
                return ` Manutenções: ${context.parsed.y}`;
              }
            }
          }
        },
        animation: {
          duration: 800,
          easing: 'easeOutQuart'
        }
      }
    });
  },

  /**
   * Gráfico 3: Tipos de Serviço (Horizontal Bar)
   * Mostra quais tipos de manutenção são mais frequentes
   */
  renderServiceTypes(canvasId) {
    destroyChart(canvasId);
    
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    
    const { registros } = getState();
    
    // Conta por tipo de serviço
    const typeCount = {};
    
    registros.forEach(reg => {
      if (!reg.tipo) return;
      const tipo = reg.tipo.length > 25 ? reg.tipo.substring(0, 25) + '...' : reg.tipo;
      typeCount[tipo] = (typeCount[tipo] || 0) + 1;
    });
    
    // Ordena e pega top 5
    const sortedTypes = Object.entries(typeCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    
    if (sortedTypes.length === 0) {
      const ctx = canvas.getContext('2d');
      ctx.font = '14px Inter';
      ctx.fillStyle = COLORS.muted;
      ctx.textAlign = 'center';
      ctx.fillText('Sem dados de serviços', canvas.width / 2, canvas.height / 2);
      return;
    }
    
    const labels = sortedTypes.map(t => t[0]);
    const data = sortedTypes.map(t => t[1]);
    
    // Cores gradientes
    const backgroundColors = data.map((_, i) => {
      const alpha = 1 - (i * 0.15);
      return `rgba(0, 212, 255, ${alpha})`;
    });
    
    const ctx = canvas.getContext('2d');
    chartInstances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels.reverse(),
        datasets: [{
          label: 'Quantidade',
          data: data.reverse(),
          backgroundColor: backgroundColors.reverse(),
          borderColor: COLORS.primary,
          borderWidth: 1,
          borderRadius: 6,
          borderSkipped: false
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            beginAtZero: true,
            grid: {
              color: 'rgba(255, 255, 255, 0.04)',
              drawBorder: false
            },
            ticks: {
              color: COLORS.muted,
              font: { size: 11 },
              stepSize: 1
            }
          },
          y: {
            grid: {
              display: false
            },
            ticks: {
              color: COLORS.text,
              font: { 
                size: 11,
                weight: '500'
              }
            }
          }
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: COLORS.surface,
            titleColor: COLORS.text,
            bodyColor: COLORS.muted,
            borderColor: COLORS.border,
            borderWidth: 1,
            padding: 12,
            callbacks: {
              label: function(context) {
                return ` ${context.parsed.x} ocorrência(s)`;
              }
            }
          }
        },
        animation: {
          duration: 1000,
          easing: 'easeOutQuart'
        }
      }
    });
  },

  /**
   * Atualiza TODOS os gráficos do dashboard
   * Deve ser chamada quando os dados mudam
   */
  refreshAll() {
    this.renderStatusPie('chart-status-pie');
    this.renderMaintenanceTrend('chart-trend-line');
    this.renderServiceTypes('chart-types-bar');
  },

  /**
   * Destói todos os gráficos (para limpeza)
   */
  destroyAll() {
    Object.keys(chartInstances).forEach(id => destroyChart(id));
  }
};

// Exportação padrão
export default Charts;