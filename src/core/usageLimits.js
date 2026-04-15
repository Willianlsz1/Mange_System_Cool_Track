import { supabase } from './supabase.js';
import { normalizePlanCode, PLAN_CODE_FREE, PLAN_CODE_PRO } from './subscriptionPlans.js';

export const USAGE_RESOURCE_PDF_EXPORT = 'pdf_export';
export const USAGE_RESOURCE_WHATSAPP_SHARE = 'whatsapp_share';

const VALID_RESOURCES = new Set([USAGE_RESOURCE_PDF_EXPORT, USAGE_RESOURCE_WHATSAPP_SHARE]);

const MONTHLY_LIMITS = {
  [PLAN_CODE_FREE]: {
    [USAGE_RESOURCE_PDF_EXPORT]: 10,
    [USAGE_RESOURCE_WHATSAPP_SHARE]: 10,
  },
  [PLAN_CODE_PRO]: {
    [USAGE_RESOURCE_PDF_EXPORT]: Number.POSITIVE_INFINITY,
    [USAGE_RESOURCE_WHATSAPP_SHARE]: Number.POSITIVE_INFINITY,
  },
};

function assertValidResource(resource) {
  if (!VALID_RESOURCES.has(resource)) {
    throw new Error(`Unsupported usage resource: ${resource}`);
  }
}

function normalizeMonthStart(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-01$/.test(value)) {
    return value;
  }

  const date = value instanceof Date ? value : new Date();
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
}

function normalizeUsageCount(value) {
  const parsed = Number.parseInt(String(value || '0'), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function getMonthlyLimitForPlan(planCode, resource) {
  assertValidResource(resource);
  const normalizedPlan = normalizePlanCode(planCode);
  return MONTHLY_LIMITS[normalizedPlan][resource];
}

export function hasReachedMonthlyLimit({ planCode, resource, usedCount }) {
  const limit = getMonthlyLimitForPlan(planCode, resource);
  if (!Number.isFinite(limit)) return false;
  return normalizeUsageCount(usedCount) >= limit;
}

export async function getMonthlyUsageSnapshot(
  userId,
  { monthStart = null, supabaseClient = supabase } = {},
) {
  if (!userId) {
    return {
      monthStart: normalizeMonthStart(monthStart),
      [USAGE_RESOURCE_PDF_EXPORT]: 0,
      [USAGE_RESOURCE_WHATSAPP_SHARE]: 0,
    };
  }

  const normalizedMonth = normalizeMonthStart(monthStart);
  const { data, error } = await supabaseClient
    .from('usage_monthly')
    .select('resource,used_count')
    .eq('user_id', userId)
    .eq('month_start', normalizedMonth);

  // Se a tabela não existir (404) ou qualquer outro erro, retorna contagens zeradas
  // como fallback seguro em vez de propagar o erro e bloquear a funcionalidade.
  if (error) {
    return {
      monthStart: normalizedMonth,
      [USAGE_RESOURCE_PDF_EXPORT]: 0,
      [USAGE_RESOURCE_WHATSAPP_SHARE]: 0,
    };
  }

  const snapshot = {
    monthStart: normalizedMonth,
    [USAGE_RESOURCE_PDF_EXPORT]: 0,
    [USAGE_RESOURCE_WHATSAPP_SHARE]: 0,
  };

  for (const row of data || []) {
    if (!VALID_RESOURCES.has(row?.resource)) continue;
    snapshot[row.resource] = normalizeUsageCount(row?.used_count);
  }

  return snapshot;
}

export async function incrementMonthlyUsage(
  userId,
  resource,
  { monthStart = null, delta = 1, supabaseClient = supabase } = {},
) {
  assertValidResource(resource);
  if (!userId) throw new Error('User id is required to increment usage.');

  const normalizedMonth = normalizeMonthStart(monthStart);
  const { data, error } = await supabaseClient.rpc('increment_monthly_usage', {
    p_user_id: userId,
    p_resource: resource,
    p_month_start: normalizedMonth,
    p_delta: delta,
  });

  // Se a função RPC ainda não existir no banco, ignora silenciosamente
  if (error) return 0;

  if (typeof data === 'number') return normalizeUsageCount(data);
  if (Array.isArray(data) && data.length > 0) {
    return normalizeUsageCount(data[0]?.used_count ?? data[0]?.increment_monthly_usage ?? data[0]);
  }

  return normalizeUsageCount(data?.used_count ?? data?.increment_monthly_usage ?? 0);
}
