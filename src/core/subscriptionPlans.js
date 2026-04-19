import { supabase } from './supabase.js';
import { DevPlanOverride } from './devPlanOverride.js';

// ── Planos canônicos ───────────────────────────────────────────────────────
export const PLAN_CODE_FREE = 'free';
export const PLAN_CODE_PLUS = 'plus';
export const PLAN_CODE_PRO = 'pro';

// Hierarquia: free < plus < pro. Usada por isAtLeastPlan / hasFeature.
const PLAN_RANK = {
  [PLAN_CODE_FREE]: 0,
  [PLAN_CODE_PLUS]: 1,
  [PLAN_CODE_PRO]: 2,
};

// ── Feature flags (gating binário) ─────────────────────────────────────────
// Cada feature mapeia para o plano MÍNIMO que a libera. assertFeature usa
// essa matriz em vez de if/else espalhado pelo código.
export const FEATURE_PDF_EXPORT = 'pdf_export';
export const FEATURE_EQUIPAMENTOS_EXTRA = 'equipamentos_extra';
export const FEATURE_HISTORICO_COMPLETO = 'historico_completo';
export const FEATURE_SETORES = 'setores';
export const FEATURE_SUPORTE_PRIORITARIO = 'suporte_prioritario';

// PDF export agora é liberado para TODOS os planos (inclusive Free), mas com
// cotas mensais diferenciadas e marca d'água no Free. O gating passou de
// "feature binária" pra "quota mensal" — ver MONTHLY_LIMITS em usageLimits.js.
// Assinatura digital do cliente no PDF é exclusiva de Plus+ (diferencial pago).
export const FEATURE_DIGITAL_SIGNATURE = 'digital_signature';

const FEATURE_MIN_PLAN = {
  [FEATURE_PDF_EXPORT]: PLAN_CODE_FREE,
  [FEATURE_EQUIPAMENTOS_EXTRA]: PLAN_CODE_PLUS,
  [FEATURE_HISTORICO_COMPLETO]: PLAN_CODE_PLUS,
  [FEATURE_DIGITAL_SIGNATURE]: PLAN_CODE_PLUS,
  [FEATURE_SETORES]: PLAN_CODE_PRO,
  [FEATURE_SUPORTE_PRIORITARIO]: PLAN_CODE_PRO,
};

// ── Catálogo de planos ─────────────────────────────────────────────────────
// Nota: `accountTagline` e `accountChips` alimentam o account modal — versão
// enxuta dos perks pra caber no card sem redundância. Fonte da verdade alinhada
// com a pricing page (não inventar features que não existem nos perks).
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
      '10 envios de relatório via WhatsApp/mês',
    ],
    accountTagline: 'Recursos básicos para começar. Desbloqueie mais com o Plus.',
    // Chips aspiracionais no Free: mostram o que vem ao fazer upgrade (estilo ghost/muted).
    accountChips: ['Até 25 equipamentos', 'PDFs sem marca d\u2019água', 'Registros ilimitados'],
  },
  [PLAN_CODE_PLUS]: {
    key: PLAN_CODE_PLUS,
    label: 'Plus',
    limits: {
      equipamentos: 25,
      registros: Number.POSITIVE_INFINITY,
    },
    perks: [
      'Até 25 equipamentos cadastrados',
      'Registros de serviço ilimitados',
      'Todo o histórico de manutenções',
      '100 relatórios PDF/mês sem marca d\u2019água',
      '50 envios via WhatsApp/mês',
      'Assinatura digital do cliente no PDF',
      'Fotos dos equipamentos (até 3 por equipamento)',
    ],
    accountTagline: 'Até 25 equipamentos, PDFs sem marca d\u2019água e assinatura digital.',
    accountChips: ['Até 25 equipamentos', 'PDFs sem marca d\u2019água', 'Assinatura digital'],
  },
  [PLAN_CODE_PRO]: {
    key: PLAN_CODE_PRO,
    label: 'Pro',
    limits: {
      equipamentos: Number.POSITIVE_INFINITY,
      registros: Number.POSITIVE_INFINITY,
    },
    perks: [
      'Equipamentos ilimitados',
      'Registros de serviço ilimitados',
      'Todo o histórico de manutenções',
      'Relatórios PDF e WhatsApp ilimitados',
      'Agrupamento por setores',
      'Assinatura digital do cliente no PDF',
      'Fotos dos equipamentos (até 3 por equipamento)',
      'Suporte prioritário',
    ],
    accountTagline: 'Equipamentos ilimitados, agrupamento por setores e suporte prioritário.',
    accountChips: ['Ilimitado em tudo', 'Agrupamento por setores', 'Suporte prioritário'],
  },
};

// ── Normalizadores ─────────────────────────────────────────────────────────
export function normalizePlanCode(planCode) {
  const lower = String(planCode || '').toLowerCase();
  if (lower === PLAN_CODE_PRO) return PLAN_CODE_PRO;
  if (lower === PLAN_CODE_PLUS) return PLAN_CODE_PLUS;
  return PLAN_CODE_FREE;
}

function isActivePaidStatus(status) {
  const s = String(status || '').toLowerCase();
  return s === 'active' || s === 'trialing';
}

// ── Resolução do plano efetivo ─────────────────────────────────────────────
export function getEffectivePlan(profile) {
  // Dev mode: flag local OU is_dev=true no perfil liberam o override do toggle.
  // Antes, is_dev=true forçava sempre Pro ignorando o override — o que fazia o
  // devPlanToggle não ter efeito em usuários marcados como dev no Supabase.
  const isLocalDev =
    typeof localStorage !== 'undefined' && localStorage.getItem('cooltrack-dev-mode') === 'true';
  const isDevMode = isLocalDev || profile?.is_dev === true;

  if (isDevMode) {
    const devOverride = DevPlanOverride.get();
    if (devOverride === PLAN_CODE_PRO) return PLAN_CODE_PRO;
    if (devOverride === PLAN_CODE_PLUS) return PLAN_CODE_PLUS;
    if (devOverride === PLAN_CODE_FREE) return PLAN_CODE_FREE;
    // Sem override definido em dev mode → Pro por padrão (compatibilidade legada).
    return PLAN_CODE_PRO;
  }

  const planCode = normalizePlanCode(profile?.plan || profile?.plan_code || PLAN_CODE_FREE);
  if (planCode === PLAN_CODE_FREE) return PLAN_CODE_FREE;

  // Plus ou Pro: só vale se subscription tá active/trialing.
  // Fora disso volta pra Free (proteção contra past_due, canceled, etc).
  return isActivePaidStatus(profile?.subscription_status) ? planCode : PLAN_CODE_FREE;
}

// ── Helpers de hierarquia ──────────────────────────────────────────────────
export function planRank(planCode) {
  return PLAN_RANK[normalizePlanCode(planCode)] ?? 0;
}

export function isAtLeastPlan(currentPlanCode, requiredPlanCode) {
  return planRank(currentPlanCode) >= planRank(requiredPlanCode);
}

export function hasProAccess(profile) {
  return getEffectivePlan(profile) === PLAN_CODE_PRO;
}

export function hasPlusAccess(profile) {
  const plan = getEffectivePlan(profile);
  return plan === PLAN_CODE_PLUS || plan === PLAN_CODE_PRO;
}

// ── Feature gating ─────────────────────────────────────────────────────────
export function hasFeature(profile, feature) {
  const required = FEATURE_MIN_PLAN[feature];
  if (!required) return false;
  return isAtLeastPlan(getEffectivePlan(profile), required);
}

const FEATURE_MESSAGES = Object.freeze({
  [FEATURE_PDF_EXPORT]: 'A exportação em PDF está disponível em todos os planos.',
  [FEATURE_EQUIPAMENTOS_EXTRA]: 'Mais de 3 equipamentos está disponível a partir do plano Plus.',
  [FEATURE_HISTORICO_COMPLETO]:
    'Histórico completo de manutenções está disponível a partir do plano Plus.',
  [FEATURE_DIGITAL_SIGNATURE]:
    'Assinatura digital do cliente no PDF está disponível a partir do plano Plus.',
  [FEATURE_SETORES]: 'Agrupamento por setores é exclusivo do plano Pro.',
  [FEATURE_SUPORTE_PRIORITARIO]: 'Suporte prioritário é exclusivo do plano Pro.',
});

export function assertFeature(profile, feature) {
  if (hasFeature(profile, feature)) {
    return { allowed: true, planCode: getEffectivePlan(profile) };
  }
  const required = FEATURE_MIN_PLAN[feature] ?? PLAN_CODE_PRO;
  const error = new Error(
    FEATURE_MESSAGES[feature] || `Este recurso é exclusivo do plano ${required}.`,
  );
  error.code = 'FEATURE_NOT_AVAILABLE';
  error.feature = feature;
  error.requiredPlan = required;
  error.planCode = getEffectivePlan(profile);
  throw error;
}

// ── Limites por plano (equipamentos) ───────────────────────────────────────
export function canCreateEquipment(profile, currentEquipmentCount = 0) {
  const planCode = getEffectivePlan(profile);
  const limit = PLAN_CATALOG[planCode].limits.equipamentos;
  const parsedCurrent = Number.parseInt(String(currentEquipmentCount || '0'), 10);
  const current = Number.isFinite(parsedCurrent) && parsedCurrent > 0 ? parsedCurrent : 0;
  const allowed = !Number.isFinite(limit) || current < limit;

  return { allowed, limit, current, planCode };
}

// ── Legacy: assertProAccess (mantido pra código que ainda não migrou) ──────
const PREMIUM_FEATURE_MESSAGES = Object.freeze({
  pdf_export: 'A exportação em PDF está disponível a partir do plano Plus.',
  equipamentos: 'Mais de 3 equipamentos está disponível a partir do plano Plus.',
});

const LEGACY_FEATURE_MAP = {
  pdf_export: FEATURE_PDF_EXPORT,
  equipamentos: FEATURE_EQUIPAMENTOS_EXTRA,
};

export function assertProAccess(profile, featureName = 'premium_feature') {
  const normalizedFeature = String(featureName || '').toLowerCase();

  // Redireciona para assertFeature se houver mapping
  const mapped = LEGACY_FEATURE_MAP[normalizedFeature];
  if (mapped) {
    return assertFeature(profile, mapped);
  }

  // Fallback: comportamento antigo (bloqueia não-Pro)
  if (hasProAccess(profile)) return { allowed: true, planCode: PLAN_CODE_PRO };

  const error = new Error(
    PREMIUM_FEATURE_MESSAGES[normalizedFeature] || 'Este recurso é exclusivo do plano Pro.',
  );
  error.code = 'PRO_REQUIRED';
  error.feature = normalizedFeature || featureName;
  error.planCode = getEffectivePlan(profile);
  throw error;
}

// ── Fetchers de plano ──────────────────────────────────────────────────────
export function getPlanForUser({ isGuest, planCode = PLAN_CODE_FREE } = {}) {
  if (isGuest) return PLAN_CATALOG[PLAN_CODE_FREE];
  return PLAN_CATALOG[normalizePlanCode(planCode)];
}

export async function getPlanProfileForUserId(userId, { supabaseClient = supabase } = {}) {
  if (!userId) return null;

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
