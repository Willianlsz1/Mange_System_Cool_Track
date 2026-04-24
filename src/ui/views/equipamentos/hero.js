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

/** Copy do subtítulo do hero, derivada dos KPIs (evita "0 de tudo" genérico). */
function equipHeroSubCopy({ semSetor, emAtencao, criticos, preventiva30d }) {
  if (criticos > 0) {
    const plural = criticos !== 1 ? 's' : '';
    return `${criticos} equipamento${plural} crítico${plural} precisam de ação imediata.`;
  }
  if (emAtencao > 0) {
    const plural = emAtencao !== 1 ? 's' : '';
    return `${emAtencao} equipamento${plural} pedindo atenção.`;
  }
  if (semSetor > 0) {
    const plural = semSetor !== 1 ? 's' : '';
    return `${semSetor} equipamento${plural} sem setor — organize pra acompanhar por área.`;
  }
  if (preventiva30d > 0) {
    const plural = preventiva30d !== 1 ? 's' : '';
    return `${preventiva30d} preventiva${plural} vencendo nos próximos 30 dias.`;
  }
  return 'Parque em ordem. Monitore as preventivas e organize por setor.';
}

/** Renderiza hero no slot #equip-hero. Idempotente; chamar sempre em render.
 *  `opts.isPro` bifurca o CTA "Sem setor": Pro vê atalho pra organizar,
 *  Free/Plus vê CTA educacional de upsell. */
export function renderEquipHero(opts = {}) {
  const { isPro = false } = opts || {};
  const hero = Utils.getEl('equip-hero');
  if (!hero) return;
  const { equipamentos = [] } = getState();

  if (!equipamentos.length) {
    hero.setAttribute('hidden', '');
    return;
  }

  hero.removeAttribute('hidden');
  const kpis = computeEquipKpis();
  const sub = Utils.getEl('equip-hero-sub');
  if (sub) sub.textContent = equipHeroSubCopy(kpis);

  const ctaSlot = Utils.getEl('equip-hero-sem-setor-cta');
  if (ctaSlot) {
    if (kpis.semSetor <= 0) {
      ctaSlot.setAttribute('hidden', '');
      ctaSlot.innerHTML = '';
    } else {
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
  }

  const slot = Utils.getEl('equip-hero-kpis');
  if (!slot) return;

  const tiles = [
    {
      id: 'sem-setor',
      icon: '#eq-ri-inbox',
      tone: 'neutral',
      value: kpis.semSetor,
      label: 'Sem setor',
    },
    {
      id: 'em-atencao',
      icon: '#eq-ri-alert-triangle',
      tone: kpis.emAtencao > 0 ? 'warn' : 'neutral',
      value: kpis.emAtencao,
      label: 'Em atenção',
    },
    {
      id: 'criticos',
      icon: '#eq-ri-alert-octagon',
      tone: kpis.criticos > 0 ? 'danger' : 'neutral',
      value: kpis.criticos,
      label: 'Críticos',
    },
    {
      id: 'preventiva-30d',
      icon: '#eq-ri-calendar-clock',
      tone: kpis.preventiva30d > 0 ? 'cyan' : 'neutral',
      value: kpis.preventiva30d,
      label: 'Preventivas ≤30d',
    },
  ];

  slot.innerHTML = tiles
    .map((t) => {
      const safeId = Utils.escapeAttr(t.id);
      return `
        <button type="button" class="equip-hero__kpi equip-hero__kpi--${t.tone}" role="listitem"
                data-action="equip-quickfilter" data-id="${safeId}"
                aria-label="${Utils.escapeHtml(t.label)}: ${t.value}. Filtrar por ${Utils.escapeHtml(t.label)}">
          <span class="equip-hero__kpi-icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><use href="${t.icon}"/></svg>
          </span>
          <span class="equip-hero__kpi-value">${t.value}</span>
          <span class="equip-hero__kpi-label">${Utils.escapeHtml(t.label)}</span>
        </button>`;
    })
    .join('');
}

/** Renderiza os chips de quick filter no slot #equip-filters. */
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

  const chips = [
    { id: 'todos', label: 'Todos' },
    { id: 'sem-setor', label: 'Sem setor' },
    { id: 'em-atencao', label: 'Em atenção' },
    { id: 'criticos', label: 'Críticos' },
    { id: 'preventiva-30d', label: 'Preventiva ≤30d' },
  ];

  bar.innerHTML = chips
    .map((c) => {
      const isActive = c.id === active;
      const safeId = Utils.escapeAttr(c.id);
      return `
        <button type="button" class="equip-filter${isActive ? ' equip-filter--active' : ''}"
                data-action="equip-quickfilter" data-id="${safeId}"
                aria-pressed="${isActive ? 'true' : 'false'}">
          ${Utils.escapeHtml(c.label)}
        </button>`;
    })
    .join('');
}
