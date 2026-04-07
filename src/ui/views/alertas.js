/**
 * CoolTrack Pro - Alertas View v5.0
 * Funções: renderAlertas
 */

import { Utils } from '../../core/utils.js';
import { findEquip } from '../../core/state.js';
import { Alerts } from '../../domain/alerts.js';

function _alertCardHtml({ kind, reg, eq }) {
  if (kind === 'critical') {
    return `<div class="alert-card alert-card--critical" data-nav="alertas" role="listitem">
      <span class="alert-card__icon">🔴</span>
      <div>
        <div class="alert-card__title">Equipamento fora de operação</div>
        <div class="alert-card__sub">Requer intervenção imediata</div>
        <div class="alert-card__equip">${Utils.escapeHtml(eq.nome)}</div>
      </div>
    </div>`;
  }
  const equip = findEquip(reg.equipId);
  if (kind === 'overdue') {
    return `<div class="alert-card alert-card--critical" data-nav="alertas" role="listitem">
      <span class="alert-card__icon">⚠️</span>
      <div>
        <div class="alert-card__title">Manutenção preventiva vencida</div>
        <div class="alert-card__sub">${Utils.escapeHtml(reg.tipo)}</div>
        <div class="alert-card__equip">${Utils.escapeHtml(equip?.nome ?? '—')}</div>
      </div>
    </div>`;
  }
  return `<div class="alert-card" data-nav="alertas" role="listitem">
    <span class="alert-card__icon">🔔</span>
    <div>
      <div class="alert-card__title">Manutenção em ${Utils.daysDiff(reg.proxima)} dia(s)</div>
      <div class="alert-card__sub">${Utils.escapeHtml(reg.tipo)}</div>
      <div class="alert-card__equip">${Utils.escapeHtml(equip?.nome ?? '—')}</div>
    </div>
  </div>`;
}

export function renderAlertas() {
  const list = Alerts.getAll();
  const el = Utils.getEl('lista-alertas');
  if (!el) return;
  el.innerHTML = list.length
    ? list.map(_alertCardHtml).join('')
    : `<div class="empty-state"><div class="empty-state__icon">✅</div><div class="empty-state__title">Sem alertas ativos</div><div class="empty-state__sub">Todos os equipamentos dentro do prazo</div></div>`;
}
