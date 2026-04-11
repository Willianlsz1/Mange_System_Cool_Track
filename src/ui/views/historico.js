/**
 * CoolTrack Pro - Histórico View v5.0
 * Funções: renderHist, deleteReg
 */

import { Utils } from '../../core/utils.js';
import { getState, findEquip, setState } from '../../core/state.js';
import { Storage } from '../../core/storage.js';
import { Toast } from '../../core/toast.js';
import { goTo } from '../../core/router.js';
import { emptyStateHtml } from '../components/emptyState.js';
import { SavedHighlight } from '../components/onboarding.js';
import { cleanupOrphanSignatures } from '../components/signature.js';
import { withSkeleton } from '../components/skeleton.js';
import { updateHeader } from './dashboard.js';
import { getOperationalStatus } from '../../core/equipmentRules.js';

function toNumber(value) {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function getSummaryMetrics(list) {
  const totalServicos = list.length;
  const custoTotal = list.reduce(
    (acc, reg) => acc + toNumber(reg.custoPecas) + toNumber(reg.custoMaoObra),
    0,
  );
  const preventivas = list
    .filter((reg) => (reg.tipo || '').trim().toLowerCase() === 'preventiva')
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

function renderSummaryCard(list) {
  const { totalServicos, custoTotal, mediaDiasPreventiva } = getSummaryMetrics(list);
  const mediaLabel = mediaDiasPreventiva !== null ? `${mediaDiasPreventiva} dias` : '—';

  return `<section class="hist-summary-card" aria-label="Resumo do período">
    <div class="hist-summary-grid" role="list">
      <div class="hist-summary-item" role="listitem">
        <div class="hist-summary-item__value">${totalServicos}</div>
        <div class="hist-summary-item__label">Serviços registrados</div>
      </div>
      <div class="hist-summary-item__separator" aria-hidden="true">&middot;</div>
      <div class="hist-summary-item" role="listitem">
        <div class="hist-summary-item__value">${formatCurrency(custoTotal)}</div>
        <div class="hist-summary-item__label">Custo total</div>
      </div>
      <div class="hist-summary-item__separator" aria-hidden="true">&middot;</div>
      <div class="hist-summary-item" role="listitem">
        <div class="hist-summary-item__value">${mediaLabel}</div>
        <div class="hist-summary-item__label">Média entre preventivas</div>
      </div>
    </div>
    <div class="hist-summary-upsell">
      <span>📊 Economize 3h/semana com relatórios automáticos</span>
      <button type="button" class="hist-summary-upsell__link" data-action="hist-pricing-link">Ver planos &rarr;</button>
    </div>
  </section>`;
}

export function renderHist() {
  const { registros } = getState();
  cleanupOrphanSignatures(registros.map((r) => r.id));
  const busca = Utils.getVal('hist-busca').toLowerCase();
  const filtEq = Utils.getVal('hist-equip');

  let list = [...registros].sort((a, b) => b.data.localeCompare(a.data));
  if (filtEq) list = list.filter((r) => r.equipId === filtEq);
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
  if (countEl)
    countEl.textContent = list.length
      ? `${list.length} registro${list.length !== 1 ? 's' : ''}`
      : '';

  const scrollRoot = document.scrollingElement || document.documentElement;
  const prevScrollTop = scrollRoot ? scrollRoot.scrollTop : window.scrollY;

  const renderTimeline = () => {
    const summaryCard = renderSummaryCard(list);

    if (!list.length) {
      el.innerHTML =
        busca || filtEq
          ? `${summaryCard}${emptyStateHtml({
              icon: '🔍',
              title: 'Nenhum resultado para esse filtro',
              description: 'Tente outro termo ou remova o filtro.',
            })}`
          : `${summaryCard}<section class="engaging-empty-state" aria-label="Histórico vazio">
              <div class="engaging-empty-state__icon">📋</div>
              <h3 class="engaging-empty-state__title">Nenhum serviço registrado ainda</h3>
              <p class="engaging-empty-state__description">Cada serviço registrado vira um relatório profissional pronto para o cliente. Técnicos que registram aqui economizam em média 3 horas por semana.</p>
              <button class="btn btn--primary engaging-empty-state__cta" data-nav="registro">Registrar meu primeiro serviço &rarr;</button>
              <div class="engaging-empty-state__microcopy">Leva menos de 2 minutos</div>
            </section>`;
      el.querySelector('[data-action="hist-pricing-link"]')?.addEventListener('click', () =>
        goTo('pricing'),
      );
      return;
    }

    el.innerHTML = `${summaryCard}<div class="timeline">${list
      .map((r, idx) => {
        const eq = findEquip(r.equipId);
        const safeStatus = Utils.safeStatus(r.status);
        const dotMod = safeStatus !== 'ok' ? `timeline__dot--${safeStatus}` : '';
        const custoTotal = parseFloat(r.custoPecas || 0) + parseFloat(r.custoMaoObra || 0);
        const isFirst = idx === 0;
        const isToday = r.data.slice(0, 10) === Utils.localDateString();

        return `<div class="timeline__item${isFirst ? ' timeline__item--latest' : ''}" role="listitem" data-reg-id="${Utils.escapeAttr(r.id)}">
        ${isFirst ? `<div class="timeline__recency-badge">Mais recente</div>` : ''}
        <div class="timeline__dot ${dotMod}"></div>
        <div class="timeline__item-inner">
          <div class="timeline__date">${isToday ? '<span class="timeline__today-badge">Hoje</span> ' : ''}${Utils.formatDatetime(r.data)}</div>
          <div class="timeline__title">${Utils.escapeHtml(r.tipo)}</div>
          <div class="timeline__equip">${Utils.escapeHtml(eq?.nome ?? '—')} &middot; ${Utils.escapeHtml(eq?.tag ?? eq?.local ?? '')}</div>
          <div class="timeline__obs">${Utils.escapeHtml(r.obs)}</div>
          ${r.pecas ? `<div class="timeline__parts">Peças: ${Utils.escapeHtml(r.pecas)}</div>` : ''}
          ${r.tecnico ? `<div class="timeline__parts">Técnico: ${Utils.escapeHtml(r.tecnico)}</div>` : ''}
          ${custoTotal > 0 ? `<div class="timeline__parts timeline__custo">Total: R$ ${custoTotal.toFixed(2).replace('.', ',')}</div>` : ''}
          ${r.proxima ? `<div class="timeline__next">Próxima: ${Utils.formatDate(r.proxima)}</div>` : ''}
          ${r.assinatura ? `<div class="timeline__signed"><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" stroke="var(--success)" stroke-width="1"/><path d="M3.5 6l1.5 1.5 3-3" stroke="var(--success)" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg> Assinado pelo cliente</div>` : ''}
          <div class="timeline__actions">
            <button class="timeline__delete" data-action="edit-reg" data-id="${Utils.escapeAttr(r.id)}" aria-label="Editar registro">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="timeline__delete" data-action="delete-reg" data-id="${Utils.escapeAttr(r.id)}" aria-label="Excluir registro de ${Utils.escapeHtml(r.tipo)}">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
      </div>`;
      })
      .join('')}</div>`;
    el.querySelector('[data-action="hist-pricing-link"]')?.addEventListener('click', () =>
      goTo('pricing'),
    );

    if (prevScrollTop > 0) {
      requestAnimationFrame(() => {
        if (scrollRoot) scrollRoot.scrollTop = prevScrollTop;
        else window.scrollTo(0, prevScrollTop);
      });
    }

    // H5: highlight do item recém-salvo
    SavedHighlight.applyIfPending();
  };

  withSkeleton(
    el,
    { enabled: true, variant: 'timeline', count: Math.min(Math.max(list.length, 3), 5) },
    renderTimeline,
  );
}

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
