/**
 * telemetrySink — Destino externo dos eventos de telemetria (Supabase).
 *
 * Pipeline:
 *   trackEvent() → queueEvent() → memory queue
 *     → flush (timer OR size threshold) → Supabase insert
 *     → falhou? → IndexedDB fallback → retry exponencial
 *
 * Garantias:
 *   - Nunca joga exceção pra cima: telemetria NUNCA deve quebrar o app.
 *   - Offline-first: enfileira em IDB se navigator.onLine === false ou se o
 *     insert falhar; retenta com backoff exponencial (1s → 2s → 4s → 8s cap).
 *   - Sem PII: session_id é gerado em sessionStorage (não persiste cross-session).
 *   - Insert-only: cliente nunca lê, compatível com RLS insert-any / select-none.
 *
 * Uso:
 *   import { initTelemetrySink, queueEvent } from './core/telemetrySink.js';
 *   initTelemetrySink({ supabaseClient: supabase });
 *   queueEvent({ name: 'lp_view', payload: {}, timestamp: '...' });
 */

const DEFAULTS = {
  tableName: 'analytics_events',
  batchSize: 10,
  batchIntervalMs: 5000,
  retryMaxMs: 8000,
  retryInitialMs: 1000,
  idbName: 'cooltrack-telemetry',
  idbStore: 'pending_events',
  sessionStorageKey: 'cooltrack-telemetry-session',
};

// Estado do sink — módulo-level pra permitir 1 instância por pageload.
// Reset explícito via resetTelemetrySink() (usado em testes).
let state = null;

function createInitialState(config) {
  return {
    ...DEFAULTS,
    ...config,
    queue: [],
    flushTimer: null,
    retryDelayMs: config?.retryInitialMs ?? DEFAULTS.retryInitialMs,
    flushing: false,
    initialized: false,
    supabaseClient: null,
    getUserId: null,
  };
}

/**
 * Gera ou recupera um session_id efêmero (sobrevive só na aba atual).
 * Não é PII — é um identificador aleatório pra correlacionar eventos.
 */
function getOrCreateSessionId() {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return `mem-${Math.random().toString(36).slice(2, 14)}`;
  }

  try {
    let sid = window.sessionStorage.getItem(state.sessionStorageKey);
    if (!sid) {
      // crypto.randomUUID disponível em browsers modernos + jsdom 22+
      sid =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `sid-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
      window.sessionStorage.setItem(state.sessionStorageKey, sid);
    }
    return sid;
  } catch {
    // sessionStorage bloqueado (private mode exotic) — fallback memória.
    return `fallback-${Math.random().toString(36).slice(2, 14)}`;
  }
}

// --- IndexedDB helpers --------------------------------------------------

function openIdb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(state.idbName, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(state.idbStore)) {
        db.createObjectStore(state.idbStore, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbAppend(events) {
  if (!events?.length) return;
  try {
    const db = await openIdb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(state.idbStore, 'readwrite');
      const store = tx.objectStore(state.idbStore);
      events.forEach((e) => store.add({ event: e, enqueuedAt: Date.now() }));
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (err) {
    // Silencioso — telemetria não pode quebrar app.
    if (import.meta.env?.DEV) {
      console.warn('[telemetrySink] idbAppend falhou:', err);
    }
  }
}

async function idbDrain() {
  try {
    const db = await openIdb();
    const pending = await new Promise((resolve, reject) => {
      const tx = db.transaction(state.idbStore, 'readwrite');
      const store = tx.objectStore(state.idbStore);
      const getAllReq = store.getAll();
      getAllReq.onsuccess = () => {
        store.clear();
        resolve(getAllReq.result || []);
      };
      getAllReq.onerror = () => reject(getAllReq.error);
    });
    db.close();
    return pending.map((r) => r.event);
  } catch {
    return [];
  }
}

// --- Supabase insert ----------------------------------------------------

async function insertBatch(events) {
  if (!state.supabaseClient?.from) {
    throw new Error('supabase client missing');
  }

  const sessionId = getOrCreateSessionId();
  const userId = typeof state.getUserId === 'function' ? await state.getUserId() : null;

  const rows = events.map((e) => ({
    name: e.name,
    payload: e.payload || {},
    session_id: sessionId,
    user_id: userId || null,
    // Deixamos o servidor setar created_at via default — evita skew de clock.
  }));

  const { error } = await state.supabaseClient.from(state.tableName).insert(rows);
  if (error) {
    throw error;
  }
}

// --- flush + retry ------------------------------------------------------

function scheduleFlush(delayMs) {
  if (typeof window === 'undefined') return;
  if (state.flushTimer) clearTimeout(state.flushTimer);
  state.flushTimer = setTimeout(() => {
    state.flushTimer = null;
    // Fire-and-forget; flush() nunca joga.
    flush();
  }, delayMs);
}

function isOnline() {
  if (typeof navigator === 'undefined') return true;
  // navigator.onLine === false é confiável pra detectar offline;
  // true pode ser otimista mas ainda tentamos.
  return navigator.onLine !== false;
}

export async function flush() {
  if (!state?.initialized || state.flushing) return;
  state.flushing = true;

  try {
    // Junta queue in-memory + qualquer resquício de IDB (retomado no boot).
    const memoryBatch = state.queue.splice(0, state.queue.length);
    if (!memoryBatch.length) {
      state.flushing = false;
      return;
    }

    // Se offline, vai direto pro IDB sem tentar.
    if (!isOnline()) {
      await idbAppend(memoryBatch);
      state.flushing = false;
      return;
    }

    try {
      await insertBatch(memoryBatch);
      // Sucesso — reseta backoff.
      state.retryDelayMs = state.retryInitialMs;

      // Aproveita pra drenar qualquer evento em IDB de tentativas anteriores.
      const stale = await idbDrain();
      if (stale.length) {
        try {
          await insertBatch(stale);
        } catch {
          // Volta pro IDB — tenta no próximo ciclo.
          await idbAppend(stale);
        }
      }
    } catch (err) {
      // Falha — persiste pra tentar depois com backoff.
      await idbAppend(memoryBatch);
      state.retryDelayMs = Math.min(state.retryDelayMs * 2, state.retryMaxMs);
      scheduleFlush(state.retryDelayMs);

      if (import.meta.env?.DEV) {
        console.warn(
          '[telemetrySink] insert falhou, rescheduled em',
          state.retryDelayMs,
          'ms:',
          err?.message || err,
        );
      }
    }
  } finally {
    state.flushing = false;
  }
}

// --- API pública --------------------------------------------------------

export function queueEvent(event) {
  if (!state?.initialized || !event || typeof event !== 'object') return;
  const name = String(event.name || '').trim();
  if (!name) return;

  state.queue.push({ name, payload: event.payload || {} });

  if (state.queue.length >= state.batchSize) {
    // Dispara imediato quando bate o threshold.
    flush();
  } else if (!state.flushTimer) {
    scheduleFlush(state.batchIntervalMs);
  }
}

export function initTelemetrySink(config = {}) {
  if (state?.initialized) return state;

  state = createInitialState(config);
  state.supabaseClient = config.supabaseClient || null;
  state.getUserId = config.getUserId || null;
  state.initialized = true;

  // Recupera eventos de sessões anteriores que não subiram.
  if (typeof window !== 'undefined') {
    // Resync quando voltar online.
    window.addEventListener('online', () => {
      flush();
    });

    // Tenta flush antes da página fechar — sendBeacon seria ideal mas
    // supabase-js usa fetch. Best-effort.
    window.addEventListener('beforeunload', () => {
      if (state?.queue.length) {
        // Joga pro IDB pra não perder.
        const snapshot = state.queue.splice(0, state.queue.length);
        idbAppend(snapshot);
      }
    });

    // Drain inicial em idle — sem bloquear o boot crítico.
    const drainInitial = async () => {
      const stale = await idbDrain();
      if (stale.length && isOnline()) {
        try {
          await insertBatch(stale);
        } catch {
          await idbAppend(stale);
        }
      } else if (stale.length) {
        await idbAppend(stale);
      }
    };

    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(drainInitial, { timeout: 3000 });
    } else {
      setTimeout(drainInitial, 1500);
    }
  }

  return state;
}

export function resetTelemetrySink() {
  if (state?.flushTimer) clearTimeout(state.flushTimer);
  state = null;
}

// Exporta pra testes (não é API pública).
export const __internal = {
  getState: () => state,
  getOrCreateSessionId: () => getOrCreateSessionId(),
};
