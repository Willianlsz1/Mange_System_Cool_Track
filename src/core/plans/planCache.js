/**
 * planCache — cache síncrono do plano efetivo do usuário.
 * Permite que views síncronas (ex: renderHist) consultem o plano sem fazer
 * chamadas assíncronas ao Supabase em cada render.
 *
 * Fluxo:
 *  1. app.js chama setCachedPlan(planCode) após resolver o perfil no boot.
 *  2. Qualquer view pode chamar getCachedPlan() de forma síncrona.
 *  3. Dev mode override tem prioridade sobre o valor em cache.
 */

import { DevPlanOverride } from './devPlanOverride.js';
import {
  PLAN_CODE_FREE,
  PLAN_CODE_PLUS,
  PLAN_CODE_PRO,
  normalizePlanCode,
} from './subscriptionPlans.js';
import { trackEvent } from '../telemetry.js';

const LS_KEY = 'cooltrack-cached-plan';

/**
 * Planos pagos (sinal de conversão monetária).
 */
const PAID_PLANS = new Set([PLAN_CODE_PLUS, PLAN_CODE_PRO]);

export function setCachedPlan(planCode) {
  const normalized = normalizePlanCode(planCode);
  try {
    // Lê o valor ANTES de sobrescrever pra detectar transições.
    // setCachedPlan roda em todo boot; queremos emitir upgrade_completed
    // somente quando o plano SUBIU (free → plus/pro ou plus → pro).
    const previous = localStorage.getItem(LS_KEY);
    localStorage.setItem(LS_KEY, normalized);

    const wasPaid = previous ? PAID_PLANS.has(normalizePlanCode(previous)) : false;
    const isPaid = PAID_PLANS.has(normalized);

    if (!wasPaid && isPaid) {
      // Primeira vez que o usuário tem plano pago no cache local.
      // Marcador monetário principal: assinatura confirmada e propagada ao cliente.
      trackEvent('upgrade_completed', {
        from: previous || 'unknown',
        to: normalized,
      });
    } else if (wasPaid && isPaid && previous !== normalized) {
      // Mudança entre planos pagos (upgrade plus→pro ou downgrade pro→plus).
      trackEvent('plan_changed', {
        from: previous,
        to: normalized,
      });
    }
  } catch {
    // ignora erros de storage (modo privado, etc.)
  }
}

export function getCachedPlan() {
  if (typeof localStorage === 'undefined') return PLAN_CODE_FREE;

  // Dev mode override tem prioridade total.
  // SEGURANÇA: a flag só é aceita em build de dev (import.meta.env.DEV).
  // Em prod, qualquer um poderia setar `cooltrack-dev-mode=true` no F12 e
  // virar Pro sem pagar. O gate fecha esse bypass.
  const isLocalDev =
    import.meta.env?.DEV === true && localStorage.getItem('cooltrack-dev-mode') === 'true';
  if (isLocalDev) {
    const devOverride = DevPlanOverride.get();
    if (devOverride === PLAN_CODE_PRO) return PLAN_CODE_PRO;
    if (devOverride === PLAN_CODE_PLUS) return PLAN_CODE_PLUS;
    if (devOverride === PLAN_CODE_FREE) return PLAN_CODE_FREE;
    return PLAN_CODE_PRO; // sem override definido em dev mode → Pro por padrão
  }

  return normalizePlanCode(localStorage.getItem(LS_KEY) || PLAN_CODE_FREE);
}

export function isCachedPlanPro() {
  return getCachedPlan() === PLAN_CODE_PRO;
}

export function isCachedPlanPlus() {
  return getCachedPlan() === PLAN_CODE_PLUS;
}

/** True se o plano em cache é Plus OU Pro (ou seja, pagante). */
export function isCachedPlanPlusOrHigher() {
  const plan = getCachedPlan();
  return plan === PLAN_CODE_PLUS || plan === PLAN_CODE_PRO;
}
