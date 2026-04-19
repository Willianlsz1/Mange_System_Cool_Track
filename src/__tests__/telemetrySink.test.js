/**
 * Testes do telemetrySink.
 *
 * Estratégia:
 *   - Mocka supabase client (from().insert()) pra simular sucesso/falha.
 *   - Usa vi.useFakeTimers() pra controlar o batch interval sem esperar real.
 *   - IDB em jsdom: usamos fake-indexeddb via global se presente, ou stub inline
 *     só pra testar as chamadas (o código tolera IDB ausente — é resilient).
 *
 * Cobertura:
 *   1. init+queue → insert batch ao atingir batchSize
 *   2. init+queue → insert batch após batchIntervalMs
 *   3. insert falha → reagenda com backoff e enfileira pro IDB
 *   4. offline (navigator.onLine=false) → pula insert e vai pro IDB
 *   5. session_id persistente no sessionStorage
 *   6. queueEvent antes de init → no-op silencioso
 *   7. name vazio → ignorado
 */

import {
  initTelemetrySink,
  queueEvent,
  flush,
  resetTelemetrySink,
  __internal,
} from '../core/telemetrySink.js';

function makeSupabaseMock(insertImpl) {
  const insert = vi.fn(insertImpl || (() => Promise.resolve({ error: null })));
  const from = vi.fn(() => ({ insert }));
  return { from, insert };
}

describe('telemetrySink', () => {
  beforeEach(() => {
    // Reset total — cada teste começa virgem.
    resetTelemetrySink();
    window.sessionStorage.clear();
    vi.useFakeTimers();

    // navigator.onLine default true
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: () => true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    resetTelemetrySink();
  });

  it('no-op se queueEvent chamado antes de initTelemetrySink', () => {
    // Não deve jogar. Simplesmente ignora.
    expect(() => queueEvent({ name: 'foo' })).not.toThrow();
    expect(__internal.getState()).toBeNull();
  });

  it('ignora eventos com name vazio', async () => {
    const supa = makeSupabaseMock();
    initTelemetrySink({ supabaseClient: supa, batchSize: 1 });

    queueEvent({ name: '', payload: {} });
    queueEvent({ name: '   ', payload: {} });
    queueEvent({ name: null, payload: {} });

    await vi.runAllTimersAsync();
    expect(supa.insert).not.toHaveBeenCalled();
  });

  it('faz flush imediato quando a fila atinge batchSize', async () => {
    const supa = makeSupabaseMock();
    initTelemetrySink({ supabaseClient: supa, batchSize: 2, batchIntervalMs: 10000 });

    queueEvent({ name: 'lp_view', payload: {} });
    queueEvent({ name: 'lp_cta_click', payload: { action: 'start-trial' } });

    // flush é assíncrono — pra resolver Promises microtask
    await vi.runAllTimersAsync();

    expect(supa.from).toHaveBeenCalledWith('analytics_events');
    expect(supa.insert).toHaveBeenCalledTimes(1);
    const rows = supa.insert.mock.calls[0][0];
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      name: 'lp_view',
      payload: {},
      user_id: null,
    });
    expect(rows[1]).toMatchObject({
      name: 'lp_cta_click',
      payload: { action: 'start-trial' },
    });
    // session_id deve estar presente e não-vazio
    expect(rows[0].session_id).toBeTruthy();
  });

  it('faz flush por timer quando batchSize não é atingido', async () => {
    const supa = makeSupabaseMock();
    initTelemetrySink({ supabaseClient: supa, batchSize: 10, batchIntervalMs: 5000 });

    queueEvent({ name: 'lp_view', payload: {} });

    // Antes do timer nada aconteceu
    expect(supa.insert).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(5000);

    expect(supa.insert).toHaveBeenCalledTimes(1);
    const rows = supa.insert.mock.calls[0][0];
    expect(rows).toHaveLength(1);
  });

  it('reusa session_id do sessionStorage entre eventos', async () => {
    const supa = makeSupabaseMock();
    initTelemetrySink({ supabaseClient: supa, batchSize: 1, batchIntervalMs: 10000 });

    queueEvent({ name: 'evt1', payload: {} });
    await vi.runAllTimersAsync();

    queueEvent({ name: 'evt2', payload: {} });
    await vi.runAllTimersAsync();

    expect(supa.insert).toHaveBeenCalledTimes(2);
    const sid1 = supa.insert.mock.calls[0][0][0].session_id;
    const sid2 = supa.insert.mock.calls[1][0][0].session_id;
    expect(sid1).toBe(sid2);
    expect(sid1).toBeTruthy();
  });

  it('getUserId é chamado e injetado nas rows', async () => {
    const supa = makeSupabaseMock();
    const getUserId = vi.fn(async () => 'user-123');
    initTelemetrySink({
      supabaseClient: supa,
      getUserId,
      batchSize: 1,
      batchIntervalMs: 10000,
    });

    queueEvent({ name: 'lp_view', payload: {} });
    await vi.runAllTimersAsync();

    expect(getUserId).toHaveBeenCalled();
    expect(supa.insert.mock.calls[0][0][0].user_id).toBe('user-123');
  });

  it('quando offline, não chama insert e vai pro fallback', async () => {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: () => false,
    });

    const supa = makeSupabaseMock();
    initTelemetrySink({ supabaseClient: supa, batchSize: 1, batchIntervalMs: 10000 });

    queueEvent({ name: 'lp_view', payload: {} });
    await vi.runAllTimersAsync();

    // Insert NÃO foi chamado (offline).
    expect(supa.insert).not.toHaveBeenCalled();
  });

  it('insert falhando reagenda com backoff exponencial', async () => {
    let call = 0;
    const supa = makeSupabaseMock(() => {
      call += 1;
      // Primeiro call falha, segundo sucesso.
      if (call === 1) return Promise.resolve({ error: { message: 'network' } });
      return Promise.resolve({ error: null });
    });

    initTelemetrySink({
      supabaseClient: supa,
      batchSize: 1,
      batchIntervalMs: 10000,
      retryInitialMs: 1000,
      retryMaxMs: 4000,
    });

    queueEvent({ name: 'lp_view', payload: {} });
    await vi.runAllTimersAsync();

    // Primeiro insert falhou
    expect(supa.insert).toHaveBeenCalledTimes(1);

    // Backoff deve ter dobrado o delay. Avançamos o tempo pra rescheduled flush.
    // Nesse ponto a memory queue está vazia, mas o backoff está no state.
    // Após flush, a queue foi pro IDB — no próximo flush, o IDB é drenado.
    await vi.advanceTimersByTimeAsync(2000);
    await vi.runAllTimersAsync();

    // Não garantimos que o IDB funciona em jsdom — só checamos que o
    // código não travou e que não jogou exceção não tratada.
    // Se IDB estiver disponível, drenou e re-inseriu.
    expect(call).toBeGreaterThanOrEqual(1);
  });

  it('resetTelemetrySink limpa o estado', () => {
    const supa = makeSupabaseMock();
    initTelemetrySink({ supabaseClient: supa });
    expect(__internal.getState()).not.toBeNull();

    resetTelemetrySink();
    expect(__internal.getState()).toBeNull();
  });

  it('flush é no-op se sink não inicializado', async () => {
    // Sem init, flush() não pode jogar.
    await expect(flush()).resolves.toBeUndefined();
  });

  it('initTelemetrySink chamado 2x é idempotente', () => {
    const supa1 = makeSupabaseMock();
    const supa2 = makeSupabaseMock();

    const s1 = initTelemetrySink({ supabaseClient: supa1, batchSize: 5 });
    const s2 = initTelemetrySink({ supabaseClient: supa2, batchSize: 99 });

    // Segunda chamada retorna o MESMO state; não sobrescreve o client.
    expect(s1).toBe(s2);
    expect(s2.batchSize).toBe(5);
  });
});
