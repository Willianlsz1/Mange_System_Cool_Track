/**
 * Dev Wipe Data — apaga equipamentos, registros, técnicos e cache local
 * do usuário atual. Só para testes. NÃO derruba a sessão, NÃO mexe no perfil
 * de billing (plan_code, subscription_status) pra não quebrar o teste do plano.
 *
 * Ordem importa:
 *  1. Supabase (remote) — registros primeiro (FK para equipamentos), depois
 *     equipamentos, tecnicos, usage_monthly
 *  2. localStorage — snapshot local (cooltrack_v3) + filas de sync
 *  3. Reload — força o app a re-bootar com estado vazio
 */

import { supabase } from './supabase.js';
import { STORAGE_KEY } from './utils.js';

const LOCAL_KEYS_TO_CLEAR = [
  STORAGE_KEY, // 'cooltrack_v3' — snapshot local principal
  'cooltrack-sync-dirty-v1',
  'cooltrack-sync-deletions-v1',
  'cooltrack-cache-owner-v1',
];

async function deleteAllFromTable(table, userId) {
  const { error } = await supabase.from(table).delete().eq('user_id', userId);
  if (error) {
    // Alguns ambientes podem não ter `usage_monthly` ainda; loga mas não quebra
    console.warn(`[DevWipe] erro ao limpar ${table}:`, error.message);
    return false;
  }
  return true;
}

function clearLocalData() {
  for (const key of LOCAL_KEYS_TO_CLEAR) {
    try {
      localStorage.removeItem(key);
    } catch (_) {
      /* ignora */
    }
  }
  // Remove flags de migração por usuário (cooltrack-migrated-<uuid>)
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('cooltrack-migrated-')) keysToRemove.push(k);
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch (_) {
    /* ignora */
  }
}

/**
 * Executa o wipe. Retorna { ok, localOnly, error? }.
 *  - localOnly=true quando não havia userId (guest mode) — limpa só localStorage
 */
export async function wipeAllUserData() {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const userId = user?.id ?? null;

    if (!userId) {
      clearLocalData();
      return { ok: true, localOnly: true };
    }

    // Ordem: registros → equipamentos (FK), depois os demais
    const results = await Promise.allSettled([
      deleteAllFromTable('registros', userId),
      deleteAllFromTable('tecnicos', userId),
      deleteAllFromTable('usage_monthly', userId),
    ]);

    // equipamentos por último porque registros.equip_id referencia
    await deleteAllFromTable('equipamentos', userId);

    const failures = results.filter((r) => r.status === 'rejected');
    if (failures.length) {
      console.warn('[DevWipe] algumas tabelas falharam:', failures);
    }

    clearLocalData();
    return { ok: true, localOnly: false };
  } catch (error) {
    console.error('[DevWipe] falha:', error);
    return { ok: false, error: error?.message || 'unknown' };
  }
}
