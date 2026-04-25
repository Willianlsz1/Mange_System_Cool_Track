// @ts-nocheck
// Deployed with --no-verify-jwt porque este projeto usa ES256 para assinar JWTs
// e o gateway Supabase só valida HS256. A verificação é feita internamente via
// `verifyUserToken` — que cria um client Supabase com o access_token do user
// e chama .auth.getUser(), validando a assinatura via Auth server real.
//
// Endpoint: POST /functions/v1/delete-user-account
// Auth:     Authorization: Bearer <user access_token>
//
// LGPD art. 18, VI (eliminação): remove permanentemente todos os dados do
// usuário. Ordem FK-safe:
//   1. Deletes manuais em tabelas core (equipamentos/registros/tecnicos/setores)
//      porque seus FKs podem ter sido criados fora das migrations versionadas
//      sem CASCADE. Idempotente — running 2x não erra.
//   2. Storage cleanup: remove todos os objetos em {userId}/** do bucket
//      compartilhado (registro-fotos), que inclui fotos de equipamentos,
//      fotos de registros e assinaturas.
//   3. admin.deleteUser cascateia o resto: profiles, usage_monthly,
//      push_subscriptions, ai_usage_cost (todas têm ON DELETE CASCADE).
//      Tabelas com SET NULL (feedback, analytics_events) ficam anonimizadas.
import { getCorsHeaders } from '../_shared/cors.ts';
import { verifyUserToken } from '../_shared/auth.ts';

const DEFAULT_BUCKET = 'registro-fotos';

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

/**
 * Lista recursivamente todos os objetos em {userId}/ e retorna array de paths.
 * Supabase Storage `list` retorna 1 nível só + tem limite default de 100.
 * Navega subpastas conhecidas do schema do bucket: registros/, equipamentos/.
 */
async function listUserStoragePaths(supabaseAdmin, userId: string): Promise<string[]> {
  const paths: string[] = [];
  const bucket = supabaseAdmin.storage.from(DEFAULT_BUCKET);

  const scopes = ['registros', 'equipamentos'];
  for (const scope of scopes) {
    const scopePrefix = `${userId}/${scope}`;
    const { data: records, error: listErr } = await bucket.list(scopePrefix, { limit: 1000 });
    if (listErr || !records) continue;

    for (const record of records) {
      if (!record?.name) continue;
      const recordPrefix = `${scopePrefix}/${record.name}`;
      const { data: files } = await bucket.list(recordPrefix, { limit: 1000 });
      if (!files) continue;
      for (const f of files) {
        if (f?.name) paths.push(`${recordPrefix}/${f.name}`);
      }
    }
  }

  return paths;
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
    const serviceRoleKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');

    // ── 1. Valida autenticação REAL via Auth server ──────────────────────────
    // CRITICAL: este endpoint é destrutivo. Auth forjada = conta alheia
    // deletada. verifyUserToken garante que o token foi assinado pelo Auth
    // server do Supabase antes de prosseguir.
    const auth = await verifyUserToken(req, supabaseUrl, supabaseAnonKey);
    if (!auth.ok) {
      return jsonResponse(req, { code: auth.code, message: auth.message }, auth.status);
    }
    const userId = auth.user.id;

    // ── 2. Cliente admin ─────────────────────────────────────────────────────
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const steps: Record<string, { ok: boolean; error?: string; count?: number }> = {};

    // ── 3. Delete manual em tabelas core (ordem FK-safe) ─────────────────────
    const tablesInOrder = ['registros', 'equipamentos', 'setores', 'tecnicos'];
    for (const table of tablesInOrder) {
      const { error, count } = await supabaseAdmin
        .from(table)
        .delete({ count: 'exact' })
        .eq('user_id', userId);

      if (error) {
        console.error(`[delete-user-account] falha ao deletar ${table}:`, error.message);
        steps[table] = { ok: false, error: error.message };
        return jsonResponse(
          req,
          { code: 'TABLE_DELETE_FAILED', step: table, message: error.message },
          500,
        );
      }
      steps[table] = { ok: true, count: count ?? 0 };
    }

    // ── 4. Storage cleanup ───────────────────────────────────────────────────
    try {
      const paths = await listUserStoragePaths(supabaseAdmin, userId);
      if (paths.length > 0) {
        const { error: removeErr } = await supabaseAdmin.storage.from(DEFAULT_BUCKET).remove(paths);
        if (removeErr) {
          console.warn('[delete-user-account] storage cleanup parcial:', removeErr.message);
          steps.storage = { ok: false, error: removeErr.message, count: paths.length };
        } else {
          steps.storage = { ok: true, count: paths.length };
        }
      } else {
        steps.storage = { ok: true, count: 0 };
      }
    } catch (storageErr) {
      console.warn('[delete-user-account] storage list/remove falhou:', storageErr);
      steps.storage = { ok: false, error: String(storageErr) };
    }

    // ── 5. admin.deleteUser — cascateia tabelas com ON DELETE CASCADE ────────
    const { error: deleteUserErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteUserErr) {
      console.error('[delete-user-account] admin.deleteUser falhou:', deleteUserErr.message);
      steps.auth = { ok: false, error: deleteUserErr.message };
      return jsonResponse(
        req,
        { code: 'AUTH_DELETE_FAILED', message: deleteUserErr.message, steps },
        500,
      );
    }
    steps.auth = { ok: true };

    console.log('[delete-user-account] concluído', { userId, steps });

    return jsonResponse(req, { ok: true, userId, steps }, 200);
  } catch (error) {
    console.error(
      '[delete-user-account] erro interno:',
      error instanceof Error ? error.message : error,
    );
    const message = error instanceof Error ? error.message : 'Erro interno';

    if (message.startsWith('MISSING_ENV_')) {
      return jsonResponse(req, { code: 'MISSING_ENV', message }, 500);
    }

    return jsonResponse(req, { code: 'INTERNAL_ERROR', message }, 500);
  }
});
