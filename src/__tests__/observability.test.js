/**
 * Tests pra camada de observability.
 *
 * Cobre:
 *   - Sem DSN: initObservability() retorna false, captureError / addBreadcrumb
 *     viram no-op.
 *   - Com DSN: initObservability() chama Sentry.init, captureError manda
 *     exception, addBreadcrumb registra breadcrumb.
 *   - Nunca joga exceção mesmo com Sentry quebrado.
 *
 * Estratégia: vi.doMock no @sentry/browser (dep opcional, pode nem existir
 * no repo local). Assim conseguimos testar o wrapper sem depender da SDK
 * real instalada.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const sentryMockFactory = () => {
  const init = vi.fn();
  const captureException = vi.fn();
  const captureMessage = vi.fn();
  const addBreadcrumb = vi.fn();
  const setUser = vi.fn();
  // Integrations que o módulo destrutura no init pós-refactor (defaultIntegrations: false).
  // Cada uma é uma factory que retorna um objeto integration descritor — o SDK real
  // chama-as e empilha no array. Mockamos como factories vazias só pra existirem.
  const makeIntegration = (name) => vi.fn(() => ({ name }));
  return {
    init,
    captureException,
    captureMessage,
    addBreadcrumb,
    setUser,
    dedupeIntegration: makeIntegration('Dedupe'),
    functionToStringIntegration: makeIntegration('FunctionToString'),
    inboundFiltersIntegration: makeIntegration('InboundFilters'),
    breadcrumbsIntegration: makeIntegration('Breadcrumbs'),
    globalHandlersIntegration: makeIntegration('GlobalHandlers'),
    linkedErrorsIntegration: makeIntegration('LinkedErrors'),
    httpContextIntegration: makeIntegration('HttpContext'),
  };
};

async function loadObservability({ dsn = '', sentryMock = null } = {}) {
  vi.resetModules();

  if (sentryMock) {
    vi.doMock('@sentry/browser', () => sentryMock);
  } else {
    // Simula pacote ausente — import dinâmico vai rejeitar.
    vi.doMock('@sentry/browser', () => {
      throw new Error('Cannot find module @sentry/browser');
    });
  }

  // Stub import.meta.env via vi.stubGlobal não funciona direto pro
  // import.meta — usamos process.env fallback implementado no módulo.
  if (dsn) {
    process.env.VITE_SENTRY_DSN = dsn;
  } else {
    delete process.env.VITE_SENTRY_DSN;
  }

  const mod = await import('../core/observability.js');
  return mod;
}

describe('observability (sem DSN)', () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.VITE_SENTRY_DSN;
  });

  it('initObservability() retorna false quando DSN está vazio', async () => {
    const { initObservability } = await loadObservability({ dsn: '' });
    const result = await initObservability();
    expect(result).toBe(false);
  });

  it('captureError() é no-op sem DSN (não joga)', async () => {
    const { initObservability, captureError } = await loadObservability({ dsn: '' });
    await initObservability();
    expect(() => captureError(new Error('boom'))).not.toThrow();
  });

  it('addBreadcrumb() é no-op sem DSN', async () => {
    const { initObservability, addBreadcrumb } = await loadObservability({ dsn: '' });
    await initObservability();
    expect(() => addBreadcrumb({ category: 'test', message: 'x' })).not.toThrow();
  });

  it('setUser() é no-op sem DSN', async () => {
    const { initObservability, setUser } = await loadObservability({ dsn: '' });
    await initObservability();
    expect(() => setUser({ id: 'abc' })).not.toThrow();
  });
});

describe('observability (com DSN mas Sentry SDK ausente)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('initObservability() retorna false e não joga quando import falha', async () => {
    // sentryMock = null → simula pacote não instalado.
    const { initObservability } = await loadObservability({
      dsn: 'https://fake@sentry.io/123',
      sentryMock: null,
    });
    const result = await initObservability();
    expect(result).toBe(false);
  });

  it('captureError() segue sendo no-op quando SDK ausente', async () => {
    const { initObservability, captureError } = await loadObservability({
      dsn: 'https://fake@sentry.io/123',
      sentryMock: null,
    });
    await initObservability();
    expect(() => captureError(new Error('boom'))).not.toThrow();
  });
});

describe('observability (com DSN e Sentry SDK presente)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('initObservability() chama Sentry.init com DSN + config segura', async () => {
    const sentryMock = sentryMockFactory();
    const { initObservability } = await loadObservability({
      dsn: 'https://fake@sentry.io/123',
      sentryMock,
    });

    const result = await initObservability();
    expect(result).toBe(true);
    expect(sentryMock.init).toHaveBeenCalledTimes(1);

    const initConfig = sentryMock.init.mock.calls[0][0];
    expect(initConfig.dsn).toBe('https://fake@sentry.io/123');
    expect(initConfig.sendDefaultPii).toBe(false);
    expect(initConfig.tracesSampleRate).toBe(0);
    expect(typeof initConfig.beforeSend).toBe('function');
  });

  it('beforeSend() remove cookies, email e IP', async () => {
    const sentryMock = sentryMockFactory();
    const { initObservability } = await loadObservability({
      dsn: 'https://fake@sentry.io/123',
      sentryMock,
    });
    await initObservability();

    const { beforeSend } = sentryMock.init.mock.calls[0][0];
    const scrubbed = beforeSend({
      request: { cookies: { token: 'secret' } },
      user: { id: 'abc', email: 'a@b.com', ip_address: '1.2.3.4' },
    });

    expect(scrubbed.request.cookies).toBeUndefined();
    expect(scrubbed.user.email).toBeUndefined();
    expect(scrubbed.user.ip_address).toBeUndefined();
    expect(scrubbed.user.id).toBe('abc');
  });

  it('captureError() invoca Sentry.captureException com tags + context', async () => {
    const sentryMock = sentryMockFactory();
    const { initObservability, captureError } = await loadObservability({
      dsn: 'https://fake@sentry.io/123',
      sentryMock,
    });
    await initObservability();

    const err = new Error('boom');
    captureError(err, { code: 'SYNC_FAILED', severity: 'warning', context: { userId: 'u1' } });

    expect(sentryMock.captureException).toHaveBeenCalledTimes(1);
    const [captured, opts] = sentryMock.captureException.mock.calls[0];
    expect(captured).toBe(err);
    expect(opts.level).toBe('warning');
    expect(opts.tags.code).toBe('SYNC_FAILED');
    expect(opts.contexts.app.userId).toBe('u1');
  });

  it('addBreadcrumb() repassa categoria + message + data', async () => {
    const sentryMock = sentryMockFactory();
    const { initObservability, addBreadcrumb } = await loadObservability({
      dsn: 'https://fake@sentry.io/123',
      sentryMock,
    });
    await initObservability();

    addBreadcrumb({ category: 'telemetry', message: 'lp_view', data: { plan: 'free' } });

    expect(sentryMock.addBreadcrumb).toHaveBeenCalledTimes(1);
    const bc = sentryMock.addBreadcrumb.mock.calls[0][0];
    expect(bc.category).toBe('telemetry');
    expect(bc.message).toBe('lp_view');
    expect(bc.data.plan).toBe('free');
    expect(typeof bc.timestamp).toBe('number');
  });

  it('setUser() envia só o id, nunca email/nome', async () => {
    const sentryMock = sentryMockFactory();
    const { initObservability, setUser } = await loadObservability({
      dsn: 'https://fake@sentry.io/123',
      sentryMock,
    });
    await initObservability();

    setUser({ id: 'uuid-1', email: 'leak@example.com', name: 'Leak' });

    expect(sentryMock.setUser).toHaveBeenCalledWith({ id: 'uuid-1' });
    expect(sentryMock.setUser.mock.calls[0][0]).not.toHaveProperty('email');
    expect(sentryMock.setUser.mock.calls[0][0]).not.toHaveProperty('name');
  });

  it('setUser(null) chama Sentry.setUser(null) pra limpar', async () => {
    const sentryMock = sentryMockFactory();
    const { initObservability, setUser } = await loadObservability({
      dsn: 'https://fake@sentry.io/123',
      sentryMock,
    });
    await initObservability();

    setUser(null);
    expect(sentryMock.setUser).toHaveBeenCalledWith(null);
  });

  it('initObservability() é idempotente', async () => {
    const sentryMock = sentryMockFactory();
    const { initObservability } = await loadObservability({
      dsn: 'https://fake@sentry.io/123',
      sentryMock,
    });

    await initObservability();
    await initObservability();
    await initObservability();

    expect(sentryMock.init).toHaveBeenCalledTimes(1);
  });
});
