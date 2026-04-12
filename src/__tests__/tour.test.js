import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../core/router.js', () => ({
  goTo: vi.fn(),
}));

describe('Tour', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders slide-modal tour on start', async () => {
    const { Tour } = await import('../ui/components/tour.js');

    Tour.start();

    const modal = document.getElementById('tour-modal');
    expect(modal).not.toBeNull();

    const title = modal.querySelector('#tour-title')?.textContent;
    expect(title).toContain('Bem-vindo ao CoolTrack');

    const icon = modal.querySelector('#tour-icon')?.textContent;
    expect(icon).toBeTruthy();
  });

  it('advances to next step when Próximo is clicked', async () => {
    const { Tour } = await import('../ui/components/tour.js');

    Tour.start();

    const nextBtn = document.getElementById('tour-next');
    nextBtn?.click();

    const title = document.getElementById('tour-title')?.textContent;
    expect(title).toContain('Registre manutenções');
  });

  it('goes back to previous step when Anterior is clicked', async () => {
    const { Tour } = await import('../ui/components/tour.js');

    Tour.start();
    // advance twice
    document.getElementById('tour-next')?.click();
    document.getElementById('tour-next')?.click();

    const titleAfterTwoNexts = document.getElementById('tour-title')?.textContent;
    expect(titleAfterTwoNexts).toContain('Gerencie equipamentos');

    document.getElementById('tour-prev')?.click();
    const titleAfterBack = document.getElementById('tour-title')?.textContent;
    expect(titleAfterBack).toContain('Registre manutenções');
  });

  it('finishes and marks done when Pular tour is clicked', async () => {
    const { Tour } = await import('../ui/components/tour.js');

    Tour.start();
    document.getElementById('tour-skip')?.click();

    expect(localStorage.getItem('cooltrack-tour-done')).toBe('1');
    expect(document.getElementById('tour-modal')).toBeNull();
  });

  it('finishes when last step Próximo is clicked', async () => {
    const { Tour } = await import('../ui/components/tour.js');

    Tour.start();
    // Click next 3 times to reach last step (4 steps total)
    for (let i = 0; i < 3; i++) {
      document.getElementById('tour-next')?.click();
    }
    // Now on last step — click "Começar a usar"
    document.getElementById('tour-next')?.click();

    expect(localStorage.getItem('cooltrack-tour-done')).toBe('1');
    expect(document.getElementById('tour-modal')).toBeNull();
  });

  it('keeps bindHelpButton as compatibility no-op', async () => {
    const { Tour } = await import('../ui/components/tour.js');
    expect(() => Tour.bindHelpButton()).not.toThrow();
  });

  it('does not start if tour already done', async () => {
    localStorage.setItem('cooltrack-tour-done', '1');
    const { Tour } = await import('../ui/components/tour.js');

    Tour.initIfFirstVisit();

    // Modal should NOT appear since tour is done
    expect(document.getElementById('tour-modal')).toBeNull();
  });
});
