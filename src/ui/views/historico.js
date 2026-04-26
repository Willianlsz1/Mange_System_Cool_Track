/**
 * CoolTrack Pro - Histórico View v5.2
 * Port do mockup do Claude Design (docs/design/prompts/04-histórico-redesign.md).
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
import { HistoricoFiltersSheet } from '../components/historicoFiltersSheet.js';
import { updateHeader } from './dashboard.js';
import { getOperationalStatus } from '../../core/equipmentRules.js';

// Histórico é parte do core do produto e não tem corte por data em nenhum
// plano — Free, Plus e Pro veem todos os registros salvos. Outros limites
// do Free (equipamentos, PDFs, WhatsApp share) permanecem via plan cache.

// Filtros auxiliares persistem na sessão — desaparecem ao fechar o app (intencional).
const HIST_PERIOD_KEY = 'cooltrack-hist-period';
const HIST_TIPO_KEY = 'cooltrack-hist-tipo';
const HIST_SUMMARY_COLLAPSED_KEY = 'cooltrack-hist-summary-collapsed';

// Helper de UA mobile-ish para decidir default colapsado.
// Não confiamos só em viewport — touch + viewport <= 720px = mobile.
function isMobileViewport() {
  if (typeof window === 'undefined') return false;
  try {
    return window.matchMedia('(max-width: 720px)').matches;
  } catch {
    return (window.innerWidth || 0) <= 720;
  }
}

function getSummaryCollapsedDefault() {
  return isMobileViewport();
}

function isSummaryCollapsed() {
  try {
    const raw = sessionStorage.getItem(HIST_SUMMARY_COLLAPSED_KEY);
    if (raw === '1') return true;
    if (raw === '0') return false;
    return getSummaryCollapsedDefault();
  } catch {
    return getSummaryCollapsedDefault();
  }
}

function setSummaryCollapsed(value) {
  try {
    sessionStorage.setItem(HIST_SUMMARY_COLLAPSED_KEY, value ? '1' : '0');
  } catch {
    /* sessionStorage indisponivel: ignora */
  }
}

// ──────────────────────────────────────────────────────────────────────
// URL persistence dos filtros
// ──────────────────────────────────────────────────────────────────────

// Mapa de query param -> id do select/input no DOM. Usamos URLSearchParams
// como source-of-truth on-load (deep linking) e replaceState on-change
// (mantem URL atualizada sem inflar o history).
const URL_PARAM_KEYS = {
  busca: 'q',
  setor: 'setor',
  equip: 'equip',
  periodo: 'periodo',
  tipo: 'tipo',
};

let _urlFiltersHydrated = false;
// Filtro "Cliente: X" vindo da view /clientes -> "Ver serviços". Reset toda
// vez que o user limpa via chip, ou navega pra histórico sem clienteId nos
// query params. Persistente apenas dentro da sessão (não na URL).
let _clienteFilter = { id: null, nome: null };

function readUrlFilters() {
  if (typeof window === 'undefined') return {};
  try {
    const sp = new URLSearchParams(window.location.search);
    return {
      busca: sp.get(URL_PARAM_KEYS.busca) || '',
      setor: sp.get(URL_PARAM_KEYS.setor) || '',
      equip: sp.get(URL_PARAM_KEYS.equip) || '',
      periodo: sp.get(URL_PARAM_KEYS.periodo) || '',
      tipo: sp.get(URL_PARAM_KEYS.tipo) || '',
    };
  } catch {
    return {};
  }
}

// Aplica filtros vindos da URL nos inputs/selects/sessionStorage. So roda
// uma vez por sessão do view (flag _urlFiltersHydrated). Apos hydrate,
// sessionStorage e DOM viram source-of-truth e a URL é atualizada por write.
function hydrateFiltersFromUrl() {
  if (_urlFiltersHydrated) return;
  _urlFiltersHydrated = true;
  const f = readUrlFilters();
  if (!Object.values(f).some(Boolean)) return;

  const buscaEl = document.getElementById('hist-busca');
  if (buscaEl && f.busca) buscaEl.value = f.busca;

  const setorEl = document.getElementById('hist-setor');
  if (setorEl && f.setor) setorEl.value = f.setor;

  const equipEl = document.getElementById('hist-equip');
  if (equipEl && f.equip) equipEl.value = f.equip;

  if (f.periodo) setExtraFilter(HIST_PERIOD_KEY, f.periodo === 'tudo' ? '' : f.periodo);
  if (f.tipo) setExtraFilter(HIST_TIPO_KEY, f.tipo);
}

function writeFiltersToUrl({ busca, setor, equip, periodo, tipo }) {
  if (typeof window === 'undefined') return;
  try {
    const sp = new URLSearchParams(window.location.search);
    const setOrDelete = (key, value) => {
      if (value) sp.set(key, value);
      else sp.delete(key);
    };
    setOrDelete(URL_PARAM_KEYS.busca, busca);
    setOrDelete(URL_PARAM_KEYS.setor, setor);
    setOrDelete(URL_PARAM_KEYS.equip, equip);
    setOrDelete(URL_PARAM_KEYS.periodo, periodo === 'tudo' ? '' : periodo);
    setOrDelete(URL_PARAM_KEYS.tipo, tipo);
    const qs = sp.toString();
    const newUrl = window.location.pathname + (qs ? '?' + qs : '') + (window.location.hash || '');
    if (newUrl !== window.location.pathname + window.location.search + window.location.hash) {
      window.history.replaceState(null, '', newUrl);
    }
  } catch {
    /* não crucial: se replaceState falhar, app segue funcionando sem deep link */
  }
}

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
    match: ['inspeção', 'inspecao', 'verificação', 'verificação'],
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
 * - próxima: ≤7 dias no futuro → âmbar ("Vence em X dias")
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

// Agrupa lista de registros por categoria de data relativa pra renderizar
// headers tipo "Hoje", "Ontem", "Esta semana" entre os grupos.
// Espera lista já ordenada (mais recente primeiro). Retorna lista de grupos
// [{ id, label, items }] preservando a ordem dos items dentro do grupo.
function groupRegistrosByDate(list) {
  const today = Utils.localDateString();
  const todayDate = new Date(today + 'T00:00:00');
  const yesterdayDate = new Date(todayDate.getTime() - 24 * 60 * 60 * 1000);
  const yesterday = yesterdayDate.toISOString().slice(0, 10);
  const dow = todayDate.getDay();
  const daysSinceMonday = dow === 0 ? 6 : dow - 1;
  const weekStartDate = new Date(todayDate.getTime() - daysSinceMonday * 24 * 60 * 60 * 1000);
  const weekStart = weekStartDate.toISOString().slice(0, 10);
  const monthStartDate = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);
  const monthStart = monthStartDate.toISOString().slice(0, 10);

  const buckets = [
    { id: 'hoje', label: 'Hoje', items: [] },
    { id: 'ontem', label: 'Ontem', items: [] },
    { id: 'semana', label: 'Esta semana', items: [] },
    { id: 'mês', label: 'Este mês', items: [] },
    { id: 'antigos', label: 'Anteriores', items: [] },
  ];
  const byId = Object.fromEntries(buckets.map((b) => [b.id, b]));

  for (const r of list) {
    const day = (r.data || '').slice(0, 10);
    if (!day) {
      byId.antigos.items.push(r);
      continue;
    }
    if (day === today) byId.hoje.items.push(r);
    else if (day === yesterday) byId.ontem.items.push(r);
    else if (day >= weekStart) byId.semana.items.push(r);
    else if (day >= monthStart) byId.mes.items.push(r);
    else byId.antigos.items.push(r);
  }

  return buckets.filter((b) => b.items.length > 0);
}

function renderDayGroupHeader(group) {
  const count = group.items.length;
  const countLabel = count === 1 ? '1 serviço' : count + ' serviços';
  return (
    '<div class="hist-day-group" role="presentation">' +
    '<div class="hist-day-group__label">' +
    '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
    ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>' +
    '<line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>' +
    '<line x1="3" y1="10" x2="21" y2="10"/>' +
    '</svg>' +
    '<span>' +
    Utils.escapeHtml(group.label) +
    '</span>' +
    '<span class="hist-day-group__count">' +
    countLabel +
    '</span>' +
    '</div>' +
    '</div>'
  );
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

  const collapsed = isSummaryCollapsed();
  const sectionClass = collapsed
    ? 'hist-summary-card hist-summary-card--collapsed'
    : 'hist-summary-card';
  const expandedAttr = collapsed ? 'false' : 'true';
  const toggleAriaLabel = collapsed ? 'Mostrar insights' : 'Ocultar insights';
  const chevronPath = collapsed ? 'm6 9 6 6 6-6' : 'm18 15-6-6-6 6';

  return `<section class="${sectionClass}" aria-label="Resumo do período">
    <div class="hist-summary-card__orbs" aria-hidden="true">
      <div class="hist-summary-card__orb hist-summary-card__orb--tl"></div>
      <div class="hist-summary-card__orb hist-summary-card__orb--br"></div>
    </div>
    <button type="button" class="hist-summary-card__pill hist-summary-card__pill--toggle"
      data-hist-action="toggle-summary"
      aria-expanded="${expandedAttr}"
      aria-controls="hist-summary-content"
      aria-label="${Utils.escapeHtml(toggleAriaLabel)}">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        ${
          filtered
            ? '<path d="M3 5h18M6 12h12M10 19h4"/>'
            : '<path d="M3 20V10M9 20V4M15 20v-7M21 20v-4"/>'
        }
      </svg>
      <span class="hist-summary-card__pill-label">${Utils.escapeHtml(pillLabel)}</span>
      <svg class="hist-summary-card__pill-chev" width="14" height="14" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" stroke-width="1.75"
        stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="${chevronPath}"/>
      </svg>
    </button>
    <div class="hist-summary-card__content" id="hist-summary-content" ${collapsed ? 'hidden' : ''}>
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
    </div>
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

  // Assinatura existe no registro mas não está local neste dispositivo —
  // não renderiza nada (o placeholder anterior poluía visualmente sem
  // adicionar info acionável). Se o usuário precisar, pode abrir o registro
  // em outro device onde a assinatura foi coletada.
  if (!hasLocal) return '';

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

function renderTimelineItem(
  r,
  { isFirst, equipamentos, setoresById, currentFilterEquipId = '', groupId = '' },
) {
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
  // Quando o card esta dentro de um grupo de data (Hoje/Ontem/Esta semana/Este mês),
  // mostra so a hora pq o header do grupo já comunica o dia. Em "Anteriores"
  // (sem contexto de grupo) mostra data + hora completa pra ficar inequivoco.
  const dateInGroupCtx = groupId && groupId !== 'antigos';
  let headerDateLabel;
  if (dateInGroupCtx) {
    const d = r.data ? new Date(r.data) : null;
    headerDateLabel =
      d && !Number.isNaN(d.getTime())
        ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        : Utils.formatDatetime(r.data);
  } else {
    headerDateLabel = Utils.formatDatetime(r.data);
  }
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
      <div class="timeline__item__header">
        <span class="timeline__item__date">${Utils.escapeHtml(headerDateLabel)}</span>
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
      <div class="hist-item-actions__menu" role="menu" hidden>
        <button type="button" role="menuitem"
          class="hist-item-actions__menuitem"
          data-action="edit-reg" data-id="${Utils.escapeAttr(r.id)}"
          title="Editar" aria-label="Editar registro">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"/>
          </svg>
        </button>
        <button type="button" role="menuitem"
          class="hist-item-actions__menuitem hist-item-actions__menuitem--danger"
          data-action="delete-reg" data-id="${Utils.escapeAttr(r.id)}"
          title="Excluir" aria-label="Excluir registro">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"/>
          </svg>
        </button>
      </div>
      <button type="button" class="hist-item-actions__kebab"
        data-hist-action="toggle-card-menu" data-id="${Utils.escapeAttr(r.id)}"
        aria-label="Ações do registro" aria-haspopup="menu" aria-expanded="false">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="5" r="1.5"/>
          <circle cx="12" cy="12" r="1.5"/>
          <circle cx="12" cy="19" r="1.5"/>
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

/**
 * Setter público chamado pela rota histórico quando o usuário chega via
 * /clientes -> "Ver serviços" (params.clienteId presente). Limpa quando
 * chamado sem args.
 */
export function setHistClienteFilter({ id = null, nome = null } = {}) {
  _clienteFilter = { id, nome };
}

export function clearHistClienteFilter() {
  _clienteFilter = { id: null, nome: null };
}

export function renderHist() {
  // Le filtros da URL na primeira vez que o view é renderizado por sessão.
  // Suporta deep linking: ?periodo=7d&setor=xyz aplica filtros direto.
  hydrateFiltersFromUrl();

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

  // Todos os planos têm histórico completo — o filtro temporal foi removido
  // porque histórico é parte essencial do valor do produto pra técnico de campo.
  let list = [...registros].sort((a, b) => b.data.localeCompare(a.data));

  if (filtSetor) list = list.filter((r) => equipIdsNoSetor.has(r.equipId));
  if (filtEq) list = list.filter((r) => r.equipId === filtEq);
  // Filtro por cliente vindo de /clientes -> "Ver serviços". Restringe aos
  // registros de equipamentos vinculados ao cliente. Se o cliente não tem
  // equipamentos, a lista vai pra zero (visual: empty state contextual).
  if (_clienteFilter.id) {
    const equipIdsForClient = new Set(
      equipamentos.filter((e) => e.clienteId === _clienteFilter.id).map((e) => e.id),
    );
    list = list.filter((r) => equipIdsForClient.has(r.equipId));
  }
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
  // Chip de filtro de cliente: aparece quando vier de /clientes -> Ver serviços.
  // Renderiza no slot de active-chips já existente.
  const activeChipsSlot = document.getElementById('hist-active-chips-slot');
  if (activeChipsSlot) {
    if (_clienteFilter.id && _clienteFilter.nome) {
      activeChipsSlot.innerHTML = `
        <div class="hist-active-chips" role="status">
          <span class="hist-active-chips__chip">
            Cliente: <strong>${Utils.escapeHtml(_clienteFilter.nome)}</strong>
            <button type="button" class="hist-active-chips__close"
              data-hist-action="clear-cliente-filter"
              aria-label="Limpar filtro de cliente">x</button>
          </span>
        </div>`;
    } else if (activeChipsSlot.querySelector('.hist-active-chips')) {
      // Não remove se já foi populado por outro filtro.
      const ourChip = activeChipsSlot.querySelector('[data-hist-action="clear-cliente-filter"]');
      if (ourChip) activeChipsSlot.innerHTML = '';
    }
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

  // Sincroniza URL apos cada render. URLSearchParams omite chaves vazias,
  // entao ?busca=foo&periodo=7d nunca vira ?busca=&periodo=&setor=&equip=&tipo=.
  writeFiltersToUrl({ busca, setor: filtSetor, equip: filtEq, periodo: period, tipo });
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
    // Card gigante de resumo removido — usuário reportou que ocupava espaço
    // demais e duplicava o CTA "Gerar Relatório" do header. Insights numéricos
    // continuam disponíveis no Painel.
    const preList = '';
    void recurring; // ainda calculado pra eventual reuso (alerta de recorrência)

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

    // Agrupa por data relativa para inserir headers entre grupos.
    // Dentro de cada grupo, preserva a ordem (mais recente primeiro).
    const groups = groupRegistrosByDate(list);
    let globalIdx = 0;
    const itemsHtml = groups
      .map((group) => {
        const groupItems = group.items
          .map((r) => {
            const html = renderTimelineItem(r, {
              isFirst: globalIdx === 0,
              equipamentos,
              setoresById,
              currentFilterEquipId: filtEq || '',
              groupId: group.id,
            });
            globalIdx += 1;
            return html;
          })
          .join('');
        return renderDayGroupHeader(group) + groupItems;
      })
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
  // Toggle do card de Insights (collapsed/expanded). Persiste a escolha em
  // sessionStorage para a sessão. Re-renderiza pra trocar o estado visual.
  const summaryToggle = container.querySelector('[data-hist-action="toggle-summary"]');
  if (summaryToggle) {
    summaryToggle.addEventListener('click', () => {
      const next = !isSummaryCollapsed();
      setSummaryCollapsed(next);
      renderHist();
    });
  }

  // Atualiza badge de contagem de filtros ativos no botao Filtros (mobile).
  // Conta apenas filtros que ficam dentro do sheet: setor, equipamento, tipo.
  // Quick-filters (periodo) não contam aqui pq tem chips visiveis no header.
  const filtersTrigger = document.getElementById('hist-filters-trigger');
  const filtersCount = document.getElementById('hist-filters-count');
  if (filtersTrigger && filtersCount) {
    const setor = Utils.getVal('hist-setor');
    const equip = Utils.getVal('hist-equip');
    const { tipo } = getExtraFilters();
    const count = [setor, equip, tipo].filter(Boolean).length;
    if (count > 0) {
      filtersCount.textContent = String(count);
      filtersCount.hidden = false;
      filtersTrigger.classList.add('is-active');
    } else {
      filtersCount.hidden = true;
      filtersTrigger.classList.remove('is-active');
    }
  }

  // Toggle do kebab menu nos cards. Click no kebab abre/fecha esse card.
  // Click fora ou em outro kebab fecha o anterior. ESC fecha também.
  // Gate dataset.histBound: container (#timeline) persiste entre renders;
  // sem o gate, addEventListener seria chamado N vezes apos N renders e
  // geraria cascata de cliques (=> congelamento ao clicar em algo).
  if (!container.dataset.histBound) {
    container.dataset.histBound = '1';
    container.addEventListener('click', (e) => {
      const kebab = e.target.closest('[data-hist-action="toggle-card-menu"]');
      if (kebab) {
        e.preventDefault();
        const menu = kebab.parentElement?.querySelector('.hist-item-actions__menu');
        const isOpen = menu && !menu.hidden;
        container.querySelectorAll('.hist-item-actions__menu').forEach((m) => {
          m.hidden = true;
        });
        container.querySelectorAll('[data-hist-action="toggle-card-menu"]').forEach((k) => {
          k.setAttribute('aria-expanded', 'false');
        });
        if (!isOpen && menu) {
          menu.hidden = false;
          kebab.setAttribute('aria-expanded', 'true');
        }
        return;
      }
      if (!e.target.closest('.hist-item-actions__menu')) {
        container.querySelectorAll('.hist-item-actions__menu').forEach((m) => {
          m.hidden = true;
        });
        container.querySelectorAll('[data-hist-action="toggle-card-menu"]').forEach((k) => {
          k.setAttribute('aria-expanded', 'false');
        });
      }
    });

    container.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const open = container.querySelector('.hist-item-actions__menu:not([hidden])');
        if (open) {
          open.hidden = true;
          const kebab = open.parentElement?.querySelector('[data-hist-action="toggle-card-menu"]');
          if (kebab) {
            kebab.setAttribute('aria-expanded', 'false');
            kebab.focus();
          }
        }
      }
    });
  }

  // Handler do botao Filtros — mesmo gate (filtersTrigger persiste no DOM).
  if (filtersTrigger && !filtersTrigger.dataset.histBound) {
    filtersTrigger.dataset.histBound = '1';
    filtersTrigger.addEventListener('click', () => {
      const { setores, equipamentos } = getState();
      const { tipo } = getExtraFilters();
      HistoricoFiltersSheet.open({
        setores,
        equipamentos: equipamentos.map((e) => ({
          id: e.id,
          nome: e.nome,
          setorId: e.setorId,
        })),
        tipoOptions: TIPO_OPTIONS,
        initial: {
          setor: Utils.getVal('hist-setor'),
          equip: Utils.getVal('hist-equip'),
          tipo,
        },
        onApply: ({ setor, equip, tipo: newTipo }) => {
          // Aplica os valores nos selects ocultos (a logica existente os le).
          const setorEl = document.getElementById('hist-setor');
          const equipEl = document.getElementById('hist-equip');
          if (setorEl) {
            setorEl.value = setor;
            // Re-sincroniza opções de equipamento se setor mudou
            syncSetorSelect(setor);
            if (equipEl) equipEl.value = equip;
          } else if (equipEl) {
            equipEl.value = equip;
          }
          setExtraFilter(HIST_TIPO_KEY, newTipo);
          renderHist();
        },
        onReset: () => {
          const setorEl = document.getElementById('hist-setor');
          const equipEl = document.getElementById('hist-equip');
          if (setorEl) setorEl.value = '';
          if (equipEl) equipEl.value = '';
          setExtraFilter(HIST_TIPO_KEY, '');
          renderHist();
        },
      });
    });
  }

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

  // "Ver tudo deste equipamento" — navega pra aba Equipamentos focando o
  // setor correto E abre o modal de detalhes do equipamento (#modal-eq-det).
  // Sequência:
  //   1. goTo('equipamentos', { equipCtx: { sectorId } }) — troca a rota,
  //      renderEquip executa e popula o setor correto;
  //   2. requestAnimationFrame + import dinâmico pra chamar viewEquip(id),
  //      que monta o HTML do modal-eq-det e abre via Modal.open.
  // Sem o requestAnimationFrame o modal seria construído antes do renderEquip
  // terminar, podendo abrir sobre uma tela "intermediária".
  each('[data-hist-action="hist-filter-equip"]', (btn) =>
    btn.addEventListener('click', () => {
      const equipId = btn.dataset.equipId || '';
      if (!equipId) return;
      const eq = equipamentos.find((it) => it.id === equipId);
      const sectorId = eq?.setorId || null;
      goTo('equipamentos', sectorId ? { equipCtx: { sectorId } } : {});
      requestAnimationFrame(() => {
        import('./equipamentos.js')
          .then((mod) => mod.viewEquip && mod.viewEquip(equipId))
          .catch(() => {
            /* falha no import não deve travar a navegacao — o usuário
               pelo menos já esta na aba certa, focado no setor */
          });
      });
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

  // Limpa o filtro "Cliente: X" injetado por /clientes -> Ver serviços.
  // Reseta o state e re-renderiza pra remover o chip.
  each('[data-hist-action="clear-cliente-filter"]', (btn) =>
    btn.addEventListener('click', () => {
      _clienteFilter = { id: null, nome: null };
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
