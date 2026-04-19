/**
 * CoolTrack Pro - Modal Module v3.4
 * Extraído de ui.js. Responsável por Modal e CustomConfirm.
 */

import { Utils } from './utils.js';

function afterAnimation(element, fallbackMs, callback) {
  if (!element) {
    callback();
    return;
  }

  let settled = false;
  const finish = () => {
    if (settled) return;
    settled = true;
    element.removeEventListener('animationend', onAnimationEnd);
    window.clearTimeout(timeoutId);
    callback();
  };
  const onAnimationEnd = (event) => {
    if (event.target === element) finish();
  };
  const timeoutId = window.setTimeout(finish, fallbackMs);

  element.addEventListener('animationend', onAnimationEnd);
}

export const Modal = {
  open(id) {
    const modalEl = Utils.getEl(id);
    if (!modalEl) return;
    modalEl._returnFocusEl =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    modalEl.classList.add('is-open');
    const modalContent = modalEl.querySelector('.modal');
    if (modalContent) modalContent.classList.remove('is-closing');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const firstInput = modalEl.querySelector(
          '[autofocus], .form-control, button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        );
        if (firstInput instanceof HTMLElement) firstInput.focus();
      });
    });
    this._enableTabTrap(modalEl);
  },

  close(id) {
    const modalEl = Utils.getEl(id);
    if (!modalEl) return;
    const modalContent = modalEl.querySelector('.modal');
    const restoreFocus = () => {
      this._disableTabTrap(modalEl);
      const returnFocusEl = modalEl._returnFocusEl;
      modalEl._returnFocusEl = null;
      if (returnFocusEl instanceof HTMLElement && document.contains(returnFocusEl)) {
        returnFocusEl.focus();
      }
    };
    if (modalContent) {
      modalContent.classList.add('is-closing');
      afterAnimation(modalContent, 220, () => {
        modalEl.classList.remove('is-open');
        modalContent.classList.remove('is-closing');
        restoreFocus();
      });
    } else {
      modalEl.classList.remove('is-open');
      restoreFocus();
    }
  },

  init() {
    document.querySelectorAll('.modal-overlay').forEach((el) => {
      el.addEventListener('click', (e) => {
        if (e.target === el) this.close(el.id);
      });
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && el.classList.contains('is-open')) this.close(el.id);
      });
    });

    // Lightbox: fechar ao clicar no overlay (fix: lightbox sem fechar no overlay)
    const lightbox = Utils.getEl('lightbox');
    if (lightbox) {
      lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) lightbox.classList.remove('is-open');
      });
    }
  },

  _enableTabTrap(modalEl) {
    const focusable = modalEl.querySelectorAll(
      'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    modalEl._tabTrapHandler = (e) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    modalEl.addEventListener('keydown', modalEl._tabTrapHandler);
  },

  _disableTabTrap(modalEl) {
    if (modalEl?._tabTrapHandler) {
      modalEl.removeEventListener('keydown', modalEl._tabTrapHandler);
      modalEl._tabTrapHandler = null;
    }
  },
};

/**
 * attachDialogA11y — adiciona Escape, focus trap e focus inicial a um overlay
 * criado dinamicamente (fora do fluxo Modal.open/close).
 * Retorna uma função `cleanup()` que remove os listeners e restaura o foco.
 *
 * Uso:
 *   const detach = attachDialogA11y(overlay, { onDismiss: () => overlay.remove() });
 *   // ...quando fechar, chamar detach() antes de remover
 */
export function attachDialogA11y(overlay, { onDismiss } = {}) {
  if (!(overlay instanceof HTMLElement)) return () => {};

  const returnFocusEl =
    document.activeElement instanceof HTMLElement ? document.activeElement : null;

  const focusableSelector =
    'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onDismiss?.();
      return;
    }
    if (event.key !== 'Tab') return;
    const nodes = overlay.querySelectorAll(focusableSelector);
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (event.shiftKey) {
      if (document.activeElement === first || !overlay.contains(document.activeElement)) {
        event.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  };

  overlay.addEventListener('keydown', onKeyDown);

  // Foca o primeiro elemento focável no próximo frame (garante DOM pronto).
  requestAnimationFrame(() => {
    const nodes = overlay.querySelectorAll(focusableSelector);
    const target = nodes[0];
    if (target instanceof HTMLElement) target.focus();
  });

  return function cleanup() {
    overlay.removeEventListener('keydown', onKeyDown);
    if (returnFocusEl instanceof HTMLElement && document.contains(returnFocusEl)) {
      returnFocusEl.focus();
    }
  };
}

export const CustomConfirm = {
  show(title, msg, options = {}) {
    return new Promise((resolve) => {
      const modal = Utils.getEl('modal-confirm');
      if (!modal) {
        resolve(window.confirm(`${title}\n\n${msg}`));
        return;
      }

      const config = {
        confirmLabel: 'Confirmar',
        cancelLabel: 'Cancelar',
        tone: 'danger',
        focus: 'cancel',
        ...options,
      };

      Utils.getEl('confirm-title').textContent = title;
      Utils.getEl('confirm-msg').textContent = msg;
      const yesBtn = Utils.getEl('confirm-yes');
      const noBtn = Utils.getEl('confirm-no');
      yesBtn.textContent = config.confirmLabel;
      noBtn.textContent = config.cancelLabel;
      yesBtn.className = `btn ${config.tone === 'danger' ? 'btn--danger' : 'btn--primary'}`;
      noBtn.className = 'btn btn--outline';

      const cleanup = (val) => {
        yesBtn.removeEventListener('click', onYes);
        noBtn.removeEventListener('click', onNo);
        modal.removeEventListener('click', onOverlayClick, true);
        modal.removeEventListener('keydown', onKeyDown, true);
        Modal.close('modal-confirm');
        resolve(val);
      };

      const onYes = () => cleanup(true);
      const onNo = () => cleanup(false);
      const onOverlayClick = (event) => {
        if (event.target !== modal) return;
        event.preventDefault();
        event.stopPropagation();
        cleanup(false);
      };
      const onKeyDown = (event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          cleanup(false);
        }
      };

      yesBtn.addEventListener('click', onYes);
      noBtn.addEventListener('click', onNo);
      modal.addEventListener('click', onOverlayClick, true);
      modal.addEventListener('keydown', onKeyDown, true);

      Modal.open('modal-confirm');
      requestAnimationFrame(() => {
        const target = config.focus === 'confirm' ? yesBtn : noBtn;
        if (target instanceof HTMLElement) target.focus();
      });
    });
  },
};
