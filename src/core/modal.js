/**
 * CoolTrack Pro - Modal Module v3.4
 * Extraído de ui.js. Responsável por Modal e CustomConfirm.
 */

import { Utils } from './utils.js';

export const Modal = {
  open(id) {
    const modalEl = Utils.getEl(id);
    if (!modalEl) return;
    modalEl.classList.add('is-open');
    const modalContent = modalEl.querySelector('.modal');
    if (modalContent) modalContent.classList.remove('is-closing');
    setTimeout(() => {
      const firstInput = modalEl.querySelector('.form-control');
      if (firstInput) firstInput.focus();
    }, 100);
    this._enableTabTrap(modalEl);
  },

  close(id) {
    const modalEl = Utils.getEl(id);
    if (!modalEl) return;
    const modalContent = modalEl.querySelector('.modal');
    if (modalContent) {
      modalContent.classList.add('is-closing');
      setTimeout(() => {
        modalEl.classList.remove('is-open');
        modalContent.classList.remove('is-closing');
        this._disableTabTrap(modalEl);
      }, 200);
    } else {
      modalEl.classList.remove('is-open');
    }
  },

  init() {
    document.querySelectorAll('.modal-overlay').forEach(el => {
      el.addEventListener('click', e => { if (e.target === el) this.close(el.id); });
      el.addEventListener('keydown', e => {
        if (e.key === 'Escape' && el.classList.contains('is-open')) this.close(el.id);
      });
    });

    // Lightbox: fechar ao clicar no overlay (fix: lightbox sem fechar no overlay)
    const lightbox = Utils.getEl('lightbox');
    if (lightbox) {
      lightbox.addEventListener('click', e => {
        if (e.target === lightbox) lightbox.classList.remove('is-open');
      });
    }

  },

  _enableTabTrap(modalEl) {
    const focusable = modalEl.querySelectorAll(
      'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    this._tabTrapHandler = e => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus(); } }
      else { if (document.activeElement === last) { e.preventDefault(); first.focus(); } }
    };
    modalEl.addEventListener('keydown', this._tabTrapHandler);
  },

  _disableTabTrap(modalEl) {
    if (this._tabTrapHandler) {
      modalEl.removeEventListener('keydown', this._tabTrapHandler);
      this._tabTrapHandler = null;
    }
  }
};

export const CustomConfirm = {
  show(title, msg) {
    return new Promise(resolve => {
      const modal = Utils.getEl('modal-confirm');
      Utils.getEl('confirm-title').textContent = title;
      Utils.getEl('confirm-msg').textContent = msg;
      modal.classList.add('is-open');

      const yesBtn = Utils.getEl('confirm-yes');
      const noBtn = Utils.getEl('confirm-no');

      const cleanup = val => {
        modal.classList.remove('is-open');
        yesBtn.removeEventListener('click', onYes);
        noBtn.removeEventListener('click', onNo);
        resolve(val);
      };

      const onYes = () => cleanup(true);
      const onNo  = () => cleanup(false);

      yesBtn.addEventListener('click', onYes);
      noBtn.addEventListener('click', onNo);
    });
  }
};
