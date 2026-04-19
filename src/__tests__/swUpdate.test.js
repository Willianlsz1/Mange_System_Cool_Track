import { describe, it, expect, beforeEach, vi } from 'vitest';

async function loadModule() {
  vi.resetModules();
  return import('../core/swUpdate.js');
}

function makeRegistration({ waiting = null, installing = null } = {}) {
  const listeners = new Map();
  return {
    waiting,
    installing,
    update: vi.fn().mockResolvedValue(undefined),
    addEventListener: (event, handler) => {
      listeners.set(event, handler);
    },
    _fireUpdateFound() {
      listeners.get('updatefound')?.();
    },
  };
}

function makeServiceWorker(initialState = 'installing') {
  const listeners = new Map();
  const worker = {
    state: initialState,
    postMessage: vi.fn(),
    addEventListener: (event, handler) => {
      listeners.set(event, handler);
    },
    _setState(next) {
      this.state = next;
      listeners.get('statechange')?.();
    },
  };
  return worker;
}

describe('swUpdate', () => {
  beforeEach(() => {
    delete window.__cooltrackSwUpdateBound;
    document.body.innerHTML = '';
    // Mock navigator.serviceWorker
    const swListeners = new Map();
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        controller: {}, // tab is controlled by existing SW
        addEventListener: (ev, handler) => swListeners.set(ev, handler),
        _fireControllerChange() {
          swListeners.get('controllerchange')?.();
        },
      },
    });
  });

  it('não mostra banner se não há waiting nem installing', async () => {
    const { initSwUpdate } = await loadModule();
    const reg = makeRegistration();
    initSwUpdate(reg);
    expect(document.getElementById('sw-update-banner')).toBeFalsy();
  });

  it('mostra banner imediatamente quando há worker em waiting', async () => {
    const { initSwUpdate } = await loadModule();
    const waiting = makeServiceWorker('installed');
    const reg = makeRegistration({ waiting });
    initSwUpdate(reg);
    const banner = document.getElementById('sw-update-banner');
    expect(banner).toBeTruthy();
    expect(banner.querySelector('[data-action="accept"]')).toBeTruthy();
  });

  it('posta SKIP_WAITING quando o usuário clica em Recarregar', async () => {
    const { initSwUpdate } = await loadModule();
    const waiting = makeServiceWorker('installed');
    const reg = makeRegistration({ waiting });
    initSwUpdate(reg);
    const banner = document.getElementById('sw-update-banner');
    banner.querySelector('[data-action="accept"]').click();
    expect(waiting.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
  });

  it('remove o banner quando o usuário dispensa', async () => {
    const { initSwUpdate } = await loadModule();
    const waiting = makeServiceWorker('installed');
    const reg = makeRegistration({ waiting });
    initSwUpdate(reg);
    const banner = document.getElementById('sw-update-banner');
    expect(banner.classList.contains('is-visible')).toBe(false); // rAF ainda não rodou
    banner.querySelector('.sw-update-banner__dismiss').click();
    // após click dismiss, classe is-visible deve sair
    expect(banner.classList.contains('is-visible')).toBe(false);
  });

  it('é idempotente — segundo init ignora', async () => {
    const { initSwUpdate } = await loadModule();
    const waiting = makeServiceWorker('installed');
    const reg1 = makeRegistration({ waiting });
    initSwUpdate(reg1);
    const first = document.getElementById('sw-update-banner');
    expect(first).toBeTruthy();
    // Segunda chamada não deve duplicar banner
    initSwUpdate(makeRegistration({ waiting: makeServiceWorker('installed') }));
    const banners = document.querySelectorAll('.sw-update-banner');
    expect(banners.length).toBe(1);
  });
});
