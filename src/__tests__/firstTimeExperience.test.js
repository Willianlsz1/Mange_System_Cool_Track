// Suite do fluxo de onboarding forçado (FTX). Cobertura mínima:
//  - skip em cada passo grava `cooltrack-ftx-skipped` (sem marcar done)
//  - telemetria `onboarding_skipped` sai com step correto
//  - show() respeita ambas flags e não reabre automaticamente
//  - reopen() limpa skip e reabre o overlay

async function loadFtx() {
  vi.resetModules();

  const trackEvent = vi.fn();
  const setStateMock = vi.fn();
  const getStateMock = vi.fn(() => ({ equipamentos: [], tecnicos: [] }));
  const goToMock = vi.fn();
  const Profile = {
    get: vi.fn(() => ({ nome: '' })),
    save: vi.fn(),
    saveLastTecnico: vi.fn(),
  };

  vi.doMock('../core/telemetry.js', () => ({ trackEvent }));
  vi.doMock('../core/state.js', () => ({ setState: setStateMock, getState: getStateMock }));
  vi.doMock('../core/router.js', () => ({ goTo: goToMock }));
  vi.doMock('../features/profile.js', () => ({ Profile }));
  vi.doMock('../core/utils.js', () => ({
    Utils: {
      escapeAttr: (v) => String(v ?? ''),
      escapeHtml: (v) => String(v ?? ''),
      uid: () => 'eq-test-uid',
    },
    TIPO_ICON: { 'Split Hi-Wall': '❄️' },
  }));
  // CSS import — resolve para nada em jsdom
  vi.doMock('../ui/components/onboarding/firstTimeExperience.css', () => ({}));

  const { FirstTimeExperience } =
    await import('../ui/components/onboarding/firstTimeExperience.js');
  return { FirstTimeExperience, trackEvent, Profile };
}

describe('FirstTimeExperience > skip flow', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
  });

  it('skip no passo 0 grava flag skipped, não marca done e emite telemetria', async () => {
    const { FirstTimeExperience, trackEvent } = await loadFtx();

    FirstTimeExperience.show([]);
    expect(document.getElementById('ftx-overlay')).toBeTruthy();

    document.getElementById('ftx-skip-0').click();

    expect(localStorage.getItem('cooltrack-ftx-skipped')).toBe('1');
    expect(localStorage.getItem('cooltrack-ftx-done')).toBeNull();
    expect(trackEvent).toHaveBeenCalledWith('onboarding_skipped', { step: 0 });
  });

  it('skip no passo 1 persiste skip e emite step=1', async () => {
    const { FirstTimeExperience, trackEvent } = await loadFtx();

    FirstTimeExperience.show([]);
    // Avança pro passo 1 preenchendo o nome
    const nomeInput = document.getElementById('ftx-nome');
    nomeInput.value = 'Willian Teste';
    document.getElementById('ftx-next-0').click();

    expect(document.getElementById('ftx-skip-1')).toBeTruthy();
    document.getElementById('ftx-skip-1').click();

    expect(localStorage.getItem('cooltrack-ftx-skipped')).toBe('1');
    expect(localStorage.getItem('cooltrack-ftx-done')).toBeNull();
    expect(trackEvent).toHaveBeenCalledWith('onboarding_skipped', { step: 1 });
  });

  it('skip no passo 2 (preview PDF) persiste skip e emite step=2', async () => {
    const { FirstTimeExperience, trackEvent } = await loadFtx();

    FirstTimeExperience.show([]);
    // Passo 0 → 1
    document.getElementById('ftx-nome').value = 'Willian Teste';
    document.getElementById('ftx-next-0').click();
    // Passo 1 → 2 (preenche equipamento)
    document.getElementById('ftx-eq-nome').value = 'Split teste';
    document.getElementById('ftx-eq-local').value = 'Sala teste';
    document.getElementById('ftx-next-1').click();

    expect(document.getElementById('ftx-skip-2')).toBeTruthy();
    document.getElementById('ftx-skip-2').click();

    expect(localStorage.getItem('cooltrack-ftx-skipped')).toBe('1');
    expect(localStorage.getItem('cooltrack-ftx-done')).toBeNull();
    expect(trackEvent).toHaveBeenCalledWith('onboarding_skipped', { step: 2 });
  });

  it('show() não reabre automaticamente quando flag skipped está setada', async () => {
    const { FirstTimeExperience, trackEvent } = await loadFtx();
    localStorage.setItem('cooltrack-ftx-skipped', '1');

    FirstTimeExperience.show([]);

    expect(document.getElementById('ftx-overlay')).toBeFalsy();
    // Nenhum started emitido
    expect(trackEvent).not.toHaveBeenCalledWith('onboarding_started', expect.anything());
  });

  it('show() não reabre quando já existe equipamento cadastrado', async () => {
    const { FirstTimeExperience } = await loadFtx();

    FirstTimeExperience.show([{ id: 'eq-1' }]);

    expect(document.getElementById('ftx-overlay')).toBeFalsy();
  });

  it('reopen() limpa skip e reabre overlay', async () => {
    const { FirstTimeExperience, trackEvent } = await loadFtx();
    localStorage.setItem('cooltrack-ftx-skipped', '1');

    FirstTimeExperience.reopen([]);

    expect(localStorage.getItem('cooltrack-ftx-skipped')).toBeNull();
    expect(document.getElementById('ftx-overlay')).toBeTruthy();
    expect(trackEvent).toHaveBeenCalledWith('onboarding_started', {});
  });

  it('fluxo completo (sem skip) marca done e limpa skip flag se houver', async () => {
    const { FirstTimeExperience, trackEvent } = await loadFtx();
    // Simula que o usuário tinha skipado antes e agora voltou e completou
    localStorage.setItem('cooltrack-ftx-skipped', '1');

    FirstTimeExperience.reopen([]);
    // Passo 0 → 1
    document.getElementById('ftx-nome').value = 'Willian';
    document.getElementById('ftx-next-0').click();
    // Passo 1 → 2
    document.getElementById('ftx-eq-nome').value = 'Split teste';
    document.getElementById('ftx-eq-local').value = 'Sala teste';
    document.getElementById('ftx-next-1').click();
    // Passo 2 → 3
    document.getElementById('ftx-next-2').click();
    // Passo 3 → dismiss via dashboard
    document.getElementById('ftx-go-dashboard').click();

    expect(localStorage.getItem('cooltrack-ftx-done')).toBe('1');
    expect(localStorage.getItem('cooltrack-ftx-skipped')).toBeNull();
    expect(trackEvent).toHaveBeenCalledWith('onboarding_completed', {});
  });
});
