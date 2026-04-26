/**
 * CoolTrack Pro - Relatório View v6.0 (redesign)
 * Funções: renderRelatorio, populateRelatorioSelects
 *
 * Arquitetura:
 *  - Hero summary com 4 KPIs (Registros, Custo Total, Tipo mais comum, Próx. vencimento)
 *  - Filtro em chips + disclosure "Mais filtros" (form legado preservado embaixo)
 *  - Cards expansíveis com cabeçalho compacto (tipo+ícone+status) e disclosure p/ detalhes
 *  - Preview de assinatura inline (reaproveita SignatureViewerModal / getSignatureForRecord)
 *  - Segmentado "Compacto / Detalhado" persistido em localStorage
 */

import { Utils } from '../../core/utils.js';
import { getState, findEquip } from '../../core/state.js';
import { withSkeleton } from '../components/skeleton.js';
import { CRITICIDADE_LABEL, PRIORIDADE_OPERACIONAL_LABEL } from '../../domain/maintenance.js';
import { formatDadosPlacaRows } from '../../domain/dadosPlacaDisplay.js';
import { PdfQuotaBadge } from '../components/pdfQuotaBadge.js';
import { getSignatureForRecord, SignatureViewerModal } from '../components/signature.js';

// ──────────────────────────────────────────────────────────────────────
// Constantes de design — mapeamento granular dos 12 tipos reais
// (aprovado com o Willian; o mockup original tinha só 4 buckets)
// ──────────────────────────────────────────────────────────────────────

const VIEW_MODE_STORAGE_KEY = 'cooltrack_relatorio_view_mode';
const VIEW_MODE_COMPACT = 'compact';
const VIEW_MODE_DETAILED = 'detailed';

// tone = classe CSS .rel-tipo--<tone> (cores no components.css)
const TIPO_META = {
  'Manutenção Preventiva': { tone: 'cyan', icon: 'shieldCheck' },
  'Inspeção Geral': { tone: 'cyan', icon: 'shieldCheck' },
  'Limpeza de Filtros': { tone: 'cyan-soft', icon: 'droplets' },
  'Limpeza de Condensador': { tone: 'cyan-soft', icon: 'droplets' },
  'Limpeza de Evaporador': { tone: 'cyan-soft', icon: 'droplets' },
  'Ajuste de Dreno': { tone: 'cyan-soft', icon: 'droplets' },
  'Verificação Elétrica': { tone: 'gold-soft', icon: 'zap' },
  'Troca de Capacitor': { tone: 'gold-soft', icon: 'zap' },
  'Manutenção Corretiva': { tone: 'gold', icon: 'wrench' },
  'Troca de Compressor': { tone: 'gold', icon: 'wrench' },
  'Carga de Gás Refrigerante': { tone: 'cyan-strong', icon: 'flask' },
  Outro: { tone: 'muted', icon: 'tool' },
};

const DEFAULT_TIPO_META = { tone: 'muted', icon: 'tool' };

// ícones inline (stroke 1.6, currentColor) — usa o mesmo kit visual da UI
const ICON_SVG = {
  shieldCheck:
    '<path d="M12 3l8 3v6c0 4.5-3.5 8-8 9-4.5-1-8-4.5-8-9V6l8-3z"/><path d="M9 12l2 2 4-4"/>',
  droplets:
    '<path d="M8 4c1.2 2.5 4 6 4 9a4 4 0 1 1-8 0c0-3 2.8-6.5 4-9z"/><path d="M16 10c.9 1.9 3 4.6 3 7a3 3 0 1 1-6 0c0-2.4 2.1-5.1 3-7z"/>',
  zap: '<path d="M13 2L4 14h7l-2 8 9-12h-7l2-8z"/>',
  wrench:
    '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.3 2.3-2.4-2.4 2.3-2.3z"/>',
  flask:
    '<path d="M10 3h4"/><path d="M11 3v6l-5 9a2 2 0 0 0 2 3h8a2 2 0 0 0 2-3l-5-9V3"/><path d="M7 14h10"/>',
  tool: '<path d="M20 7a4 4 0 0 1-5 5l-7 7-3-3 7-7a4 4 0 0 1 5-5l-2.5 2.5 1.5 1.5L19 8l1-1z"/>',
  clipboardCheck:
    '<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4h6v3H9z"/><path d="M9 13l2 2 4-4"/>',
  dollarSign: '<path d="M12 3v18"/><path d="M16 7H10a2.5 2.5 0 0 0 0 5h4a2.5 2.5 0 0 1 0 5H8"/>',
  calendarClock:
    '<rect x="3" y="5" width="14" height="14" rx="2"/><path d="M3 9h14M8 3v4M14 3v4"/><circle cx="18" cy="18" r="4"/><path d="M18 16.5V18l1 1"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  tag: '<path d="M3 12l9-9h8v8l-9 9-8-8z"/><circle cx="15.5" cy="8.5" r="1.2"/>',
  chevronDown: '<path d="M6 9l6 6 6-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  edit2: '<path d="M14 4l6 6-12 12H2v-6L14 4z"/>',
  snowflake:
    '<path d="M12 2v20M2 12h20"/><path d="M5 5l14 14M19 5L5 19"/><path d="M12 5l-2-2M12 5l2-2M12 19l-2 2M12 19l2 2M5 12l-2-2M5 12l-2 2M19 12l2-2M19 12l2 2"/>',
  arrowRight: '<path d="M9 6l6 6-6 6"/>',
};

function icon(name, size = 14) {
  const inner = ICON_SVG[name] || ICON_SVG.tool;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
}

// ──────────────────────────────────────────────────────────────────────
// Status → variante visual (ok/warn/danger do sistema)
// ──────────────────────────────────────────────────────────────────────
const STATUS_TONE = { ok: 'ok', warn: 'warn', danger: 'danger' };

// Labels locais pro relatório — mais fortes que "Normal" do STATUS_LABEL
// global (que também vive em equipamentos, onde um rótulo curto tipo
// "Normal" funciona melhor). Aqui "Concluído" comunica ação finalizada,
// que é o que o leitor do relatório quer ver.
const REL_STATUS_LABEL = {
  ok: 'Concluído',
  warn: 'Atenção',
  danger: 'Crítico',
};

// Banner de corretivas: só aparece quando o volume é relevante. 2 registros
// é o mínimo absoluto pra falar em "recorrência", e 30% evita que 3 corretivas
// num relatório de 100 registros apareça como alarme — nesse caso é ruído.
const CORRETIVAS_BANNER_MIN_COUNT = 2;
const CORRETIVAS_BANNER_MIN_RATIO = 0.3;

// Próximas ações: janela de 14 dias pra frente + qualquer coisa vencida.
// Empírico — acima disso o leitor já não trata como "próxima" e o bloco vira
// lista longa sem urgência.
const PROXIMAS_ACOES_WINDOW_DAYS = 14;
const PROXIMAS_ACOES_DEFAULT_LIMIT = 5;

// ──────────────────────────────────────────────────────────────────────
// View mode persistence
// ──────────────────────────────────────────────────────────────────────
function getStoredViewMode() {
  try {
    const v = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    return v === VIEW_MODE_DETAILED ? VIEW_MODE_DETAILED : VIEW_MODE_COMPACT;
  } catch {
    return VIEW_MODE_COMPACT;
  }
}

function setStoredViewMode(v) {
  try {
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, v);
  } catch {
    /* ignore (Safari privado, etc.) */
  }
}

// ──────────────────────────────────────────────────────────────────────
// Public: populateRelatorioSelects (inalterado, só move o default label)
// ──────────────────────────────────────────────────────────────────────
export function populateRelatorioSelects() {
  const { equipamentos } = getState();
  const el = Utils.getEl('rel-equip');
  if (!el) return;

  el.textContent = '';
  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = 'Todos os equipamentos';
  el.appendChild(defaultOption);

  equipamentos.forEach((equipamento) => {
    const option = document.createElement('option');
    option.value = String(equipamento.id || '');
    option.textContent = `${equipamento.nome || '-'} - ${equipamento.local || '-'}`;
    el.appendChild(option);
  });
}

// ──────────────────────────────────────────────────────────────────────
// KPIs calculation
// ──────────────────────────────────────────────────────────────────────
function computeKPIs(registros) {
  const count = registros.length;
  const total = registros.reduce((s, r) => {
    const pecas = parseFloat(r.custoPecas) || 0;
    const mao = parseFloat(r.custoMaoObra) || 0;
    return s + pecas + mao;
  }, 0);

  // Tipo mais comum (no empate, pega o primeiro encontrado na iteração)
  const byType = registros.reduce((acc, r) => {
    const t = r.tipo || 'Outro';
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {});
  let mostCommonType = null;
  let mostCommonCount = 0;
  for (const t in byType) {
    if (byType[t] > mostCommonCount) {
      mostCommonCount = byType[t];
      mostCommonType = t;
    }
  }

  // Próxima manutenção: menor `proxima` a partir de hoje; se tudo venceu, pega o mais recente passado
  const allDues = registros
    .map((r) => r.proxima)
    .filter(Boolean)
    .map((d) => ({ iso: d, n: Utils.daysUntil(d) }))
    .filter((x) => x.n != null);
  allDues.sort((a, b) => a.n - b.n);
  const nextDue = allDues.find((d) => d.n >= 0) || allDues[allDues.length - 1] || null;

  return { count, total, mostCommonType, mostCommonCount, nextDue };
}

// ──────────────────────────────────────────────────────────────────────
// Insights determinísticos (sem IA — regras claras, auditáveis)
// ──────────────────────────────────────────────────────────────────────

/**
 * Resumo narrativo do período: "8 atendimentos em 3 equipamentos · predomínio
 * de Preventiva (62%) · 2 corretivas." Só inclui o predomínio quando o tipo
 * dominante representa ≥30% E existe mais de um tipo (senão vira redundante
 * com o KPI). Retorna null pra lista vazia pra que o chamador decida omitir.
 */
export function buildPeriodNarrative(list) {
  if (!Array.isArray(list) || list.length === 0) return null;
  const total = list.length;
  const equipsSet = new Set();
  const byTipo = {};
  let corretivas = 0;
  for (const r of list) {
    if (r?.equipId) equipsSet.add(r.equipId);
    const tipo = r?.tipo || 'Outro';
    byTipo[tipo] = (byTipo[tipo] || 0) + 1;
    if (/corretiva/i.test(r?.tipo || '')) corretivas += 1;
  }
  const equipsUnicos = equipsSet.size;
  let tipoTop = null;
  let tipoTopCount = 0;
  for (const k in byTipo) {
    if (byTipo[k] > tipoTopCount) {
      tipoTopCount = byTipo[k];
      tipoTop = k;
    }
  }
  const tipoPct = total > 0 ? Math.round((tipoTopCount / total) * 100) : 0;

  const atendimentosTxt = `${total} ${total === 1 ? 'atendimento' : 'atendimentos'}`;
  const equipsTxt =
    equipsUnicos > 0
      ? ` em ${equipsUnicos} ${equipsUnicos === 1 ? 'equipamento' : 'equipamentos'}`
      : '';
  const partes = [`${atendimentosTxt}${equipsTxt}`];

  const multiTipos = Object.keys(byTipo).length > 1;
  if (tipoTop && tipoPct >= 30 && multiTipos) {
    const nomeCurto = tipoTop.replace(/^Manutenção\s+/i, '');
    partes.push(`predomínio de ${nomeCurto} (${tipoPct}%)`);
  }
  if (corretivas > 0) {
    partes.push(`${corretivas} ${corretivas === 1 ? 'corretiva' : 'corretivas'}`);
  }

  return {
    text: `${partes.join(' · ')}.`,
    total,
    equipsUnicos,
    tipoTop,
    tipoTopCount,
    tipoPct,
    corretivas,
  };
}

/**
 * Conta registros do tipo corretiva (case-insensitive, keyword match).
 * Mantida como helper separado pra que o banner possa reutilizar sem recalcular
 * o narrative todo.
 */
export function countCorretivas(list) {
  if (!Array.isArray(list) || list.length === 0) return 0;
  return list.reduce((acc, r) => (/corretiva/i.test(r?.tipo || '') ? acc + 1 : acc), 0);
}

/**
 * Decide se mostrar o banner de corretivas: exige mínimo absoluto E razão
 * mínima pra evitar falso alarme em relatórios grandes com poucas corretivas.
 */
export function shouldShowCorretivasBanner(count, total) {
  if (count < CORRETIVAS_BANNER_MIN_COUNT) return false;
  if (total <= 0) return false;
  return count / total >= CORRETIVAS_BANNER_MIN_RATIO;
}

/**
 * Próximas ações recomendadas: pega a manutenção futura mais próxima de cada
 * equipamento dentro de `days` dias (+ qualquer vencida), dedupe por equip,
 * ordena pela mais urgente primeiro. Retorna até `limit` itens.
 */
export function getProximasAcoes(
  list,
  equipamentos = [],
  limit = PROXIMAS_ACOES_DEFAULT_LIMIT,
  days = PROXIMAS_ACOES_WINDOW_DAYS,
) {
  if (!Array.isArray(list) || list.length === 0) return [];
  const equipIndex = new Map((equipamentos || []).map((e) => [e.id, e]));

  // Dedup por equipId mantendo o mais urgente (menor daysUntil = mais vencido)
  const byEquip = new Map();
  for (const r of list) {
    if (!r?.equipId || !r?.proxima) continue;
    const n = Utils.daysUntil(r.proxima);
    if (n == null) continue;
    if (n > days) continue; // Fora da janela — pula
    const existing = byEquip.get(r.equipId);
    if (!existing || n < existing.daysUntil) {
      const equip = equipIndex.get(r.equipId) || null;
      byEquip.set(r.equipId, {
        equipId: r.equipId,
        equipNome: equip?.nome || r.equipNome || '—',
        equipTag: equip?.tag || '',
        proximaIso: r.proxima,
        daysUntil: n,
        registro: r,
      });
    }
  }

  const items = Array.from(byEquip.values());
  items.sort((a, b) => a.daysUntil - b.daysUntil);
  return items.slice(0, limit).map((item) => ({
    ...item,
    tone: item.daysUntil < 0 ? 'danger' : 'warn',
    label: Utils.fmtDueRelative(item.proximaIso),
  }));
}

// ──────────────────────────────────────────────────────────────────────
// Hero summary
// ──────────────────────────────────────────────────────────────────────
function renderHero({ kpis, periodoTxt, equipTxt, viewMode, narrative, emittedAt }) {
  const dueState = (() => {
    if (kpis.count === 0 || !kpis.nextDue) return 'default';
    if (kpis.nextDue.n < 0) return 'red';
    if (kpis.nextDue.n <= 7) return 'gold';
    return 'default';
  })();

  const dueValue = kpis.count === 0 || !kpis.nextDue ? '—' : Utils.fmtDueRelative(kpis.nextDue.iso);

  // "Tipo mais comum": exibe "N × Tipo"; se tipo muito longo, trunca
  const tipoValue = (() => {
    if (kpis.count === 0 || !kpis.mostCommonType) return '—';
    const nome = kpis.mostCommonType.replace(/^Manutenção\s+/i, '');
    const truncated = nome.length > 20 ? `${nome.slice(0, 20)}…` : nome;
    return `${kpis.mostCommonCount}× ${truncated}`;
  })();

  const tipoTitle =
    kpis.count === 0 || !kpis.mostCommonType
      ? ''
      : `title="${Utils.escapeAttr(`${kpis.mostCommonCount} × ${kpis.mostCommonType}`)}"`;

  // Custo total "R$ 0,00" vira "—" pra não ser lido como "serviço gratuito".
  // Prestadores nem sempre registram custos — o hero precisa refletir
  // ausência de dado, não afirmação de zero.
  const hasCusto = kpis.total > 0;
  const custoValue = hasCusto ? Utils.fmtBRL(kpis.total) : '—';
  const custoAriaLabel = hasCusto
    ? `Custo total: ${Utils.fmtBRL(kpis.total)}`
    : 'Custo total não registrado no período';
  const custoTitleAttr = hasCusto ? '' : ` title="Nenhum custo registrado nos serviços do período"`;

  const narrativeHtml = narrative?.text
    ? `<p class="rel-hero__narrative">${Utils.escapeHtml(narrative.text)}</p>`
    : '';

  const emittedHtml = emittedAt
    ? `<span class="rel-hero__emitted" aria-label="Emitido em ${Utils.escapeAttr(emittedAt)}">Emitido em ${Utils.escapeHtml(emittedAt)}</span>`
    : '';

  return `
    <div class="rel-hero__brand">
      <span class="rel-hero__brand-ic" aria-hidden="true">${icon('clipboardCheck', 14)}</span>
      <span class="rel-hero__brand-label">Relatório de Serviços</span>
    </div>
    <div class="rel-hero__head">
      <h2 id="rel-hero-title" class="rel-hero__title">Resumo do período</h2>
      <div class="rel-segmented" role="radiogroup" aria-label="Modo de visualização">
        <button type="button" class="rel-segmented__opt${viewMode === VIEW_MODE_COMPACT ? ' is-active' : ''}"
          role="radio" aria-checked="${viewMode === VIEW_MODE_COMPACT}"
          data-view-mode="${VIEW_MODE_COMPACT}">Compacto</button>
        <button type="button" class="rel-segmented__opt${viewMode === VIEW_MODE_DETAILED ? ' is-active' : ''}"
          role="radio" aria-checked="${viewMode === VIEW_MODE_DETAILED}"
          data-view-mode="${VIEW_MODE_DETAILED}">Detalhado</button>
      </div>
    </div>
    <div class="rel-hero__meta">
      <span class="rel-hero__meta-period">${Utils.escapeHtml(periodoTxt)} · ${Utils.escapeHtml(equipTxt)}</span>
      ${emittedHtml}
    </div>
    ${narrativeHtml}
    <div class="rel-hero__divider" role="presentation"></div>
    <div class="rel-hero__kpis">
      <div class="rel-kpi" aria-label="Registros: ${kpis.count}">
        <div class="rel-kpi__row">
          <span class="rel-kpi__icon rel-kpi__icon--cyan">${icon('clipboardCheck')}</span>
          <span class="rel-kpi__value">${kpis.count}</span>
        </div>
        <div class="rel-kpi__label">Registros</div>
      </div>
      <div class="rel-kpi" aria-label="${custoAriaLabel}"${custoTitleAttr}>
        <div class="rel-kpi__row">
          <span class="rel-kpi__icon rel-kpi__icon--cyan">${icon('dollarSign')}</span>
          <span class="rel-kpi__value${hasCusto ? '' : ' rel-kpi__value--muted'}">${custoValue}</span>
        </div>
        <div class="rel-kpi__label">Custo total</div>
      </div>
      <div class="rel-kpi" ${tipoTitle}>
        <div class="rel-kpi__row">
          <span class="rel-kpi__icon rel-kpi__icon--cyan">${icon('shieldCheck')}</span>
          <span class="rel-kpi__value rel-kpi__value--compact">${Utils.escapeHtml(tipoValue)}</span>
        </div>
        <div class="rel-kpi__label">Tipo mais comum</div>
      </div>
      <div class="rel-kpi" aria-label="Próximo vencimento: ${Utils.escapeAttr(dueValue)}">
        <div class="rel-kpi__row">
          <span class="rel-kpi__icon rel-kpi__icon--${dueState === 'red' ? 'red' : dueState === 'gold' ? 'gold' : 'cyan'}">${icon('calendarClock')}</span>
          <span class="rel-kpi__value rel-kpi__value--${dueState}">${Utils.escapeHtml(dueValue)}</span>
        </div>
        <div class="rel-kpi__label">Próx. vencimento</div>
      </div>
    </div>
  `;
}

// ──────────────────────────────────────────────────────────────────────
// Próximas ações & banner de corretivas (inseridos entre hero e records)
// ──────────────────────────────────────────────────────────────────────
function renderProximasAcoes(items) {
  if (!items.length) return '';
  const listHtml = items
    .map((item) => {
      const dtDisplay = Utils.formatDate(item.proximaIso);
      return `
        <li class="rel-proximas__item">
          <span class="rel-proximas__equip" title="${Utils.escapeAttr(item.equipNome)}">${Utils.escapeHtml(item.equipNome)}</span>
          <span class="rel-proximas__date">${Utils.escapeHtml(dtDisplay)}</span>
          <span class="rel-proximas__label rel-proximas__label--${item.tone}">${Utils.escapeHtml(item.label)}</span>
        </li>`;
    })
    .join('');

  return `
    <section class="rel-proximas" aria-labelledby="rel-proximas-title">
      <header class="rel-proximas__head">
        <span class="rel-proximas__icon" aria-hidden="true">${icon('calendarClock', 14)}</span>
        <h3 id="rel-proximas-title" class="rel-proximas__title">Próximas ações recomendadas</h3>
        <span class="rel-proximas__count" aria-hidden="true">${items.length}</span>
      </header>
      <ul class="rel-proximas__list" role="list">
        ${listHtml}
      </ul>
    </section>
  `;
}

function renderCorretivasBanner(count, total) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return `
    <section class="rel-corretivas-banner" role="status" aria-live="polite">
      <span class="rel-corretivas-banner__icon" aria-hidden="true">${icon('wrench', 18)}</span>
      <div class="rel-corretivas-banner__text">
        <strong>${count} ${count === 1 ? 'corretiva' : 'corretivas'} no período (${pct}%)</strong>
        <span>Volume alto de corretivas pode indicar oportunidade de reforçar o plano preventivo.</span>
      </div>
    </section>
  `;
}

// ──────────────────────────────────────────────────────────────────────
// Filter chips
// ──────────────────────────────────────────────────────────────────────
function renderFilterChips({
  periodoTxt,
  equipTxt,
  hasPeriodoFilter,
  hasEquipFilter,
  advancedOpen,
}) {
  const anyActive = hasPeriodoFilter || hasEquipFilter;
  const periodoChip = `
    <button type="button" class="rel-chip${hasPeriodoFilter ? ' is-active' : ''}"
      data-action="rel-toggle-advanced" aria-expanded="${advancedOpen}" aria-controls="rel-filters-advanced">
      <span class="rel-chip__icon">${icon('calendar', 12)}</span>
      <span class="rel-chip__label">${Utils.escapeHtml(hasPeriodoFilter ? periodoTxt : 'Todo período')}</span>
    </button>
  `;
  const equipChip = `
    <button type="button" class="rel-chip${hasEquipFilter ? ' is-active' : ''}"
      data-action="rel-toggle-advanced" aria-expanded="${advancedOpen}" aria-controls="rel-filters-advanced">
      <span class="rel-chip__icon">${icon('tag', 12)}</span>
      <span class="rel-chip__label">${Utils.escapeHtml(hasEquipFilter ? equipTxt : 'Todos os equipamentos')}</span>
    </button>
  `;
  const newFilterChip = `
    <button type="button" class="rel-chip rel-chip--dashed"
      data-action="rel-toggle-advanced" aria-expanded="${advancedOpen}" aria-controls="rel-filters-advanced">
      <span class="rel-chip__icon">${icon(advancedOpen ? 'x' : 'plus', 12)}</span>
      <span class="rel-chip__label">${advancedOpen ? 'Fechar filtros' : 'Mais filtros'}</span>
    </button>
  `;
  const clearBtn = anyActive
    ? `<button type="button" class="rel-chip__clear" data-action="rel-clear-filters">
         ${icon('x', 12)} <span>Limpar filtros</span>
       </button>`
    : '';
  return `${periodoChip}${equipChip}${newFilterChip}${clearBtn}`;
}

// ──────────────────────────────────────────────────────────────────────
// Empty state
// ──────────────────────────────────────────────────────────────────────
function renderEmpty({ hoje }) {
  return `
    <section class="rel-empty" aria-label="Sem dados para relatório">
      <div class="rel-empty__icon">${icon('snowflake', 32)}</div>
      <h3 class="rel-empty__title">Sem registros no período selecionado</h3>
      <p class="rel-empty__desc">Registre um serviço e veja seu relatório profissional pronto para envio em segundos.</p>
      <div class="rel-empty__preview" role="presentation">
        <div class="rel-empty__preview-brand">
          <span class="rel-empty__preview-flake">${icon('snowflake', 14)}</span>
          <span>CoolTrack Pro · Relatório de Serviço</span>
        </div>
        <div class="rel-empty__preview-meta">
          <div><span>Técnico</span><strong>Seu nome</strong></div>
          <div><span>Data</span><strong>${Utils.escapeHtml(hoje)}</strong></div>
          <div><span>Equipamento</span><strong>Split Loja Centro</strong></div>
          <div><span>Tipo</span><strong>Manutenção Prev.</strong></div>
        </div>
        <table class="rel-empty__preview-table" aria-label="Preview de relatório">
          <thead><tr><th>Serviço</th><th>Status</th><th>Obs.</th></tr></thead>
          <tbody>
            <tr><td>Limpeza de filtros</td><td>Concluído</td><td>Fluxo ok</td></tr>
            <tr><td>Inspeção elétrica</td><td>Concluído</td><td>Sem observação</td></tr>
            <tr><td>Verificação dreno</td><td>Concluído</td><td>Sem observação</td></tr>
          </tbody>
        </table>
      </div>
      <button type="button" class="rel-empty__cta" data-nav="registro">
        Registrar serviço para gerar relatório ${icon('arrowRight', 14)}
      </button>
    </section>
  `;
}

// ──────────────────────────────────────────────────────────────────────
// Signature thumb (reaproveita pattern do Histórico)
// ──────────────────────────────────────────────────────────────────────
function renderSignatureThumb(registro) {
  if (!registro?.assinatura) {
    return `<span class="rel-sigthumb rel-sigthumb--none" title="Cliente não assinou este registro">
      ${icon('edit2', 12)} Sem assinatura
    </span>`;
  }
  const dataUrl = getSignatureForRecord(registro.id);
  if (!dataUrl) {
    return `<span class="rel-sigthumb rel-sigthumb--unavailable"
        title="Assinatura coletada em outro dispositivo — armazenada localmente por padrão">
      ${icon('edit2', 12)} Assinatura em outro dispositivo
    </span>`;
  }
  const clienteNome = registro.clienteNome?.trim() || 'cliente';
  return `<button type="button" class="rel-sigthumb rel-sigthumb--btn"
      data-action="rel-view-signature" data-id="${Utils.escapeAttr(registro.id)}"
      aria-label="Ver assinatura de ${Utils.escapeAttr(clienteNome)} em tamanho grande">
      <img src="${Utils.escapeAttr(dataUrl)}" alt="Assinatura registrada" />
    </button>`;
}

// ──────────────────────────────────────────────────────────────────────
// Record card
// ──────────────────────────────────────────────────────────────────────
function renderRecordCard({ r, eq, expanded, singleEquipFilter }) {
  const tipoMeta = TIPO_META[r.tipo] || DEFAULT_TIPO_META;
  const safeStatus = Utils.safeStatus(r.status);
  const statusTone = STATUS_TONE[safeStatus] || 'ok';

  const custoPecas = parseFloat(r.custoPecas) || 0;
  const custoMao = parseFloat(r.custoMaoObra) || 0;
  const custoTotal = custoPecas + custoMao;
  const isCostZero = custoTotal <= 0;

  const nProx = r.proxima ? Utils.daysUntil(r.proxima) : null;
  const proxTone = nProx == null ? null : nProx < 0 ? 'red' : nProx <= 7 ? 'gold' : 'default';

  const equipNome = eq?.nome || r.equipNome || '—';
  const equipTag = eq?.tag || '—';
  const equipLocal = eq?.local || '—';
  const equipFluido = eq?.fluido || '—';
  const equipCriticidade = CRITICIDADE_LABEL[eq?.criticidade] || CRITICIDADE_LABEL.media;
  const equipPrioridade =
    PRIORIDADE_OPERACIONAL_LABEL[eq?.prioridadeOperacional] || PRIORIDADE_OPERACIONAL_LABEL.normal;
  const equipRotina = eq?.periodicidadePreventivaDias
    ? `${eq.periodicidadePreventivaDias} dias`
    : '—';

  // Dados da placa (12 campos opcionais, populados via IA ou manualmente).
  // Cada um vira uma .rel-spec na mesma grid das specs fixas — omite campos
  // sem valor pra não poluir com linhas "—". Se o equip foi cadastrado antes
  // da feature, dadosPlacaRows === [] e o HTML fica vazio.
  const dadosPlacaRows = formatDadosPlacaRows(eq?.dadosPlaca);
  const dadosPlacaSpecsHtml = dadosPlacaRows
    .map(
      (row) => `
            <div class="rel-spec">
              <div class="rel-spec__label">${Utils.escapeHtml(row.label)}</div>
              <div class="rel-spec__value${row.mono ? ' rel-spec__value--mono' : ''}">${Utils.escapeHtml(row.value)}</div>
            </div>`,
    )
    .join('');

  const tipoLabel = r.tipo || 'Outro';
  const titleText = tipoLabel;

  const equipInSummary = singleEquipFilter
    ? ''
    : `
      <span class="rel-record__equip-name">${Utils.escapeHtml(equipNome)}</span>
      <span class="rel-record__sep">·</span>
      <span class="rel-record__equip-tag">${Utils.escapeHtml(equipTag)}</span>
      <span class="rel-record__sep">·</span>
    `;

  return `
    <article class="rel-record${expanded ? ' is-expanded' : ''}" data-id="${Utils.escapeAttr(r.id)}"
      aria-labelledby="rec-${Utils.escapeAttr(r.id)}-title">
      <div class="rel-record__head">
        <span class="rel-tipo-icon rel-tipo-icon--${tipoMeta.tone}">${icon(tipoMeta.icon, 14)}</span>
        <div id="rec-${Utils.escapeAttr(r.id)}-title" class="rel-record__title">${Utils.escapeHtml(titleText)}</div>
        <span class="rel-status rel-status--${statusTone}" aria-label="Status: ${Utils.escapeAttr(REL_STATUS_LABEL[statusTone] || REL_STATUS_LABEL.ok)}">
          ${REL_STATUS_LABEL[statusTone] || REL_STATUS_LABEL.ok}
        </span>
      </div>
      <div class="rel-record__meta">
        <span>${Utils.escapeHtml(Utils.fmtDateTimeShort(r.data))}</span>
        <span class="rel-record__sep">·</span>
        <span>${Utils.escapeHtml(Utils.getRelativeTime(r.data))}</span>
      </div>

      <div class="rel-record__divider" role="presentation"></div>

      <div class="rel-record__body${isCostZero ? ' is-cost-zero' : ''}">
        <div class="rel-record__summary">
          <div class="rel-record__summary-line">
            ${equipInSummary}
            <span class="rel-record__tech">
              <span class="rel-record__tech-ic">${icon('user', 12)}</span>
              ${Utils.escapeHtml(r.tecnico || '—')}
            </span>
          </div>
          <div class="rel-record__signature">
            ${renderSignatureThumb(r)}
          </div>
        </div>
        ${
          isCostZero
            ? ''
            : `<div class="rel-record__cost">
                <div class="rel-record__cost-value">${Utils.fmtBRL(custoTotal)}</div>
                <div class="rel-record__cost-label">Total do serviço</div>
              </div>`
        }
      </div>

      <button type="button" class="rel-record__toggle"
        data-rel-action="rel-toggle-card" data-id="${Utils.escapeAttr(r.id)}"
        aria-expanded="${expanded}" aria-controls="rec-${Utils.escapeAttr(r.id)}-details">
        <span>${expanded ? 'Ocultar detalhes' : 'Ver detalhes'}</span>
        <span class="rel-record__toggle-chev" aria-hidden="true">${icon('chevronDown', 12)}</span>
      </button>

      <div id="rec-${Utils.escapeAttr(r.id)}-details" class="rel-record__details"${expanded ? '' : ' hidden'}>
        <section class="rel-record__section">
          <div class="rel-record__section-title">Especificações do equipamento</div>
          <div class="rel-record__specs">
            <div class="rel-spec">
              <div class="rel-spec__label">Equipamento</div>
              <div class="rel-spec__value">${Utils.escapeHtml(equipNome)}</div>
            </div>
            <div class="rel-spec">
              <div class="rel-spec__label">TAG</div>
              <div class="rel-spec__value rel-spec__value--mono">${Utils.escapeHtml(equipTag)}</div>
            </div>
            <div class="rel-spec">
              <div class="rel-spec__label">Local</div>
              <div class="rel-spec__value">${Utils.escapeHtml(equipLocal)}</div>
            </div>
            <div class="rel-spec">
              <div class="rel-spec__label">Fluido</div>
              <div class="rel-spec__value">${Utils.escapeHtml(equipFluido)}</div>
            </div>
            <div class="rel-spec">
              <div class="rel-spec__label">Criticidade</div>
              <div class="rel-spec__value">${Utils.escapeHtml(equipCriticidade)}</div>
            </div>
            <div class="rel-spec">
              <div class="rel-spec__label">Prior. operacional</div>
              <div class="rel-spec__value">${Utils.escapeHtml(equipPrioridade)}</div>
            </div>
            <div class="rel-spec">
              <div class="rel-spec__label">Rotina</div>
              <div class="rel-spec__value">${Utils.escapeHtml(equipRotina)}</div>
            </div>
            ${dadosPlacaSpecsHtml}
          </div>
        </section>

        ${
          r.pecas
            ? `<section class="rel-record__section">
                <div class="rel-record__section-title">Peças / Materiais</div>
                <div class="rel-record__pecas">${Utils.escapeHtml(r.pecas)}</div>
              </section>`
            : ''
        }

        ${
          isCostZero
            ? ''
            : `<section class="rel-record__section">
                <div class="rel-record__section-title">Custos</div>
                <div class="rel-record__cost-breakdown">
                  <span class="rel-cost-row__label">Peças</span>
                  <span class="rel-cost-row__value">${Utils.fmtBRL(custoPecas)}</span>
                  <span class="rel-cost-row__label">Mão de obra</span>
                  <span class="rel-cost-row__value">${Utils.fmtBRL(custoMao)}</span>
                  <span class="rel-cost-row__rule" aria-hidden="true"></span>
                  <span class="rel-cost-row__label rel-cost-row__label--total">Total</span>
                  <span class="rel-cost-row__value rel-cost-row__value--total">${Utils.fmtBRL(custoTotal)}</span>
                </div>
              </section>`
        }

        ${
          r.proxima
            ? `<section class="rel-record__section">
                <div class="rel-record__section-title">Próxima manutenção</div>
                <div class="rel-record__prox">
                  <span class="rel-record__prox-date">${Utils.formatDate(r.proxima)}</span>
                  <span class="rel-record__prox-badge rel-record__prox-badge--${proxTone}">
                    ${Utils.escapeHtml(Utils.fmtDueRelative(r.proxima))}
                  </span>
                </div>
              </section>`
            : ''
        }

        ${
          r.obs
            ? `<section class="rel-record__section">
                <div class="rel-record__section-title">Observações</div>
                <div class="rel-record__obs">${Utils.escapeHtml(r.obs)}</div>
              </section>`
            : ''
        }
      </div>
    </article>
  `;
}

// ──────────────────────────────────────────────────────────────────────
// Handlers wiring (idempotente: chamado a cada render)
// ──────────────────────────────────────────────────────────────────────
function wireHandlers({ registros, equipamentos, expandedIds, viewMode, rerender }) {
  const view = Utils.getEl('view-relatorio');
  if (!view) return;

  // Segmented control (compact/detailed)
  view.querySelectorAll('[data-view-mode]').forEach((btn) => {
    btn.addEventListener(
      'click',
      () => {
        const v = btn.dataset.viewMode;
        if (v !== viewMode) {
          setStoredViewMode(v);
          // Detailed expands all, compact collapses all — align w/ user expectation
          if (v === VIEW_MODE_DETAILED) {
            registros.forEach((r) => expandedIds.add(r.id));
          } else {
            expandedIds.clear();
          }
          rerender();
        }
      },
      { once: true },
    );
  });

  // Toggle advanced filter disclosure
  view.querySelectorAll('[data-action="rel-toggle-advanced"]').forEach((btn) => {
    btn.addEventListener(
      'click',
      () => {
        const adv = Utils.getEl('rel-filters-advanced');
        if (!adv) return;
        const willOpen = adv.hasAttribute('hidden');
        if (willOpen) {
          adv.removeAttribute('hidden');
        } else {
          adv.setAttribute('hidden', '');
        }
        // Atualiza aria-expanded dos chips
        view.querySelectorAll('[data-action="rel-toggle-advanced"]').forEach((c) => {
          c.setAttribute('aria-expanded', String(willOpen));
        });
        // Re-renderiza chips pra trocar o label "Mais filtros" <-> "Fechar filtros"
        // (não precisa refazer o hero ou records, mas é mais simples re-render completo)
        rerender({ keepAdvancedOpen: willOpen });
      },
      { once: true },
    );
  });

  // Clear filters
  view.querySelectorAll('[data-action="rel-clear-filters"]').forEach((btn) => {
    btn.addEventListener(
      'click',
      () => {
        Utils.setVal('rel-equip', '');
        Utils.setVal('rel-de', '');
        Utils.setVal('rel-ate', '');
        rerender();
      },
      { once: true },
    );
  });

  // Disclosure per card
  view.querySelectorAll('[data-rel-action="rel-toggle-card"]').forEach((btn) => {
    btn.addEventListener(
      'click',
      () => {
        const id = btn.dataset.id;
        if (!id) return;
        if (expandedIds.has(id)) {
          expandedIds.delete(id);
        } else {
          expandedIds.add(id);
        }
        rerender();
      },
      { once: true },
    );
  });

  // Signature thumb → viewer modal
  view.querySelectorAll('[data-action="rel-view-signature"]').forEach((btn) => {
    btn.addEventListener(
      'click',
      () => {
        const id = btn.dataset.id;
        if (!id) return;
        const registro = registros.find((r) => r.id === id);
        if (!registro) return;
        const eq = equipamentos.find((e) => e.id === registro.equipId);
        SignatureViewerModal.open(registro, { equipNome: eq?.nome || '—' });
      },
      { once: true },
    );
  });
}

// ──────────────────────────────────────────────────────────────────────
// Public: renderRelatorio
// ──────────────────────────────────────────────────────────────────────

// expandedIds vive entre re-renders da MESMA entrada na view.
// Recriar a cada navegação previne leak entre registros diferentes.
const expandedIds = new Set();

export function renderRelatorio(options = {}) {
  const { equipamentos, registros } = getState();
  const filtEq = Utils.getVal('rel-equip');
  const de = Utils.getVal('rel-de');
  const ate = Utils.getVal('rel-ate');

  // Badge de quota mensal de PDFs (slot fixo na toolbar).
  PdfQuotaBadge.refresh();

  // Filtros (mantém a lógica antiga: ISO date strings)
  let list = [...registros].sort((a, b) => (b.data || '').localeCompare(a.data || ''));
  if (filtEq) list = list.filter((r) => r.equipId === filtEq);
  if (de) list = list.filter((r) => r.data >= de);
  if (ate) list = list.filter((r) => r.data <= `${ate}T23:59`);

  const heroEl = Utils.getEl('rel-hero');
  const chipsEl = Utils.getEl('rel-filters-chips');
  const corpoEl = Utils.getEl('relatorio-corpo');
  if (!heroEl || !chipsEl || !corpoEl) return;

  const hoje = new Date().toLocaleDateString('pt-BR');
  const viewMode = getStoredViewMode();

  // Se mode=detailed, garante que todos estão expandidos (respeitando toggle individual durante a sessão)
  if (viewMode === VIEW_MODE_DETAILED) {
    list.forEach((r) => expandedIds.add(r.id));
  }

  // Labels pro hero / chips
  const hasPeriodoFilter = Boolean(de || ate);
  const periodoTxt = hasPeriodoFilter ? Utils.fmtShortDateRange(de, ate) : 'Todo o período';

  const hasEquipFilter = Boolean(filtEq);
  const equipFiltrado = hasEquipFilter ? equipamentos.find((e) => e.id === filtEq) : null;
  const equipTxt = hasEquipFilter
    ? equipFiltrado?.nome || 'Equipamento selecionado'
    : 'Todos os equipamentos';

  const singleEquipFilter = hasEquipFilter;

  const kpis = computeKPIs(list);
  const narrative = buildPeriodNarrative(list);
  const corretivasCount = countCorretivas(list);
  const showCorretivasBanner = shouldShowCorretivasBanner(corretivasCount, list.length);
  const proximasAcoes = getProximasAcoes(list, equipamentos);

  const advancedEl = Utils.getEl('rel-filters-advanced');
  const advancedOpen = options.keepAdvancedOpen ?? !(advancedEl?.hasAttribute('hidden') ?? true);

  const rerender = (opts = {}) => renderRelatorio(opts);

  const renderContent = () => {
    // Hero
    heroEl.innerHTML = renderHero({
      kpis,
      periodoTxt,
      equipTxt,
      viewMode,
      narrative,
      emittedAt: hoje,
    });

    // Chips
    chipsEl.innerHTML = renderFilterChips({
      periodoTxt,
      equipTxt,
      hasPeriodoFilter,
      hasEquipFilter,
      advancedOpen,
    });

    // Records
    if (!list.length) {
      corpoEl.innerHTML = renderEmpty({ hoje });
    } else {
      // Banner âmbar de corretivas (quando volume relevante) e bloco de
      // "Próximas ações" entram antes dos cards — leitura de alto nível
      // antes do detalhe registro-por-registro.
      const bannerHtml = showCorretivasBanner
        ? renderCorretivasBanner(corretivasCount, list.length)
        : '';
      const proximasHtml = proximasAcoes.length ? renderProximasAcoes(proximasAcoes) : '';
      const recordsHtml = list
        .map((r) => {
          const eq = findEquip(r.equipId);
          return renderRecordCard({
            r,
            eq,
            expanded: expandedIds.has(r.id),
            singleEquipFilter,
          });
        })
        .join('');
      corpoEl.innerHTML = `${bannerHtml}${proximasHtml}${recordsHtml}`;
    }

    wireHandlers({
      registros,
      equipamentos,
      expandedIds,
      viewMode,
      rerender,
    });
  };

  withSkeleton(
    corpoEl,
    { enabled: true, variant: 'report', count: Math.min(Math.max(list.length, 3), 4) },
    renderContent,
  );
}
