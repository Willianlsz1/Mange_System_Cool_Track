/**
 * CoolTrack Pro - Equipamentos / setorCard
 * Renderizador puro do card de setor (vista PRO) + helpers de agregação.
 */

import { Utils } from '../../../core/utils.js';
import { regsForEquip } from '../../../core/state.js';
import { STATUS_LABEL } from './constants.js';

// Módulo de manutenção cacheado para uso síncrono nos cards.
let _maintenanceModule = null;
import('../../../domain/maintenance.js')
  .then((m) => {
    _maintenanceModule = m;
  })
  .catch(() => {});

/** Status "pior" de uma lista de equipamentos: danger > warn > ok. */
export function worstStatus(eqs) {
  if (eqs.some((e) => Utils.safeStatus(e.status) === 'danger')) return 'danger';
  if (eqs.some((e) => Utils.safeStatus(e.status) === 'warn')) return 'warn';
  return 'ok';
}

/** Último técnico a trabalhar em qualquer equipamento do setor. */
export function lastTecnicoInSetor(eqs) {
  let latestReg = null;
  eqs.forEach((eq) => {
    const regs = regsForEquip(eq.id);
    regs.forEach((r) => {
      if (!latestReg || r.data > latestReg.data) latestReg = r;
    });
  });
  return latestReg?.tecnico ?? null;
}

export function setorCardHtml(setor, equipamentosDoSetor) {
  const count = equipamentosDoSetor.length;
  const ws = worstStatus(equipamentosDoSetor);
  const wsLabel = STATUS_LABEL[ws];
  const cor = setor.cor || '#00bcd4';
  const safeId = Utils.escapeAttr(setor.id);

  // Próxima preventiva
  let prevLabel = '—';
  let prevCls = '';
  equipamentosDoSetor.forEach((eq) => {
    try {
      if (!_maintenanceModule) return;
      const ctx = _maintenanceModule.getEquipmentMaintenanceContext(eq, regsForEquip(eq.id));
      if (ctx.proximaPreventiva) {
        const diff = Utils.daysDiff(ctx.proximaPreventiva);
        if (prevLabel === '—' || diff < parseInt(prevLabel)) {
          if (diff < 0) {
            prevLabel = `Vencida ${Math.abs(diff)}d`;
            prevCls = 'setor-card__val--danger';
          } else if (diff <= 7) {
            prevLabel = `Em ${diff}d`;
            prevCls = 'setor-card__val--warn';
          } else prevLabel = `Em ${diff} dias`;
        }
      }
    } catch {
      /* ignora */
    }
  });

  const tecnico = lastTecnicoInSetor(equipamentosDoSetor);
  const tecLabel = tecnico
    ? Utils.truncate(
        tecnico.split(' ')[0] + (tecnico.split(' ')[1] ? ' ' + tecnico.split(' ')[1][0] + '.' : ''),
        16,
      )
    : '—';

  return `
    <div class="setor-card setor-card--${ws}" data-action="open-setor" data-id="${safeId}"
         style="--setor-cor:${Utils.escapeHtml(cor)}" role="button" tabindex="0"
         aria-label="Setor ${Utils.escapeHtml(setor.nome)}: ${count} equipamento${count !== 1 ? 's' : ''}">

      <div class="setor-card__head">
        <div class="setor-card__info">
          <div class="setor-card__nome">${Utils.escapeHtml(setor.nome)}</div>
          <div class="setor-card__count">
            <span class="setor-card__count-dot"></span>
            ${count} equipamento${count !== 1 ? 's' : ''}
          </div>
        </div>
        <span class="setor-card__status setor-card__status--${ws}">${wsLabel}</span>
      </div>

      <div class="setor-card__metrics">
        <div class="setor-card__metric">
          <span class="setor-card__lbl">Próx. preventiva</span>
          <span class="setor-card__val ${prevCls}">${prevLabel}</span>
        </div>
        <div class="setor-card__metric">
          <span class="setor-card__lbl">Último técnico</span>
          <span class="setor-card__val">${Utils.escapeHtml(tecLabel)}</span>
        </div>
      </div>

      <div class="setor-card__cta">
        <span>Ver equipamentos</span>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M5 3l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>

      <button class="setor-card__delete" data-action="delete-setor" data-id="${safeId}"
              aria-label="Excluir setor ${Utils.escapeHtml(setor.nome)}" title="Excluir setor">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
        </svg>
      </button>
    </div>`;
}
