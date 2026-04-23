const closeSignatureCaptureIfOpen = vi.fn(() => true);
const closeSignatureViewerIfOpen = vi.fn(() => true);

vi.mock('../ui/components/signature/signature-modal.js', () => ({
  SignatureModal: {
    closeIfOpen: closeSignatureCaptureIfOpen,
  },
}));

vi.mock('../ui/components/signature/signature-viewer-modal.js', () => ({
  SignatureViewerModal: {
    closeIfOpen: closeSignatureViewerIfOpen,
  },
}));

function mountRouterDom() {
  document.body.innerHTML = `
    <main id="main-content" tabindex="-1"></main>
    <button id="nav-inicio" class="nav-btn"></button>
    <button id="nav-registros" class="nav-btn"></button>
    <section id="view-inicio"></section>
    <section id="view-registros"></section>
  `;
  Object.defineProperty(window, 'scrollTo', {
    value: vi.fn(),
    writable: true,
  });
}

async function loadRouterModule() {
  vi.resetModules();
  return import('../core/router.js');
}

describe('router', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    closeSignatureCaptureIfOpen.mockClear();
    closeSignatureViewerIfOpen.mockClear();
    mountRouterDom();
  });

  it('activates route and nav button and pushes browser history', async () => {
    const { registerRoute, goTo, currentRoute } = await loadRouterModule();
    const enterInicio = vi.fn();
    const pushSpy = vi.spyOn(window.history, 'pushState');
    const routeChangedSpy = vi.fn();
    document.addEventListener('app:route-changed', routeChangedSpy);

    registerRoute('inicio', enterInicio);
    goTo('inicio', { source: 'spec' });

    expect(enterInicio).toHaveBeenCalledWith({ source: 'spec' });
    expect(document.getElementById('view-inicio').classList.contains('active')).toBe(true);
    expect(document.getElementById('nav-inicio').classList.contains('is-active')).toBe(true);
    expect(currentRoute()).toBe('inicio');
    expect(pushSpy).toHaveBeenCalledTimes(1);
    expect(routeChangedSpy).toHaveBeenCalledTimes(1);
    expect(routeChangedSpy.mock.calls[0][0].detail).toEqual({
      route: 'inicio',
      previousRoute: null,
    });
  });

  it('runs transition hooks and switches active view after timeout', async () => {
    vi.useFakeTimers();
    const { registerRoute, goTo } = await loadRouterModule();
    const enterInicio = vi.fn();
    const leaveInicio = vi.fn();
    const enterRegistros = vi.fn();

    registerRoute('inicio', enterInicio, leaveInicio);
    registerRoute('registros', enterRegistros);

    goTo('inicio');
    goTo('registros', { via: 'menu' });

    expect(document.getElementById('view-inicio').classList.contains('is-exiting')).toBe(true);
    vi.advanceTimersByTime(150);

    expect(leaveInicio).toHaveBeenCalledTimes(1);
    expect(enterRegistros).toHaveBeenCalledWith({ via: 'menu' });
    expect(document.getElementById('view-inicio').classList.contains('active')).toBe(false);
    expect(document.getElementById('view-registros').classList.contains('active')).toBe(true);
  });

  it('supports replaceHistory and skips history writes when coming from popstate', async () => {
    const { registerRoute, goTo } = await loadRouterModule();
    const pushSpy = vi.spyOn(window.history, 'pushState');
    const replaceSpy = vi.spyOn(window.history, 'replaceState');

    registerRoute('inicio', vi.fn());
    registerRoute('registros', vi.fn());

    goTo('inicio', {}, { replaceHistory: true });
    goTo('registros', {}, { fromHistory: true });

    expect(replaceSpy).toHaveBeenCalledTimes(1);
    expect(pushSpy).toHaveBeenCalledTimes(0);
  });

  it('persiste params no history state em goTo', async () => {
    const { registerRoute, goTo } = await loadRouterModule();
    const pushSpy = vi.spyOn(window.history, 'pushState');

    registerRoute('registros', vi.fn());
    goTo('registros', { equipId: 'eq-1', source: 'kpi' });

    expect(pushSpy).toHaveBeenCalledTimes(1);
    const [state] = pushSpy.mock.calls[0];
    expect(state).toMatchObject({
      route: 'registros',
      params: { equipId: 'eq-1', source: 'kpi' },
    });
    expect(state.uiCtxVersion).toBeTypeOf('number');
  });

  it('permite reentrar na mesma rota quando há params e usa replaceState', async () => {
    const { registerRoute, goTo } = await loadRouterModule();
    const enterInicio = vi.fn();
    const pushSpy = vi.spyOn(window.history, 'pushState');
    const replaceSpy = vi.spyOn(window.history, 'replaceState');

    registerRoute('inicio', enterInicio);

    goTo('inicio');
    goTo('inicio', { equipId: 'eq-2' });

    expect(enterInicio).toHaveBeenCalledTimes(2);
    expect(enterInicio).toHaveBeenNthCalledWith(2, { equipId: 'eq-2' });
    expect(pushSpy).toHaveBeenCalledTimes(1);
    expect(replaceSpy).toHaveBeenCalledTimes(1);
  });

  it('warns when route is unknown and keeps current route untouched', async () => {
    const { registerRoute, goTo, currentRoute } = await loadRouterModule();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    registerRoute('inicio', vi.fn());
    goTo('inicio');
    goTo('missing-route');

    expect(currentRoute()).toBe('inicio');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Rota desconhecida'));
  });

  it('catches sync errors in onEnter and renders fallback UI', async () => {
    const { registerRoute, goTo, currentRoute } = await loadRouterModule();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    registerRoute('inicio', () => {
      throw new Error('boom');
    });
    goTo('inicio');

    // Router permanece navegável — rota atual foi atualizada mesmo com erro
    expect(currentRoute()).toBe('inicio');
    // Fallback é renderizado dentro do container da view
    const view = document.getElementById('view-inicio');
    expect(view.querySelector('.view-error-boundary')).toBeTruthy();
    expect(view.querySelector('.view-error-boundary__retry')).toBeTruthy();
    // Erro foi logado via handleError
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('catches rejected promises from onEnter and renders fallback UI', async () => {
    const { registerRoute, goTo } = await loadRouterModule();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    registerRoute('inicio', () => Promise.reject(new Error('async boom')));
    goTo('inicio');

    // Aguarda microtask pra rejection chegar ao .catch do router
    await Promise.resolve();
    await Promise.resolve();

    const view = document.getElementById('view-inicio');
    expect(view.querySelector('.view-error-boundary')).toBeTruthy();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('handles popstate navigation and backbutton integration', async () => {
    vi.useFakeTimers();
    const { registerRoute, goTo, initHistory } = await loadRouterModule();
    const onEnterRegistros = vi.fn();
    const pushSpy = vi.spyOn(window.history, 'pushState');
    const backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => {});

    registerRoute('inicio', vi.fn());
    registerRoute('registros', onEnterRegistros);

    goTo('inicio');
    initHistory();

    window.dispatchEvent(
      new PopStateEvent('popstate', {
        state: { route: 'registros', params: { statusFilter: 'preventiva-7d' }, uiCtxVersion: 1 },
      }),
    );
    vi.advanceTimersByTime(150);
    expect(onEnterRegistros).toHaveBeenCalledTimes(1);
    expect(onEnterRegistros).toHaveBeenCalledWith({ statusFilter: 'preventiva-7d' });
    expect(pushSpy).toHaveBeenCalledTimes(1);

    const backEvent = new Event('backbutton');
    backEvent.preventDefault = vi.fn();
    document.dispatchEvent(backEvent);
    expect(backEvent.preventDefault).toHaveBeenCalledTimes(1);
    expect(backSpy).toHaveBeenCalledTimes(1);
  });

  it('backbutton fecha modal aberto antes de navegar no histórico', async () => {
    const { registerRoute, goTo, initHistory } = await loadRouterModule();
    const backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => {});

    document.body.insertAdjacentHTML(
      'beforeend',
      `<div id="modal-add-eq" class="modal-overlay is-open"></div>`,
    );

    registerRoute('inicio', vi.fn());
    goTo('inicio');
    initHistory();

    const backEvent = new Event('backbutton');
    backEvent.preventDefault = vi.fn();
    document.dispatchEvent(backEvent);

    expect(backEvent.preventDefault).toHaveBeenCalledTimes(1);
    expect(document.getElementById('modal-add-eq').classList.contains('is-open')).toBe(false);
    expect(backSpy).not.toHaveBeenCalled();
  });

  it('consome popstate para fechar camada aberta sem trocar rota', async () => {
    const { registerRoute, goTo, initHistory } = await loadRouterModule();
    const onEnterInicio = vi.fn();
    const onEnterRegistros = vi.fn();
    const pushSpy = vi.spyOn(window.history, 'pushState');

    document.body.insertAdjacentHTML(
      'beforeend',
      `<div id="lightbox" class="lightbox is-open"></div>`,
    );

    registerRoute('inicio', onEnterInicio);
    registerRoute('registros', onEnterRegistros);

    goTo('inicio');
    initHistory();

    window.dispatchEvent(new PopStateEvent('popstate', { state: { route: 'registros' } }));

    expect(document.getElementById('lightbox').classList.contains('is-open')).toBe(false);
    expect(onEnterRegistros).not.toHaveBeenCalled();
    expect(pushSpy).toHaveBeenCalledTimes(2); // entrada inicial + reinserção da rota atual
  });

  it('mantém compatibilidade com history state legado sem params', async () => {
    vi.useFakeTimers();
    const { registerRoute, goTo, initHistory } = await loadRouterModule();
    const onEnterRegistros = vi.fn();

    registerRoute('inicio', vi.fn());
    registerRoute('registros', onEnterRegistros);

    goTo('inicio');
    initHistory();

    window.dispatchEvent(new PopStateEvent('popstate', { state: { route: 'registros' } }));
    vi.advanceTimersByTime(150);

    expect(onEnterRegistros).toHaveBeenCalledWith({});
  });

  it('consome popstate para fechar assinatura (capture) sem trocar rota', async () => {
    const { registerRoute, goTo, initHistory } = await loadRouterModule();
    const onEnterRegistros = vi.fn();
    const pushSpy = vi.spyOn(window.history, 'pushState');

    document.body.insertAdjacentHTML(
      'beforeend',
      `<div id="modal-signature-overlay" class="sig-capture-modal is-open"></div>`,
    );

    registerRoute('inicio', vi.fn());
    registerRoute('registros', onEnterRegistros);

    goTo('inicio');
    initHistory();

    window.dispatchEvent(new PopStateEvent('popstate', { state: { route: 'registros' } }));

    expect(closeSignatureCaptureIfOpen).toHaveBeenCalled();
    expect(onEnterRegistros).not.toHaveBeenCalled();
    expect(pushSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('consome popstate para fechar assinatura (viewer) sem trocar rota', async () => {
    const { registerRoute, goTo, initHistory } = await loadRouterModule();
    const onEnterRegistros = vi.fn();
    const pushSpy = vi.spyOn(window.history, 'pushState');

    document.body.insertAdjacentHTML(
      'beforeend',
      `<div id="modal-signature-viewer-overlay" class="hist-signature-modal is-open"></div>`,
    );

    registerRoute('inicio', vi.fn());
    registerRoute('registros', onEnterRegistros);

    goTo('inicio');
    initHistory();

    window.dispatchEvent(new PopStateEvent('popstate', { state: { route: 'registros' } }));

    expect(closeSignatureViewerIfOpen).toHaveBeenCalled();
    expect(onEnterRegistros).not.toHaveBeenCalled();
    expect(pushSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('fecha apenas a camada do topo quando há múltiplas camadas bloqueantes', async () => {
    const { registerRoute, goTo, initHistory } = await loadRouterModule();
    const onEnterRegistros = vi.fn();

    // Ordem no DOM define topo: modal padrão -> lightbox -> assinatura viewer (topo).
    document.body.insertAdjacentHTML(
      'beforeend',
      `<div id="modal-add-eq" class="modal-overlay is-open"></div>`,
    );
    document.body.insertAdjacentHTML(
      'beforeend',
      `<div id="lightbox" class="lightbox is-open"></div>`,
    );
    document.body.insertAdjacentHTML(
      'beforeend',
      `<div id="modal-signature-viewer-overlay" class="hist-signature-modal is-open"></div>`,
    );

    registerRoute('inicio', vi.fn());
    registerRoute('registros', onEnterRegistros);

    goTo('inicio');
    initHistory();

    window.dispatchEvent(new PopStateEvent('popstate', { state: { route: 'registros' } }));

    expect(closeSignatureViewerIfOpen).toHaveBeenCalled();
    expect(document.getElementById('modal-add-eq').classList.contains('is-open')).toBe(true);
    expect(document.getElementById('lightbox').classList.contains('is-open')).toBe(true);
    expect(onEnterRegistros).not.toHaveBeenCalled();
  });
});
