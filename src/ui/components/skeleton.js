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

  const cleanup = () => {
    target.removeAttribute('aria-busy');
    target.classList.remove('is-skeleton-loading');
    overlay.remove();
  };

  // rAF duplo garante que o browser pinte o skeleton antes de rodarmos o
  // renderFn (que pode bloquear o main thread por um frame ou mais).
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      let result;
      try {
        result = renderFn();
      } catch (err) {
        cleanup();
        throw err;
      }
      // Se renderFn for async, precisamos esperar resolve/reject para só então
      // remover o overlay — caso contrário o skeleton pisca e some antes
      // do conteúdo real ser inserido.
      if (result && typeof result.then === 'function') {
        result.then(cleanup, (err) => {
          cleanup();
          // Repropaga para não engolir erros silenciosamente
          Promise.reject(err);
          if (typeof console !== 'undefined') {
            console.error('[withSkeleton] renderFn falhou', err);
          }
        });
      } else {
        cleanup();
      }
    });
  });
}

/**
 * Renderiza um conteúdo com skeleton overlay enquanto o renderFn roda.
 * Serve tanto para cards individuais quanto para views inteiras — a única
 * diferença é o `variant` escolhido.
 *
 * @param {HTMLElement} target — container onde o overlay será anexado.
 * @param {{ enabled?: boolean, variant?: 'equipment'|'timeline'|'report'|'alerts'|'generic', count?: number }} options
 * @param {() => void | Promise<void>} renderFn — função de render real.
 */
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
