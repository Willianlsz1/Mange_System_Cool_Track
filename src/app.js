/**
 * CoolTrack Pro - Bootstrap v5.0
 * Entrada única: 15 linhas.
 */

import { seedIfEmpty, getState }  from './core/state.js';
import { bindEvents }             from './core/events.js';
import { Modal }                  from './core/modal.js';
import { goTo }                   from './core/router.js';
import { initController }         from './ui/controller.js';

function bootstrap() {
  const done = localStorage.getItem('cooltrack-onboarding-done');

  if (!done) {
    window.location.href = '/onboarding-cooltrack.html';
    return; // para aqui — não sobe o app
  }

  // Onboarding já foi feito — fluxo normal, sem seed de dados falsos
  Modal.init();
  bindEvents();
  initController();
  goTo('inicio');
}

bootstrap();