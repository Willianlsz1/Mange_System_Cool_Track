/**
 * CoolTrack Pro - Alerts Module v3.4
 * Extraído de ui.js.
 */

import { getState } from '../core/state.js';

export const Alerts = {
  getAll() {
    const { registros, equipamentos } = getState();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in7 = new Date(today);
    in7.setDate(in7.getDate() + 7);

    const dueByEquip = new Map();
    registros.forEach(r => {
      if (!r.proxima) return;
      const d = new Date(`${r.proxima}T00:00:00`);
      if (Number.isNaN(d.getTime())) return;
      const current = dueByEquip.get(r.equipId);
      if (!current || d < current.date) dueByEquip.set(r.equipId, { date: d, reg: r });
    });

    const list = [];
    dueByEquip.forEach(({ date, reg }) => {
      if (date < today) list.push({ kind: 'overdue', reg });
      else if (date <= in7) list.push({ kind: 'upcoming', reg });
    });

    equipamentos
      .filter(e => e.status === 'danger')
      .forEach(eq => list.push({ kind: 'critical', eq }));

    return list;
  }
};