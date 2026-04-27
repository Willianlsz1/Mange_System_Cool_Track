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
//   2. Storage cleanup: remove todos os objetos em {userId}/** dos buckets
//      de arquivos do app:
//        - registro-fotos (fotos de equipamentos/registros + assinaturas)
//        - relatorios (PDFs exportados para compartilhamento)
//   3. admin.deleteUser cascateia o resto: profiles, usage_monthly,
//      push_subscriptions, ai_usage_cost (todas têm ON DELETE CASCADE).
//      Tabelas com SET NULL (feedback, analytics_events) ficam anonimizadas.
import { getCorsHeaders } from '../_shared/cors.ts';
import { verifyUserToken } from '../_shared/auth.ts';

const STORAGE_LIST_PAGE_SIZE = 1000;
const STORAGE_REMOVE_CHUNK_SIZE = 100;
const DEFAULT_PHOTOS_BUCKET = Deno.env.get('SUPABASE_PHOTOS_BUCKET')?.trim() || 'registro-fotos';
const DEFAULT_REPORTS_BUCKET = Deno.env.get('SUPABASE_REPORTS_BUCKET')?.trim() || 'relatorios';
const STORAGE_BUCKETS = [
  ...new Set([DEFAULT_PHOTOS_BUCKET, DEFAULT_REPORTS_BUCKET].filter(Boolean)),
];

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

function splitIntoChunks<T>(values: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < values.length; i += chunkSize) {
    chunks.push(values.slice(i, i + chunkSize));
  }
  return chunks;
}

function isStorageFolderEntry(entry: Record<string, unknown>): boolean {
  // Supabase Storage retorna `id` para objetos e null para "pastas virtuais".
  return entry?.id == null;
}

/**
 * Lista recursivamente todos os objetos em {userId}/ e retorna array de paths.
 * Faz paginação por offset (limit=1000) em cada prefixo para evitar truncamento
 * silencioso em contas com grande volume de arquivos.
 */
async function listUserStoragePaths(
  supabaseAdmin,
  userId: string,
  bucketName: string,
): Promise<string[]> {
  const paths: string[] = [];
  const bucket = supabaseAdmin.storage.from(bucketName);
  const pendingPrefixes = [String(userId)];

  while (pendingPrefixes.length > 0) {
    const prefix = pendingPrefixes.pop();
    if (!prefix) continue;

    let offset = 0;
    while (true) {
      const { data, error: listErr } = await bucket.list(prefix, {
        limit: STORAGE_LIST_PAGE_SIZE,
        offset,
      });
      if (listErr) {
        throw new Error(`[storage_list_failed] ${bucketName}/${prefix}: ${listErr.message}`);
      }

      const items = Array.isArray(data) ? data : [];
      if (!items.length) break;

      for (const item of items) {
        if (!item?.name) continue;
        const nextPath = `${prefix}/${item.name}`;
        if (isStorageFolderEntry(item)) {
          pendingPrefixes.push(nextPath);
        } else {
          paths.push(nextPath);
        }
      }

      if (items.length < STORAGE_LIST_PAGE_SIZE) break;
      offset += STORAGE_LIST_PAGE_SIZE;
    }
  }

  return paths;
}

async function removeStoragePaths(supabaseAdmin, bucketName: string, paths: string[]) {
  if (!paths.length) return;
  const chunks = splitIntoChunks(paths, STORAGE_REMOVE_CHUNK_SIZE);
  for (const chunk of chunks) {
    const { error } = await supabaseAdmin.storage.from(bucketName).remove(chunk);
    if (error) {
      throw new Error(`[storage_remove_failed] ${bucketName}: ${error.message}`);
    }
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
      let totalRemoved = 0;
      for (const bucketName of STORAGE_BUCKETS) {
        console.log('[delete-user-account] storage cleanup start', { userId, bucketName });
        const paths = await listUserStoragePaths(supabaseAdmin, userId, bucketName);
        await removeStoragePaths(supabaseAdmin, bucketName, paths);
        steps[`storage:${bucketName}`] = { ok: true, count: paths.length };
        totalRemoved += paths.length;
        console.log('[delete-user-account] storage cleanup done', {
          userId,
          bucketName,
          removed: paths.length,
        });
      }
      steps.storage = { ok: true, count: totalRemoved };
    } catch (storageErr) {
      const message = storageErr instanceof Error ? storageErr.message : String(storageErr);
      console.error('[delete-user-account] storage cleanup falhou:', message);
      steps.storage = { ok: false, error: message };
      return jsonResponse(
        req,
        { code: 'STORAGE_CLEANUP_FAILED', message: 'Falha ao remover arquivos do usuário.', steps },
        500,
      );
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
