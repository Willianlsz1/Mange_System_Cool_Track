/**
 * CoolTrack Pro - User-Scoped Storage
 *
 * Wrapper fino em cima de localStorage pra evitar que dados de um usuário
 * vazem pro próximo que logar no mesmo navegador. As chaves são prefixadas
 * com o userId atual: `ct:<userId>:<key>`. Antes da sessão autenticar,
 * `userId = "anon"` — as chaves caem em `ct:anon:<key>`.
 *
 * Migração incremental: NÃO substitui todo `localStorage` de uma vez. O
 * plano é migrar chaves críticas que hoje vazam entre contas (flags de
 * onboarding, cache de plano, último técnico usado). O resto continua no
 * `localStorage` global até ser migrado por demanda.
 *
 * Uso:
 *   import { userStorage, setCurrentUser } from './userStorage.js';
 *   setCurrentUser(user?.id || 'anon');
 *   userStorage.set('ftx-done', '1');
 *   userStorage.get('ftx-done');
 *
 * Atomicidade: cada chamada é síncrona. Não há fila de writes. Em caso de
 * QuotaExceeded ou storage indisponível (Safari private mode), silencia
 * o erro — vale mais manter o app funcional do que crashar por cache.
 */

const KEY_PREFIX = 'ct';
let _userId = 'anon';

function scopedKey(key) {
  return `${KEY_PREFIX}:${_userId}:${key}`;
}

export function setCurrentUser(id) {
  _userId = id && typeof id === 'string' ? id : 'anon';
}

export function getCurrentUserScope() {
  return _userId;
}

export const userStorage = {
  get(key) {
    try {
      return localStorage.getItem(scopedKey(key));
    } catch {
      return null;
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(scopedKey(key), value);
      return true;
    } catch {
      return false;
    }
  },

  remove(key) {
    try {
      localStorage.removeItem(scopedKey(key));
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Remove todas as chaves escopadas do usuário atual. Útil no logout
   * pra garantir higiene completa sem mexer em `ct:anon:*` (outras sessões).
   */
  clearCurrent() {
    try {
      const prefix = `${KEY_PREFIX}:${_userId}:`;
      const toRemove = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix)) toRemove.push(k);
      }
      toRemove.forEach((k) => localStorage.removeItem(k));
    } catch {
      /* storage indisponível — no-op */
    }
  },
};

/**
 * Helper de migração one-shot: se existir uma chave legada global em
 * `localStorage`, copia pra userStorage escopada e remove a original.
 * Seguro de chamar várias vezes (idempotente).
 */
export function migrateLegacyKey(legacyKey, newKey = legacyKey) {
  try {
    const existing = localStorage.getItem(legacyKey);
    if (existing === null) return;
    // Só migra se ainda não foi migrada — evita sobrescrever um valor
    // novo que o usuário já setou escopado.
    if (userStorage.get(newKey) === null) {
      userStorage.set(newKey, existing);
    }
    localStorage.removeItem(legacyKey);
  } catch {
    /* no-op */
  }
}
