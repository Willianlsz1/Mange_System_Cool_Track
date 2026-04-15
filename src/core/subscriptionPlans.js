import { supabase } from './supabase.js';
import { DevPlanOverride } from './devPlanOverride.js';

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
    perks: [
      'Até 3 equipamentos cadastrados',
      'Até 10 registros de serviço/mês',
      'Histórico dos últimos 30 dias',
    ],
  },
  [PLAN_CODE_PRO]: {
    key: PLAN_CODE_PRO,
    label: 'Pro',
    limits: {
      equipamentos: 30,
      registros: Number.POSITIVE_INFINITY,
    },
    perks: [
      'Até 30 equipamentos cadastrados',
      'Registros de serviço ilimitados',
      'Todo o histórico de manutenções',
      'Relatórios PDF e WhatsApp ilimitados',
      'Agrupamento por setores',
    ],
  },
};

export function normalizePlanCode(planCode) {
  return String(planCode || '').toLowerCase() === PLAN_CODE_PRO ? PLAN_CODE_PRO : PLAN_CODE_FREE;
}

export function getEffectivePlan(profile) {
  // Dev mode local: se 'cooltrack-dev-mode' estiver ativo, aplica o override de plano
  // diretamente aqui — funciona em todos os caminhos de verificação de plano do app.
  const isLocalDev =
    typeof localStorage !== 'undefined' && localStorage.getItem('cooltrack-dev-mode') === 'true';
  if (isLocalDev) {
    const devOverride = DevPlanOverride.get();
    if (devOverride) {
      return devOverride === PLAN_CODE_PRO ? PLAN_CODE_PRO : PLAN_CODE_FREE;
    }
    // Se o override ainda não foi definido, trata como pro por padrão no modo dev
    return PLAN_CODE_PRO;
  }

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
  pdf_export: 'A exportação em PDF é exclusiva do plano Pro.',
  equipamentos: 'Mais de 3 equipamentos é exclusivo do plano Pro.',
});

export function assertProAccess(profile, featureName = 'premium_feature') {
  if (hasProAccess(profile)) return { allowed: true, planCode: PLAN_CODE_PRO };

  const normalizedFeature = String(featureName || '').toLowerCase();
  const error = new Error(
    PREMIUM_FEATURE_MESSAGES[normalizedFeature] || 'Este recurso é exclusivo do plano Pro.',
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

  // Usa select('*') para evitar erros 400 por colunas ausentes no schema
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('*')
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
