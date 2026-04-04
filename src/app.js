/**
 * CoolTrack Pro - Application Bootstrap v3.3
 * 
 * Ponto de entrada principal com Toast System
 */

import { seedIfEmpty } from './state.js';
import { Modal, updateHeader, renderInicio, populateSelects, Actions } from './ui.js';
import { bindEvents } from './events.js';
import { Toast } from './toast.js'; // ✅ NOVO: Importa Toast system

function bootstrap() {
  seedIfEmpty();
  Modal.init();
  Actions.init();
  bindEvents();
  populateSelects();
  updateHeader();
  renderInicio();
  
  // Log informativo (pode ser removido em produção)
  console.log('🧊 CoolTrack Pro v3.3 - UX Premium carregado com sucesso!');
  console.log('✨ Novidades: Toast Notifications, Theme Toggle, Validação Visual, Busca Inteligente');
}

bootstrap();