import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

async function loadModule() {
  vi.resetModules();
  return import('../core/onlineStatus.js');
}

function setOnline(value) {
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    value,
  });
}

describe('onlineStatus', () => {
  beforeEach(() => {
    // Limpa flag de idempotência entre testes
    delete window.__cooltrackOnlineStatusBound;
    document.body.innerHTML = '';
    setOnline(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('não mostra toast ao inicializar com conexão estável', async () => {
    const { initOnlineStatus } = await loadModule();
    initOnlineStatus();
    // Simula evento online sem que offline tenha acontecido antes
    window.dispatchEvent(new Event('online'));
    // Nenhum toast deve aparecer
    expect(document.querySelector('.toast')).toBeFalsy();
  });

  it('mostra toast de warning quando a conexão é perdida', async () => {
    const { initOnlineStatus } = await loadModule();
    initOnlineStatus();
    setOnline(false);
    window.dispatchEvent(new Event('offline'));
    const toast = document.querySelector('.toast--warning');
    expect(toast).toBeTruthy();
    expect(toast.textContent).toContain('offline');
  });

  it('mostra toast de success quando a conexão é restaurada após offline', async () => {
    const { initOnlineStatus } = await loadModule();
    initOnlineStatus();
    // Primeiro vai offline
    setOnline(false);
    window.dispatchEvent(new Event('offline'));
    // Depois volta online
    setOnline(true);
    window.dispatchEvent(new Event('online'));
    const success = document.querySelector('.toast--success');
    expect(success).toBeTruthy();
    expect(success.textContent.toLowerCase()).toContain('conexão restaurada');
  });

  it('é idempotente — não duplica listeners em chamadas repetidas', async () => {
    const { initOnlineStatus } = await loadModule();
    const spy = vi.spyOn(window, 'addEventListener');
    initOnlineStatus();
    const firstCalls = spy.mock.calls.length;
    initOnlineStatus();
    const secondCalls = spy.mock.calls.length;
    expect(secondCalls).toBe(firstCalls);
  });

  it('expõe isOffline() baseado em navigator.onLine', async () => {
    const { isOffline } = await loadModule();
    setOnline(true);
    expect(isOffline()).toBe(false);
    setOnline(false);
    expect(isOffline()).toBe(true);
  });
});
