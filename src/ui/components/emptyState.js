import { Utils } from '../../core/utils.js';

export function emptyStateHtml({ icon = '-', title, description = '', ctaHtml = '' }) {
  return `<div class="empty-state">
    <div class="empty-state__icon">${Utils.escapeHtml(icon)}</div>
    <div class="empty-state__title">${Utils.escapeHtml(title)}</div>
    ${description ? `<div class="empty-state__sub">${Utils.escapeHtml(description)}</div>` : ''}
    ${ctaHtml ? `<div class="empty-state__cta">${ctaHtml}</div>` : ''}
  </div>`;
}
