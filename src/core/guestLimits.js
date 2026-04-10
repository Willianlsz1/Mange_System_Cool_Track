import { getState } from './state.js';
import { getPlanForUser } from './subscriptionPlans.js';

export function isGuestMode() {
  return localStorage.getItem('cooltrack-guest-mode') === '1';
}

export function getUsageSnapshot() {
  const state = getState();
  return {
    equipamentos: state.equipamentos.length,
    registros: state.registros.length,
  };
}

export function checkGuestLimit(resource) {
  const guest = isGuestMode();
  if (!guest) return { blocked: false, resource, limit: null, current: null };

  const usage = getUsageSnapshot();
  const plan = getPlanForUser({ isGuest: true });
  const limit = plan.limits[resource];
  const current = usage[resource];

  return {
    blocked: Number.isFinite(limit) ? current >= limit : false,
    resource,
    limit,
    current,
  };
}
