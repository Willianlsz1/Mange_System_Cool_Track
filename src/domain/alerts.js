/**
 * CoolTrack Pro - Alerts Module v4.0
 * Regras derivadas do dominio de manutencao.
 */

import { getState } from '../core/state.js';
import { buildMaintenanceAlerts } from './maintenance.js';

export const Alerts = {
  getAll() {
    const { registros, equipamentos } = getState();
    return buildMaintenanceAlerts(equipamentos, registros);
  },
};
