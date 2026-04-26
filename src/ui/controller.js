/**
 * CoolTrack Pro - UI Controller (Orchestrator)
 * Responsabilidade: compor rotas, handlers e helpers de inicializacao.
 */

import { registerAppRoutes } from './controller/routes.js';
import { bindNavigationHandlers } from './controller/handlers/navigationHandlers.js';
import { bindEquipmentHandlers } from './controller/handlers/equipmentHandlers.js';
import { bindRegistroHandlers } from './controller/handlers/registroHandlers.js';
import { bindProfileAccountHandlers } from './controller/handlers/profileAccountHandlers.js';
import { bindReportExportHandlers } from './controller/handlers/reportExportHandlers.js';
import { bindClienteHandlers } from './controller/handlers/clienteHandlers.js';
import { initControllerHelpers } from './controller/helpers/themeInitHelpers.js';
import { registerBlockingLayer } from '../core/router.js';
import { SignatureModal } from './components/signature/signature-modal.js';
import { SignatureViewerModal } from './components/signature/signature-viewer-modal.js';
import { updateShellSidebar } from './shell.js';

/**
 * Registra modais "blocking layer" no router pra serem fechados pelo botao
 * Voltar do browser. Inverte a dependencia que antes era core/router.js
 * importando de ui/components/signature/* (violava core ↛ ui).
 */
function registerSignatureBlockingLayers() {
  registerBlockingLayer({
    id: 'signature-capture',
    isOpen: () => {
      const el = document.getElementById('modal-signature-overlay');
      return Boolean(el?.classList.contains('is-open'));
    },
    close: () => SignatureModal.closeIfOpen(),
    getElement: () => document.getElementById('modal-signature-overlay'),
  });
  registerBlockingLayer({
    id: 'signature-viewer',
    isOpen: () => {
      const el = document.getElementById('modal-signature-viewer-overlay');
      return Boolean(el?.classList.contains('is-open'));
    },
    close: () => SignatureViewerModal.closeIfOpen(),
    getElement: () => document.getElementById('modal-signature-viewer-overlay'),
  });
}

export function initController() {
  registerAppRoutes();

  bindNavigationHandlers();
  bindEquipmentHandlers();
  bindRegistroHandlers();
  bindProfileAccountHandlers();
  bindReportExportHandlers();
  bindClienteHandlers();

  registerSignatureBlockingLayers();

  initControllerHelpers();

  // Popula footer da sidebar (user chip + plan card) com dados reais.
  // Chamado em bootstrap apos profile carregar do localStorage.
  updateShellSidebar();
  // Re-popula quando profile e salvo (modal de perfil dispatch este evento).
  if (typeof document !== 'undefined') {
    document.addEventListener('profile-saved', () => updateShellSidebar());
  }
}
