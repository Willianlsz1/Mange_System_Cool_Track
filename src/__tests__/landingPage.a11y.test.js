/**
 * A11y regression test for the landing page.
 *
 * Renders the full landing in jsdom and runs axe-core with WCAG 2.1 A + AA
 * rules. Gate: zero violations — breaks CI se alguém quebrar acessibilidade.
 *
 * Regras desabilitadas:
 *   - color-contrast: jsdom não calcula estilos computados corretamente
 *     (não aplica gradients, backdrop-filter, etc). Validação de contraste
 *     é feita manualmente via Lighthouse ou DevTools contrast picker.
 */
import axe from 'axe-core';

const { LandingPage } = await import('../ui/components/landingPage.js');

describe('LandingPage a11y (axe-core)', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
  });

  it('has zero WCAG 2.1 A/AA violations', async () => {
    LandingPage.render({ onStartTrial: vi.fn(), onLogin: vi.fn() });

    const results = await axe.run(document.body, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
      rules: {
        // color-contrast: jsdom sem CSS computado real, validamos manualmente.
        'color-contrast': { enabled: false },
      },
    });

    // Se falhar, loga violations detalhadas — facilita debug.
    if (results.violations.length > 0) {
      console.error(
        '[a11y] violations encontradas:',
        JSON.stringify(
          results.violations.map((v) => ({
            id: v.id,
            impact: v.impact,
            description: v.description,
            nodes: v.nodes.map((n) => ({ target: n.target, html: n.html })),
          })),
          null,
          2,
        ),
      );
    }

    expect(results.violations).toEqual([]);
  });
});
