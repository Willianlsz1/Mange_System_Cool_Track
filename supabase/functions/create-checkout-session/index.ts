// @ts-nocheck
import { getCorsHeaders } from '../_shared/cors.ts';
import Stripe from 'https://esm.sh/stripe@14?target=denonext';

function jsonResponse(req: Request, payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
  });
}

function getRequiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value || !value.trim()) {
    throw new Error(`MISSING_ENV_${name}`);
  }
  return value.trim();
}

function getOptionalEnv(name: string) {
  return Deno.env.get(name)?.trim() ?? null;
}

// Planos aceitos pelo endpoint. Cada chave casa com um env var que guarda o Price ID do Stripe.
// STRIPE_PRICE_PRO é obrigatório (retrocompatibilidade); os demais são opcionais
// até que você cadastre os Price IDs no Stripe e publique os secrets.
const PLAN_TO_ENV: Record<string, string> = {
  pro: 'STRIPE_PRICE_PRO',
  pro_annual: 'STRIPE_PRICE_PRO_ANNUAL',
  plus: 'STRIPE_PRICE_PLUS',
  plus_annual: 'STRIPE_PRICE_PLUS_ANNUAL',
};

const DEFAULT_PLAN = 'pro';

function normalizeRequestedPlan(raw: unknown): string {
  const lower = String(raw || '').toLowerCase();
  return Object.prototype.hasOwnProperty.call(PLAN_TO_ENV, lower) ? lower : DEFAULT_PLAN;
}

/**
 * Resolve o Price ID para o plano pedido.
 *
 * Fallback apenas DENTRO do mesmo tier (anual→mensal quando anual não
 * existe). Fallback cross-tier foi removido — o risco é crítico: user
 * pede Plus, env `STRIPE_PRICE_PLUS` está ausente por acidente (rotação
 * de secret, typo em deploy), e o sistema silenciosamente cobra Pro em
 * vez de travar. Isso é cobrança sem consentimento do usuário.
 *
 * Regra:
 *   plus_annual → plus (se não existir, erro)
 *   plus        → erro se não existir (NÃO cai para pro)
 *   pro_annual  → pro  (se não existir, erro)
 *   pro         → erro se não existir
 */
function resolvePriceId(plan: string): { priceId: string; resolvedPlan: string } {
  const fallbackChain: string[] = (() => {
    switch (plan) {
      case 'plus_annual':
        return ['plus_annual', 'plus'];
      case 'plus':
        return ['plus'];
      case 'pro_annual':
        return ['pro_annual', 'pro'];
      case 'pro':
      default:
        return ['pro'];
    }
  })();

  for (const candidate of fallbackChain) {
    const envName = PLAN_TO_ENV[candidate];
    const value = getOptionalEnv(envName);
    if (value) {
      return { priceId: value, resolvedPlan: candidate };
    }
  }

  // Nenhum price dentro do tier configurado — falha fechado. Evita cobrar
  // user em tier diferente do que foi pedido.
  const primaryEnv = PLAN_TO_ENV[fallbackChain[0]] ?? PLAN_TO_ENV.pro;
  throw new Error(`MISSING_ENV_${primaryEnv}`);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) });
  }

  if (req.method !== 'POST') {
    return jsonResponse(req, { code: 'METHOD_NOT_ALLOWED', message: 'Use POST.' }, 405);
  }

  try {
    const stripeSecretKey = getRequiredEnv('STRIPE_SECRET_KEY');
    const appUrl = getRequiredEnv('APP_URL');
    const supabaseUrl = getRequiredEnv('SUPABASE_URL');
    const supabaseAnonKey = getRequiredEnv('SUPABASE_ANON_KEY');

    const stripe = new Stripe(stripeSecretKey);
    const body = await req.json().catch(() => ({}));
    const requestedPlan = normalizeRequestedPlan(body?.plan);

    const { priceId, resolvedPlan } = resolvePriceId(requestedPlan);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse(
        req,
        { code: 'AUTH_REQUIRED', message: 'Sem token de autenticação.' },
        401,
      );
    }

    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) {
      return jsonResponse(req, { code: 'AUTH_REQUIRED', message: 'Token inválido.' }, 401);
    }

    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      console.error('[create-checkout-session] auth falhou:', userError?.message ?? 'sem usuário');
      return jsonResponse(
        req,
        {
          code: 'INVALID_JWT',
          message: 'Usuário não autenticado.',
        },
        401,
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      client_reference_id: user.id,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/?success=true`,
      cancel_url: `${appUrl}/?canceled=true`,
      metadata: {
        supabase_user_id: user.id,
        requested_plan: requestedPlan,
        // resolved_plan pode diferir do requested_plan quando caímos em fallback
        // (ex: pediram plus_annual mas só há Pro cadastrado). O webhook usa esse
        // valor para gravar o plan_code correto em profiles.
        resolved_plan: resolvedPlan,
      },
      // Duplica no subscription_data para que o webhook receba metadata mesmo
      // em eventos posteriores (invoice.paid, subscription.updated).
      subscription_data: {
        metadata: {
          supabase_user_id: user.id,
          requested_plan: requestedPlan,
          resolved_plan: resolvedPlan,
        },
      },
    });

    return jsonResponse(req, { url: session.url }, 200);
  } catch (error) {
    console.error(
      '[create-checkout-session] erro interno:',
      error instanceof Error ? error.message : error,
    );

    const message = error instanceof Error ? error.message : 'Erro interno na função';
    if (message.startsWith('MISSING_ENV_')) {
      const envName = message.replace('MISSING_ENV_', '');
      return jsonResponse(
        req,
        {
          code: 'MISSING_ENV',
          message: `Falta ${envName} nos secrets da Edge Function.`,
        },
        500,
      );
    }

    return jsonResponse(req, { code: 'INTERNAL_ERROR', message }, 500);
  }
});
