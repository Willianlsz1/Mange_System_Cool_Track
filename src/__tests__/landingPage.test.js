const { trackEvent } = vi.hoisted(() => ({ trackEvent: vi.fn() }));
vi.mock('../core/telemetry.js', () => ({ trackEvent, TELEMETRY_EVENT: 'cooltrack:telemetry' }));

const { LandingPage } = await import('../ui/components/landingPage.js');

describe('LandingPage', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    localStorage.clear();
    trackEvent.mockReset();
  });

  it('renders hero headline and AI nameplate mockup card', () => {
    LandingPage.render({ onStartTrial: vi.fn(), onLogin: vi.fn() });

    const heroText = document.body.textContent;
    // Pós-rebuild IA: disk mostra o tempo da análise ("5s") e o badge é o moment-IA.
    expect(heroText).toContain('IA preencheu');
    expect(heroText).toContain('5s');
    // Kicker agora sinaliza IA
    expect(heroText).toContain('agora com IA');
    // H1 reposicionado para promessa real: fim da digitação da etiqueta.
    expect(heroText).toContain('Pare de digitar etiqueta');
    expect(heroText).toContain('Cadastre equipamentos');
    // CTA principal do topo
    expect(heroText).toContain('Testar grátis');
    // Chips do mockup mostram dados extraídos da etiqueta (signature moment 3)
    expect(heroText).toContain('USNW092WSG3');
    expect(heroText).toContain('R-410A');
  });

  it('renders signature moments (grad word, filled chips, final CTA)', () => {
    LandingPage.render({ onStartTrial: vi.fn(), onLogin: vi.fn() });

    // Grad word "30 segundos" no h1 e "organizar" no final CTA
    const gradWords = document.querySelectorAll('.lp-grad');
    expect(gradWords.length).toBeGreaterThanOrEqual(2);

    // Pós-redesign #72: os chips do hero viraram "trust chips" (LGPD/Offline/etc)
    // e os dados extraídos da etiqueta aparecem como linhas do sheet do phone mock.
    const trustChips = document.querySelectorAll('.lp-hero__trust-chip');
    expect(trustChips.length).toBeGreaterThanOrEqual(3);
    const sheetRows = document.querySelectorAll('.lp-phone__row');
    expect(sheetRows.length).toBeGreaterThanOrEqual(3);

    // Final CTA card presente (dual orb via ::before/::after no CSS)
    expect(document.querySelector('.lp-final__card')).toBeTruthy();

    // Social proof strip
    const socialText = document.querySelector('.lp-social')?.textContent || '';
    expect(socialText).toContain('Usado por técnicos em campo');
    expect(socialText).toContain('2.400+');
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

  it('renders pricing section with 3 tiers and real prices', () => {
    LandingPage.render({ onStartTrial: vi.fn(), onLogin: vi.fn() });

    const pricing = document.querySelector('.lp-pricing');
    expect(pricing).toBeTruthy();

    // 3 cards: Free, Plus, Pro
    const cards = document.querySelectorAll('.lp-pricing-card');
    expect(cards.length).toBe(3);

    // Pro deve estar destacado (highlight)
    expect(document.querySelector('.lp-pricing-card--pro.lp-pricing-card--highlight')).toBeTruthy();

    // Preços mensais reais extraídos do subscriptionPlans
    const pricingText = pricing.textContent;
    expect(pricingText).toContain('R$ 0');
    expect(pricingText).toContain('R$ 29');
    expect(pricingText).toContain('R$ 49');

    // Toggle mensal/anual presente
    expect(document.querySelector('#lp-pricing-toggle')).toBeTruthy();
    expect(pricingText).toContain('-28%');
  });

  it('pricing toggle switches between monthly and annual prices', () => {
    LandingPage.render({ onStartTrial: vi.fn(), onLogin: vi.fn() });

    const monthlyEls = document.querySelectorAll('[data-price-monthly]');
    const annualEls = document.querySelectorAll('[data-price-annual]');

    // Estado inicial: mensal visível, anual oculto
    monthlyEls.forEach((el) => expect(el.hidden).toBe(false));
    annualEls.forEach((el) => expect(el.hidden).toBe(true));

    // Clica em "Anual" → inverte
    const annualBtn = document.querySelector('[data-billing="annual"]');
    annualBtn.click();

    monthlyEls.forEach((el) => expect(el.hidden).toBe(true));
    annualEls.forEach((el) => expect(el.hidden).toBe(false));
    expect(annualBtn.classList.contains('lp-pricing-toggle__btn--active')).toBe(true);

    // Preços anuais aparecem após clicar
    const annualText = document.querySelector('.lp-pricing').textContent;
    expect(annualText).toContain('R$ 249');
    expect(annualText).toContain('R$ 419');
  });

  it('pricing card CTAs trigger onStartTrial (trial-first strategy)', () => {
    const onStartTrial = vi.fn();
    LandingPage.render({ onStartTrial, onLogin: vi.fn() });

    const pricingCtas = document.querySelectorAll('.lp-pricing-card__cta');
    expect(pricingCtas.length).toBe(3);
    pricingCtas.forEach((btn) => btn.click());

    // 3 CTAs do pricing + 2 CTAs do hero/final = no mínimo 5 chamadas
    expect(onStartTrial.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('renders trust strip with the 4 objection-buster badges before pricing', () => {
    LandingPage.render({ onStartTrial: vi.fn(), onLogin: vi.fn() });

    const trust = document.querySelector('.lp-trust');
    expect(trust).toBeTruthy();

    const items = trust.querySelectorAll('.lp-trust__item');
    expect(items.length).toBe(4);

    const trustText = trust.textContent;
    expect(trustText).toContain('LGPD compliant');
    expect(trustText).toContain('Dados criptografados');
    expect(trustText).toContain('7 dias de garantia');
    expect(trustText).toContain('Sem fidelidade');

    // Trust strip deve vir ANTES da seção de pricing no DOM (ordem importa
    // pro flow de leitura: social proof → trust → preço).
    const pricing = document.querySelector('.lp-pricing');
    expect(pricing).toBeTruthy();
    const order = trust.compareDocumentPosition(pricing);
    // DOCUMENT_POSITION_FOLLOWING = 4 — pricing vem depois do trust
    expect(order & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('renders counter-signal section with "feito pra" and "não serve pra" cards', () => {
    LandingPage.render({ onStartTrial: vi.fn(), onLogin: vi.fn() });

    const fit = document.querySelector('.lp-fit');
    expect(fit).toBeTruthy();

    // Dois cards: yes (azul cyan, check list) e no (cinza, x list)
    const yesCard = fit.querySelector('.lp-fit__card--yes');
    const noCard = fit.querySelector('.lp-fit__card--no');
    expect(yesCard).toBeTruthy();
    expect(noCard).toBeTruthy();

    // Badge "Feito pra" e "Não serve"
    expect(yesCard.querySelector('.lp-fit__badge--yes')?.textContent).toContain('Feito pra');
    expect(noCard.querySelector('.lp-fit__badge--no')?.textContent).toContain('Não serve');

    // Itens representativos — não checa todos, só âncoras-chave do messaging.
    const yesText = yesCard.textContent;
    expect(yesText).toContain('manutenção em campo');
    expect(yesText).toContain('PDF assinado');
    expect(yesText).toContain('offline');

    const noText = noCard.textContent;
    expect(noText).toContain('ERP completo');
    expect(noText).toContain('CRM de vendas');

    // Counter-signal vem entre pricing e FAQ
    const pricing = document.querySelector('.lp-pricing');
    const faq = document.querySelector('.lp-faq');
    expect(pricing.compareDocumentPosition(fit) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(fit.compareDocumentPosition(faq) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('renders "Como funciona" section with 3 numbered steps between hero and gallery', () => {
    LandingPage.render({ onStartTrial: vi.fn(), onLogin: vi.fn() });

    const how = document.querySelector('.lp-how');
    expect(how).toBeTruthy();
    expect(how.querySelector('.lp-how__tabs-label')?.textContent).toContain(
      'Veja como funciona na prática',
    );
    expect(how.querySelector('.lp-how__tab--active')?.textContent).toContain('Como funciona');

    // 3 passos numerados
    const steps = how.querySelectorAll('.lp-how__step');
    expect(steps.length).toBe(3);

    // Copy-âncoras dos 3 passos (ordem importa) — pós-rebuild IA:
    // step 1 = foto da etiqueta com IA, step 2 = registro em campo, step 3 = PDF.
    const stepTexts = Array.from(steps).map((s) => s.textContent);
    expect(stepTexts[0]).toContain('1');
    expect(stepTexts[0]).toContain('Aponta a câmera');
    expect(stepTexts[1]).toContain('IA preenche');
    expect(stepTexts[1]).toContain('2');
    expect(stepTexts[1]).toContain('você revisa e cadastra');
    expect(stepTexts[2]).toContain('3');
    expect(stepTexts[2]).toContain('Você registra e gera o relatório');

    // Posição: depois do hero, antes da gallery
    const hero = document.querySelector('.lp-hero');
    const gallery = document.querySelector('.lp-gallery');
    expect(hero.compareDocumentPosition(how) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(how.compareDocumentPosition(gallery) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('renders dedicated "Cadastro por foto (IA)" section with antes/depois and demo', () => {
    LandingPage.render({ onStartTrial: vi.fn(), onLogin: vi.fn() });

    const ai = document.querySelector('.lp-ai');
    expect(ai).toBeTruthy();

    // Pill "Novo · Plus+ e Pro" sinaliza o feature + gate de plano
    const pill = ai.querySelector('.lp-ai__pill');
    expect(pill).toBeTruthy();
    expect(pill.textContent.toLowerCase()).toContain('plus+');
    expect(pill.textContent.toLowerCase()).toContain('pro');

    // Cards Antes/Depois (2 colunas de valor concreto)
    const cards = ai.querySelectorAll('.lp-ai-card');
    expect(cards.length).toBe(2);
    const before = ai.querySelector('.lp-ai-card--before');
    const after = ai.querySelector('.lp-ai-card--after');
    expect(before).toBeTruthy();
    expect(after).toBeTruthy();
    expect(before.textContent.toLowerCase()).toContain('digitando');
    expect(after.textContent.toLowerCase()).toContain('câmera');
    expect(after.textContent).toContain('14 de 16');

    // Demo foto → fields (3 colunas)
    const demo = ai.querySelector('.lp-ai__demo');
    expect(demo).toBeTruthy();
    expect(demo.querySelector('.lp-ai-demo__photo')).toBeTruthy();
    expect(demo.querySelector('.lp-ai-demo__fields')).toBeTruthy();
    expect(demo.textContent).toContain('USNW092WSG3');
    expect(demo.textContent).toContain('R-410A');

    // Posição: depois do "Como funciona", antes da gallery
    const how = document.querySelector('.lp-how');
    const gallery = document.querySelector('.lp-gallery');
    expect(how.compareDocumentPosition(ai) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(ai.compareDocumentPosition(gallery) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('gallery includes the IA capture screen (6 screens + 6 dots)', () => {
    LandingPage.render({ onStartTrial: vi.fn(), onLogin: vi.fn() });

    const gallery = document.querySelector('.lp-gallery');
    const screens = gallery.querySelectorAll('.lp-screen');
    expect(screens.length).toBe(6);

    // Tela de captura da etiqueta (novo screen 1): câmera + progresso IA.
    const cameraScreen = gallery.querySelector('.lp-sc-camera');
    expect(cameraScreen).toBeTruthy();
    expect(gallery.querySelector('.lp-sc-ai-progress')).toBeTruthy();
    expect(gallery.textContent).toContain('Foto da etiqueta');

    // Dots refletem a nova contagem.
    const dots = gallery.querySelectorAll('.lp-gallery__dot');
    expect(dots.length).toBe(6);
  });

  it('pricing Plus and Pro advertise the IA nameplate feature', () => {
    LandingPage.render({ onStartTrial: vi.fn(), onLogin: vi.fn() });

    const plus = document.querySelector('.lp-pricing-card--plus');
    const pro = document.querySelector('.lp-pricing-card--pro');
    expect(plus.textContent.toLowerCase()).toContain('cadastro por foto');
    expect(pro.textContent.toLowerCase()).toContain('cadastro por foto');

    // Free não deve anunciar IA (é gate Plus+)
    const free = document.querySelector(
      '.lp-pricing-card:not(.lp-pricing-card--plus):not(.lp-pricing-card--pro)',
    );
    expect(free.textContent.toLowerCase()).not.toContain('cadastro por foto');
  });

  it('FAQ includes IA-related questions (how it works, accuracy, privacy)', () => {
    LandingPage.render({ onStartTrial: vi.fn(), onLogin: vi.fn() });

    const faq = document.querySelector('.lp-faq');
    expect(faq.querySelector('[data-question="ai_how"]')).toBeTruthy();
    expect(faq.querySelector('[data-question="ai_accuracy"]')).toBeTruthy();
    expect(faq.querySelector('[data-question="ai_privacy"]')).toBeTruthy();
  });

  it('renders offline-first demo with queue items and sync copy', () => {
    LandingPage.render({ onStartTrial: vi.fn(), onLogin: vi.fn() });

    const offline = document.querySelector('.lp-offline');
    expect(offline).toBeTruthy();

    // Barra de status "Modo offline ativo"
    const bar = offline.querySelector('.lp-offline__bar');
    expect(bar).toBeTruthy();
    expect(bar.textContent.toLowerCase()).toContain('modo offline');
    expect(bar.textContent).toContain('3 registros');

    // 3 itens na fila (prova visual de múltiplos registros salvos local)
    const items = offline.querySelectorAll('.lp-offline__item');
    expect(items.length).toBe(3);
    expect(offline.textContent).toContain('Pendente');

    // Copy de reconexão
    expect(offline.textContent.toLowerCase()).toContain('sinal voltar');

    // Posição: depois da gallery, antes do social proof
    const gallery = document.querySelector('.lp-gallery');
    const social = document.querySelector('.lp-social');
    expect(
      gallery.compareDocumentPosition(offline) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(offline.compareDocumentPosition(social) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('renders "Antes vs. Depois" comparison between trust strip and pricing', () => {
    LandingPage.render({ onStartTrial: vi.fn(), onLogin: vi.fn() });

    const compare = document.querySelector('.lp-compare');
    expect(compare).toBeTruthy();

    // Dois cards: before (cinza) + after (cyan)
    const beforeCard = compare.querySelector('.lp-compare__card--before');
    const afterCard = compare.querySelector('.lp-compare__card--after');
    expect(beforeCard).toBeTruthy();
    expect(afterCard).toBeTruthy();

    // Badges "Antes" / "Depois"
    expect(beforeCard.querySelector('.lp-compare__badge--before')?.textContent).toContain('Antes');
    expect(afterCard.querySelector('.lp-compare__badge--after')?.textContent).toContain('Depois');

    // Âncoras de transformação mais fiéis ao fluxo real
    const beforeText = beforeCard.textContent.toLowerCase();
    expect(beforeText).toContain('digitando etiqueta manualmente');
    expect(beforeText).toContain('16 campos');
    expect(beforeText).toContain('erros constantes');
    expect(beforeText).toContain('perda de tempo');

    const afterText = afterCard.textContent.toLowerCase();
    expect(afterText).toContain('foto da etiqueta');
    expect(afterText).toContain('dados preenchidos automaticamente');
    expect(afterText).toContain('registro rápido');
    expect(afterText).toContain('relatório em poucos toques');

    // Posição: depois do trust strip, antes do pricing
    const trust = document.querySelector('.lp-trust');
    const pricing = document.querySelector('.lp-pricing');
    expect(trust.compareDocumentPosition(compare) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(
      compare.compareDocumentPosition(pricing) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('renders FAQ section with at least 5 questions', () => {
    LandingPage.render({ onStartTrial: vi.fn(), onLogin: vi.fn() });

    const faq = document.querySelector('.lp-faq');
    expect(faq).toBeTruthy();

    const items = document.querySelectorAll('.lp-faq__item');
    expect(items.length).toBeGreaterThanOrEqual(5);

    // Summaries semânticos <summary>
    const summaries = document.querySelectorAll('.lp-faq__item summary');
    expect(summaries.length).toBe(items.length);
  });

  it('hero keeps one primary trial button and one anchor de apoio (no Google)', () => {
    LandingPage.render({ onStartTrial: vi.fn(), onLogin: vi.fn() });

    // Hero mantém 1 botão primário e 1 link secundário "Ver como funciona".
    const heroCtas = document.querySelector('.lp-hero .lp-hero__ctas');
    expect(heroCtas).toBeTruthy();
    const heroButtons = heroCtas.querySelectorAll('button');
    expect(heroButtons.length).toBe(1);
    const heroAnchors = heroCtas.querySelectorAll('a');
    expect(heroAnchors.length).toBe(1);

    // Hero NÃO pode ter button social (ex. "Continuar com Google") — dilui conversão.
    expect(heroCtas.textContent).not.toContain('Google');

    // O único botão do hero deve disparar trial (não login).
    expect(heroButtons[0].dataset.action).toBe('start-trial');
    expect(heroAnchors[0].getAttribute('href')).toBe('#lp-how-title');
  });

  it('renders institutional footer with brand, legal links and contact', () => {
    LandingPage.render({ onStartTrial: vi.fn(), onLogin: vi.fn() });

    const footer = document.querySelector('.lp-footer');
    expect(footer).toBeTruthy();

    // Brand lockup presente no footer (reforço de identidade no fim da página)
    expect(footer.querySelector('.lp-brand__name')?.textContent).toContain('CoolTrack');

    // Três colunas: Produto, Legal, Contato
    const cols = footer.querySelectorAll('.lp-footer__col');
    expect(cols.length).toBe(3);

    // Links legais obrigatórios (LGPD + Termos + Privacidade)
    const footerText = footer.textContent;
    expect(footerText).toContain('Termos de uso');
    expect(footerText).toContain('Política de privacidade');
    expect(footerText).toContain('LGPD');

    // Links apontam para as páginas legais reais (não placeholder #).
    // Usa .html direto pra funcionar em dev (Vite), prod (Cloudflare) e SW
    // sem depender da regra de rewrite do _redirects.
    const termsLink = footer.querySelector('a[href="/legal/termos.html"]');
    const privacyLink = footer.querySelector('a[href="/legal/privacidade.html"]');
    const lgpdLink = footer.querySelector('a[href="/legal/lgpd.html"]');
    expect(termsLink).toBeTruthy();
    expect(privacyLink).toBeTruthy();
    expect(lgpdLink).toBeTruthy();

    // Contato real — mailto pro suporte
    const supportMail = footer.querySelector('a[href^="mailto:"]');
    expect(supportMail).toBeTruthy();
    expect(supportMail.getAttribute('href')).toContain('suporte@cooltrackpro.com.br');

    // Copyright + origem
    expect(footerText).toContain('2026');
    expect(footerText).toContain('CoolTrack Pro');
    expect(footerText).toContain('Feito no Brasil');
  });

  it('footer login button triggers onLogin handler', () => {
    const onLogin = vi.fn();
    LandingPage.render({ onStartTrial: vi.fn(), onLogin });

    const footerLoginBtn = document.querySelector('.lp-footer button[data-action="login"]');
    expect(footerLoginBtn).toBeTruthy();
    footerLoginBtn.click();

    expect(onLogin).toHaveBeenCalled();
  });

  it('emits lp_view telemetry once per render', () => {
    LandingPage.render({ onStartTrial: vi.fn(), onLogin: vi.fn() });

    const viewCalls = trackEvent.mock.calls.filter((c) => c[0] === 'lp_view');
    expect(viewCalls).toHaveLength(1);
    expect(viewCalls[0][1]).toEqual({});
  });

  it('emits lp_cta_click with source=hero when hero trial CTA is clicked', () => {
    const onStartTrial = vi.fn();
    LandingPage.render({ onStartTrial, onLogin: vi.fn() });

    const heroBtn = document.querySelector('.lp-hero [data-action="start-trial"]');
    heroBtn.click();

    expect(trackEvent).toHaveBeenCalledWith('lp_cta_click', {
      action: 'start-trial',
      source: 'hero',
    });
    // Handler real ainda deve rodar após telemetria
    expect(onStartTrial).toHaveBeenCalledTimes(1);
  });

  it('emits lp_cta_click with correct sources for pricing cards and footer login', () => {
    LandingPage.render({ onStartTrial: vi.fn(), onLogin: vi.fn() });

    document.querySelector('[data-source="pricing_plus"]').click();
    document.querySelector('[data-source="pricing_pro"]').click();
    document.querySelector('.lp-footer button[data-action="login"]').click();

    const ctaCalls = trackEvent.mock.calls.filter((c) => c[0] === 'lp_cta_click');
    const sources = ctaCalls.map((c) => c[1].source);
    expect(sources).toEqual(expect.arrayContaining(['pricing_plus', 'pricing_pro', 'footer']));
  });

  it('emits lp_pricing_toggle when billing cycle toggles', () => {
    LandingPage.render({ onStartTrial: vi.fn(), onLogin: vi.fn() });

    document.querySelector('[data-billing="annual"]').click();
    document.querySelector('[data-billing="monthly"]').click();

    const toggleCalls = trackEvent.mock.calls.filter((c) => c[0] === 'lp_pricing_toggle');
    expect(toggleCalls).toHaveLength(2);
    expect(toggleCalls[0][1]).toEqual({ billing: 'annual' });
    expect(toggleCalls[1][1]).toEqual({ billing: 'monthly' });
  });

  it('emits lp_faq_open only on open, not on close', () => {
    LandingPage.render({ onStartTrial: vi.fn(), onLogin: vi.fn() });

    const first = document.querySelector('.lp-faq__item[data-question="offline"]');
    // Abre (emite evento)
    first.open = true;
    first.dispatchEvent(new Event('toggle'));
    // Fecha (não emite)
    first.open = false;
    first.dispatchEvent(new Event('toggle'));

    const faqCalls = trackEvent.mock.calls.filter((c) => c[0] === 'lp_faq_open');
    expect(faqCalls).toHaveLength(1);
    expect(faqCalls[0][1]).toEqual({ question: 'offline' });
  });

  it('hero sub-hero leads with honest promise about IA + revisão humana (L-A)', () => {
    LandingPage.render({ onStartTrial: vi.fn(), onLogin: vi.fn() });

    const sub = document.querySelector('.lp-hero__sub');
    expect(sub).toBeTruthy();
    // A lead line honesta sobre o escopo real da IA: preenche cadastro para revisão.
    const lead = sub.querySelector('.lp-hero__sub-lead');
    expect(lead).toBeTruthy();
    expect(lead.textContent).toContain('IA lê a etiqueta e preenche os dados do equipamento');
    // O restante do sub continua explicando registro do serviço e geração de relatório.
    expect(sub.textContent.toLowerCase()).toContain('serviço');
    expect(sub.textContent.toLowerCase()).toContain('relatório');
  });

  it('renders time-stat strip "20 min → 30 segundos" between hero and how (L-B)', () => {
    LandingPage.render({ onStartTrial: vi.fn(), onLogin: vi.fn() });

    const stat = document.querySelector('.lp-timestat');
    expect(stat).toBeTruthy();

    // Dois itens: tradicional (antes) e CoolTrack (depois).
    expect(stat.querySelector('.lp-timestat__item--before')).toBeTruthy();
    expect(stat.querySelector('.lp-timestat__item--after')).toBeTruthy();

    // Números concretos — minutos, não reais.
    const text = stat.textContent;
    expect(text).toContain('20 min');
    expect(text).toContain('30 segundos');
    // Zero menção a R$ — ganho em reais é chute, evitamos.
    expect(text).not.toContain('R$');

    // Posição: depois do hero, antes do "Como funciona".
    const hero = document.querySelector('.lp-hero');
    const how = document.querySelector('.lp-how');
    expect(hero.compareDocumentPosition(stat) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(stat.compareDocumentPosition(how) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('hero CTA e CTAs de meio/final seguem a estrutura pedida (L-C)', () => {
    LandingPage.render({ onStartTrial: vi.fn(), onLogin: vi.fn() });

    const heroCta = document.querySelector('.lp-hero .lp-hero__cta');
    expect(heroCta).toBeTruthy();
    expect(heroCta.textContent).toContain('Testar grátis');
    const middleCta = document.querySelector('.lp-hero .lp-hero__cta-secondary');
    expect(middleCta.textContent).toContain('Ver como funciona');
    const finalCta = document.querySelector('.lp-final .lp-btn-primary');
    const stickyCta = document.querySelector('.lp-sticky .lp-btn-primary');
    expect(finalCta.textContent).toContain('Começar agora');
    expect(stickyCta.textContent).toContain('Começar agora');
  });

  it('Plus badge e microcopy reposicionam o plano como técnico autônomo (L-D)', () => {
    LandingPage.render({ onStartTrial: vi.fn(), onLogin: vi.fn() });

    const plus = document.querySelector('.lp-pricing-card--plus');
    expect(plus).toBeTruthy();
    // Badge enquadrada emocionalmente — não "Intermediário" genérico.
    const badge = plus.querySelector('.lp-pricing-badge--plus');
    expect(badge.textContent).toContain('Técnico autônomo');
    // Microcopy do Plus: sozinho, tempo.
    const micro = plus.querySelector('.lp-pricing-card__microcopy');
    expect(micro.textContent.toLowerCase()).toContain('sozinho');
    expect(micro.textContent.toLowerCase()).toContain('tempo');
  });

  it('Pro microcopy enquadra como equipe ou 15+ equipamentos (L-D)', () => {
    LandingPage.render({ onStartTrial: vi.fn(), onLogin: vi.fn() });

    const pro = document.querySelector('.lp-pricing-card--pro');
    expect(pro).toBeTruthy();
    // Badge "★ Mais popular" continua (social proof).
    expect(pro.querySelector('.lp-pricing-badge--popular')).toBeTruthy();
    // Microcopy Pro: equipe OU 15+ equipamentos (gatilho real de upgrade do Plus).
    const micro = pro.querySelector('.lp-pricing-card__microcopy');
    expect(micro.textContent.toLowerCase()).toContain('equipe');
    expect(micro.textContent).toContain('15');
  });

  it('emits lp_anchor_click when footer smooth-scroll anchor is clicked', () => {
    Element.prototype.scrollIntoView = vi.fn();
    LandingPage.render({ onStartTrial: vi.fn(), onLogin: vi.fn() });

    const planosLink = document.querySelector('.lp-footer a[href="#lp-pricing-title"]');
    planosLink.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(trackEvent).toHaveBeenCalledWith('lp_anchor_click', { anchor: '#lp-pricing-title' });
  });

  it('footer anchor links smooth-scroll to pricing/FAQ sections instead of navigating', () => {
    // jsdom não implementa scrollIntoView — mockamos pra observar as chamadas.
    const scrollSpy = vi.fn();
    Element.prototype.scrollIntoView = scrollSpy;

    LandingPage.render({ onStartTrial: vi.fn(), onLogin: vi.fn() });

    const planosLink = document.querySelector('.lp-footer a[href="#lp-pricing-title"]');
    const faqLink = document.querySelector('.lp-footer a[href="#lp-faq-title"]');
    expect(planosLink).toBeTruthy();
    expect(faqLink).toBeTruthy();

    // Clique em "Planos" — scrollIntoView deve ser chamado no target #lp-pricing-title.
    const pricingTarget = document.querySelector('#lp-pricing-title');
    const faqTarget = document.querySelector('#lp-faq-title');
    expect(pricingTarget).toBeTruthy();
    expect(faqTarget).toBeTruthy();

    // dispatchEvent com cancelable=true para que preventDefault realmente tenha efeito
    const clickPlanos = new MouseEvent('click', { bubbles: true, cancelable: true });
    planosLink.dispatchEvent(clickPlanos);
    expect(clickPlanos.defaultPrevented).toBe(true);
    expect(scrollSpy).toHaveBeenCalledTimes(1);
    expect(scrollSpy.mock.instances[0]).toBe(pricingTarget);

    const clickFaq = new MouseEvent('click', { bubbles: true, cancelable: true });
    faqLink.dispatchEvent(clickFaq);
    expect(clickFaq.defaultPrevented).toBe(true);
    expect(scrollSpy).toHaveBeenCalledTimes(2);
    expect(scrollSpy.mock.instances[1]).toBe(faqTarget);

    // Verifica opções passadas — smooth por default, block: start.
    expect(scrollSpy.mock.calls[0][0]).toMatchObject({ block: 'start' });
    expect(['smooth', 'auto']).toContain(scrollSpy.mock.calls[0][0].behavior);

    // Target recebe foco (a11y) — tabindex=-1 injetado pra elementos não focáveis.
    expect(pricingTarget.getAttribute('tabindex')).toBe('-1');
    expect(faqTarget.getAttribute('tabindex')).toBe('-1');
  });
});
