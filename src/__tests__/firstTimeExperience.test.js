async function loadFtx() {
  vi.resetModules();

  const trackEvent = vi.fn();
  const setStateMock = vi.fn();
  const getStateMock = vi.fn(() => ({ equipamentos: [], tecnicos: [], registros: [] }));
  const goToMock = vi.fn();
  const Profile = {
    get: vi.fn(() => ({ nome: 'João Técnico' })),
    save: vi.fn(),
    saveLastTecnico: vi.fn(),
  };

  vi.doMock('../core/telemetry.js', () => ({ trackEvent }));
  vi.doMock('../core/state.js', () => ({ setState: setStateMock, getState: getStateMock }));
  vi.doMock('../core/router.js', () => ({ goTo: goToMock }));
  vi.doMock('../features/profile.js', () => ({ Profile }));
  vi.doMock('../core/equipmentRules.js', () => ({
    getOperationalStatus: vi.fn(() => ({ uiStatus: 'ok', label: 'Operação normal' })),
  }));
  vi.doMock('../core/utils.js', () => ({
    Utils: {
      escapeAttr: (v) => String(v ?? ''),
      escapeHtml: (v) => String(v ?? ''),
      uid: vi.fn(() => 'uid-1'),
      nowDatetime: vi.fn(() => '2026-04-22T09:00'),
      localDateString: vi.fn((date) => date.toISOString().slice(0, 10)),
    },
  }));
  vi.doMock('../ui/components/onboarding/firstTimeExperience.css', () => ({}));

  const { FirstTimeExperience } =
    await import('../ui/components/onboarding/firstTimeExperience.js');
  return { FirstTimeExperience, trackEvent, setStateMock, goToMock };
}

describe('FirstTimeExperience > fluxo ativo', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
  });

  it('skip no passo 0 grava skipped sem marcar done', async () => {
    const { FirstTimeExperience, trackEvent } = await loadFtx();

    FirstTimeExperience.show([]);
    document.getElementById('ftx-skip-0').click();

    expect(localStorage.getItem('cooltrack-ftx-skipped')).toBe('1');
    expect(localStorage.getItem('cooltrack-ftx-done')).toBeNull();
    expect(trackEvent).toHaveBeenCalledWith('onboarding_skipped', { step: 0 });
  });

  it('cria equipamento real ao confirmar primeira pergunta', async () => {
    const { FirstTimeExperience, setStateMock, trackEvent } = await loadFtx();

    FirstTimeExperience.show([]);
    const equipInput = document.getElementById('ftx-eq-name');
    equipInput.value = 'Split recepção';
    document.getElementById('ftx-create-equip').click();

    expect(setStateMock).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith(
      'first_equipment_added',
      expect.objectContaining({ source: 'onboarding' }),
    );
    expect(document.getElementById('ftx-save-maint')).toBeTruthy();
  });

  it('skip no passo 1 mantém onboarding incompleto', async () => {
    const { FirstTimeExperience } = await loadFtx();

    FirstTimeExperience.show([]);
    document.getElementById('ftx-eq-name').value = 'Split recepção';
    document.getElementById('ftx-create-equip').click();
    document.getElementById('ftx-skip-1').click();

    expect(localStorage.getItem('cooltrack-ftx-skipped')).toBe('1');
    expect(localStorage.getItem('cooltrack-ftx-done')).toBeNull();
  });

  it('fluxo completo marca done e navega para equipamentos', async () => {
    const { FirstTimeExperience, trackEvent, setStateMock, goToMock } = await loadFtx();

    FirstTimeExperience.show([]);
    document.getElementById('ftx-eq-name').value = 'Câmara fria estoque';
    document.getElementById('ftx-create-equip').click();

    document.getElementById('ftx-maint-date').value = '2026-04-20';
    document.getElementById('ftx-maint-type').value = 'Manutenção Preventiva';
    document.getElementById('ftx-save-maint').click();

    expect(localStorage.getItem('cooltrack-ftx-done')).toBe('1');
    expect(localStorage.getItem('cooltrack-ftx-skipped')).toBeNull();
    expect(setStateMock).toHaveBeenCalledTimes(2);
    expect(trackEvent).toHaveBeenCalledWith(
      'onboarding_activation_completed',
      expect.objectContaining({ source: 'first-time-experience' }),
    );
    expect(goToMock).toHaveBeenCalledWith('equipamentos');
  });

  it('reopen limpa skip e reabre overlay', async () => {
    const { FirstTimeExperience } = await loadFtx();
    localStorage.setItem('cooltrack-ftx-skipped', '1');

    FirstTimeExperience.reopen([]);

    expect(localStorage.getItem('cooltrack-ftx-skipped')).toBeNull();
    expect(document.getElementById('ftx-overlay')).toBeTruthy();
  });
});
