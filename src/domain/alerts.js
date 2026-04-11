/**
 * CoolTrack Pro - Alerts Module v4.0
 * Regras derivadas do dominio de manutencao.
 */

import { getState } from '../core/state.js';
import { buildMaintenanceAlerts } from './maintenance.js';

function parseIsoDay(dateLike) {
  if (!dateLike) return null;
  const day = String(dateLike).slice(0, 10);
  const parsed = new Date(`${day}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getPreventivaDueEquipmentIds(
  registros = [],
  withinDays = 7,
  baseDate = new Date(),
) {
  const start = new Date(baseDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + withinDays);

  const equipmentIds = new Set();
  registros.forEach((reg) => {
    const tipo = (reg.tipo || '').trim().toLowerCase();
    if (tipo !== 'preventiva') return;
    const proxima = parseIsoDay(reg.proxima);
    if (!proxima) return;
    if (proxima >= start && proxima <= end && reg.equipId) {
      equipmentIds.add(reg.equipId);
    }
  });

  return [...equipmentIds];
}

export const Alerts = {
  getAll() {
    const { registros, equipamentos } = getState();
    return buildMaintenanceAlerts(equipamentos, registros);
  },
  countPreventivas7Dias() {
    const { registros } = getState();
    return getPreventivaDueEquipmentIds(registros, 7).length;
  },
};
