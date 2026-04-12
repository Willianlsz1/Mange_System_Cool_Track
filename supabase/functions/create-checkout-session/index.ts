// @ts-nocheck
import { corsHeaders } from '../_shared/cors.ts';
import Stripe from 'https://esm.sh/stripe@14?target=denonext';

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function getRequiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value || !value.trim()) {
    throw new Error(`MISSING_ENV_${name}`);
  }
  return value.trim();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ code: 'METHOD_NOT_ALLOWED', message: 'Use POST.' }, 405);
  }

  try {
    const stripeSecretKey = getRequiredEnv('STRIPE_SECRET_KEY');
    const stripePricePro = getRequiredEnv('STRIPE_PRICE_PRO');
    const appUrl = getRequiredEnv('APP_URL');
    const supabaseUrl = getRequiredEnv('SUPABASE_URL');
    const supabaseAnonKey = getRequiredEnv('SUPABASE_ANON_KEY');

    const stripe = new Stripe(stripeSecretKey);
    const body = await req.json().catch(() => ({}));
    const plan = body?.plan === 'pro' ? 'pro' : 'pro';

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ code: 'AUTH_REQUIRED', message: 'Sem token de autenticação.' }, 401);
    }

    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) {
      return jsonResponse({ code: 'AUTH_REQUIRED', message: 'Token inválido.' }, 401);
    }

    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      console.error('AUTH DEBUG', { userError });
      return jsonResponse(
        {
          code: 'INVALID_JWT',
          message: 'Usuário não autenticado.',
          details: userError?.message ?? null,
        },
        401,
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      client_reference_id: user.id,
      line_items: [
        {
          price: stripePricePro,
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/?success=true`,
      cancel_url: `${appUrl}/?canceled=true`,
      metadata: {
        supabase_user_id: user.id,
        requested_plan: plan,
      },
    });

    return jsonResponse({ url: session.url }, 200);
  } catch (error) {
    console.error('Stripe checkout error:', error);

    const message = error instanceof Error ? error.message : 'Erro interno na função';
    if (message.startsWith('MISSING_ENV_')) {
      const envName = message.replace('MISSING_ENV_', '');
      return jsonResponse(
        {
          code: 'MISSING_ENV',
          message: `Falta ${envName} nos secrets da Edge Function.`,
        },
        500,
      );
    }

    return jsonResponse({ code: 'INTERNAL_ERROR', message }, 500);
  }
});
