/**
 * CoolTrack Pro - Histórico View v5.2
 * Port do mockup do Claude Design (docs/design/prompts/04-historico-redesign.md).
 *
 * Estrutura de render:
 *   - #hist-quickfilters-slot  → pílulas de período + tipo (row scrollable)
 *   - #hist-active-chips-slot  → chips removíveis dos filtros ativos
 *   - #timeline                → hero summary + plan banner + items (.timeline__item)
 *
 * Funções expostas: renderHist, deleteReg
 */

import { Utils } from '../../core/utils.js';
import { getState, findEquip, setState } from '../../core/state.js';
import { Storage } from '../../core/storage.js';
import { Toast } from '../../core/toast.js';
import { goTo } from '../../core/router.js';
import { emptyStateHtml } from '../components/emptyState.js';
import { SavedHighlight } from '../components/onboarding.js';
import {
  cleanupOrphanSignatures,
  getSignatureForRecord,
  SignatureViewerModal,
} from '../components/signature.js';
import { Photos } from '../components/photos.js';
import { withSkeleton } from '../components/skeleton.js';
import { updateHeader } from './dashboard.js';
import { getOperationalStatus } from '../../core/equipmentRules.js';
import { isCachedPlanPlusOrHigher } from '../../core/plans/planCache.js';

// Free: histórico limitado aos últimos 15 dias (apertado pro usuário sentir o
// valor do Plus/Pro sem deixar a conta inútil — cobre 2 semanas de operação).
const HIST_FREE_LIMIT_DAYS = 15;

// Filtros auxiliares persistem na sessão — desaparecem ao fechar o app (intencional).
const HIST_PERIOD_KEY = 'cooltrack-hist-period';
const HIST_TIPO_KEY = 'cooltrack-hist-tipo';

// Períodos suportados. `days: null` = "tudo" (sem corte).
const PERIOD_OPTIONS = [
  { id: 'hoje', label: 'Hoje', days: 0 },
  { id: '7d', label: 'Últimos 7 dias', days: 7 },
  { id: '30d', label: 'Últimos 30 dias', days: 30 },
  { id: 'tudo', label: 'Tudo', days: null },
];

// Tipos rápidos — cobrem o grosso dos registros.
const TIPO_OPTIONS = [
  { id: 'preventiva', label: 'Preventiva', match: ['preventiva'], color: 'cyan' },
  { id: 'corretiva', label: 'Corretiva', match: ['corretiva'], color: 'amber' },
  { id: 'limpeza', label: 'Limpeza', match: ['limpeza'], color: 'teal' },
  { id: 'recarga', label: 'Recarga', match: ['recarga', 'gás', 'gas'], color: 'violet' },
  {
    id: 'inspecao',
    label: 'Inspeção',
    match: ['inspeção', 'inspecao', 'verificação', 'verificacao'],
    color: 'teal',
  },
];

// ──────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────

function toNumber(value) {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatBRL(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatBRLMoney(value) {
  // Variante com 2 casas pra breakdown (R$ 120,00).
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function getPhotoUrl(photo) {
  if (!photo) return null;
  if (typeof photo === 'string') return photo;
  return photo.url || photo.src || photo.dataUrl || null;
}

/**
 * Tempo relativo curto pra contexto de lista. "há 2h", "ontem", "há 3 dias".
 */
function formatRelativeTime(iso) {
  if (!iso) return '';
  const target = new Date(iso);
  if (Number.isNaN(target.getTime())) return '';
  const diffMs = Date.now() - target.getTime();
  if (diffMs < 0) return '';

  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'agora há pouco';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'ontem';
  if (days < 30) return `há ${days} dias`;
  const months = Math.floor(days / 30);
  if (months < 12) return `há ${months} ${months === 1 ? 'mês' : 'meses'}`;
  const years = Math.floor(days / 365);
  return `há ${years} ${years === 1 ? 'ano' : 'anos'}`;
}

/**
 * Normaliza o `tipo` free-form pra uma das categorias coloridas + label.
 */
function getTypePillInfo(tipo) {
  const normalized = (tipo || '').toLowerCase().trim();
  if (!normalized) return { color: 'cyan', label: '—' };

  for (const opt of TIPO_OPTIONS) {
    if (opt.match.some((keyword) => normalized.includes(keyword))) {
      return { color: opt.color, label: tipo };
    }
  }
  return { color: 'cyan', label: tipo };
}

function getExtraFilters() {
  try {
    const period = sessionStorage.getItem(HIST_PERIOD_KEY) || 'tudo';
    const tipo = sessionStorage.getItem(HIST_TIPO_KEY) || '';
    return { period, tipo };
  } catch (_error) {
    return { period: 'tudo', tipo: '' };
  }
}

function setExtraFilter(key, value) {
  try {
    if (value) sessionStorage.setItem(key, value);
    else sessionStorage.removeItem(key);
  } catch (_error) {
    /* sessionStorage indisponível (iOS privacy mode) — ignora silenciosamente */
  }
}

function applyPeriodFilter(list, periodId) {
  const opt = PERIOD_OPTIONS.find((p) => p.id === periodId);
  if (!opt || opt.days === null) return list;

  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - opt.days);
  const cutoffStr = cutoff.toISOString();
  return list.filter((r) => (r.data || '') >= cutoffStr);
}

function applyTipoFilter(list, tipoId) {
  if (!tipoId) return list;
  const opt = TIPO_OPTIONS.find((t) => t.id === tipoId);
  if (!opt) return list;
  return list.filter((r) => {
    const tipoNorm = (r.tipo || '').toLowerCase();
    return opt.match.some((keyword) => tipoNorm.includes(keyword));
  });
}

function getSummaryMetrics(list) {
  const totalServicos = list.length;
  const custoTotal = list.reduce(
    (acc, reg) => acc + toNumber(reg.custoPecas) + toNumber(reg.custoMaoObra),
    0,
  );
  const preventivas = list
    .filter((reg) => (reg.tipo || '').trim().toLowerCase().includes('preventiva'))
    .sort((a, b) => a.data.localeCompare(b.data));

  let mediaDiasPreventiva = null;
  if (preventivas.length >= 2) {
    const intervals = [];
    for (let i = 1; i < preventivas.length; i += 1) {
      const previous = new Date(preventivas[i - 1].data);
      const current = new Date(preventivas[i].data);
      const diffMs = current.getTime() - previous.getTime();
      if (!Number.isNaN(diffMs) && diffMs > 0) intervals.push(diffMs / (1000 * 60 * 60 * 24));
    }
    if (intervals.length) {
      mediaDiasPreventiva = Math.round(
        intervals.reduce((acc, val) => acc + val, 0) / intervals.length,
      );
    }
  }

  return { totalServicos, custoTotal, mediaDiasPreventiva };
}

/**
 * Insights do período — extensão do getSummaryMetrics pra alimentar a segunda
 * linha do summary card. Fica puro / sem DOM pra ser testável.
 *
 * - preventivasCount / corretivasCount: contagem por match no `tipo`.
 * - equipsAtendidos: cardinalidade de equipIds únicos no período.
 * - equipsAtencao: quantos desses equipamentos estão com `status` warn/danger
 *   (status vem de equipmentRules.getOperationalStatus, já populado no state).
 */
export function getHistInsights(list, equipamentos = []) {
  const equipsAtendidosSet = new Set();
  let preventivasCount = 0;
  let corretivasCount = 0;

  list.forEach((reg) => {
    if (reg.equipId) equipsAtendidosSet.add(reg.equipId);
    const tipoNorm = (reg.tipo || '').toLowerCase();
    if (tipoNorm.includes('preventiva')) preventivasCount += 1;
    if (tipoNorm.includes('corretiva')) corretivasCount += 1;
  });

  const equipsById = new Map((equipamentos || []).map((e) => [e.id, e]));
  let equipsAtencao = 0;
  equipsAtendidosSet.forEach((equipId) => {
    const eq = equipsById.get(equipId);
    const status = (eq?.status || '').toLowerCase();
    if (status === 'warn' || status === 'danger') equipsAtencao += 1;
  });

  return {
    preventivasCount,
    corretivasCount,
    equipsAtendidos: equipsAtendidosSet.size,
    equipsAtencao,
  };
}

/**
 * Detecção determinística de equipamentos com alta recorrência — usada no
 * summary card pra sinalizar "olha aqui, tá saindo do padrão". Não chama
 * LLM nem tenta diagnosticar causa: só aponta o fato.
 *
 * @param {Array} list registros já filtrados pelo período ativo
 * @param {number} days janela em dias (default 14)
 * @param {number} threshold mínimo de registros no mesmo equip pra contar (default 3)
 * @returns {Array<{equipId: string, count: number}>}
 */
export function getRecurringEquips(list, days = 14, threshold = 3) {
  if (!Array.isArray(list) || !list.length) return [];
  const cutoffMs = Date.now() - days * 86400000;
  const byEquip = new Map();
  list.forEach((reg) => {
    if (!reg.equipId || !reg.data) return;
    const ts = new Date(reg.data).getTime();
    if (!Number.isFinite(ts) || ts < cutoffMs) return;
    byEquip.set(reg.equipId, (byEquip.get(reg.equipId) || 0) + 1);
  });
  return Array.from(byEquip.entries())
    .filter(([, count]) => count >= threshold)
    .map(([equipId, count]) => ({ equipId, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Converte dias até a próxima manutenção em um estado visual acionável.
 * Usa Utils.daysDiff (dias relativos a hoje, negativo=passado).
 *
 * - vencida: data no passado → vermelho ("Vencida há X dias")
 * - hoje: data é hoje → âmbar ("Vence hoje")
 * - proxima: ≤7 dias no futuro → âmbar ("Vence em X dias")
 * - distante: >7 dias no futuro → neutro ("Próxima em X dias")
 */
export function getProximaStatus(proximaIso) {
  if (!proximaIso) return null;
  const diasRaw = Utils.daysDiff(String(proximaIso).slice(0, 10));
  if (!Number.isFinite(diasRaw)) return null;

  if (diasRaw < 0) {
    const abs = Math.abs(diasRaw);
    return {
      tone: 'danger',
      label: `Vencida há ${abs} ${abs === 1 ? 'dia' : 'dias'}`,
      days: diasRaw,
    };
  }
  if (diasRaw === 0) {
    return { tone: 'warn', label: 'Vence hoje', days: 0 };
  }
  if (diasRaw <= 7) {
    return {
      tone: 'warn',
      label: `Vence em ${diasRaw} ${diasRaw === 1 ? 'dia' : 'dias'}`,
      days: diasRaw,
    };
  }
  return {
    tone: 'neutral',
    label: `Próxima em ${diasRaw} dias`,
    days: diasRaw,
  };
}

/**
 * Label humanizado pro status operacional do equipamento. Prefere o
 * `statusDescricao` já calculado pelo equipmentRules (se existir), senão
 * cai num default curto coerente com o tone.
 */
export function getEquipStatusPill(eq) {
  const status = (eq?.status || '').toLowerCase();
  if (!status) return null;
  const defaultLabels = {
    ok: 'Em dia',
    warn: 'Atenção',
    danger: 'Crítico',
  };
  const tone = status === 'danger' ? 'danger' : status === 'warn' ? 'warn' : 'ok';
  const label =
    (eq?.statusDescricao && String(eq.statusDescricao).trim()) || defaultLabels[tone] || 'Em dia';
  return { tone, label };
}

// ──────────────────────────────────────────────────────────────────────
// Render blocks
// ──────────────────────────────────────────────────────────────────────

/**
 * Linha fina logo abaixo dos KPIs principais com splits tipicos do período.
 * Só renderiza se houve ao menos 1 serviço — evita mostrar zeros sem sentido.
 */
function renderInsightsRow(insights, hasData) {
  if (!hasData) return '';
  const { preventivasCount, corretivasCount, equipsAtendidos, equipsAtencao } = insights;
  const chips = [];
  if (preventivasCount) {
    chips.push(
      `<span class="hist-summary-card__insight-chip hist-summary-card__insight-chip--cyan">
        <b>${preventivasCount}</b> ${preventivasCount === 1 ? 'preventiva' : 'preventivas'}
      </span>`,
    );
  }
  if (corretivasCount) {
    chips.push(
      `<span class="hist-summary-card__insight-chip hist-summary-card__insight-chip--amber">
        <b>${corretivasCount}</b> ${corretivasCount === 1 ? 'corretiva' : 'corretivas'}
      </span>`,
    );
  }
  if (equipsAtendidos) {
    chips.push(
      `<span class="hist-summary-card__insight-chip">
        <b>${equipsAtendidos}</b> ${equipsAtendidos === 1 ? 'equipamento' : 'equipamentos'}
      </span>`,
    );
  }
  if (equipsAtencao > 0) {
    chips.push(
      `<span class="hist-summary-card__insight-chip hist-summary-card__insight-chip--danger">
        <b>${equipsAtencao}</b> em atenção
      </span>`,
    );
  }
  if (!chips.length) return '';
  return `<div class="hist-summary-card__insights" role="list" aria-label="Splits do período">
    ${chips.join('')}
  </div>`;
}

/**
 * Aviso determinístico: N equipamentos acumularam 3+ serviços em 14 dias.
 * Não diagnostica causa (ambiente sujo / filtro etc) — só aponta o fato e
 * oferece filtro rápido quando é um único equipamento.
 */
function renderRecurringAlert(recurring, equipamentos) {
  if (!Array.isArray(recurring) || !recurring.length) return '';
  const equipsById = new Map((equipamentos || []).map((e) => [e.id, e]));
  const n = recurring.length;

  const ctaBtn =
    n === 1
      ? `<button type="button" class="hist-summary-card__recurring-link"
          data-hist-action="hist-filter-equip" data-equip-id="${Utils.escapeAttr(recurring[0].equipId)}">
          Ver serviços →
        </button>`
      : '';

  const detailText =
    n === 1
      ? `<b>${Utils.escapeHtml(equipsById.get(recurring[0].equipId)?.nome || 'Um equipamento')}</b> acumulou <b>${recurring[0].count}</b> serviços nos últimos 14 dias.`
      : `<b>${n}</b> equipamentos acumularam 3+ serviços nos últimos 14 dias.`;

  return `<div class="hist-summary-card__recurring" role="status" aria-live="polite">
    <span class="hist-summary-card__recurring-ic" aria-hidden="true">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>
      </svg>
    </span>
    <span class="hist-summary-card__recurring-text">${detailText}</span>
    ${ctaBtn}
  </div>`;
}

function renderSummaryCard(
  list,
  { filtered, activeFilterCount, equipamentos = [], recurring = [] },
) {
  const { totalServicos, custoTotal, mediaDiasPreventiva } = getSummaryMetrics(list);
  const insights = getHistInsights(list, equipamentos);
  const hasData = totalServicos > 0;
  const mediaLabel = mediaDiasPreventiva !== null ? `${mediaDiasPreventiva}` : '—';
  const mediaSuffix =
    mediaDiasPreventiva !== null ? ` <span class="hist-summary-card__kpi-unit">dias</span>` : '';

  const pillLabel = filtered
    ? `${totalServicos} de ${activeFilterCount > 1 ? 'muitos' : '?'} · filtros ativos`
    : 'Insights do período';

  const custoClass = hasData
    ? 'hist-summary-card__kpi-value hist-summary-card__kpi-value--mono'
    : 'hist-summary-card__kpi-value hist-summary-card__kpi-value--mono hist-summary-card__kpi-value--muted';

  const mediaClass =
    hasData && mediaDiasPreventiva !== null
      ? 'hist-summary-card__kpi-value'
      : 'hist-summary-card__kpi-value hist-summary-card__kpi-value--muted';

  const ctaLabel = filtered ? 'Gerar Relatório desta seleção' : 'Gerar Relatório';

  return `<section class="hist-summary-card" aria-label="Resumo do período">
    <div class="hist-summary-card__orbs" aria-hidden="true">
      <div class="hist-summary-card__orb hist-summary-card__orb--tl"></div>
      <div class="hist-summary-card__orb hist-summary-card__orb--br"></div>
    </div>
    <div class="hist-summary-card__pill">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        ${
          filtered
            ? '<path d="M3 5h18M6 12h12M10 19h4"/>'
            : '<path d="M3 20V10M9 20V4M15 20v-7M21 20v-4"/>'
        }
      </svg>
      ${Utils.escapeHtml(pillLabel)}
    </div>
    <div class="hist-summary-card__kpis">
      <div class="hist-summary-card__kpi">
        <div class="hist-summary-card__kpi-value">${totalServicos}</div>
        <div class="hist-summary-card__kpi-label">${filtered ? 'Serviços filtrados' : 'Serviços no período'}</div>
      </div>
      <div class="hist-summary-card__kpi-sep" aria-hidden="true">::</div>
      <div class="hist-summary-card__kpi">
        <div class="${custoClass}">${formatBRL(custoTotal)}</div>
        <div class="hist-summary-card__kpi-label">${hasData ? 'Peças + mão de obra' : 'Nenhum custo'}</div>
      </div>
      <div class="hist-summary-card__kpi-sep" aria-hidden="true">::</div>
      <div class="hist-summary-card__kpi">
        <div class="${mediaClass}">${mediaLabel}${mediaSuffix}</div>
        <div class="hist-summary-card__kpi-label">${
          mediaDiasPreventiva !== null ? 'Intervalo médio preventivas' : 'Sem dados ainda'
        }</div>
      </div>
    </div>
    ${renderInsightsRow(insights, hasData)}
    ${renderRecurringAlert(recurring, equipamentos)}
    <div class="hist-summary-card__divider" aria-hidden="true"></div>
    <div class="hist-summary-card__upsell">
      <span class="hist-summary-card__upsell-ic" aria-hidden="true">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 17 9 11l4 4 8-8"/><path d="M14 7h7v7"/>
        </svg>
      </span>
      <span>Economize 3h/semana com relatórios automáticos</span>
      <button type="button" class="hist-summary-card__upsell-link" data-hist-action="hist-pricing-link">
        Ver planos →
      </button>
    </div>
    <button type="button" class="hist-summary-card__cta" data-nav="relatorio">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z"/>
        <path d="M14 3v6h6"/><path d="M8 13h8M8 17h5"/>
      </svg>
      ${Utils.escapeHtml(ctaLabel)}
    </button>
  </section>`;
}

function renderQuickFilters({ period, tipo }) {
  const periodPills = PERIOD_OPTIONS.map((opt) => {
    const active = period === opt.id || (!period && opt.id === 'tudo');
    return `<button type="button"
        class="hist-quickfilter${active ? ' is-active' : ''}"
        data-hist-action="hist-filter-period"
        data-period="${opt.id}"
        aria-pressed="${active ? 'true' : 'false'}">
        ${Utils.escapeHtml(opt.label)}
      </button>`;
  }).join('');

  const tipoPills = TIPO_OPTIONS.map((opt) => {
    const active = tipo === opt.id;
    return `<button type="button"
        class="hist-quickfilter hist-quickfilter--${opt.color}${active ? ' is-active' : ''}"
        data-hist-action="hist-filter-tipo"
        data-tipo-id="${opt.id}"
        aria-pressed="${active ? 'true' : 'false'}">
        <span class="hist-quickfilter__dot" aria-hidden="true"></span>
        ${Utils.escapeHtml(opt.label)}
      </button>`;
  }).join('');

  return `<div class="hist-quickfilters" role="toolbar" aria-label="Filtros rápidos">
    ${periodPills}
    <div class="hist-quickfilters__sep" aria-hidden="true"></div>
    ${tipoPills}
  </div>`;
}

function renderActiveFilterChips(filters) {
  const chips = [];

  if (filters.setorLabel) {
    chips.push({
      key: 'Setor',
      value: filters.setorLabel,
      clearAction: 'hist-clear-setor',
    });
  }

  if (filters.equipLabel) {
    chips.push({
      key: 'Equipamento',
      value: filters.equipLabel,
      clearAction: 'hist-clear-equip',
    });
  }

  const tipoOpt = TIPO_OPTIONS.find((t) => t.id === filters.tipo);
  if (tipoOpt) {
    chips.push({
      key: 'Tipo',
      value: tipoOpt.label,
      clearAction: 'hist-clear-tipo',
    });
  }

  const periodOpt = PERIOD_OPTIONS.find((p) => p.id === filters.period);
  if (periodOpt && periodOpt.id !== 'tudo') {
    chips.push({
      key: 'Período',
      value: periodOpt.label,
      clearAction: 'hist-clear-period',
    });
  }

  if (filters.busca) {
    chips.push({
      key: 'Busca',
      value: `"${filters.busca}"`,
      clearAction: 'hist-clear-busca',
    });
  }

  if (!chips.length) return '';

  const chipHtml = chips
    .map(
      (c) =>
        `<span class="hist-active-chip">
          <b>${Utils.escapeHtml(c.key)}:</b> ${Utils.escapeHtml(c.value)}
          <button type="button" class="hist-active-chip__x"
            data-hist-action="${c.clearAction}"
            aria-label="Remover filtro ${Utils.escapeAttr(c.key)}: ${Utils.escapeAttr(c.value)}">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18"/>
            </svg>
          </button>
        </span>`,
    )
    .join('');

  return `<div class="hist-active-chips" role="status" aria-live="polite">
    <span class="hist-active-chips__label">Filtros ativos</span>
    ${chipHtml}
    <button type="button" class="hist-active-chips__clear"
      data-hist-action="hist-clear-all">Limpar tudo</button>
  </div>`;
}

function renderPhotoStrip(fotos) {
  if (!Array.isArray(fotos) || !fotos.length) return '';
  const urls = fotos.map(getPhotoUrl).filter(Boolean);
  if (!urls.length) return '';

  const visibleCount = Math.min(3, urls.length);
  const extra = urls.length - visibleCount;

  const thumbs = urls
    .slice(0, visibleCount)
    .map(
      (url, idx) =>
        `<button type="button" class="timeline__item__photos-thumb"
          data-hist-action="hist-open-photo" data-photo-url="${Utils.escapeAttr(url)}"
          aria-label="Abrir foto ${idx + 1}">
          <img src="${Utils.escapeAttr(url)}" alt="Foto ${idx + 1} do serviço" loading="lazy"/>
        </button>`,
    )
    .join('');

  const more = extra
    ? `<span class="timeline__item__photos-more" aria-label="Mais ${extra} fotos">+${extra}</span>`
    : '';

  return `<div class="timeline__item__photos" aria-label="Fotos do serviço">
    ${thumbs}${more}
  </div>`;
}

function renderSignatureBlock(registro) {
  if (!registro?.assinatura) return '';

  const hasLocal = Boolean(getSignatureForRecord(registro.id));

  if (!hasLocal) {
    return `<div class="hist-signature-unavailable"
        title="Assinatura armazenada localmente no aparelho em que foi coletada — não disponível neste dispositivo"
        role="status">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="m12 19 7-7 3 3-7 7-3-3Z"/>
          <path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18Z"/>
          <path d="m2 2 7.5 7.5"/><circle cx="11" cy="11" r="2"/>
        </svg>
        Assinatura não disponível neste dispositivo
      </div>`;
  }

  const dataUrl = getSignatureForRecord(registro.id);
  const clienteNome = registro.clienteNome?.trim() || '';
  const ariaLabel = clienteNome
    ? `Ver assinatura de ${clienteNome} em tamanho grande`
    : 'Ver assinatura do cliente em tamanho grande';
  return `<button type="button" class="hist-signature-preview"
      data-hist-action="hist-view-signature" data-id="${Utils.escapeAttr(registro.id)}"
      aria-label="${Utils.escapeAttr(ariaLabel)}">
      <span class="hist-signature-preview__canvas">
        <img src="${Utils.escapeAttr(dataUrl)}"
          alt="Assinatura registrada pelo cliente${clienteNome ? ' ' + Utils.escapeAttr(clienteNome) : ''}" />
      </span>
      <span class="hist-signature-preview__label">
        <span class="hist-signature-preview__label-ic" aria-hidden="true">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
            <path d="m12 19 7-7 3 3-7 7-3-3Z"/>
            <path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18Z"/>
            <path d="m2 2 7.5 7.5"/><circle cx="11" cy="11" r="2"/>
          </svg>
        </span>
        <span><b>Assinado pelo cliente</b></span>
        <span class="hist-signature-preview__zoom" aria-hidden="true">toque pra ampliar</span>
      </span>
    </button>`;
}

function renderTimelineItem(r, { isFirst, equipamentos, setoresById, currentFilterEquipId = '' }) {
  const eq = equipamentos.find((e) => e.id === r.equipId) || findEquip(r.equipId);
  const setorNome = eq?.setorId ? setoresById.get(eq.setorId)?.nome || '' : '';
  const safeStatus = Utils.safeStatus(r.status);
  const dotMod = safeStatus !== 'ok' ? ` timeline__dot--${safeStatus}` : '';
  const itemStatusMod =
    safeStatus === 'warn' || safeStatus === 'danger' ? ` timeline__item--${safeStatus}` : '';
  const custoPecas = toNumber(r.custoPecas);
  const custoMao = toNumber(r.custoMaoObra);
  const custoTotal = custoPecas + custoMao;
  const isToday = r.data.slice(0, 10) === Utils.localDateString();
  const typePill = getTypePillInfo(r.tipo);
  const relTime = formatRelativeTime(r.data);
  const prioridade = (r.prioridade || '').toLowerCase();
  const showPrioridadePill = prioridade === 'alta' || prioridade === 'baixa';
  const prioridadeColor = prioridade === 'alta' ? 'red' : 'cyan';
  const prioridadeLabel = prioridade === 'alta' ? 'Alta prioridade' : 'Baixa prioridade';

  // Título do serviço: usa o próprio tipo (free-form) como heading.
  const serviceTitle = (r.tipo || 'Serviço').trim();

  // Tag do setor em maiúsculas compactas (ex: "SALA 1"). Evita tag vazia.
  const setorTag = setorNome ? setorNome.slice(0, 12).toUpperCase().replace(/\s+/g, ' ') : '';

  const equipTag = (eq?.tag || eq?.local || '').trim();

  // Pill do status operacional do equipamento — só aparece em warn/danger pra
  // manter alto sinal. Quando está ok, o ponto verde da timeline já comunica.
  const equipStatusPill = getEquipStatusPill(eq);
  const showEquipStatusPill = equipStatusPill && equipStatusPill.tone !== 'ok';
  const equipStatusColor = equipStatusPill?.tone === 'danger' ? 'red' : 'amber';

  const headPills = [
    isToday ? `<span class="hist-pill hist-pill--success">Hoje</span>` : '',
    showEquipStatusPill
      ? `<span class="hist-pill hist-pill--${equipStatusColor}"
          title="${Utils.escapeAttr('Status atual do equipamento')}">
          ${Utils.escapeHtml(equipStatusPill.label)}
        </span>`
      : '',
    showPrioridadePill
      ? `<span class="hist-pill hist-pill--${prioridadeColor}">${prioridadeLabel}</span>`
      : '',
    `<span class="hist-pill hist-pill--${typePill.color}">${Utils.escapeHtml(typePill.label)}</span>`,
  ]
    .filter(Boolean)
    .join('');

  // Meta chunks em ordem: técnico · peças · custo · próxima
  const metaChunks = [];
  if (r.tecnico) {
    metaChunks.push(`<span class="meta-chunk">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>
      </svg>${Utils.escapeHtml(r.tecnico)}</span>`);
  }
  if (r.pecas) {
    metaChunks.push(`<span class="meta-chunk">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M21 8 12 3 3 8l9 5 9-5Z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/>
      </svg>${Utils.escapeHtml(r.pecas)}</span>`);
  }
  if (custoTotal > 0) {
    const hasBreakdown = custoPecas > 0 && custoMao > 0;
    const breakdown = hasBreakdown
      ? ` <span class="meta-details">(peças ${formatBRLMoney(custoPecas)} · mão ${formatBRLMoney(custoMao)})</span>`
      : '';
    metaChunks.push(
      `<span class="meta-chunk meta-mono">Total: <span class="meta-cyan">${formatBRL(custoTotal)}</span>${breakdown}</span>`,
    );
  }
  if (r.proxima) {
    // 3 estados acionáveis: vencida (passado), vence logo (≤7d), em dia.
    // Mantém a data formatada no title pra quem quiser conferir por tooltip.
    const proxInfo = getProximaStatus(r.proxima) || {
      tone: 'neutral',
      label: `Próxima: ${Utils.formatDate(r.proxima)}`,
    };
    const toneCls =
      proxInfo.tone === 'danger'
        ? 'meta-danger'
        : proxInfo.tone === 'warn'
          ? 'meta-warn'
          : 'meta-neutral';
    metaChunks.push(`<span class="meta-chunk" title="${Utils.escapeAttr('Próxima: ' + Utils.formatDate(r.proxima))}">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="3" y="5" width="18" height="16" rx="2"/>
        <path d="M8 3v4M16 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01"/>
      </svg><span class="${toneCls}">${Utils.escapeHtml(proxInfo.label)}</span></span>`);
  }

  const metaHtml = metaChunks.length
    ? `<div class="timeline__item__meta">${metaChunks.join('<span class="meta-sep" aria-hidden="true">·</span>')}</div>`
    : '';

  const photoStrip = renderPhotoStrip(r.fotos);
  const signatureBlock = renderSignatureBlock(r);

  // Atalho "Ver tudo deste equipamento" — só faz sentido se o filtro de
  // equipamento NÃO estiver ativo (e o registro realmente tiver equipId).
  // Evita adicionar "modo agrupar" separado: um clique leva o técnico pra
  // timeline filtrada pelo mesmo equip e ele vê o histórico inteiro.
  const showVerTudoLink = r.equipId && currentFilterEquipId !== r.equipId;
  const verTudoLink = showVerTudoLink
    ? `<button type="button" class="timeline__item__focus-equip"
        data-hist-action="hist-filter-equip" data-equip-id="${Utils.escapeAttr(r.equipId)}"
        aria-label="Ver todos os serviços deste equipamento">
        Ver tudo deste equipamento →
      </button>`
    : '';

  return `<article class="timeline__item${isFirst ? ' timeline__item--latest' : ''}${itemStatusMod}"
      role="listitem" data-reg-id="${Utils.escapeAttr(r.id)}">
    <span class="timeline__dot${dotMod}" aria-hidden="true"></span>
    <div class="timeline__item__main">
      ${isFirst ? '<span class="timeline__item__latest-pill">• Mais recente</span>' : ''}
      <div class="timeline__item__header">
        <span class="timeline__item__date">${Utils.escapeHtml(Utils.formatDatetime(r.data))}</span>
        ${relTime ? `<span class="timeline__item__rel">(${Utils.escapeHtml(relTime)})</span>` : ''}
        <div class="timeline__item__header-spacer"></div>
        ${headPills}
      </div>
      <h3 class="timeline__item__service">${Utils.escapeHtml(serviceTitle)}</h3>
      <div class="timeline__item__equipment">
        <span>${Utils.escapeHtml(eq?.nome ?? '—')}</span>
        ${
          setorNome || equipTag
            ? `<span class="timeline__item__equipment-sep" aria-hidden="true">·</span>`
            : ''
        }
        ${setorNome ? `<span class="timeline__item__equipment-tag">${Utils.escapeHtml(setorNome)}</span>` : ''}
        ${setorTag ? `<span class="hist-pill hist-pill--neutral">${Utils.escapeHtml(setorTag)}</span>` : ''}
      </div>
      ${r.obs ? `<p class="timeline__item__obs">${Utils.escapeHtml(r.obs)}</p>` : ''}
      ${metaHtml}
      ${photoStrip}
      ${signatureBlock}
      ${verTudoLink}
    </div>
    <div class="hist-item-actions">
      <button type="button" data-action="edit-reg" data-id="${Utils.escapeAttr(r.id)}"
        aria-label="Editar registro">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"/>
        </svg>
      </button>
      <button type="button" class="is-danger" data-action="delete-reg"
        data-id="${Utils.escapeAttr(r.id)}"
        aria-label="Excluir registro de ${Utils.escapeAttr(r.tipo)}">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"/>
        </svg>
      </button>
    </div>
  </article>`;
}

/** Popula o select de setor e controla sua visibilidade. */
function syncSetorSelect(currentSetorId) {
  const { setores, equipamentos } = getState();
  const el = Utils.getEl('hist-setor');
  if (!el) return;

  el.style.display = setores.length ? '' : 'none';
  if (!setores.length) return;

  const prev = currentSetorId ?? el.value;
  el.textContent = '';
  const defOpt = document.createElement('option');
  defOpt.value = '';
  defOpt.textContent = 'Todos os setores';
  el.appendChild(defOpt);

  const setoresComDados = new Set(equipamentos.map((e) => e.setorId).filter(Boolean));
  setores.forEach((s) => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.nome + (setoresComDados.has(s.id) ? '' : ' (sem registros)');
    el.appendChild(opt);
  });

  if (prev) el.value = prev;
}

// ──────────────────────────────────────────────────────────────────────
// Public: renderHist
// ──────────────────────────────────────────────────────────────────────

export function renderHist() {
  const { registros, equipamentos, setores } = getState();
  cleanupOrphanSignatures(registros.map((r) => r.id));

  syncSetorSelect();

  const busca = Utils.getVal('hist-busca').toLowerCase();
  const filtEq = Utils.getVal('hist-equip');
  const filtSetor = Utils.getVal('hist-setor');
  const { period, tipo } = getExtraFilters();

  const equipIdsNoSetor = filtSetor
    ? new Set(equipamentos.filter((e) => e.setorId === filtSetor).map((e) => e.id))
    : null;

  // Plano Free: limita histórico aos últimos HIST_FREE_LIMIT_DAYS dias (15).
  // Plus e Pro têm histórico completo — Plus é o menor tier que destrava isso.
  const hasFullHistoryAccess = isCachedPlanPlusOrHigher();
  let histLimitedByPlan = false;
  let list = [...registros].sort((a, b) => b.data.localeCompare(a.data));

  if (!hasFullHistoryAccess) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - HIST_FREE_LIMIT_DAYS);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    const totalBeforeFilter = list.length;
    list = list.filter((r) => r.data >= cutoffStr);
    histLimitedByPlan = list.length < totalBeforeFilter;
  }

  if (filtSetor) list = list.filter((r) => equipIdsNoSetor.has(r.equipId));
  if (filtEq) list = list.filter((r) => r.equipId === filtEq);
  list = applyPeriodFilter(list, period);
  list = applyTipoFilter(list, tipo);
  if (busca)
    list = list.filter((r) => {
      const eq = findEquip(r.equipId);
      return (
        r.obs.toLowerCase().includes(busca) ||
        r.tipo.toLowerCase().includes(busca) ||
        (eq?.nome || '').toLowerCase().includes(busca) ||
        (r.tecnico || '').toLowerCase().includes(busca)
      );
    });

  const el = Utils.getEl('timeline');
  if (!el) return;

  const countEl = Utils.getEl('hist-count');
  if (countEl) {
    countEl.textContent = list.length
      ? `${list.length} registro${list.length !== 1 ? 's' : ''}`
      : 'Sem registros';
  }

  const scrollRoot = document.scrollingElement || document.documentElement;
  const prevScrollTop = scrollRoot ? scrollRoot.scrollTop : window.scrollY;

  const activeFilters = {
    period,
    tipo,
    busca,
    setorLabel: filtSetor ? setores.find((s) => s.id === filtSetor)?.nome || '' : '',
    equipLabel: filtEq ? equipamentos.find((e) => e.id === filtEq)?.nome || '' : '',
  };
  const activeFilterCount = [
    activeFilters.setorLabel,
    activeFilters.equipLabel,
    activeFilters.tipo,
    activeFilters.period !== 'tudo' ? activeFilters.period : '',
    activeFilters.busca,
  ].filter(Boolean).length;

  // Slots fora do #timeline: mount quickfilters e chips nos seus slots dedicados.
  const quickSlot = Utils.getEl('hist-quickfilters-slot');
  if (quickSlot) quickSlot.innerHTML = renderQuickFilters({ period, tipo });

  const chipsSlot = Utils.getEl('hist-active-chips-slot');
  if (chipsSlot) chipsSlot.innerHTML = renderActiveFilterChips(activeFilters);

  const setoresById = new Map(setores.map((s) => [s.id, s]));

  const recurring = getRecurringEquips(list);

  const renderTimeline = () => {
    const summaryCard = renderSummaryCard(list, {
      filtered: activeFilterCount > 0,
      activeFilterCount,
      equipamentos,
      recurring,
    });

    // Banner só aparece pro Free — Plus e Pro já têm histórico completo.
    // CTA aponta pra Plus (menor tier que destrava) em vez de Pro.
    const planLimitBanner = !hasFullHistoryAccess
      ? `<div class="hist-plan-limit-banner">
           <span class="hist-plan-limit-banner__ic" aria-hidden="true">
             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
               <rect x="4" y="11" width="16" height="10" rx="2"/>
               <path d="M8 11V7a4 4 0 0 1 8 0v4"/>
             </svg>
           </span>
           <span>${
             histLimitedByPlan
               ? `Exibindo apenas os últimos <b>${HIST_FREE_LIMIT_DAYS} dias</b> de histórico.`
               : `Plano Free · histórico limitado aos últimos <b>${HIST_FREE_LIMIT_DAYS} dias</b>.`
           }</span>
           <button type="button" class="hist-plan-limit-banner__link"
             data-hist-action="hist-pricing-link">Ver plano Plus →</button>
         </div>`
      : '';

    const preList = `${summaryCard}${planLimitBanner}`;

    if (!list.length) {
      el.innerHTML =
        busca || filtEq || filtSetor || period !== 'tudo' || tipo
          ? `${preList}${emptyStateHtml({
              icon: '🔍',
              title: 'Nenhum resultado para esse filtro',
              description: 'Tente outro termo ou remova um filtro acima.',
            })}`
          : `${preList}${emptyStateHtml({
              variant: 'engaging',
              ariaLabel: 'Histórico vazio',
              icon: '📋',
              title: 'Nenhum serviço registrado ainda',
              description:
                'Cada serviço registrado vira um relatório profissional pronto para o cliente. Técnicos que registram aqui economizam em média 3 horas por semana.',
              cta: {
                label: 'Registrar meu primeiro serviço →',
                nav: 'registro',
              },
              microcopy: 'Leva menos de 2 minutos',
            })}`;
      attachFilterHandlers(el);
      return;
    }

    const itemsHtml = list
      .map((r, idx) =>
        renderTimelineItem(r, {
          isFirst: idx === 0,
          equipamentos,
          setoresById,
          currentFilterEquipId: filtEq || '',
        }),
      )
      .join('');

    el.innerHTML = `${preList}<div class="timeline">${itemsHtml}</div>`;

    attachFilterHandlers(el);

    if (prevScrollTop > 0) {
      requestAnimationFrame(() => {
        if (scrollRoot) scrollRoot.scrollTop = prevScrollTop;
        else window.scrollTo(0, prevScrollTop);
      });
    }

    SavedHighlight.applyIfPending();
  };

  withSkeleton(
    el,
    { enabled: true, variant: 'timeline', count: Math.min(Math.max(list.length, 3), 5) },
    renderTimeline,
  );
}

// ──────────────────────────────────────────────────────────────────────
// Handlers (re-attach em cada render)
// ──────────────────────────────────────────────────────────────────────

function attachFilterHandlers(container) {
  const { registros, equipamentos } = getState();

  // Handlers vivem em múltiplos containers agora (slots fora do #timeline).
  // Usamos document.querySelectorAll pra capturar tudo — é seguro porque cada
  // re-render substitui o innerHTML dos slots, removendo listeners antigos.
  const roots = [
    container,
    Utils.getEl('hist-quickfilters-slot'),
    Utils.getEl('hist-active-chips-slot'),
  ].filter(Boolean);

  const each = (selector, fn) => {
    roots.forEach((root) => {
      root.querySelectorAll(selector).forEach(fn);
    });
  };

  // CTA aponta pra Plus (menor tier que destrava histórico completo),
  // alinhando com o texto do banner.
  each('[data-hist-action="hist-pricing-link"]', (btn) =>
    btn.addEventListener('click', () => goTo('pricing', { highlightPlan: 'plus' })),
  );

  each('[data-hist-action="hist-filter-period"]', (btn) =>
    btn.addEventListener('click', () => {
      const pid = btn.dataset.period;
      setExtraFilter(HIST_PERIOD_KEY, pid === 'tudo' ? '' : pid);
      renderHist();
    }),
  );

  each('[data-hist-action="hist-filter-tipo"]', (btn) =>
    btn.addEventListener('click', () => {
      const current = getExtraFilters().tipo;
      const next = current === btn.dataset.tipoId ? '' : btn.dataset.tipoId;
      setExtraFilter(HIST_TIPO_KEY, next);
      renderHist();
    }),
  );

  each('[data-hist-action="hist-clear-period"]', (btn) =>
    btn.addEventListener('click', () => {
      setExtraFilter(HIST_PERIOD_KEY, '');
      renderHist();
    }),
  );

  each('[data-hist-action="hist-clear-tipo"]', (btn) =>
    btn.addEventListener('click', () => {
      setExtraFilter(HIST_TIPO_KEY, '');
      renderHist();
    }),
  );

  // "Ver tudo deste equipamento" (link no rodapé do item) e "Ver serviços"
  // (CTA do alerta de recorrência no summary) caem no mesmo handler — ambos
  // aplicam o filtro de equipamento e re-renderizam.
  each('[data-hist-action="hist-filter-equip"]', (btn) =>
    btn.addEventListener('click', () => {
      const equipId = btn.dataset.equipId || '';
      if (!equipId) return;
      const sel = Utils.getEl('hist-equip');
      if (sel) sel.value = equipId;
      renderHist();
    }),
  );

  each('[data-hist-action="hist-clear-setor"]', (btn) =>
    btn.addEventListener('click', () => {
      const sel = Utils.getEl('hist-setor');
      if (sel) sel.value = '';
      renderHist();
    }),
  );

  each('[data-hist-action="hist-clear-equip"]', (btn) =>
    btn.addEventListener('click', () => {
      const sel = Utils.getEl('hist-equip');
      if (sel) sel.value = '';
      renderHist();
    }),
  );

  each('[data-hist-action="hist-clear-busca"]', (btn) =>
    btn.addEventListener('click', () => {
      const input = Utils.getEl('hist-busca');
      if (input) input.value = '';
      renderHist();
    }),
  );

  each('[data-hist-action="hist-clear-all"]', (btn) =>
    btn.addEventListener('click', () => {
      setExtraFilter(HIST_PERIOD_KEY, '');
      setExtraFilter(HIST_TIPO_KEY, '');
      const setorSel = Utils.getEl('hist-setor');
      if (setorSel) setorSel.value = '';
      const equipSel = Utils.getEl('hist-equip');
      if (equipSel) equipSel.value = '';
      const buscaInput = Utils.getEl('hist-busca');
      if (buscaInput) buscaInput.value = '';
      renderHist();
    }),
  );

  each('[data-hist-action="hist-open-photo"]', (btn) =>
    btn.addEventListener('click', () => {
      const url = btn.dataset.photoUrl;
      if (url) Photos.openLightbox(url);
    }),
  );

  each('[data-hist-action="hist-view-signature"]', (btn) =>
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      if (!id) return;
      const registro = registros.find((r) => r.id === id);
      if (!registro) return;
      const eq = equipamentos.find((e) => e.id === registro.equipId);
      SignatureViewerModal.open(registro, { equipNome: eq?.nome || '—' });
    }),
  );
}

// ──────────────────────────────────────────────────────────────────────
// Public: deleteReg
// ──────────────────────────────────────────────────────────────────────

export function deleteReg(id) {
  Storage.markRegistroDeleted(id);
  setState((prev) => {
    const reg = prev.registros.find((r) => r.id === id);
    const regs = prev.registros.filter((r) => r.id !== id);
    if (!reg) return { ...prev, registros: regs };
    const remainingEqRegs = regs
      .filter((r) => r.equipId === reg.equipId)
      .sort((a, b) => b.data.localeCompare(a.data));
    const last = remainingEqRegs[0] || null;
    const equips = prev.equipamentos.map((eq) => {
      if (eq.id !== reg.equipId) return eq;
      const nextStatus = getOperationalStatus({
        status: last?.status || '',
        lastStatus: last?.status || '',
        daysToNext: last?.proxima ? Utils.daysDiff(last.proxima.slice(0, 10)) : null,
        ultimoRegistro: last,
      });
      return {
        ...eq,
        status: nextStatus.uiStatus === 'unknown' ? eq.status || 'ok' : nextStatus.uiStatus,
        statusDescricao: nextStatus.label,
      };
    });
    return { ...prev, registros: regs, equipamentos: equips };
  });
  localStorage.removeItem(`cooltrack-sig-${id}`);
  renderHist();
  updateHeader();
  Toast.warning('Registro removido do histórico.');
}
