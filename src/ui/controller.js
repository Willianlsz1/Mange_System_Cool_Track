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

export function initController() {
  registerAppRoutes();

  bindNavigationHandlers();
  bindEquipmentHandlers();
  bindRegistroHandlers();
  bindProfileAccountHandlers();
  bindReportExportHandlers();
  bindClienteHandlers();

  initControllerHelpers();
}
