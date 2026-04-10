import { LandingPage } from '../ui/components/landingPage.js';

describe('LandingPage', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    localStorage.clear();
  });

  it('renders conversion hero, risk result and CTA', () => {
    const onStartTrial = vi.fn();

    LandingPage.render({ onStartTrial, onLogin: vi.fn() });

    expect(document.querySelector('.landing-hero h1')?.textContent).toContain(
      'Pare de perder tempo com manutenção desorganizada.',
    );
    expect(document.body.textContent).toContain('Sem cadastro • Sem cartão • Comece em segundos');
    expect(document.body.textContent).toContain('ALERTA CRÍTICO');
    expect(document.body.textContent).toContain('Score de risco: 87');
    expect(document.body.textContent).toContain('Ação sugerida');

    document.querySelector('[data-action="start-trial"]')?.click();
    expect(onStartTrial).toHaveBeenCalledTimes(1);
  });

  it('attaches repeated CTA and login callback', () => {
    const onStartTrial = vi.fn();
    const onLogin = vi.fn();

    LandingPage.render({ onStartTrial, onLogin });

    document.querySelectorAll('[data-action="start-trial"]').forEach((button) => button.click());
    document.querySelectorAll('[data-action="login"]').forEach((button) => button.click());

    expect(onStartTrial).toHaveBeenCalledTimes(3);
    expect(onLogin).toHaveBeenCalledTimes(3);
  });
});
