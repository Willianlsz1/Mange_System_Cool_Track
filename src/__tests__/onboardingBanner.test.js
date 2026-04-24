const { getStateMock, reopenMock } = vi.hoisted(() => ({
  getStateMock: vi.fn(() => ({ equipamentos: [] })),
  reopenMock: vi.fn(),
}));

vi.mock('../core/state.js', () => ({
  getState: () => getStateMock(),
}));

vi.mock('../ui/components/onboarding/firstTimeExperience.js', () => ({
  FirstTimeExperience: {
    reopen: reopenMock,
  },
}));

import { OnboardingBanner } from '../ui/components/onboarding/onboardingBanner.js';

describe('OnboardingBanner', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="lista-equip"></div>';
    localStorage.clear();
    getStateMock.mockReturnValue({ equipamentos: [] });
    reopenMock.mockClear();
  });

  it('renderiza banner quando não há equipamentos, ignorando flag antiga de dismiss', () => {
    localStorage.setItem('cooltrack-banner-dismissed', '1');

    OnboardingBanner.render();

    expect(document.getElementById('onboarding-banner')).toBeTruthy();
  });

  it('remove banner quando existe equipamento cadastrado', () => {
    OnboardingBanner.render();
    expect(document.getElementById('onboarding-banner')).toBeTruthy();

    getStateMock.mockReturnValue({ equipamentos: [{ id: 'eq-1' }] });
    OnboardingBanner.render();

    expect(document.getElementById('onboarding-banner')).toBeFalsy();
  });

  it('renderiza variante "Continuar cadastro" quando FTX foi pulado', () => {
    localStorage.setItem('cooltrack-ftx-skipped', '1');

    OnboardingBanner.render();

    const banner = document.getElementById('onboarding-banner');
    expect(banner).toBeTruthy();
    // Copy específico do estado skipped
    expect(banner.textContent).toContain('Ative seu primeiro equipamento');
    // Botão é o "Continuar" com id próprio (não o data-action do modal)
    expect(document.getElementById('onboarding-banner-resume')).toBeTruthy();
    expect(banner.querySelector('[data-action="open-modal"]')).toBeFalsy();
  });

  it('renderiza variante "Continuar cadastro" usando skip por usuario', () => {
    localStorage.setItem('ct-ftx-skipped:user-1', '1');

    OnboardingBanner.render({ userId: 'user-1' });

    const banner = document.getElementById('onboarding-banner');
    expect(banner).toBeTruthy();
    expect(banner.textContent).toContain('Ative seu primeiro equipamento');
    expect(document.getElementById('onboarding-banner-resume')).toBeTruthy();
  });

  it('nao usa skip de outro usuario para renderizar retomada', () => {
    localStorage.setItem('ct-ftx-skipped:user-1', '1');

    OnboardingBanner.render({ userId: 'user-2' });

    const banner = document.getElementById('onboarding-banner');
    expect(banner).toBeTruthy();
    expect(banner.textContent).toContain('Comece por 1 equipamento real');
    expect(document.getElementById('onboarding-banner-resume')).toBeFalsy();
  });

  it('migra skip legado para a chave do usuario atual', () => {
    localStorage.setItem('cooltrack-ftx-skipped', '1');

    OnboardingBanner.render({ userId: 'user-1' });

    expect(localStorage.getItem('ct-ftx-skipped:user-1')).toBe('1');
    expect(localStorage.getItem('cooltrack-ftx-skipped')).toBeNull();
    expect(document.getElementById('onboarding-banner-resume')).toBeTruthy();
  });

  it('reabre FTX passando o userId correto ao retomar', async () => {
    const equipamentos = [];
    localStorage.setItem('ct-ftx-skipped:user-1', '1');
    getStateMock.mockReturnValue({ equipamentos });

    OnboardingBanner.render({ userId: 'user-1' });
    document.getElementById('onboarding-banner-resume').click();

    await vi.waitFor(() => {
      expect(reopenMock).toHaveBeenCalledWith(equipamentos, { userId: 'user-1' });
    });
  });

  it('renderiza variante padrão quando FTX nunca foi pulado', () => {
    OnboardingBanner.render();

    const banner = document.getElementById('onboarding-banner');
    expect(banner).toBeTruthy();
    // Copy padrão (sem skip)
    expect(banner.textContent).toContain('Comece por 1 equipamento real');
    // Botão padrão com data-action de abrir modal de equipamento
    expect(banner.querySelector('[data-action="open-modal"]')).toBeTruthy();
    expect(document.getElementById('onboarding-banner-resume')).toBeFalsy();
  });
});
