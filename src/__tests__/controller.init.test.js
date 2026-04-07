describe('initController orchestrator', () => {
  it('composes routes, handlers and helpers once during startup', async () => {
    vi.resetModules();

    const registerAppRoutes = vi.fn();
    const bindNavigationHandlers = vi.fn();
    const bindEquipmentHandlers = vi.fn();
    const bindRegistroHandlers = vi.fn();
    const bindProfileAccountHandlers = vi.fn();
    const bindReportExportHandlers = vi.fn();
    const initControllerHelpers = vi.fn();

    vi.doMock('../ui/controller/routes.js', () => ({ registerAppRoutes }));
    vi.doMock('../ui/controller/handlers/navigationHandlers.js', () => ({
      bindNavigationHandlers,
    }));
    vi.doMock('../ui/controller/handlers/equipmentHandlers.js', () => ({
      bindEquipmentHandlers,
    }));
    vi.doMock('../ui/controller/handlers/registroHandlers.js', () => ({
      bindRegistroHandlers,
    }));
    vi.doMock('../ui/controller/handlers/profileAccountHandlers.js', () => ({
      bindProfileAccountHandlers,
    }));
    vi.doMock('../ui/controller/handlers/reportExportHandlers.js', () => ({
      bindReportExportHandlers,
    }));
    vi.doMock('../ui/controller/helpers/themeInitHelpers.js', () => ({
      initControllerHelpers,
    }));

    const { initController } = await import('../ui/controller.js');
    initController();

    expect(registerAppRoutes).toHaveBeenCalledTimes(1);
    expect(bindNavigationHandlers).toHaveBeenCalledTimes(1);
    expect(bindEquipmentHandlers).toHaveBeenCalledTimes(1);
    expect(bindRegistroHandlers).toHaveBeenCalledTimes(1);
    expect(bindProfileAccountHandlers).toHaveBeenCalledTimes(1);
    expect(bindReportExportHandlers).toHaveBeenCalledTimes(1);
    expect(initControllerHelpers).toHaveBeenCalledTimes(1);
  });
});
