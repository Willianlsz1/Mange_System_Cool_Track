import { seedIfEmpty } from './state.js';
import { Modal, updateHeader, renderInicio, populateSelects, Actions } from './ui.js';
import { bindEvents } from './events.js';

function bootstrap() {
  seedIfEmpty();
  Modal.init();
  Actions.init();
  bindEvents();
  populateSelects();
  updateHeader();
  renderInicio();
}

bootstrap();