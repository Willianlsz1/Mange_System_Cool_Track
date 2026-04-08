/**
 * CoolTrack Pro - Alertas View v5.1
 * Funcoes: renderAlertas
 */

import { Utils } from '../../core/utils.js';
import { Alerts } from '../../domain/alerts.js';
import { emptyStateHtml } from '../components/emptyState.js';

function getAlertActionMeta(alert) {
  const id = Utils.escapeAttr(alert.eq?.id || '');
  switch (alert.recommendedAction) {
    case 'register-now':
      return { action: 'go-register-equip', id };
    case 'schedule':
      return { action: 'go-register-equip', id };
    case 'start-history':
      return { action: 'go-register-equip', id };
    case 'inspect':
      return { action: 'view-equip', id };
    default:
      return { action: 'view-equip', id };
  }
}

function _alertCardHtml(alert) {
  const actionMeta = getAlertActionMeta(alert);
  const toneClass = alert.severity === 'danger' ? ' alert-card--critical' : '';
  return `<div class="alert-card${toneClass}" data-action="${actionMeta.action}" data-id="${actionMeta.id}" role="listitem" tabindex="0">
    <span class="alert-card__icon">${Utils.escapeHtml(alert.icon || '!')}</span>
    <div>
      <div class="alert-card__title">${Utils.escapeHtml(alert.title)}</div>
      <div class="alert-card__sub">${Utils.escapeHtml(alert.subtitle || '')}</div>
      <div class="alert-card__equip">${Utils.escapeHtml(alert.eq?.nome ?? alert.equipmentName ?? '-')}</div>
    </div>
  </div>`;
}

export function renderAlertas() {
  const list = Alerts.getAll();
  const el = Utils.getEl('lista-alertas');
  if (!el) return;
  el.innerHTML = list.length
    ? list.map(_alertCardHtml).join('')
    : emptyStateHtml({
        icon: 'OK',
        title: 'Sem alertas ativos',
        description: 'Todos os equipamentos estão dentro da rotina prevista.',
      });
}
