import { supabase } from './supabase.js';

export const PLAN_CODE_FREE = 'free';
export const PLAN_CODE_PRO = 'pro';

export const PLAN_CATALOG = {
  [PLAN_CODE_FREE]: {
    key: PLAN_CODE_FREE,
    label: 'Free',
    limits: {
      equipamentos: 5,
      registros: 10,
    },
    perks: ['Ate 5 equipamentos', 'Ate 10 registros'],
  },
  [PLAN_CODE_PRO]: {
    key: PLAN_CODE_PRO,
    label: 'Pro',
    limits: {
      equipamentos: Number.POSITIVE_INFINITY,
      registros: Number.POSITIVE_INFINITY,
    },
    perks: ['Equipamentos ilimitados', 'Historico completo', 'Relatorios'],
  },
};

export function normalizePlanCode(planCode) {
  return String(planCode || '').toLowerCase() === PLAN_CODE_PRO ? PLAN_CODE_PRO : PLAN_CODE_FREE;
}

export function getPlanForUser({ isGuest, planCode = PLAN_CODE_FREE } = {}) {
  if (isGuest) return PLAN_CATALOG[PLAN_CODE_FREE];
  return PLAN_CATALOG[normalizePlanCode(planCode)];
}

export async function getPlanCodeForUserId(userId, { supabaseClient = supabase } = {}) {
  if (!userId) return PLAN_CODE_FREE;

  const { data, error } = await supabaseClient
    .from('profiles')
    .select('plan_code')
    .eq('id', userId)
    .maybeSingle();

  if (error) return PLAN_CODE_FREE;
  return normalizePlanCode(data?.plan_code);
}

export async function getPlanForAuthenticatedUser(userId, options) {
  const planCode = await getPlanCodeForUserId(userId, options);
  return getPlanForUser({ isGuest: false, planCode });
}

export function getLimitLabel(resource) {
  if (resource === 'equipamentos') return 'equipamentos';
  return 'registros';
}
