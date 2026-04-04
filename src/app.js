/**
 * CoolTrack Pro - Bootstrap v5.0 (SaaS)
 */

import { seedIfEmpty, getState }                       from './state.js';
import { Modal }                                      from './modal.js';
import { Actions, updateHeader, renderInicio,
         populateSelects }                            from './ui.js';
import { bindEvents }                                 from './events.js';
import { ClientMode }                                 from './clientmode.js';
import { FirstTimeExperience }                        from './onboarding.js';

function bootstrap() {
  seedIfEmpty();
  Modal.init();
  Actions.init();
  bindEvents();
  populateSelects();
  updateHeader();
  renderInicio();
  ClientMode.restore();

  // FTX: mostrar fluxo de boas-vindas na primeira visita
  const { equipamentos } = getState();
  setTimeout(() => FirstTimeExperience.show(equipamentos), 400);
}

bootstrap();