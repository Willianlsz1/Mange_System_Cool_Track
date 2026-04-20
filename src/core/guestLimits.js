import { getState } from './state.js';
import {
  PLAN_CODE_FREE,
  canCreateEquipment,
  getEffectivePlan,
  getPlanForUser,
  getPlanProfileForUserId,
} from './subscriptionPlans.js';
import { supabase } from './supabase.js';

export function isGuestMode() {
  return localStorage.getItem('cooltrack-guest-mode') === '1';
}

/**
 * Conta quantos registros de serviço foram criados no mês corrente.
 * O pricing promete "5 registros/mês" no Free — o limite é JANELA MENSAL,
 * não total histórico. Usado por checkPlanLimit('registros') e usageMeter.
 *
 * Referência: `registro.data` é salvo como ISO datetime ('YYYY-MM-DDTHH:mm').
 */
export function countRegistrosThisMonth(registros = [], now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  return registros.filter((registro) => {
    const date = new Date(registro?.data);
    return !Number.isNaN(date.getTime()) && date >= start && date < end;
  }).length;
}

export function getUsageSnapshot() {
  const state = getState();
  return {
    equipamentos: state.equipamentos.length,
    // Registros é contagem do MÊS CORRENTE — o limit free (5) é mensal.
    // Usar state.registros.length (total histórico) bloqueia a conta cedo
    // demais e não bate com o pricing ("5 registros/mês").
    registros: countRegistrosThisMonth(state.registros),
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

export async function checkPlanLimit(resource, currentUsageOrOptions = {}, maybeOptions = {}) {
  const hasExplicitUsage =
    typeof currentUsageOrOptions === 'number' || typeof currentUsageOrOptions === 'string';
  const options = hasExplicitUsage ? maybeOptions : currentUsageOrOptions || {};
  const { supabaseClient = supabase } = options;

  const usage = getUsageSnapshot();
  const snapshotCurrent = usage[resource];
  const parsedExplicitCurrent = Number.parseInt(String(currentUsageOrOptions), 10);
  const current =
    hasExplicitUsage && Number.isFinite(parsedExplicitCurrent)
      ? Math.max(0, parsedExplicitCurrent)
      : snapshotCurrent;
  const isGuest = isGuestMode();
  let planCode = PLAN_CODE_FREE;
  let profile = null;

  if (!isGuest) {
    try {
      const {
        data: { user },
      } = await supabaseClient.auth.getUser();
      profile = await getPlanProfileForUserId(user?.id, { supabaseClient });
      planCode = getEffectivePlan(profile);
    } catch {
      // Em caso de erro, ainda respeita o dev mode se estiver ativo
      planCode = getEffectivePlan(null);
      profile = null;
    }
  }

  const plan = getPlanForUser({ isGuest: false, planCode });
  let limit = plan.limits[resource];
  let blocked = Number.isFinite(limit) ? current >= limit : false;

  if (resource === 'equipamentos') {
    const createDecision = canCreateEquipment(profile, current);
    blocked = !createDecision.allowed;
    limit = createDecision.limit;
    planCode = createDecision.planCode;
  }

  return { blocked, resource, limit, current, isGuest, planCode };
}
