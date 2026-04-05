/**
 * CoolTrack Pro - Client Mode v1.0 (D4)
 * Modo de apresentação para o cliente: interface limpa, sem densidade técnica
 */

import { Utils } from './utils.js';

const CLIENT_MODE_KEY = 'cooltrack-client-mode';

export const ClientMode = {

  isActive() {
    return document.documentElement.hasAttribute('data-client-mode');
  },

  activate() {
    document.documentElement.setAttribute('data-client-mode', '1');
    localStorage.setItem(CLIENT_MODE_KEY, '1');
    this._updateToggleBtn();
  },

  deactivate() {
    document.documentElement.removeAttribute('data-client-mode');
    localStorage.removeItem(CLIENT_MODE_KEY);
    this._updateToggleBtn();
  },

  toggle() {
    if (this.isActive()) this.deactivate();
    else                  this.activate();
  },

  restore() {
    if (localStorage.getItem(CLIENT_MODE_KEY) === '1') this.activate();
  },

  _updateToggleBtn() {
    const btn  = document.getElementById('client-mode-toggle');
    const icon = document.getElementById('client-mode-icon');
    if (!btn || !icon) return;
    if (this.isActive()) {
      btn.setAttribute('aria-label', 'Sair do modo cliente');
      btn.title = 'Sair do modo cliente';
      icon.textContent = '👤';
      btn.classList.add('is-active');
    } else {
      btn.setAttribute('aria-label', 'Modo cliente');
      btn.title = 'Modo cliente — apresentação para o cliente';
      icon.textContent = '👁';
      btn.classList.remove('is-active');
    }
  },

  initToggleButton() {
    const btn = document.getElementById('client-mode-toggle');
    if (!btn) return;
    btn.addEventListener('click', () => this.toggle());
    this._updateToggleBtn();
  },
};