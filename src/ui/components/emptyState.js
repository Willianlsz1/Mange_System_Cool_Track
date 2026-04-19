import { Utils } from '../../core/utils.js';

function buildCtaHtml(cta, { variant = 'default' } = {}) {
  if (!cta || typeof cta !== 'object') return '';
  const label = Utils.escapeHtml(cta.label || 'Continuar');
  const toneClass = cta.tone === 'outline' ? 'btn--outline' : 'btn--primary';
  const sizeClass = cta.size === 'sm' ? ' btn--sm' : '';
  const autoClass = cta.autoWidth ? ' btn--auto' : '';
  const centeredClass = cta.centered ? ' btn--centered' : '';
  // No modo engaging, o botão herda a largura do container (width:100%)
  const extraClass = variant === 'engaging' ? ' engaging-empty-state__cta' : '';

  const actionAttr = cta.action ? ` data-action="${Utils.escapeAttr(cta.action)}"` : '';
  const idAttr = cta.id ? ` data-id="${Utils.escapeAttr(cta.id)}"` : '';
  const navAttr = cta.nav ? ` data-nav="${Utils.escapeAttr(cta.nav)}"` : '';

  return `<button type="button" class="btn ${toneClass}${sizeClass}${autoClass}${centeredClass}${extraClass}"${actionAttr}${idAttr}${navAttr}>${label}</button>`;
}

/**
 * Renderiza um empty-state padronizado em duas variantes:
 *
 * - `default`: versão compacta. Usada para "sem resultado pra esse filtro",
 *   listas vazias secundárias, etc.
 * - `engaging`: versão emotiva/conversão. Usada para o primeiro uso de uma
 *   feature (histórico vazio, sem alertas, sem relatórios), com microcopy
 *   opcional abaixo do CTA.
 *
 * @param {{
 *   icon?: string,
 *   title: string,
 *   description?: string,
 *   cta?: { label: string, action?: string, id?: string, nav?: string, tone?: 'primary'|'outline', size?: 'sm', autoWidth?: boolean, centered?: boolean } | null,
 *   variant?: 'default' | 'engaging',
 *   microcopy?: string,
 *   ariaLabel?: string,
 * }} opts
 */
export function emptyStateHtml({
  icon = '-',
  title,
  description = '',
  cta = null,
  variant = 'default',
  microcopy = '',
  ariaLabel = '',
}) {
  if (variant === 'engaging') {
    const labelAttr = ariaLabel ? ` aria-label="${Utils.escapeAttr(ariaLabel)}"` : '';
    return `<section class="engaging-empty-state"${labelAttr}>
      <div class="engaging-empty-state__icon">${Utils.escapeHtml(icon)}</div>
      <h3 class="engaging-empty-state__title">${Utils.escapeHtml(title)}</h3>
      ${description ? `<p class="engaging-empty-state__description">${Utils.escapeHtml(description)}</p>` : ''}
      ${cta ? buildCtaHtml(cta, { variant: 'engaging' }) : ''}
      ${microcopy ? `<div class="engaging-empty-state__microcopy">${Utils.escapeHtml(microcopy)}</div>` : ''}
    </section>`;
  }

  return `<div class="empty-state">
    <div class="empty-state__icon">${Utils.escapeHtml(icon)}</div>
    <div class="empty-state__title">${Utils.escapeHtml(title)}</div>
    ${description ? `<div class="empty-state__sub">${Utils.escapeHtml(description)}</div>` : ''}
    ${cta ? `<div class="empty-state__cta">${buildCtaHtml(cta)}</div>` : ''}
  </div>`;
}
