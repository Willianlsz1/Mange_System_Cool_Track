/**
 * CoolTrack Pro - Bootstrap v5.0 (SaaS)
 */

import { seedIfEmpty }                                from './state.js';
import { Modal }                                      from './modal.js';
import { Actions, updateHeader, renderInicio,
         populateSelects }                            from './ui.js';
import { bindEvents }                                 from './events.js';
import { ClientMode }                                 from './clientmode.js';

function bootstrap() {
  seedIfEmpty();
  Modal.init();
  Actions.init();
  bindEvents();
  populateSelects();
  updateHeader();
  renderInicio();
  ClientMode.restore();
}

bootstrap();