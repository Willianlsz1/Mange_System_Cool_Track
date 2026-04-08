/**
 * CoolTrack Pro - Events v5.0
 * Delegação global de eventos — só dispara, não contém lógica de negócio
 * Toda lógica está nos handlers injetados pelo controller
 */

import { Utils } from './utils.js';

const _handlers = new Map();

/**
 * Registra um handler para um data-action.
 * Chamado pelo controller.
 *
 * @param {string}   action
 * @param {Function} fn  — recebe (element, event)
 */
export function on(action, fn) {
  _handlers.set(action, fn);
}

export function bindEvents() {
  // Delegação de clique principal
  document.addEventListener('click', async (e) => {
    // data-nav
    const navBtn = e.target.closest('[data-nav]');
    if (navBtn) {
      const { goTo } = await import('./router.js');
      goTo(navBtn.dataset.nav);
      return;
    }

    // data-action
    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;
    if (actionEl.dataset.busy === '1' || actionEl.matches(':disabled, [aria-disabled="true"]')) {
      e.preventDefault();
      return;
    }

    const action = actionEl.dataset.action;
    const handler = _handlers.get(action);
    if (handler) {
      await handler(actionEl, e);
    } else {
      console.warn(`[Events] Sem handler para action="${action}"`);
    }
  });

  // Escape → fecha lightbox
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const lb = Utils.getEl('lightbox');
      if (lb?.classList.contains('is-open')) lb.classList.remove('is-open');
    }
  });

  // Enter/Space em equip-card (acessibilidade)
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const card = e.target.closest('[data-action="view-equip"]');
    if (card) {
      e.preventDefault();
      _handlers.get('view-equip')?.(card, e);
    }
  });
}
