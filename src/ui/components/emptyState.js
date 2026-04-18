import { Utils } from '../../core/utils.js';

function buildCtaHtml(cta) {
  if (!cta || typeof cta !== 'object') return '';
  const label = Utils.escapeHtml(cta.label || 'Continuar');
  const toneClass = cta.tone === 'outline' ? 'btn--outline' : 'btn--primary';
  const sizeClass = cta.size === 'sm' ? ' btn--sm' : '';
  const autoClass = cta.autoWidth ? ' btn--auto' : '';
  const centeredClass = cta.centered ? ' btn--centered' : '';

  const actionAttr = cta.action ? ` data-action="${Utils.escapeAttr(cta.action)}"` : '';
  const idAttr = cta.id ? ` data-id="${Utils.escapeAttr(cta.id)}"` : '';
  const navAttr = cta.nav ? ` data-nav="${Utils.escapeAttr(cta.nav)}"` : '';

  return `<button type="button" class="btn ${toneClass}${sizeClass}${autoClass}${centeredClass}"${actionAttr}${idAttr}${navAttr}>${label}</button>`;
}

export function emptyStateHtml({ icon = '-', title, description = '', cta = null }) {
  return `<div class="empty-state">
    <div class="empty-state__icon">${Utils.escapeHtml(icon)}</div>
    <div class="empty-state__title">${Utils.escapeHtml(title)}</div>
    ${description ? `<div class="empty-state__sub">${Utils.escapeHtml(description)}</div>` : ''}
    ${cta ? `<div class="empty-state__cta">${buildCtaHtml(cta)}</div>` : ''}
  </div>`;
}
