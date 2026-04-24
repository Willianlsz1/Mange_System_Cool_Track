const { trackEvent } = vi.hoisted(() => ({ trackEvent: vi.fn() }));
vi.mock('../core/telemetry.js', () => ({ trackEvent, TELEMETRY_EVENT: 'cooltrack:telemetry' }));

const { LandingPage } = await import('../ui/components/landingPage.js');

describe('LandingPage', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    localStorage.clear();
    trackEvent.mockReset();
  });

  it('renders the new field-service hero copy and CTAs', () => {
    LandingPage.render({ onStartTrial: vi.fn(), onLogin: vi.fn() });

    const hero = document.querySelector('.lp-hero');
    expect(hero).toBeTruthy();
    expect(hero.textContent).toContain(
      'Relatórios de manutenção prontos em minutos, direto do celular.',
    );
    expect(hero.textContent).toContain(
      'Chega de perder tempo com papel e planilha. Cadastre o equipamento',
    );
    expect(hero.querySelector('[data-action="start-trial"]')?.textContent).toContain(
      'Testar no próximo serviço',
    );
    expect(hero.querySelector('a[href="#lp-how-title"]')?.textContent).toContain(
      'Ver como funciona',
    );
    expect(hero.textContent).toContain('Antes: 15–20 min por relatório');
    expect(hero.textContent).toContain('Cadastro em 30s');
  });

  it('renders the phone mockup with service and WhatsApp/PDF state', () => {
    LandingPage.render({ onStartTrial: vi.fn(), onLogin: vi.fn() });

    const phone = document.querySelector('.lp-phone');
    expect(phone).toBeTruthy();
    expect(phone.textContent).toContain('Serviço em campo');
    expect(phone.textContent).toContain('Split Sala 02');
    expect(phone.textContent).toContain('PDF gerado');
    expect(phone.textContent).toContain('Relatório enviado');
  });

  it('renders problem, how, benefits, proof and final CTA sections', () => {
    LandingPage.render({ onStartTrial: vi.fn(), onLogin: vi.fn() });

    const problemCards = document.querySelectorAll('.lp-problem-card');
    expect(problemCards).toHaveLength(4);
    expect(document.querySelector('.lp-problem')?.textContent).toContain(
      'Anotação no papel que se perde',
    );

    const steps = document.querySelectorAll('.lp-how__step');
    expect(steps).toHaveLength(3);
    expect(document.querySelector('.lp-how')?.textContent).toContain('Abriu, usou. Simples assim.');
    expect(steps[2].textContent).toContain('Envie o relatório');

    const benefits = document.querySelectorAll('.lp-benefit');
    expect(benefits).toHaveLength(4);
    expect(document.querySelector('.lp-benefits')?.textContent).toContain(
      'Seu cliente recebe um relatório profissional',
    );

    const proof = document.querySelector('.lp-proof');
    expect(proof).toBeTruthy();
    expect(proof.textContent).toContain('O relatório que o cliente recebe');
    expect(proof.textContent).toContain('Não é planilha — é entrega de serviço');
    expect(document.querySelector('.lp-pdf')).toBeTruthy();

    const final = document.querySelector('.lp-final');
    expect(final.textContent).toContain('Use no seu próximo atendimento');
    expect(final.querySelector('[data-action="start-trial"]')?.textContent).toContain(
      'Testar no próximo serviço',
    );
  });

  it('calls onStartTrial for trial buttons and onLogin for login buttons', () => {
    const onStartTrial = vi.fn();
    const onLogin = vi.fn();
    LandingPage.render({ onStartTrial, onLogin });

    document.querySelector('.lp-hero [data-action="start-trial"]').click();
    document.querySelector('.lp-final [data-action="start-trial"]').click();
    document.querySelector('.lp-topbar [data-action="login"]').click();
    document.querySelector('.lp-footer [data-action="login"]').click();

    expect(onStartTrial).toHaveBeenCalledTimes(2);
    expect(onLogin).toHaveBeenCalledTimes(2);
  });

  it('keeps telemetry for render, CTA click and internal anchor click', () => {
    Element.prototype.scrollIntoView = vi.fn();
    const onStartTrial = vi.fn();
    LandingPage.render({ onStartTrial, onLogin: vi.fn() });

    expect(trackEvent).toHaveBeenCalledWith('lp_view', {});

    document.querySelector('.lp-hero [data-action="start-trial"]').click();
    expect(trackEvent).toHaveBeenCalledWith('lp_cta_click', {
      action: 'start-trial',
      source: 'hero',
    });

    const howLink = document.querySelector('.lp-hero a[href="#lp-how-title"]');
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    howLink.dispatchEvent(click);

    expect(click.defaultPrevented).toBe(true);
    expect(trackEvent).toHaveBeenCalledWith('lp_anchor_click', { anchor: '#lp-how-title' });
    expect(document.querySelector('#lp-how-title')?.getAttribute('tabindex')).toBe('-1');
  });

  it('renders footer with legal links, contact and brand', () => {
    LandingPage.render({ onStartTrial: vi.fn(), onLogin: vi.fn() });

    const footer = document.querySelector('.lp-footer');
    expect(footer).toBeTruthy();
    expect(footer.querySelector('.lp-brand__name')?.textContent).toContain('CoolTrack');
    expect(footer.querySelector('a[href="/legal/termos.html"]')).toBeTruthy();
    expect(footer.querySelector('a[href="/legal/privacidade.html"]')).toBeTruthy();
    expect(footer.querySelector('a[href="/legal/lgpd.html"]')).toBeTruthy();
    expect(footer.querySelector('a[href^="mailto:"]')?.getAttribute('href')).toContain(
      'suporte@cooltrackpro.com.br',
    );
  });

  it('clear() removes landing-active class', () => {
    LandingPage.render({ onStartTrial: vi.fn(), onLogin: vi.fn() });
    LandingPage.clear();

    expect(document.getElementById('app')?.classList.contains('landing-active')).toBe(false);
  });
});
