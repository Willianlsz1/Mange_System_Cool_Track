import { getOperationalStatus } from '../core/equipmentRules.js';

function latestStatusForEquip(registros, equipId) {
  const latest = (registros || [])
    .filter((registro) => registro?.equipId === equipId)
    .reduce((acc, registro) => {
      const ts = Date.parse(registro?.data || '');
      const score = Number.isFinite(ts) ? ts : -Infinity;
      if (!acc || score > acc.score) {
        return { score, status: registro?.status || 'ok' };
      }
      return acc;
    }, null);

  return latest?.status || null;
}

export function reconcileEquipmentStatusesAfterRegistroEdit({
  equipamentos,
  registros,
  previousRegistro,
  updatedRegistro,
}) {
  if (!previousRegistro || !updatedRegistro) return equipamentos;

  const affectedEquipIds = new Set([
    String(previousRegistro.equipId || ''),
    String(updatedRegistro.equipId || ''),
  ]);
  affectedEquipIds.delete('');
  if (!affectedEquipIds.size) return equipamentos;

  return (equipamentos || []).map((equipamento) => {
    if (!affectedEquipIds.has(String(equipamento?.id || ''))) return equipamento;

    const latestStatus = latestStatusForEquip(registros, equipamento.id);
    if (!latestStatus) return equipamento;

    const op = getOperationalStatus({
      status: latestStatus,
      lastStatus: latestStatus,
      ultimoRegistro: { status: latestStatus },
    });

    return {
      ...equipamento,
      status: op.uiStatus === 'unknown' ? equipamento.status || 'ok' : op.uiStatus,
      statusDescricao: op.label,
    };
  });
}
