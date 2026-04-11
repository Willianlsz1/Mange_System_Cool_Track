import { supabase } from './supabase.js';
import {
  PLAN_CODE_FREE,
  PLAN_CODE_PRO,
  getEffectivePlan,
  hasProAccess,
} from './subscriptionPlans.js';

export const PREMIUM_FEATURE_EQUIPAMENTOS = 'equipamentos';
export const PREMIUM_FEATURE_PDF_EXPORT = 'pdf_export';

function createMonetizationError(code, message, cause = null) {
  const error = new Error(message);
  error.code = code;
  if (cause) error.cause = cause;
  return error;
}

function isTokenProjectMismatch(token) {
  if (!token) return false;

  try {
    const [, payloadBase64] = token.split('.');
    if (!payloadBase64) return false;

    const payload = JSON.parse(atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/')));
    const tokenRef = String(payload?.ref || '').trim();
    if (!tokenRef) return false;

    const envUrl = String(import.meta.env?.VITE_SUPABASE_URL || '').trim();
    if (!envUrl) return false;

    const envRef = new URL(envUrl).hostname.split('.')[0];
    return Boolean(envRef) && tokenRef !== envRef;
  } catch {
    return false;
  }
}

export async function sanitizeSessionForCurrentProject({ supabaseClient = supabase } = {}) {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();

  if (!session?.access_token) return { sanitized: false, session: null };

  if (!isTokenProjectMismatch(session.access_token)) {
    return { sanitized: false, session };
  }

  await supabaseClient.auth.signOut();
  localStorage.removeItem('cooltrack-guest-mode');

  throw createMonetizationError(
    'SESSION_PROJECT_MISMATCH',
    'Sua sessão é de outro ambiente. Faça login novamente para continuar.',
  );
}

export function getPlanCodeFromProfile(profile) {
  return getEffectivePlan(profile);
}

export function isProUser(profile) {
  return hasProAccess(profile);
}

export function canUsePremiumFeature(profile, feature) {
  if (feature === PREMIUM_FEATURE_EQUIPAMENTOS) return hasProAccess(profile);
  if (feature === PREMIUM_FEATURE_PDF_EXPORT) return hasProAccess(profile);
  return false;
}

export async function fetchMyProfileBilling({ supabaseClient = supabase } = {}) {
  const {
    data: { user },
    error: userError,
  } = await supabaseClient.auth.getUser();

  if (userError || !user?.id) {
    throw createMonetizationError('NO_SESSION', 'Usuário sem sessão ativa.', userError);
  }

  const { data, error } = await supabaseClient
    .from('profiles')
    .select(
      'id,plan_code,plan,subscription_status,is_dev,billing_provider,stripe_customer_id,stripe_subscription_id,trial_ends_at',
    )
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    throw createMonetizationError(
      'PROFILE_READ_FAILED',
      'Não foi possível consultar seu plano.',
      error,
    );
  }

  return {
    user,
    profile: data || {
      id: user.id,
      plan_code: PLAN_CODE_FREE,
      plan: PLAN_CODE_FREE,
      subscription_status: 'inactive',
      is_dev: false,
    },
  };
}

export async function startCheckout({ plan = PLAN_CODE_PRO, supabaseClient = supabase } = {}) {
  const {
    data: { session },
    error: sessionError,
  } = await supabaseClient.auth.getSession();

  if (sessionError || !session?.access_token) {
    throw createMonetizationError(
      'NO_SESSION',
      'Faça login para iniciar o checkout.',
      sessionError,
    );
  }

  const { data, error } = await supabaseClient.functions.invoke('create-checkout-session', {
    body: { plan },
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (error) {
    const message = String(error?.message || '').toLowerCase();
    if (error?.status === 401 || message.includes('invalid jwt')) {
      throw createMonetizationError(
        'INVALID_JWT',
        'Sua sessão expirou. Faça login novamente e tente outra vez.',
        error,
      );
    }

    throw createMonetizationError(
      'CHECKOUT_REQUEST_FAILED',
      'Não foi possível iniciar o checkout agora.',
      error,
    );
  }

  if (!data?.url || typeof data.url !== 'string') {
    throw createMonetizationError('CHECKOUT_RESPONSE_INVALID', 'Checkout não retornou URL válida.');
  }

  return data.url;
}
