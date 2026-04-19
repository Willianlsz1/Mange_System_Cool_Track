const getStateMock = vi.fn(() => ({ equipamentos: [] }));
vi.mock('../core/state.js', () => ({
  getState: () => getStateMock(),
}));

import { OnboardingBanner } from '../ui/components/onboarding/onboardingBanner.js';

describe('OnboardingBanner', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="lista-equip"></div>';
    localStorage.clear();
    getStateMock.mockReturnValue({ equipamentos: [] });
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
    expect(banner.textContent).toContain('Complete seu cadastro');
    // Botão é o "Continuar" com id próprio (não o data-action do modal)
    expect(document.getElementById('onboarding-banner-resume')).toBeTruthy();
    expect(banner.querySelector('[data-action="open-modal"]')).toBeFalsy();
  });

  it('renderiza variante padrão quando FTX nunca foi pulado', () => {
    OnboardingBanner.render();

    const banner = document.getElementById('onboarding-banner');
    expect(banner).toBeTruthy();
    // Copy padrão (sem skip)
    expect(banner.textContent).toContain('Cadastre seu primeiro equipamento');
    // Botão padrão com data-action de abrir modal de equipamento
    expect(banner.querySelector('[data-action="open-modal"]')).toBeTruthy();
    expect(document.getElementById('onboarding-banner-resume')).toBeFalsy();
  });
});
