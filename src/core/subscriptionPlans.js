import { supabase } from './supabase.js';

export const PLAN_CODE_FREE = 'free';
export const PLAN_CODE_PRO = 'pro';

export const PLAN_CATALOG = {
  [PLAN_CODE_FREE]: {
    key: PLAN_CODE_FREE,
    label: 'Free',
    limits: {
      equipamentos: 3,
      registros: 10,
    },
    perks: ['Ate 3 equipamentos', 'Ate 10 registros'],
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

export function getEffectivePlan(profile) {
  if (profile?.is_dev === true) return PLAN_CODE_PRO;

  const planCode = normalizePlanCode(profile?.plan || profile?.plan_code || PLAN_CODE_FREE);
  if (planCode !== PLAN_CODE_PRO) return PLAN_CODE_FREE;

  const subscriptionStatus = String(profile?.subscription_status || '').toLowerCase();
  return subscriptionStatus === 'active' ? PLAN_CODE_PRO : PLAN_CODE_FREE;
}

export function hasProAccess(profile) {
  return getEffectivePlan(profile) === PLAN_CODE_PRO;
}

export function canCreateEquipment(profile, currentEquipmentCount = 0) {
  const planCode = getEffectivePlan(profile);
  const limit = PLAN_CATALOG[planCode].limits.equipamentos;
  const parsedCurrent = Number.parseInt(String(currentEquipmentCount || '0'), 10);
  const current = Number.isFinite(parsedCurrent) && parsedCurrent > 0 ? parsedCurrent : 0;
  const allowed = !Number.isFinite(limit) || current < limit;

  return { allowed, limit, current, planCode };
}

const PREMIUM_FEATURE_MESSAGES = Object.freeze({
  pdf_export: 'A exportacao em PDF e exclusiva do plano Pro.',
  equipamentos: 'Equipamentos ilimitados sao exclusivos do plano Pro.',
});

export function assertProAccess(profile, featureName = 'premium_feature') {
  if (hasProAccess(profile)) return { allowed: true, planCode: PLAN_CODE_PRO };

  const normalizedFeature = String(featureName || '').toLowerCase();
  const error = new Error(
    PREMIUM_FEATURE_MESSAGES[normalizedFeature] || 'Este recurso e exclusivo do plano Pro.',
  );
  error.code = 'PRO_REQUIRED';
  error.feature = normalizedFeature || featureName;
  error.planCode = getEffectivePlan(profile);
  throw error;
}

export function getPlanForUser({ isGuest, planCode = PLAN_CODE_FREE } = {}) {
  if (isGuest) return PLAN_CATALOG[PLAN_CODE_FREE];
  return PLAN_CATALOG[normalizePlanCode(planCode)];
}

export async function getPlanProfileForUserId(userId, { supabaseClient = supabase } = {}) {
  if (!userId) return null;

  const { data, error } = await supabaseClient
    .from('profiles')
    .select('plan_code,plan,subscription_status,is_dev')
    .eq('id', userId)
    .maybeSingle();

  if (error) return null;
  return data || null;
}

export async function getPlanCodeForUserId(userId, { supabaseClient = supabase } = {}) {
  const profile = await getPlanProfileForUserId(userId, { supabaseClient });
  return getEffectivePlan(profile);
}

export async function getPlanForAuthenticatedUser(userId, options) {
  const planCode = await getPlanCodeForUserId(userId, options);
  return getPlanForUser({ isGuest: false, planCode });
}

export function getLimitLabel(resource) {
  if (resource === 'equipamentos') return 'equipamentos';
  return 'registros';
}
