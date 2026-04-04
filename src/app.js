/**
 * CoolTrack Pro - Application Bootstrap v3.4
 * Importa Modal de modal.js (módulo separado de ui.js)
 */

import { seedIfEmpty } from './state.js';
import { Modal } from './modal.js';
import { Actions, updateHeader, renderInicio, populateSelects } from './ui.js';
import { bindEvents } from './events.js';

function bootstrap() {
  seedIfEmpty();
  Modal.init();
  Actions.init();
  bindEvents();
  populateSelects();
  updateHeader();
  renderInicio();
  console.log('🧊 CoolTrack Pro v3.4 carregado');
}

bootstrap();