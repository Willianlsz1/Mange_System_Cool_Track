// @ts-nocheck
// Helper compartilhado de autenticação pra edge functions.
//
// ─── Por que esse helper existe ─────────────────────────────────────────
// Este projeto deploya edge functions com --no-verify-jwt porque o gateway
// Supabase valida JWT com HS256, mas o projeto assina com ES256. Isso
// significa que o gateway NÃO filtra tokens inválidos — cabe à função
// validar.
//
// O pattern anterior era decodificar o payload manualmente (base64-parse)
// e validar que o `sub` existe via admin API. Isso É INSUFICIENTE: a
// assinatura nunca foi verificada, então um atacante pode forjar um token
// com QUALQUER `sub` (UUID válido) e passar. Exploração:
//   1. Atacante sabe um UUID de user (log, OAuth export, guess por formato)
//   2. Forja payload: { sub: "<uuid>", exp: Math.floor(Date.now()/1000)+3600 }
//   3. base64 sem signature válida
//   4. Edge function decodifica, vê sub existir no admin API → aprova
//
// ─── Pattern correto ────────────────────────────────────────────────────
// Criar um Supabase client passando o access_token do user no header
// Authorization e chamar `.auth.getUser()`. Isso faz um request pro Auth
// server do próprio Supabase, que valida a assinatura ES256 corretamente.
// Token forjado é rejeitado pelo Auth server antes de chegar ao código.
//
// Custo: 1 HTTP extra por request. Latência ~50-100ms. Aceitável.

export interface AuthSuccess {
  ok: true;
  user: {
    id: string;
    email?: string;
    [key: string]: unknown;
  };
  accessToken: string;
}

export interface AuthFailure {
  ok: false;
  status: number;
  code: string;
  message: string;
}

export type AuthResult = AuthSuccess | AuthFailure;

/**
 * Valida o access_token do request via Supabase Auth server.
 *
 * @param req — Request do Deno.serve
 * @param supabaseUrl — SUPABASE_URL do projeto
 * @param anonKey — SUPABASE_ANON_KEY (não o service_role)
 * @returns AuthResult — ok:true com user.id legítimo, ou ok:false com status/code/message
 */
export async function verifyUserToken(
  req: Request,
  supabaseUrl: string,
  anonKey: string,
): Promise<AuthResult> {
  const authHeader = req.headers.get('Authorization') ?? req.headers.get('authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!token) {
    return {
      ok: false,
      status: 401,
      code: 'AUTH_REQUIRED',
      message: 'Sem token de autenticação.',
    };
  }

  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const { data, error } = await supabaseAuth.auth.getUser();

    if (error || !data?.user?.id) {
      return {
        ok: false,
        status: 401,
        code: 'INVALID_JWT',
        message: 'Sessão inválida ou expirada.',
      };
    }

    return { ok: true, user: data.user, accessToken: token };
  } catch (err) {
    console.error('[verifyUserToken] auth check failed', err);
    return {
      ok: false,
      status: 503,
      code: 'AUTH_UNAVAILABLE',
      message: 'Não foi possível validar sessão agora. Tente novamente.',
    };
  }
}
