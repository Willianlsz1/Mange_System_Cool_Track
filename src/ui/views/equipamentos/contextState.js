import { currentRoute, currentRouteParams, goTo } from '../../../core/router.js';

let renderEquipFallback = null;

export function configureEquipContextState({ renderEquip } = {}) {
  renderEquipFallback = typeof renderEquip === 'function' ? renderEquip : null;
}

export function normalizeEquipCtx(rawCtx = {}) {
  const source = rawCtx && typeof rawCtx === 'object' ? rawCtx : {};
  const quickFilterRaw = source.quickFilter;
  const quickFilter =
    typeof quickFilterRaw === 'string' && quickFilterRaw && quickFilterRaw !== 'todos'
      ? quickFilterRaw
      : null;
  const sectorRaw = source.sectorId;
  const sectorId =
    typeof sectorRaw === 'string' && sectorRaw
      ? sectorRaw
      : sectorRaw === '__sem_setor__'
        ? '__sem_setor__'
        : null;
  // Filtro por cliente (vindo da view /clientes via "Ver equipamentos").
  // Ortogonal ao sector — pode coexistir (ex: cliente X em setor Y).
  const clienteIdRaw = source.clienteId;
  const clienteId = typeof clienteIdRaw === 'string' && clienteIdRaw ? clienteIdRaw : null;
  const clienteNomeRaw = source.clienteNome;
  const clienteNome = typeof clienteNomeRaw === 'string' && clienteNomeRaw ? clienteNomeRaw : null;
  if (quickFilter) return { sectorId: null, quickFilter, clienteId, clienteNome };
  return { sectorId, quickFilter: null, clienteId, clienteNome };
}

export function getRouteEquipCtx() {
  const routeParams = currentRouteParams?.() || {};
  if (routeParams.equipCtx) return normalizeEquipCtx(routeParams.equipCtx);
  // Compat: params antigos passados sem o wrapper equipCtx.
  if ('sectorId' in routeParams || 'quickFilter' in routeParams || 'clienteId' in routeParams) {
    return normalizeEquipCtx(routeParams);
  }
  return normalizeEquipCtx();
}

export function resolveEquipCtx(options = {}) {
  if (options?.equipCtx) return normalizeEquipCtx(options.equipCtx);
  if (
    'sectorId' in (options || {}) ||
    'quickFilter' in (options || {}) ||
    'clienteId' in (options || {})
  ) {
    return normalizeEquipCtx(options);
  }
  if (currentRoute() === 'equipamentos') return getRouteEquipCtx();
  return normalizeEquipCtx();
}

export function navigateEquipCtx(nextCtx) {
  const normalized = normalizeEquipCtx(nextCtx);
  if (currentRoute() === 'equipamentos') {
    goTo('equipamentos', { equipCtx: normalized });
    return;
  }
  renderEquipFallback?.('', { equipCtx: normalized });
}
