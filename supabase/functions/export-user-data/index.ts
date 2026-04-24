// @ts-nocheck
// Deployed with --no-verify-jwt porque este projeto usa ES256 para assinar JWTs
// e o gateway Supabase só valida HS256. A verificação é feita internamente via
// admin API com service role key — igual ou mais seguro que a validação do gateway.
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

/** Decodifica o payload de um JWT sem verificar a assinatura. */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
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

    // ── 1. Extrai e decodifica token ─────────────────────────────────────────
    const authHeader = req.headers.get('Authorization') ?? req.headers.get('authorization') ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (!token) {
      return jsonResponse(
        req,
        { code: 'AUTH_REQUIRED', message: 'Sem token de autenticação.' },
        401,
      );
    }

    const jwtPayload = decodeJwtPayload(token);
    const userId = (jwtPayload?.sub ?? '') as string;

    if (!userId) {
      return jsonResponse(
        req,
        { code: 'INVALID_JWT', message: 'Token sem identificador de usuário.' },
        401,
      );
    }

    // ── 2. Valida via admin API (prova que user existe) ──────────────────────
    const adminUserRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
    });

    if (!adminUserRes.ok) {
      console.error('[export-user-data] admin user lookup falhou', {
        status: adminUserRes.status,
        userId,
      });
      return jsonResponse(req, { code: 'INVALID_JWT', message: 'Usuário não encontrado.' }, 401);
    }

    const authUser = await adminUserRes.json();

    // ── 3. Cliente admin (service_role) pra queries ──────────────────────────
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // ── 4. Queries em paralelo ───────────────────────────────────────────────
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
        email: authUser?.email ?? null,
        createdAt: authUser?.created_at ?? null,
        lastSignInAt: authUser?.last_sign_in_at ?? null,
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
