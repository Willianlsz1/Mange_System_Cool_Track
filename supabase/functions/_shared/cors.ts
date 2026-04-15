/**
 * CORS dinâmico: restringe ao domínio definido em APP_URL.
 * Fallback para desenvolvimento local (localhost).
 */
const APP_URL = Deno.env.get('APP_URL')?.replace(/\/$/, '') ?? '';

const ALLOWED_ORIGINS = [APP_URL, 'http://localhost:5173', 'http://localhost:4173'].filter(Boolean);

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : APP_URL || ALLOWED_ORIGINS[0];

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

/** Atalho para rotas que ainda usam corsHeaders estático */
export const corsHeaders = getCorsHeaders({ headers: new Headers() } as Request);
