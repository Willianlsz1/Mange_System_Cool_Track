import { supabase } from '../supabase.js';
import {
  PLAN_CODE_FREE,
  PLAN_CODE_PLUS,
  PLAN_CODE_PRO,
  getEffectivePlan,
  hasProAccess,
  hasPlusAccess,
  hasFeature,
  assertFeature,
  FEATURE_PDF_EXPORT,
  FEATURE_EQUIPAMENTOS_EXTRA,
  FEATURE_HISTORICO_COMPLETO,
  FEATURE_SETORES,
  FEATURE_SUPORTE_PRIORITARIO,
} from './subscriptionPlans.js';
import { DevPlanOverride } from './devPlanOverride.js';

// Legacy constants — mantidas para back-compat com código que ainda não migrou
// para a API hasFeature/assertFeature (que usa FEATURE_* em subscriptionPlans).
export const PREMIUM_FEATURE_EQUIPAMENTOS = 'equipamentos';
export const PREMIUM_FEATURE_PDF_EXPORT = 'pdf_export';

// Re-export da API nova para permitir `import { hasFeature } from '.../monetization.js'`
export {
  hasFeature,
  assertFeature,
  hasPlusAccess,
  FEATURE_PDF_EXPORT,
  FEATURE_EQUIPAMENTOS_EXTRA,
  FEATURE_HISTORICO_COMPLETO,
  FEATURE_SETORES,
  FEATURE_SUPORTE_PRIORITARIO,
  PLAN_CODE_PLUS,
};

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

// Wrapper legado: traduz as constantes antigas (PREMIUM_FEATURE_*) para a
// API nova (FEATURE_* + hasFeature). Assim equipamentos e PDF export passam
// a liberar para Plus+ em vez de só Pro, sem quebrar chamadas existentes.
export function canUsePremiumFeature(profile, feature) {
  if (feature === PREMIUM_FEATURE_EQUIPAMENTOS) {
    return hasFeature(profile, FEATURE_EQUIPAMENTOS_EXTRA);
  }
  if (feature === PREMIUM_FEATURE_PDF_EXPORT) {
    return hasFeature(profile, FEATURE_PDF_EXPORT);
  }
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

  // Usa select('*') para evitar erros 400 por colunas que podem não existir no schema
  const { data, error: queryError } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (queryError) {
    throw createMonetizationError(
      'PROFILE_READ_FAILED',
      'Não foi possível consultar seu plano.',
      queryError,
    );
  }

  const rawProfile = data || {
    id: user.id,
    plan_code: PLAN_CODE_FREE,
    plan: PLAN_CODE_FREE,
    subscription_status: 'inactive',
    is_dev: false,
  };

  // Aplica override de plano para usuários dev (is_dev === true ou flag local ativa).
  // SEGURANÇA: a flag local `cooltrack-dev-mode` só tem efeito em build de dev
  // (import.meta.env.DEV). Em produção qualquer um poderia setar a flag no F12
  // e virar Pro sem pagar — o gate fecha esse bypass. `is_dev === true` no perfil
  // continua valendo em prod mas é bloqueado pelo trigger protect_profile_fields
  // (usuário comum não consegue auto-setar no Supabase).
  const isLocalDev =
    import.meta.env?.DEV === true &&
    typeof localStorage !== 'undefined' &&
    localStorage.getItem('cooltrack-dev-mode') === 'true';
  const isDevMode = rawProfile.is_dev === true || isLocalDev;
  const profile = isDevMode ? DevPlanOverride.applyToProfile(rawProfile) : rawProfile;

  return { user, profile };
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

/**
 * Abre o portal de gerenciamento/cancelamento do Stripe.
 * Usa fetch direto (sem functions.invoke do SDK) para garantir que o token
 * recém-atualizado seja enviado exatamente como esperado.
 */
export async function startBillingPortal({ supabaseClient = supabase } = {}) {
  // ── 1. Obtém token fresco ─────────────────────────────────────────────────
  let accessToken = null;
  let refreshFailed = false;

  // Tenta refresh via rede — garante token novo e válido
  try {
    const { data: refreshData } = await supabaseClient.auth.refreshSession();
    accessToken = refreshData?.session?.access_token ?? null;
  } catch (_) {
    refreshFailed = true;
  }

  if (!accessToken) {
    refreshFailed = true;
  }

  // Fallback: usa token do storage SOMENTE se ainda não estiver expirado
  // (getSession não valida via rede — pode retornar token expirado)
  if (refreshFailed) {
    try {
      const { data: sessionData } = await supabaseClient.auth.getSession();
      const token = sessionData?.session?.access_token ?? null;
      if (token) {
        // Decodifica o campo exp do JWT para checar validade
        const payload = JSON.parse(atob(token.split('.')[1]));
        const isValid = payload?.exp && payload.exp * 1000 > Date.now();
        if (isValid) accessToken = token;
      }
    } catch (_) {
      // ignora
    }
  }

  if (!accessToken) {
    throw createMonetizationError('NO_SESSION', 'Faça login para gerenciar sua assinatura.', null);
  }

  // ── 2. Chama a Edge Function via fetch direto ─────────────────────────────
  // Evita qualquer interferência do SDK (FunctionsClient armazena headers na
  // construção e pode enviar um token desatualizado)
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;

  let response;
  try {
    response = await fetch(`${supabaseUrl}/functions/v1/create-portal-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseKey,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({}),
    });
  } catch (networkError) {
    throw createMonetizationError(
      'PORTAL_REQUEST_FAILED',
      'Erro de rede ao contactar o servidor. Verifique sua conexão.',
      networkError,
    );
  }

  // ── 3. Trata erros HTTP ───────────────────────────────────────────────────
  if (!response.ok) {
    let errorBody = {};
    try {
      errorBody = await response.json();
    } catch (_) {
      /* ignora */
    }

    const code = errorBody?.code ?? '';

    if (response.status === 401 || code === 'INVALID_JWT' || code === 'AUTH_REQUIRED') {
      throw createMonetizationError(
        'INVALID_JWT',
        'Sua sessão expirou. Faça login novamente e tente outra vez.',
        errorBody,
      );
    }

    if (response.status === 404 || code === 'NO_STRIPE_CUSTOMER') {
      throw createMonetizationError(
        'NO_STRIPE_CUSTOMER',
        errorBody?.message ||
          'Nenhuma assinatura ativa encontrada. Se você acabou de assinar, aguarde alguns segundos e tente novamente.',
        errorBody,
      );
    }

    throw createMonetizationError(
      'PORTAL_REQUEST_FAILED',
      errorBody?.message || 'Não foi possível abrir o portal de assinatura.',
      errorBody,
    );
  }

  // ── 4. Valida resposta ────────────────────────────────────────────────────
  let data;
  try {
    data = await response.json();
  } catch (_) {
    data = {};
  }

  if (!data?.url || typeof data.url !== 'string') {
    throw createMonetizationError('PORTAL_RESPONSE_INVALID', 'Portal não retornou URL válida.');
  }

  return data.url;
}
