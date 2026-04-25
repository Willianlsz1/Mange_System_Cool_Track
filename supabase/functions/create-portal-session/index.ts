// @ts-nocheck
// Deployed with --no-verify-jwt porque este projeto usa ES256 para assinar JWTs
// e o gateway Supabase só valida HS256. A verificação é feita internamente via
// admin API com service role key — igual ou mais seguro que a validação do gateway.
import { getCorsHeaders } from '../_shared/cors.ts';
import { verifyUserToken } from '../_shared/auth.ts';
import Stripe from 'https://esm.sh/stripe@14?target=denonext';

function jsonResponse(req: Request, payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
  });
}

function getRequiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value || !value.trim()) throw new Error(`MISSING_ENV_${name}`);
  return value.trim();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) });
  }

  if (req.method !== 'POST') {
    return jsonResponse(req, { code: 'METHOD_NOT_ALLOWED' }, 405);
  }

  try {
    const stripeSecretKey = getRequiredEnv('STRIPE_SECRET_KEY');
    const appUrl = getRequiredEnv('APP_URL');
    const supabaseUrl = getRequiredEnv('SUPABASE_URL');
    const supabaseAnonKey = getRequiredEnv('SUPABASE_ANON_KEY');
    const serviceRoleKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');

    const stripe = new Stripe(stripeSecretKey);

    // ── 1. Valida autenticação REAL via Auth server ──────────────────────────
    // verifyUserToken cria um client Supabase com o access_token do user e
    // chama .auth.getUser(), que valida a assinatura ES256. Tokens forjados
    // são rejeitados pelo Auth server antes do código rodar.
    const auth = await verifyUserToken(req, supabaseUrl, supabaseAnonKey);
    if (!auth.ok) {
      return jsonResponse(req, { code: auth.code, message: auth.message }, auth.status);
    }
    const userId = auth.user.id;

    console.log('[create-portal-session] usuário verificado', { userId });

    // ── 4. Busca stripe_customer_id no perfil ────────────────────────────────
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      console.error('[create-portal-session] profile error', profileError?.message);
      return jsonResponse(
        req,
        { code: 'PROFILE_LOOKUP_FAILED', message: 'Nao foi possivel carregar sua assinatura.' },
        500,
      );
    }

    const customerId: string | null = profile?.stripe_customer_id ?? null;

    if (!customerId) {
      return jsonResponse(
        req,
        {
          code: 'NO_STRIPE_CUSTOMER',
          message:
            'Não encontramos uma assinatura ativa para sua conta. ' +
            'Se você acabou de assinar, aguarde alguns segundos e tente novamente.',
        },
        404,
      );
    }

    // ── 6. Cria sessão do portal Stripe ──────────────────────────────────────
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl}/`,
    });

    console.log('[create-portal-session] sessão criada', { userId, sessionId: portalSession.id });

    return jsonResponse(req, { url: portalSession.url }, 200);
  } catch (error) {
    console.error(
      '[create-portal-session] erro interno:',
      error instanceof Error ? error.message : error,
    );
    const message = error instanceof Error ? error.message : 'Erro interno';

    if (message.startsWith('MISSING_ENV_')) {
      return jsonResponse(req, { code: 'MISSING_ENV', message }, 500);
    }

    return jsonResponse(req, { code: 'INTERNAL_ERROR', message }, 500);
  }
});
