import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

vi.mock('../core/router.js', () => ({
  goTo: vi.fn(),
}));

describe('Tour', () => {
  const USER_ID = 'user-123';
  const userDoneKey = `ct-tour-done:${USER_ID}`;

  beforeEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
    vi.restoreAllMocks();
    vi.resetModules();
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
    expect(title).toContain('Registre cada atendimento');
  });

  it('goes back to previous step when Anterior is clicked', async () => {
    const { Tour } = await import('../ui/components/tour.js');

    Tour.start();
    // advance twice
    document.getElementById('tour-next')?.click();
    document.getElementById('tour-next')?.click();

    const titleAfterTwoNexts = document.getElementById('tour-title')?.textContent;
    expect(titleAfterTwoNexts).toContain('Equipamentos com histórico');

    document.getElementById('tour-prev')?.click();
    const titleAfterBack = document.getElementById('tour-title')?.textContent;
    expect(titleAfterBack).toContain('Registre cada atendimento');
  });

  it('finishes and marks done when Pular tour is clicked', async () => {
    const { Tour } = await import('../ui/components/tour.js');

    Tour.initIfFirstVisit({ userId: USER_ID });
    Tour.start();
    document.getElementById('tour-skip')?.click();

    expect(localStorage.getItem(userDoneKey)).toBe('1');
    expect(document.getElementById('tour-modal')).toBeNull();
  });

  it('finishes when last step Próximo is clicked', async () => {
    const { Tour } = await import('../ui/components/tour.js');

    Tour.initIfFirstVisit({ userId: USER_ID });
    Tour.start();
    // Click next 5 times to reach last step (6 steps total)
    for (let i = 0; i < 5; i++) {
      document.getElementById('tour-next')?.click();
    }
    // Now on last step — click "Começar a usar"
    document.getElementById('tour-next')?.click();

    expect(localStorage.getItem(userDoneKey)).toBe('1');
    expect(document.getElementById('tour-modal')).toBeNull();
  });

  it('keeps bindHelpButton as compatibility no-op', async () => {
    const { Tour } = await import('../ui/components/tour.js');
    expect(() => Tour.bindHelpButton()).not.toThrow();
  });

  it('does not start if tour already done', async () => {
    localStorage.setItem(userDoneKey, '1');
    const { Tour } = await import('../ui/components/tour.js');

    Tour.initIfFirstVisit({ userId: USER_ID });

    // Modal should NOT appear since tour is done
    expect(document.getElementById('tour-modal')).toBeNull();
  });

  it('migra chave legada global para chave por usuário', async () => {
    localStorage.setItem('cooltrack-tour-done', '1');
    const { Tour } = await import('../ui/components/tour.js');

    Tour.initIfFirstVisit({ userId: USER_ID });

    expect(localStorage.getItem('cooltrack-tour-done')).toBeNull();
    expect(localStorage.getItem(userDoneKey)).toBe('1');
    expect(document.getElementById('tour-modal')).toBeNull();
  });

  // Removido: slide "Score de Risco" foi cortado na refatoração de
  // 2026-04 (Tour modernizado de 6 → 4 slides). Score técnico demais
  // pro primeiro contato — pertence a uma página de ajuda dedicada,
  // não ao onboarding inicial. Ver redesign.css/_tour.css.
  it.skip('includes a dedicated slide explaining the Score de Risco', () => {});

  it('fails if inline event handlers appear in hardened files', () => {
    const files = ['src/ui/views/equipamentos.js', 'src/ui/components/tour.js'];
    const inlineEventPattern =
      /\s(onload|onerror|onclick|oninput|onchange|onsubmit|onkeydown|onkeyup)\s*=/i;

    files.forEach((filePath) => {
      const source = readFileSync(filePath, 'utf-8');
      expect(source).not.toMatch(inlineEventPattern);
    });
  });
});
