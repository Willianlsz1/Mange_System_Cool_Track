/**
 * CoolTrack Pro - Histórico View v5.0
 * Funções: renderHist, deleteReg
 */

import { Utils } from '../../core/utils.js';
import { getState, findEquip, setState } from '../../core/state.js';
import { Storage } from '../../core/storage.js';
import { Toast } from '../../core/toast.js';
import { emptyStateHtml } from '../components/emptyState.js';
import { SavedHighlight } from '../components/onboarding.js';
import { cleanupOrphanSignatures } from '../components/signature.js';
import { withSkeleton } from '../components/skeleton.js';
import { updateHeader } from './dashboard.js';

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

  if (!list.length) {
    el.innerHTML =
      busca || filtEq
        ? emptyStateHtml({
            icon: '🔍',
            title: 'Nenhum resultado para esse filtro',
            description: 'Tente outro termo ou remova o filtro.',
          })
        : emptyStateHtml({
            icon: '📋',
            title: 'Nenhum registro ainda',
            description: 'Registre o primeiro serviço para formar o histórico.',
            ctaHtml:
              '<button class="btn btn--primary btn--sm btn--auto" data-nav="registro">Registrar serviço</button>',
          });
    return;
  }

  const scrollRoot = document.getElementById('main-content');
  const prevScrollTop = scrollRoot ? scrollRoot.scrollTop : window.scrollY;

  const renderTimeline = () => {
    el.innerHTML = `<div class="timeline">${list
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
          <div class="timeline__equip">${Utils.escapeHtml(eq?.nome ?? '—')} · ${Utils.escapeHtml(eq?.tag ?? eq?.local ?? '')}</div>
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
    { enabled: list.length >= 14, variant: 'timeline', count: Math.min(list.length, 5) },
    renderTimeline,
  );
}

export function deleteReg(id) {
  Storage.markRegistroDeleted(id);
  setState((prev) => {
    const reg = prev.registros.find((r) => r.id === id);
    const regs = prev.registros.filter((r) => r.id !== id);
    if (!reg) return { ...prev, registros: regs };
    const last = regs
      .filter((r) => r.equipId === reg.equipId)
      .sort((a, b) => b.data.localeCompare(a.data))[0];
    const equips = prev.equipamentos.map((eq) =>
      eq.id === reg.equipId ? { ...eq, status: last?.status || 'ok' } : eq,
    );
    return { ...prev, registros: regs, equipamentos: equips };
  });
  localStorage.removeItem(`cooltrack-sig-${id}`);
  renderHist();
  updateHeader();
  Toast.warning('Registro removido do histórico.');
}
