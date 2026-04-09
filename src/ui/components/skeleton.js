const VARIANT_LINES = {
  equipment: ['short', 'full', 'medium', 'full'],
  timeline: ['short', 'medium', 'full', 'medium'],
  report: ['medium', 'short', 'full', 'full'],
  alerts: ['medium', 'full', 'short'],
  generic: ['medium', 'full', 'short'],
};

function lineHtml(size) {
  return `<span class="ui-skeleton__line ui-skeleton__line--${size}"></span>`;
}

function cardHtml(variant) {
  const lines = VARIANT_LINES[variant] || VARIANT_LINES.generic;
  return `<article class="ui-skeleton-card ui-skeleton-card--${variant}" aria-hidden="true">
    ${lines.map(lineHtml).join('')}
  </article>`;
}

function skeletonHtml(variant, count) {
  const total = Math.max(1, Number(count) || 1);
  return `<div class="ui-skeleton-stack ui-skeleton-stack--${variant}">
    ${Array.from({ length: total }, () => cardHtml(variant)).join('')}
  </div>`;
}

export function withSkeleton(target, options, renderFn) {
  if (!(target instanceof HTMLElement) || !(renderFn instanceof Function)) return;
  const { enabled = false, variant = 'generic', count = 3 } = options || {};

  if (!enabled) {
    target.removeAttribute('aria-busy');
    target.classList.remove('is-skeleton-loading');
    renderFn();
    return;
  }

  target.setAttribute('aria-busy', 'true');
  target.classList.add('is-skeleton-loading');
  target.innerHTML = skeletonHtml(variant, count);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      try {
        renderFn();
      } finally {
        target.removeAttribute('aria-busy');
        target.classList.remove('is-skeleton-loading');
      }
    });
  });
}
