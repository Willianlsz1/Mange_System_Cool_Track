/**
 * CoolTrack Pro — Hist Scroll Auto-Hide
 *
 * Esconde a `.hist-sticky-header` (título + botão Gerar Relatório + busca + filtros)
 * ao rolar para baixo e a traz de volta ao rolar para cima. Só atua quando a
 * view do Histórico está ativa.
 *
 * Decisões:
 * - Listener no `window` (scroll do documento). O app não tem scroll container
 *   interno — `body`/`#app`/`main` rolam junto.
 * - Throttle via `requestAnimationFrame` para evitar trabalho a cada pixel.
 * - Threshold pequeno (4px) para evitar "tremelique" em trackpads sensíveis.
 * - Só esconde depois que o usuário desceu pelo menos `MIN_HIDE_OFFSET` px,
 *   garantindo que a barra fica visível no topo da view.
 */

const MIN_HIDE_OFFSET = 80;
const DELTA_THRESHOLD = 4;
const HIDDEN_CLASS = 'is-hidden';
const HIST_VIEW_ID = 'view-historico';
const HIST_HEADER_ID = 'hist-sticky-header';

let lastScrollY = 0;
let ticking = false;
let bound = false;

function getScrollY() {
  return window.scrollY || window.pageYOffset || 0;
}

function isHistActive() {
  const view = document.getElementById(HIST_VIEW_ID);
  return !!(view && view.classList.contains('active'));
}

function getHeaderEl() {
  return document.getElementById(HIST_HEADER_ID);
}

function update() {
  ticking = false;

  const header = getHeaderEl();
  if (!header) return;

  // Quando a view do histórico não está ativa, garantimos que a barra
  // está em estado "visível" — não queremos que ela apareça escondida
  // ao usuário voltar para a aba.
  if (!isHistActive()) {
    if (header.classList.contains(HIDDEN_CLASS)) {
      header.classList.remove(HIDDEN_CLASS);
    }
    lastScrollY = getScrollY();
    return;
  }

  const currentY = getScrollY();
  const delta = currentY - lastScrollY;

  // Mudança muito pequena: ignora (evita flicker em trackpad/mouse de roda fina)
  if (Math.abs(delta) < DELTA_THRESHOLD) {
    return;
  }

  // Sempre garante visível perto do topo da página, independente da direção.
  if (currentY < MIN_HIDE_OFFSET) {
    header.classList.remove(HIDDEN_CLASS);
    lastScrollY = currentY;
    return;
  }

  if (delta > 0) {
    // Rolando para baixo → esconde
    if (!header.classList.contains(HIDDEN_CLASS)) {
      header.classList.add(HIDDEN_CLASS);
    }
  } else {
    // Rolando para cima → mostra
    if (header.classList.contains(HIDDEN_CLASS)) {
      header.classList.remove(HIDDEN_CLASS);
    }
  }

  lastScrollY = currentY;
}

function onScroll() {
  if (ticking) return;
  ticking = true;
  window.requestAnimationFrame(update);
}

/**
 * Reset do estado quando o usuário troca de view (ex.: navega para Histórico):
 * mostra a barra e zera o último scroll.
 */
function onViewChanged() {
  const header = getHeaderEl();
  if (header && header.classList.contains(HIDDEN_CLASS)) {
    header.classList.remove(HIDDEN_CLASS);
  }
  lastScrollY = getScrollY();
}

export function initHistScrollAutoHide() {
  if (bound) return;
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  lastScrollY = getScrollY();

  window.addEventListener('scroll', onScroll, { passive: true });

  // Reagimos a cliques na navegação inferior — quando o usuário entra no
  // Histórico, garantimos que a barra esteja visível.
  document.addEventListener(
    'click',
    (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const navBtn = target.closest('[data-nav]');
      if (!navBtn) return;
      // Damos um pequeno delay para a view ativar antes de resetar
      window.setTimeout(onViewChanged, 50);
    },
    { passive: true },
  );

  bound = true;
}
