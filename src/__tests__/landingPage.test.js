import { LandingPage } from '../ui/components/landingPage.js';

describe('LandingPage', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    localStorage.clear();
  });

  it('renders conversion hero, static mockup and CTA', () => {
    const onStartTrial = vi.fn();

    LandingPage.render({ onStartTrial, onLogin: vi.fn() });

    expect(document.querySelector('.landing-hero h1')?.textContent).toContain(
      'Saiba exatamente o que fazer em cada equipamento.',
    );
    expect(document.body.textContent).toContain('Sem cadastro');
    expect(document.body.textContent).toContain('Funciona no celular');
    expect(document.body.textContent).toContain('Comece em segundos');
    expect(document.body.textContent).toContain('Score 67');
    expect(document.body.textContent).toContain('FORA DE OPERAÇÃO');

    document.querySelector('[data-action="start-trial"]')?.click();
    expect(onStartTrial).toHaveBeenCalledTimes(1);
  });

  it('attaches repeated CTA and login callback', () => {
    const onStartTrial = vi.fn();
    const onLogin = vi.fn();

    LandingPage.render({ onStartTrial, onLogin });

    document.querySelectorAll('[data-action="start-trial"]').forEach((button) => button.click());
    document.querySelectorAll('[data-action="login"]').forEach((button) => button.click());

    expect(onStartTrial).toHaveBeenCalledTimes(6);
    expect(onLogin).toHaveBeenCalledTimes(3);
  });
});
