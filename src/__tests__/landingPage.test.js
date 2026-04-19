import { LandingPage } from '../ui/components/landingPage.js';

describe('LandingPage', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    localStorage.clear();
  });

  it('renders hero headline and mockup card', () => {
    LandingPage.render({ onStartTrial: vi.fn(), onLogin: vi.fn() });

    const heroText = document.body.textContent;
    // Score disk + label no hero mockup (V2Refined)
    expect(heroText).toContain('Alerta Crítico');
    expect(heroText).toContain('87');
    // Gradient word da headline (signature moment 2)
    expect(heroText).toContain('achismo');
    // CTA padronizado pós-redesign
    expect(heroText).toContain('Experimentar grátis');
    // Chip filled do mockup (signature moment 3)
    expect(heroText.toLowerCase()).toContain('prioridade máxima');
  });

  it('renders signature moments (grad word, filled chips, final CTA)', () => {
    LandingPage.render({ onStartTrial: vi.fn(), onLogin: vi.fn() });

    // Grad word "achismo" no h1 e "organizar" no final CTA
    const gradWords = document.querySelectorAll('.lp-grad');
    expect(gradWords.length).toBeGreaterThanOrEqual(2);

    // Filled chips com SVG de check inline
    const chips = document.querySelectorAll('.lp-chip');
    expect(chips.length).toBeGreaterThanOrEqual(3);

    // Final CTA card presente (dual orb via ::before/::after no CSS)
    expect(document.querySelector('.lp-final__card')).toBeTruthy();

    // Social proof strip
    const socialText = document.querySelector('.lp-social')?.textContent || '';
    expect(socialText).toContain('técnicos');
    expect(socialText).toContain('offline-ready');
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
