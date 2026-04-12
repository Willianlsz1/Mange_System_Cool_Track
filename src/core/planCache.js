/**
 * planCache — cache síncrono do plano efectivo do usuário.
 * Permite que views síncronas (ex: renderHist) consultem o plano sem fazer
 * chamadas assíncronas ao Supabase em cada render.
 *
 * Fluxo:
 *  1. app.js chama setCachedPlan(planCode) após resolver o perfil no boot.
 *  2. Qualquer view pode chamar getCachedPlan() de forma síncrona.
 *  3. Dev mode override tem prioridade sobre o valor em cache.
 */

import { DevPlanOverride } from './devPlanOverride.js';
import { PLAN_CODE_FREE, PLAN_CODE_PRO, normalizePlanCode } from './subscriptionPlans.js';

const LS_KEY = 'cooltrack-cached-plan';

export function setCachedPlan(planCode) {
  try {
    localStorage.setItem(LS_KEY, normalizePlanCode(planCode));
  } catch {
    // ignora erros de storage (modo privado, etc.)
  }
}

export function getCachedPlan() {
  if (typeof localStorage === 'undefined') return PLAN_CODE_FREE;

  // Dev mode override tem prioridade total
  const isLocalDev = localStorage.getItem('cooltrack-dev-mode') === 'true';
  if (isLocalDev) {
    const devOverride = DevPlanOverride.get();
    if (devOverride === PLAN_CODE_PRO) return PLAN_CODE_PRO;
    if (devOverride === PLAN_CODE_FREE) return PLAN_CODE_FREE;
    return PLAN_CODE_PRO; // sem override definido em dev mode → Pro por padrão
  }

  return normalizePlanCode(localStorage.getItem(LS_KEY) || PLAN_CODE_FREE);
}

export function isCachedPlanPro() {
  return getCachedPlan() === PLAN_CODE_PRO;
}
