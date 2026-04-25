/**
 * CoolTrack Pro - Equipamentos / Hero
 *
 * Extraído de `views/equipamentos.js` como primeiro passo da quebra
 * incremental daquele arquivo (audit §1.1). Aqui vive só o hero do
 * topo da view: KPIs, subtítulo contextual, CTA "Sem setor" e chips
 * de filtro rápido.
 *
 * `views/equipamentos.js` continua sendo o entry point e re-exporta
 * estas funções — ninguém precisa atualizar imports.
 */

import { Utils } from '../../../core/utils.js';
import { getState, regsForEquip } from '../../../core/state.js';
import { evaluateEquipmentPriority } from '../../../domain/priorityEngine.js';
import { getPreventivaDueEquipmentIds } from '../../../domain/alerts.js';
import { getRouteEquipCtx } from './contextState.js';

/**
 * Calcula os 4 KPIs do hero de equipamentos:
 *  - semSetor: equipamentos sem `setorId` atribuído
 *  - emAtencao: priority >= ALTA ou status 'warn'
 *  - criticos: status 'danger'
 *  - preventiva30d: preventivas vencendo nos próximos 30 dias
 *
 * Pure — não toca DOM. Testável isoladamente.
 */
export function computeEquipKpis(state = getState()) {
  const { equipamentos = [], registros = [] } = state || {};
  let semSetor = 0;
  let emAtencao = 0;
  let criticos = 0;

  equipamentos.forEach((eq) => {
    if (!eq.setorId) semSetor += 1;
    const status = Utils.safeStatus(eq.status);
    if (status === 'danger') {
      criticos += 1;
    } else {
      try {
        const regs = regsForEquip(eq.id);
        const priority = evaluateEquipmentPriority(eq, regs);
        if (priority.priorityLevel >= 3 || status === 'warn') emAtencao += 1;
      } catch {
        if (status === 'warn') emAtencao += 1;
      }
    }
  });

  let preventiva30d;
  try {
    preventiva30d = getPreventivaDueEquipmentIds(registros, 30).length;
  } catch {
    preventiva30d = 0;
  }

  return { semSetor, emAtencao, criticos, preventiva30d };
}

/**
 * Renderiza hero "Organizar parque" no slot #equip-hero.
 *
 * Pós-simplificação UX (abr/2026): o hero aparece APENAS quando há
 * equipamentos sem setor. As métricas (críticos/atenção/preventiva) foram
 * unificadas com os chips de filtro logo abaixo (ver `renderEquipFilters`),
 * eliminando a redundância entre os 4 KPI tiles e os 5 chips que faziam
 * praticamente a mesma coisa.
 *
 * `opts.isPro` bifurca o CTA: Pro vê atalho "Organizar agora" (filtro);
 * Free/Plus vê upsell educacional.
 */
export function renderEquipHero(opts = {}) {
  const { isPro = false } = opts || {};
  const hero = Utils.getEl('equip-hero');
  if (!hero) return;
  const { equipamentos = [] } = getState();

  if (!equipamentos.length) {
    hero.setAttribute('hidden', '');
    return;
  }

  const kpis = computeEquipKpis();

  // Hero só aparece quando há equipamentos sem setor — é o único caso em que
  // "Organizar parque" tem utilidade acionável. Os chips contadorados abaixo
  // cobrem críticos/atenção/preventiva sem precisar de duplicação aqui.
  if (kpis.semSetor <= 0) {
    hero.setAttribute('hidden', '');
    return;
  }

  hero.removeAttribute('hidden');

  const sub = Utils.getEl('equip-hero-sub');
  if (sub) {
    const plural = kpis.semSetor !== 1 ? 's' : '';
    sub.textContent = `${kpis.semSetor} equipamento${plural} sem setor — organize pra acompanhar por área.`;
  }

  const ctaSlot = Utils.getEl('equip-hero-sem-setor-cta');
  if (ctaSlot) {
    ctaSlot.removeAttribute('hidden');
    if (isPro) {
      ctaSlot.innerHTML = `
        <button type="button" class="equip-hero__cta-btn equip-hero__cta-btn--action"
                data-action="equip-quickfilter" data-id="sem-setor"
                aria-label="Organizar equipamentos sem setor agora">
          <span>Organizar agora</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
        </button>`;
    } else {
      ctaSlot.innerHTML = `
        <button type="button" class="equip-hero__cta-btn equip-hero__cta-btn--upsell"
                data-action="open-upgrade" data-upgrade-source="equip_sem_setor" data-highlight-plan="pro"
                aria-label="Ver como setores funcionam no plano Pro">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2l2.4 7.4H22l-6.2 4.5L18.2 21 12 16.5 5.8 21l2.4-7.1L2 9.4h7.6z"/></svg>
          <span>Ver como setores funcionam</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
        </button>`;
    }
  }

  // Slot de KPIs: esvaziado pós-simplificação (mantido no HTML pra não
  // exigir mudança no shell template, mas sem conteúdo renderizado).
  const slot = Utils.getEl('equip-hero-kpis');
  if (slot) slot.innerHTML = '';
}

/** Renderiza os chips de quick filter no slot #equip-filters.
 *
 * Cada chip mostra label + contador, unificando o que antes eram 4 KPI tiles
 * + 5 chips. O contador usa os kpis globais já calculados por
 * `computeEquipKpis`. Chips com count=0 ficam visualmente esmaecidos via
 * modifier `--empty` mas continuam clicáveis (filtrar por 0 mostra empty
 * state informativo, útil pro usuário confirmar que não há nada pendente).
 */
export function renderEquipFilters() {
  const bar = Utils.getEl('equip-filters');
  if (!bar) return;
  const { equipamentos = [] } = getState();
  if (!equipamentos.length) {
    bar.setAttribute('hidden', '');
    bar.innerHTML = '';
    return;
  }
  bar.removeAttribute('hidden');
  const active = getRouteEquipCtx().quickFilter || 'todos';
  const kpis = computeEquipKpis();

  const chips = [
    { id: 'todos', label: 'Todos', count: equipamentos.length, tone: 'neutral' },
    { id: 'sem-setor', label: 'Sem setor', count: kpis.semSetor, tone: 'neutral' },
    { id: 'em-atencao', label: 'Em atenção', count: kpis.emAtencao, tone: 'warn' },
    { id: 'criticos', label: 'Críticos', count: kpis.criticos, tone: 'danger' },
    {
      id: 'preventiva-30d',
      label: 'Preventivas em 30 dias',
      count: kpis.preventiva30d,
      tone: 'cyan',
    },
  ];

  bar.innerHTML = chips
    .map((c) => {
      const isActive = c.id === active;
      const isEmpty = c.count === 0 && c.id !== 'todos';
      const safeId = Utils.escapeAttr(c.id);
      const modifiers = [
        isActive ? 'equip-filter--active' : '',
        isEmpty ? 'equip-filter--empty' : '',
        c.count > 0 && c.id !== 'todos' ? `equip-filter--${c.tone}` : '',
      ]
        .filter(Boolean)
        .join(' ');
      return `
        <button type="button" class="equip-filter ${modifiers}"
                data-action="equip-quickfilter" data-id="${safeId}"
                aria-pressed="${isActive ? 'true' : 'false'}"
                aria-label="${Utils.escapeHtml(c.label)}: ${c.count}">
          <span class="equip-filter__label">${Utils.escapeHtml(c.label)}</span>
          <span class="equip-filter__count" aria-hidden="true">${c.count}</span>
        </button>`;
    })
    .join('');
}
