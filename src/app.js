/**
 * CoolTrack Pro - Bootstrap v5.0
 * Entrada única: 15 linhas.
 */

import { seedIfEmpty, getState }  from './core/state.js';
import { bindEvents }             from './core/events.js';
import { Modal }                  from './core/modal.js';
import { goTo }                   from './core/router.js';
import { initController }         from './ui/controller.js';
import { FirstTimeExperience }    from './ui/components/onboarding.js';

function bootstrap() {
  seedIfEmpty();
  Modal.init();
  bindEvents();
  initController();
  goTo('inicio');

  const { equipamentos } = getState();
  setTimeout(() => FirstTimeExperience.show(equipamentos), 400);
}

bootstrap();