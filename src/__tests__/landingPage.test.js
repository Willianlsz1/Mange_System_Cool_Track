import { LandingPage } from '../ui/components/landingPage.js';

describe('LandingPage', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    localStorage.clear();
  });

  it('renders conversion sections and calls guest start CTA', () => {
    const onStartTrial = vi.fn();

    LandingPage.render({ onStartTrial, onLogin: vi.fn() });

    expect(document.querySelector('.landing-hero h1')?.textContent).toContain('Organize serviços');
    expect(document.body.textContent).toContain('Problema');
    expect(document.body.textContent).toContain('Solução');
    expect(document.body.textContent).toContain('Como funciona');

    document.querySelector('[data-action="start-trial"]')?.click();
    expect(onStartTrial).toHaveBeenCalledTimes(1);
  });

  it('attaches login callback in all CTA points', () => {
    const onLogin = vi.fn();

    LandingPage.render({ onStartTrial: vi.fn(), onLogin });

    document.querySelectorAll('[data-action="login"]').forEach((button) => button.click());

    expect(onLogin).toHaveBeenCalledTimes(3);
  });
});
