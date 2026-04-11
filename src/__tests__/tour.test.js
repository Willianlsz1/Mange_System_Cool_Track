import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../core/router.js', () => ({
  goTo: vi.fn(),
}));

describe('Tour', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <button id="header-help-btn"></button>
      <button id="nav-registro"></button>
      <button id="nav-equipamentos"></button>
      <button id="nav-alertas"></button>
      <div id="lista-equip"><div class="equip-card"></div></div>
    `;
    localStorage.clear();
    vi.restoreAllMocks();
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb();
      return 1;
    });
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('renders updated onboarding flow with register CTA first', async () => {
    const { Tour } = await import('../ui/components/tour.js');

    Tour.start();
    await Promise.resolve();
    await Promise.resolve();

    const progress = document.querySelector('.tour-tooltip__progress')?.textContent;
    const text = document.querySelector('.tour-tooltip__text')?.textContent;

    expect(progress).toContain('Passo 1 de 4');
    expect(text).toContain('Toque aqui para registrar um serviço');
  });

  it('binds tutorial restart to header help button', async () => {
    const { Tour } = await import('../ui/components/tour.js');
    const restartSpy = vi.spyOn(Tour, 'restart').mockImplementation(() => {});

    Tour.bindHelpButton();
    document.getElementById('header-help-btn')?.click();

    expect(restartSpy).toHaveBeenCalledTimes(1);
  });
});
