/**
 * CoolTrack Pro - Dashboard / alerts
 * Renderização da alert-strip, cards de alerta, critical-now items e
 * do bloco "Próxima ação".
 */

import { Utils } from '../../../core/utils.js';
import { ACTION_CODE } from '../../../domain/suggestedAction.js';
import { getMostSevereAlert } from './metrics.js';

export function getAlertActionMeta(alert) {
  const id = Utils.escapeAttr(alert.eq?.id || '');
  switch (alert.recommendedAction) {
    case 'register-now':
      return { action: 'go-register-equip', id, label: 'Registrar agora' };
    case 'schedule':
      return { action: 'go-register-equip', id, label: 'Registrar serviço preventivo' };
    case 'start-history':
      return { action: 'go-register-equip', id, label: 'Iniciar historico' };
    case 'inspect':
      return { action: 'view-equip', id, label: 'Abrir equipamento' };
    default:
      return { action: 'view-equip', id, label: 'Ver equipamento' };
  }
}

export function alertCardHtml(alert) {
  const actionMeta = getAlertActionMeta(alert);
  const toneClass = alert.severity === 'danger' ? ' alert-card--critical' : '';
  const sub = Utils.truncate(alert.subtitle || '', 56);
  return `<div class="alert-card${toneClass}" data-action="${actionMeta.action}" data-id="${actionMeta.id}" role="listitem" tabindex="0">
    <span class="alert-card__icon">${alert.icon || '!'}</span>
    <div class="alert-card__body">
      <div class="alert-card__equip">${Utils.escapeHtml(alert.eq?.nome ?? alert.equipmentName ?? '—')}</div>
      <div class="alert-card__title">${alert.title}</div>
      ${sub ? `<div class="alert-card__sub">${sub}</div>` : ''}
    </div>
    <span class="alert-card__action">&rarr; Agir</span>
  </div>`;
}

export function criticalNowItemHtml({
  icon = '!',
  tone = 'danger',
  title = 'Ação imediata',
  subtitle = '',
  action = 'view-equip',
  id = '',
  ctaLabel = 'Abrir',
}) {
  return `<button class="critical-now-item critical-now-item--${tone}" data-action="${Utils.escapeAttr(action)}" data-id="${Utils.escapeAttr(id)}">
    <span class="critical-now-item__icon" aria-hidden="true">${icon}</span>
    <span class="critical-now-item__body">
      <span class="critical-now-item__title">${title}</span>
      ${subtitle ? `<span class="critical-now-item__subtitle">${subtitle}</span>` : ''}
    </span>
    <span class="critical-now-item__cta">${ctaLabel}</span>
  </button>`;
}

export function getActionButton(actionCode) {
  if (
    actionCode === ACTION_CODE.REGISTER_CORRECTIVE_IMMEDIATE ||
    actionCode === ACTION_CODE.REGISTER_CORRECTIVE ||
    actionCode === ACTION_CODE.REGISTER_PREVENTIVE
  ) {
    return { action: 'go-register-equip', ctaLabel: 'Registrar' };
  }
  if (actionCode === ACTION_CODE.SCHEDULE_PREVENTIVE) {
    return { action: 'go-register-equip', ctaLabel: 'Programar' };
  }
  return { action: 'view-equip', ctaLabel: 'Ver' };
}

export function renderAlertStrip(alerts, hasCritical = false) {
  const el = Utils.getEl('dash-alert-strip');
  if (!el) return;
  const primary = getMostSevereAlert(alerts);
  if (!hasCritical && !primary) {
    el.innerHTML = `<div class="alert-strip alert-strip--none">
      <div class="alert-strip__icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="var(--success)" stroke-width="1.3"/><path d="M5 8l2 2 4-4" stroke="var(--success)" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
      <div><div class="alert-strip__title">Todos os equipamentos operando normalmente</div><div class="alert-strip__desc">Sem anormalidades críticas registradas em campo</div></div>
    </div>`;
    return;
  }
  if (!primary) {
    el.innerHTML = '';
    return;
  }

  if (hasCritical) {
    const actionMeta = getAlertActionMeta(primary);
    const preventiveText = primary.nextDueDate
      ? `🛠 Prev.: ${Utils.formatDate(primary.nextDueDate)}`
      : '🛠 Preventiva em atraso';
    el.innerHTML = `<div class="critical-incident" role="alert" aria-live="assertive">
      <div class="critical-incident__label">SITUAÇÃO CRÍTICA</div>
      <div class="critical-incident__title">${Utils.escapeHtml(primary.eq?.nome || 'Equipamento não identificado')}</div>
      <div class="critical-incident__desc">&#9888; ${Utils.truncate(primary.title || primary.subtitle || 'Intervenção imediata necessária.', 92)}</div>
      <div class="critical-incident__meta">${Utils.escapeHtml(preventiveText)} &middot; &rarr; Ação imediata</div>
      <button class="btn btn--danger btn--sm btn--fit-content critical-incident__cta" data-action="${actionMeta.action}" data-id="${actionMeta.id}">Registrar agora</button>
    </div>`;
    return;
  }

  const detailParts = [];
  if (primary.eq?.nome) detailParts.push(Utils.escapeHtml(primary.eq.nome));
  if (primary.subtitle) detailParts.push(primary.subtitle);
  const detail = detailParts.join(' &middot; ');
  const meta = primary.reg?.data
    ? `Ult. serviço: ${Utils.formatDatetime(primary.reg.data)}`
    : primary.nextDueDate
      ? `Próxima preventiva: ${Utils.formatDate(primary.nextDueDate)}`
      : '';
  const actionMeta = getAlertActionMeta(primary);
  const toneClass =
    primary.severity === 'danger'
      ? 'alert-strip--critical'
      : primary.severity === 'warn'
        ? 'alert-strip--warn'
        : 'alert-strip--info';

  el.innerHTML = `<div class="alert-strip ${toneClass}" role="alert" aria-live="assertive">
    <div class="alert-strip__icon" aria-hidden="true">${primary.icon || '!'}</div>
    <div class="alert-strip__content">
      <div class="alert-strip__title">${primary.title}</div>
      <div class="alert-strip__desc">${detail}</div>
      ${meta ? `<div class="alert-strip__time">${Utils.escapeHtml(meta)}</div>` : ''}
    </div>
    <button class="btn ${primary.severity === 'danger' ? 'btn--danger' : 'btn--primary'} btn--sm btn--fit-content alert-strip__cta" data-action="${actionMeta.action}" data-id="${actionMeta.id}">${actionMeta.label}</button>
  </div>`;
}

export function renderNextAction(equipamentos, alerts) {
  const el = Utils.getEl('dash-next-action');
  if (!el) return;
  if (!equipamentos.length) {
    el.innerHTML = '';
    return;
  }

  const primaryAlert = getMostSevereAlert(alerts);
  if (primaryAlert) {
    const actionMeta = getAlertActionMeta(primaryAlert);
    const cardClass =
      primaryAlert.severity === 'danger'
        ? 'next-action-card next-action-card--urgent'
        : primaryAlert.kind === 'no-history'
          ? 'next-action-card next-action-card--invite'
          : 'next-action-card';

    el.innerHTML = `<div class="${cardClass}" data-action="${actionMeta.action}" data-id="${actionMeta.id}">
      <div class="next-action-card__icon">${primaryAlert.icon || '!'}</div>
      <div class="next-action-card__body">
        <div class="next-action-card__label">${primaryAlert.title.toUpperCase()}</div>
        <div class="next-action-card__title">${Utils.escapeHtml(primaryAlert.eq?.nome || '—')}</div>
        <div class="next-action-card__sub">${primaryAlert.subtitle || ''}</div>
      </div>
      <button class="btn ${primaryAlert.severity === 'danger' ? 'btn--danger' : 'btn--primary'} btn--sm btn--fit-content" data-action="${actionMeta.action}" data-id="${actionMeta.id}">${actionMeta.label}</button>
    </div>`;
    return;
  }

  el.innerHTML = `<div class="next-action-card next-action-card--ok">
    <div class="next-action-card__icon">OK</div>
    <div class="next-action-card__body">
      <div class="next-action-card__label">NENHUMA AÇÃO URGENTE</div>
      <div class="next-action-card__title">Todas as rotinas estão dentro do prazo</div>
      <div class="next-action-card__sub">Continue registrando os serviços para manter o histórico atualizado</div>
    </div>
  </div>`;
}
