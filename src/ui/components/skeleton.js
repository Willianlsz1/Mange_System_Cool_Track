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

function createOverlay(variant, count) {
  const overlay = document.createElement('div');
  overlay.className = 'ui-skeleton-overlay';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.innerHTML = skeletonHtml(variant, count);
  return overlay;
}

function runWithLoadingState(target, variant, count, renderFn) {
  target.setAttribute('aria-busy', 'true');
  target.classList.add('is-skeleton-loading');
  const overlay = createOverlay(variant, count);
  target.appendChild(overlay);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      try {
        renderFn();
      } finally {
        target.removeAttribute('aria-busy');
        target.classList.remove('is-skeleton-loading');
        overlay.remove();
      }
    });
  });
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

  runWithLoadingState(target, variant, count, renderFn);
}

export function withViewSkeleton(target, options, renderFn) {
  if (!(target instanceof HTMLElement) || !(renderFn instanceof Function)) return;
  const { enabled = false, variant = 'generic', count = 3 } = options || {};

  if (!enabled) {
    target.removeAttribute('aria-busy');
    target.classList.remove('is-skeleton-loading');
    renderFn();
    return;
  }

  runWithLoadingState(target, variant, count, renderFn);
}
