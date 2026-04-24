/**
 * CoolTrack Pro - Plan Limits
 *
 * Substitui o antigo `guestLimits.js` depois que o modo demo/guest foi
 * removido. Aqui vive só a lógica de gate por plano do usuário autenticado.
 */

import { getState } from './state.js';
import {
  canCreateEquipment,
  getEffectivePlan,
  getPlanForUser,
  getPlanProfileForUserId,
} from './plans/subscriptionPlans.js';
import { supabase } from './supabase.js';

/**
 * Conta quantos registros de serviço foram criados no mês corrente.
 * Mantido para métricas de uso e telemetria.
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
    registros: countRegistrosThisMonth(state.registros),
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

  // `profile`/`planCode` são sempre atribuídos dentro do try/catch abaixo —
  // não inicializamos aqui pra evitar "no-useless-assignment" do ESLint.
  let planCode;
  let profile;

  try {
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();
    profile = await getPlanProfileForUserId(user?.id, { supabaseClient });
    planCode = getEffectivePlan(profile);
  } catch {
    // Sem conexão → cai para o plano base (free), que é conservador.
    profile = null;
    planCode = getEffectivePlan(null);
  }

  const plan = getPlanForUser({ planCode });
  let limit = plan.limits[resource];
  let blocked = Number.isFinite(limit) ? current >= limit : false;

  if (resource === 'equipamentos') {
    const createDecision = canCreateEquipment(profile, current);
    blocked = !createDecision.allowed;
    limit = createDecision.limit;
    planCode = createDecision.planCode;
  }

  return { blocked, resource, limit, current, planCode };
}
