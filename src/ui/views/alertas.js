/**
 * CoolTrack Pro - Alertas View v5.1
 * Funcoes: renderAlertas
 */

import { Utils } from '../../core/utils.js';
import { getState } from '../../core/state.js';
import { Alerts } from '../../domain/alerts.js';
import { withSkeleton } from '../components/skeleton.js';

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
  const { equipamentos } = getState();
  const list = Alerts.getAll();
  const el = Utils.getEl('lista-alertas');
  if (!el) return;

  withSkeleton(
    el,
    { enabled: true, variant: 'alerts', count: Math.min(Math.max(list.length, 3), 5) },
    () => {
      if (list.length) {
        el.innerHTML = list.map(_alertCardHtml).join('');
        return;
      }

      if (!equipamentos.length) {
        el.innerHTML = `<section class="engaging-empty-state" aria-label="Sem equipamentos">
          <div class="engaging-empty-state__icon">🔧</div>
          <h3 class="engaging-empty-state__title">Cadastre um equipamento para receber alertas</h3>
          <p class="engaging-empty-state__description">Alertas automáticos identificam quando um equipamento precisa de atenção — sem você precisar lembrar.</p>
          <button class="btn btn--primary engaging-empty-state__cta" data-nav="equipamentos">Cadastrar equipamento →</button>
        </section>`;
        return;
      }

      el.innerHTML = `<section class="engaging-empty-state" aria-label="Sem alertas">
        <div class="engaging-empty-state__icon">✅</div>
        <h3 class="engaging-empty-state__title">Tudo em dia!</h3>
        <p class="engaging-empty-state__description">Nenhum equipamento precisa de atenção agora. Continue registrando serviços para manter o histórico atualizado.</p>
        <button class="btn btn--outline engaging-empty-state__cta" data-nav="equipamentos">Ver todos os equipamentos</button>
      </section>`;
    },
  );
}
