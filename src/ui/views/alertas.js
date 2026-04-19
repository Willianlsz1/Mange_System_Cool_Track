/**
 * CoolTrack Pro - Alertas View v5.1
 * Funcoes: renderAlertas
 */

import { Utils } from '../../core/utils.js';
import { getState } from '../../core/state.js';
import { Alerts, getPreventivaDueEquipmentIds } from '../../domain/alerts.js';
import { emptyStateHtml } from '../components/emptyState.js';
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
  const { equipamentos, registros } = getState();
  const list = Alerts.getAll();
  const preventivas7dCount = getPreventivaDueEquipmentIds(registros, 7).length;
  const el = Utils.getEl('lista-alertas');
  const contextual = Utils.getEl('alertas-contextual');
  if (!el) return;
  if (contextual) {
    contextual.innerHTML =
      preventivas7dCount > 0
        ? `<section class="alertas-context-banner" role="status" aria-live="polite">
            <span class="alertas-context-banner__icon" aria-hidden="true">&#9888;</span>
            <div class="alertas-context-banner__text">Você tem ${preventivas7dCount} preventiva(s) nos próximos 7 dias. Agende agora para evitar parada.</div>
            <button type="button" class="alertas-context-banner__cta" data-action="go-equipamentos-preventiva-7d">Ver equipamentos &rarr;</button>
          </section>`
        : '';
  }

  withSkeleton(
    el,
    { enabled: true, variant: 'alerts', count: Math.min(Math.max(list.length, 3), 5) },
    () => {
      if (list.length) {
        el.innerHTML = list.map(_alertCardHtml).join('');
        return;
      }

      if (!equipamentos.length) {
        el.innerHTML = emptyStateHtml({
          variant: 'engaging',
          ariaLabel: 'Sem equipamentos',
          icon: '🔧',
          title: 'Cadastre um equipamento para receber alertas',
          description:
            'Alertas automáticos identificam quando um equipamento precisa de atenção — sem você precisar lembrar.',
          cta: { label: 'Cadastrar equipamento →', nav: 'equipamentos' },
        });
        return;
      }

      el.innerHTML = emptyStateHtml({
        variant: 'engaging',
        ariaLabel: 'Sem alertas',
        icon: '✅',
        title: 'Tudo em dia!',
        description:
          'Nenhum equipamento precisa de atenção agora. Continue registrando serviços para manter o histórico atualizado.',
        cta: { label: 'Ver todos os equipamentos', nav: 'equipamentos', tone: 'outline' },
      });
    },
  );
}
