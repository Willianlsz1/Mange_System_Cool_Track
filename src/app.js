/**
 * CoolTrack Pro - Bootstrap v4.0
 * Inicialização limpa — sem logs desnecessários em produção
 */

import { seedIfEmpty }                                   from './state.js';
import { Modal }                                         from './modal.js';
import { Actions, updateHeader, renderInicio,
         populateSelects }                               from './ui.js';
import { bindEvents }                                    from './events.js';

function bootstrap() {
  // 1. Dados iniciais
  seedIfEmpty();

  // 2. UI base
  Modal.init();
  Actions.init();
  bindEvents();
  populateSelects();
  updateHeader();
  renderInicio();
}

bootstrap();