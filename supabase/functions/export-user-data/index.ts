// @ts-nocheck
// Deployed with --no-verify-jwt porque este projeto usa ES256 para assinar JWTs
// e o gateway Supabase só valida HS256. A verificação é feita internamente via
// `verifyUserToken` — que cria um client Supabase com o access_token do user
// e chama .auth.getUser(), validando a assinatura via Auth server real.
//
// Endpoint: POST /functions/v1/export-user-data
// Auth:     Authorization: Bearer <user access_token>
// Response: application/json (JSON com Content-Disposition attachment)
//
// LGPD art. 18, V (portabilidade): retorna dump tabular dos dados do usuário
// em formato aberto. Inclui apenas linhas onde user_id == auth.uid() — não
// expõe feedback/analytics anonimizados (user_id = null) porque esses já não
// são mais do usuário.
import { getCorsHeaders } from '../_shared/cors.ts';
import { verifyUserToken } from '../_shared/auth.ts';

function jsonResponse(
  req: Request,
  payload: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...getCorsHeaders(req),
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
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
    const supabaseUrl = getRequiredEnv('SUPABASE_URL');
    const supabaseAnonKey = getRequiredEnv('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? supabaseAnonKey;

    // ── 1. Valida autenticação REAL via Auth server ──────────────────────────
    const auth = await verifyUserToken(req, supabaseUrl, supabaseAnonKey);
    if (!auth.ok) {
      return jsonResponse(req, { code: auth.code, message: auth.message }, auth.status);
    }
    const userId = auth.user.id;

    // ── 2. Cliente admin (service_role) pra queries amplas ───────────────────
    // service_role bypass RLS — necessário pra ler tabelas que o user normal
    // não alcançaria via policies (ex.: feedback/analytics anonimizados).
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // ── 3. Queries em paralelo ───────────────────────────────────────────────
    const [
      { data: profile },
      { data: equipamentos },
      { data: registros },
      { data: tecnicos },
      { data: setores },
      { data: feedback },
      { data: usageMonthly },
      { data: aiUsageCost },
    ] = await Promise.all([
      supabaseAdmin.from('profiles').select('*').eq('id', userId).maybeSingle(),
      supabaseAdmin.from('equipamentos').select('*').eq('user_id', userId),
      supabaseAdmin.from('registros').select('*').eq('user_id', userId),
      supabaseAdmin.from('tecnicos').select('*').eq('user_id', userId),
      supabaseAdmin.from('setores').select('*').eq('user_id', userId),
      supabaseAdmin.from('feedback').select('*').eq('user_id', userId),
      supabaseAdmin.from('usage_monthly').select('*').eq('user_id', userId),
      supabaseAdmin.from('ai_usage_cost').select('*').eq('user_id', userId),
    ]);

    const exportedAt = new Date().toISOString();
    const payload = {
      meta: {
        exportedAt,
        userId,
        appVersion: Deno.env.get('VITE_APP_VERSION') ?? 'unknown',
        disclaimer:
          'Dados pessoais exportados em conformidade com o art. 18, V da LGPD ' +
          '(direito à portabilidade). Conteúdo: linhas das tabelas associadas a este ' +
          'usuário. Conteúdos anonimizados (feedback/analytics com user_id removido) ' +
          'não são incluídos por não serem mais dados pessoais identificáveis.',
        schema: {
          profiles: 'dados de cadastro e assinatura',
          equipamentos: 'equipamentos cadastrados pelo usuário',
          registros: 'registros de serviço (manutenções)',
          tecnicos: 'técnicos cadastrados no contexto do usuário',
          setores: 'agrupamentos de equipamentos (feature Pro)',
          feedback: 'feedback enviado pelo usuário',
          usage_monthly: 'contadores de uso mensal (PDF, WhatsApp)',
          ai_usage_cost: 'contadores de uso de IA (análise de placa)',
        },
      },
      account: {
        email: auth.user.email ?? null,
        createdAt: auth.user.created_at ?? null,
        lastSignInAt: auth.user.last_sign_in_at ?? null,
      },
      profiles: profile ? [profile] : [],
      equipamentos: equipamentos ?? [],
      registros: registros ?? [],
      tecnicos: tecnicos ?? [],
      setores: setores ?? [],
      feedback: feedback ?? [],
      usage_monthly: usageMonthly ?? [],
      ai_usage_cost: aiUsageCost ?? [],
    };

    const filename = `cooltrack-export-${userId}-${exportedAt.replace(/[:.]/g, '-')}.json`;

    console.log('[export-user-data] sucesso', {
      userId,
      equipamentos: payload.equipamentos.length,
      registros: payload.registros.length,
    });

    return jsonResponse(req, payload, 200, {
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
  } catch (error) {
    console.error(
      '[export-user-data] erro interno:',
      error instanceof Error ? error.message : error,
    );
    const message = error instanceof Error ? error.message : 'Erro interno';

    if (message.startsWith('MISSING_ENV_')) {
      return jsonResponse(req, { code: 'MISSING_ENV', message }, 500);
    }

    return jsonResponse(req, { code: 'INTERNAL_ERROR', message }, 500);
  }
});
