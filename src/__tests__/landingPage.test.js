import { LandingPage } from '../ui/components/landingPage.js';

describe('LandingPage', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    localStorage.clear();
  });

  it('renders hero headline and mockup card', () => {
    LandingPage.render({ onStartTrial: vi.fn(), onLogin: vi.fn() });

    const heroText = document.body.textContent;
    expect(heroText).toContain('ALERTA CRÍTICO');
    expect(heroText).toContain('Risco: 87');
    expect(heroText).toContain('Ação sugerida');
    expect(heroText).toContain('Testar agora');
  });

  it('calls onStartTrial when start-trial buttons are clicked', () => {
    const onStartTrial = vi.fn();
    LandingPage.render({ onStartTrial, onLogin: vi.fn() });

    document.querySelectorAll('[data-action="start-trial"]').forEach((btn) => btn.click());
    expect(onStartTrial).toHaveBeenCalled();
  });

  it('calls onLogin when login buttons are clicked', () => {
    const onLogin = vi.fn();
    LandingPage.render({ onStartTrial: vi.fn(), onLogin });

    document.querySelectorAll('[data-action="login"]').forEach((btn) => btn.click());
    expect(onLogin).toHaveBeenCalled();
  });

  it('clear() removes landing-active class', () => {
    LandingPage.render({ onStartTrial: vi.fn(), onLogin: vi.fn() });
    LandingPage.clear();

    expect(document.getElementById('app')?.classList.contains('landing-active')).toBe(false);
  });
});
