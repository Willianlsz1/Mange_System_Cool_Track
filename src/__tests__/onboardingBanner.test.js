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
});
