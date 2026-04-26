/**
 * CoolTrack Pro - LandingPage / template
 *
 * Markup HTML da landing. Mantem os handlers usados pelo orquestrador:
 * data-action="start-trial" e data-action="login".
 *
 * Copy alinhada ao projeto real:
 * - "Plano gratuito para sempre" (Free e gratis pra sempre, sem trial 14d)
 * - Sem e-mail como canal de envio (so WhatsApp/Web Share)
 * - Sem "Servidor no Brasil" (Supabase/Stripe/CF fora, ver privacidade.html)
 * - Tipos de manutencao = opcoes reais do select em registro.js
 */

export function buildLandingHtml() {
  const ICON_ARROW = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>`;
  const ICON_LOGIN = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="m10 17 5-5-5-5"/><path d="M15 12H3"/></svg>`;
  const ICON_CHECK = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>`;
  const ICON_X = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;
  const ICON_SHIELD = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;
  const ICON_LOCK = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>`;
  const ICON_CARD = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" aria-hidden="true"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M2 11h20"/></svg>`;
  const ICON_OFFLINE = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-9-9"/><path d="M21 3v6h-6"/></svg>`;

  const problemItems = [
    'Anotação no papel que se perde',
    'Fotos misturadas no WhatsApp',
    'Relatório feito à noite, manual',
    'Sem histórico do equipamento',
  ];

  const steps = [
    {
      title: 'Cadastre o equipamento',
      text: 'Tire foto da placa. A IA preenche os dados.',
      image: '/brand/passo-1-cadastro.png',
      alt: 'Tela de cadastro de equipamento com opcao de usar foto da etiqueta (IA)',
    },
    {
      title: 'Registre o serviço',
      text: 'Escolha o tipo de serviço e registre em segundos.',
      image: '/brand/passo-2-registro.png',
      alt: 'Tela de novo registro de manutencao com acoes rapidas',
    },
    {
      title: 'Envie o relatório',
      text: 'Gere o PDF e envie no WhatsApp — um toque.',
      image: '/brand/passo-3-pdf.png',
      alt: 'PDF do relatorio de manutencao gerado pelo CoolTrack PRO',
    },
  ];

  const benefits = [
    'Pare de voltar em cliente por falta de informação',
    'Seu cliente recebe um relatório profissional',
    'Cada equipamento com histórico completo',
    'Terminou o serviço → relatório enviado em segundos',
  ];

  const plans = [
    {
      name: 'Free',
      featured: false,
      badge: null,
      priceM: '0',
      sufM: '/sempre',
      priceY: '0',
      sufY: '/sempre',
      annualNote: 'Sem cartão · Para sempre',
      tag: 'Pra testar em um cliente real sem compromisso.',
      deltaIntro: null,
      cta: 'Começar grátis',
      ctaVariant: 'secondary',
      foot: 'Sem cartão · Para sempre',
      features: [
        'Até <strong>3 equipamentos</strong> cadastrados',
        'Registros de serviço ilimitados',
        'Histórico completo do equipamento',
        "Relatórios com marca d'água",
        '<strong>5 envios</strong> via WhatsApp/mês',
        'Cadastro por foto (IA): 1 análise/mês',
        'Fotos nos registros de serviço',
        'Alertas de manutenção preventiva',
        'Funciona offline',
      ],
    },
    {
      name: 'Plus',
      featured: false,
      badge: null,
      priceM: '29',
      sufM: '/mês',
      priceY: '24',
      sufY: '/mês',
      annualNote: 'Cobrado R$ 290/ano · <b>economize R$ 58</b>',
      tag: 'Pro técnico autônomo sem limitação chata no dia a dia.',
      deltaIntro: 'Tudo do Free, mais:',
      cta: 'Assinar Plus',
      ctaVariant: 'secondary',
      foot: 'Sem fidelidade · Cancele quando quiser',
      features: [
        'Até <strong>15 equipamentos</strong> cadastrados',
        "<strong>Relatórios PDF profissionais</strong> sem marca d'água, ilimitados",
        '<strong>60 envios</strong> via WhatsApp/mês',
        '<strong>Cadastro por foto (IA)</strong> — até 30 análises/mês',
        '<strong>Assinatura digital</strong> do cliente no PDF',
        '<strong>Fotos dos equipamentos</strong> (até 3 por equip.)',
      ],
    },
    {
      name: 'Pro',
      featured: true,
      badge: 'Mais popular',
      priceM: '99',
      sufM: '/mês',
      priceY: '82',
      sufY: '/mês',
      annualNote: 'Cobrado R$ 990/ano · <b>economize R$ 198</b>',
      tag: 'Operação maior — hospital, prédio comercial, muitos clientes fixos.',
      deltaIntro: 'Tudo do Plus, mais:',
      cta: 'Assinar Pro',
      ctaVariant: 'primary',
      foot: 'Sem fidelidade · Cancele quando quiser',
      features: [
        '<strong>Equipamentos ilimitados</strong>',
        '<strong>PMOC formal anual</strong> (NBR 13971) com termo de RT',
        '<strong>PDFs ilimitados</strong>',
        '<strong>WhatsApp ilimitado</strong>',
        '<strong>Cadastro por foto (IA)</strong> — até 200 análises/mês',
        '<strong>Agrupamento por setores</strong>',
        'Suporte prioritário',
      ],
    },
  ];

  const seals = `<span>${ICON_SHIELD} LGPD</span><span class="lp-seal-sep"></span><span>${ICON_LOCK} SSL</span><span class="lp-seal-sep"></span><span>${ICON_CARD} Stripe</span><span class="lp-seal-sep"></span><span>${ICON_OFFLINE} Funciona offline</span>`;

  return `
    <div class="lp">
      <header class="lp-topbar" role="banner">
        <a class="lp-brand" href="#lp-hero-title" aria-label="CoolTrack Pro">
          <span class="lp-brand__mark" aria-hidden="true"><span></span></span>
          <span class="lp-brand__text"><span class="lp-brand__name">CoolTrack</span><span class="lp-brand__tag">PRO</span></span>
        </a>
        <nav class="lp-nav" aria-label="Secoes da landing">
          <a href="#lp-problem-title">Problema</a>
          <a href="#lp-how-title">Como funciona</a>
          <a href="#lp-proof-title">Relatório</a>
          <a href="#lp-pricing-title">Planos</a>
          <a href="#lp-about-title">Quem sou</a>
        </nav>
        <button class="lp-login" type="button" data-action="login" data-source="topbar">${ICON_LOGIN} Entrar</button>
      </header>
      <main>
        <section class="lp-hero" aria-labelledby="lp-hero-title">
          <div class="lp-container lp-hero__inner">
            <div class="lp-hero__copy">
              <p class="lp-kicker">Para técnico de ar-condicionado que precisa entregar rápido</p>
              <h1 class="lp-hero__title" id="lp-hero-title">Relatórios de manutenção prontos em minutos, direto do celular.</h1>
              <p class="lp-hero__sub">Chega de perder tempo com papel e planilha. Cadastre o equipamento, registre o serviço e envie o <strong class="lp-accent">PDF</strong> pelo <strong class="lp-accent">WhatsApp</strong> em <strong class="lp-accent">menos de 1 minuto</strong>.</p>
              <div class="lp-hero__ctas">
                <button class="lp-btn lp-btn--primary lp-hero__cta" type="button" data-action="start-trial" data-source="hero">Testar no próximo serviço ${ICON_ARROW}</button>
                <a class="lp-btn lp-btn--secondary lp-hero__cta-secondary" href="#lp-how-title">Ver como funciona</a>
              </div>
              <p class="lp-microcopy">Sem cartão · Gratuito pra sempre · Funciona offline · Cadastro em 30s</p>
              <p class="lp-impact">Antes: 15–20 min por relatório | Agora: menos de 1 minuto</p>
            </div>
            <div class="lp-hero__visual" aria-label="App CoolTrack Pro em uso no celular">
              <div class="lp-phone" role="img" aria-label="Tela do aplicativo mostrando equipamentos monitorados">
                <div class="lp-phone__screen lp-phone__screen--image">
                  <img src="/brand/hero-app-equipamentos.png" alt="Lista de equipamentos no CoolTrack PRO com eficiência, status operacional e próxima ação" />
                  <span class="lp-sr-only">Serviço em campo Split Sala 02 PDF gerado Relatório enviado</span>
                </div>
              </div>
              <div class="lp-hero__ticket" aria-hidden="true">
                <span>Tempo economizado</span><strong>~15 min</strong><small>por atendimento</small>
              </div>
            </div>
          </div>
        </section>

        <section class="lp-vs" aria-labelledby="lp-vs-title">
          <div class="lp-container">
            <div class="lp-section-head lp-section-head--center">
              <p class="lp-section-label">Antes vs Depois</p>
              <h2 id="lp-vs-title">Menos tempo, mais profissionalismo.</h2>
              <p class="lp-section-sub">O mesmo serviço, o mesmo técnico, o mesmo cliente. Só muda o tempo que você gasta — e o que o cliente recebe no fim.</p>
            </div>
            <div class="lp-vs__grid">
              <div class="lp-vs__col lp-vs__col--before">
                <span class="lp-vs__badge">Antes</span>
                <div class="lp-vs__visual"><img src="/brand/antes.png" alt="Caderno com anotações manuscritas e celular com fotos soltas no WhatsApp" /></div>
                <ul class="lp-vs__labels">
                  <li><strong>15–20 min por relatório</strong>Caneta, planilha — sempre depois do expediente.</li>
                  <li><strong>Anotação no papel e fotos soltas</strong>Caderno que molha, foto perdida no grupo.</li>
                  <li><strong>Informação perdida e sem histórico</strong>Ano passado você trocou qual peça? Ninguém lembra.</li>
                </ul>
              </div>
              <div class="lp-vs__arrow" aria-hidden="true">
                <svg width="40" height="40" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 24h32"/><path d="M30 14l10 10-10 10"/></svg>
              </div>
              <div class="lp-vs__col lp-vs__col--after">
                <span class="lp-vs__badge">Depois</span>
                <div class="lp-vs__visual"><img src="/brand/depois.png" alt="Celular com app CoolTrack PRO aberto e PDF do relatório de manutenção" /></div>
                <ul class="lp-vs__labels">
                  <li><strong class="lp-vs__highlight">Menos de 1 minuto</strong>Relatório pronto antes de sair do local do serviço.</li>
                  <li><strong>PDF profissional com fotos e dados</strong>Sua logo, dados do equipamento, fotos.</li>
                  <li><strong>Histórico completo de cada equipamento</strong>Linha do tempo por Split, VRF ou Chiller.</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section class="lp-problem" aria-labelledby="lp-problem-title">
          <div class="lp-container">
            <div class="lp-section-head">
              <p class="lp-section-label">Problema</p>
              <h2 id="lp-problem-title">Se você trabalha com manutenção, já passou por isso:</h2>
            </div>
            <div class="lp-problem__grid">
              ${problemItems.map((item) => `<article class="lp-problem-card"><span class="lp-problem-card__icon">${ICON_X}</span><h3>${item}</h3></article>`).join('')}
            </div>
          </div>
        </section>

        <section class="lp-how" aria-labelledby="lp-how-title">
          <div class="lp-container">
            <div class="lp-section-head lp-section-head--center">
              <p class="lp-section-label">Como funciona</p>
              <h2 id="lp-how-title">Abriu, usou. Simples assim.</h2>
            </div>
            <ol class="lp-how__steps">
              ${steps.map((step, index) => `<li class="lp-how__step"><span class="lp-how__num">${index + 1}</span><div class="lp-how__body"><div class="lp-how__visual"><img src="${step.image}" alt="${step.alt}" loading="lazy" /></div><h3>${step.title}</h3><p>${step.text}</p></div></li>`).join('')}
            </ol>
          </div>
        </section>

        <section class="lp-benefits" aria-labelledby="lp-benefits-title">
          <div class="lp-container lp-benefits__inner">
            <div class="lp-section-head">
              <p class="lp-section-label">Beneficios</p>
              <h2 id="lp-benefits-title">Mais organização no serviço, sem virar escritório.</h2>
            </div>
            <div class="lp-benefits__list">
              ${benefits.map((item) => `<article class="lp-benefit"><span>${ICON_CHECK}</span><h3>${item}</h3></article>`).join('')}
            </div>
          </div>
        </section>

        <section class="lp-about" aria-labelledby="lp-about-title">
          <div class="lp-container lp-about__inner">
            <div class="lp-about__head">
              <p class="lp-section-label">Quem sou</p>
              <h2 id="lp-about-title">Feito por técnico, pra técnico.</h2>
            </div>
            <div class="lp-about__grid">
              <div class="lp-about__photo" aria-label="Willian Lopes"><img src="/brand/Perfil.jpg" alt="Willian Lopes — criador do CoolTrack PRO" /></div>
              <div class="lp-about__copy">
                <p class="lp-about__lead"><strong>Sou o Willian Lopes, técnico de refrigeração há 4 anos.</strong></p>
                <p>Durante esse tempo vivi na pele o que todo técnico vive: voltar do serviço, abrir o caderno manchado de graxa e passar a noite copiando anotação pra planilha. Foto de equipamento perdida num grupo de WhatsApp com 300 mensagens.</p>
                <p>Eu não queria outra planilha. Queria uma ferramenta que resolvesse isso no próprio celular, em campo, enquanto o serviço ainda está fresco na cabeça.</p>
                <p class="lp-about__lead">Como não existia, construí. <strong>O CoolTrack PRO é o que eu queria ter tido no meu primeiro dia de profissão.</strong></p>
                <p>Se você está lendo isso, provavelmente passa pelas mesmas coisas. A gente vai se entender.</p>
                <p class="lp-about__stats">4 anos de campo <span>·</span> Feito por técnico, pra técnico <span>·</span> Atualizações semanais</p>
                <a class="btn btn-outline lp-about__cta" href="mailto:suporte@cooltrackpro.com.br" aria-label="Falar com o suporte por e-mail">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><path d="m22 6-10 7L2 6"/></svg>
                  Falar com o suporte
                </a>
              </div>
            </div>
          </div>
        </section>

        <section class="lp-proof" aria-labelledby="lp-proof-title">
          <div class="lp-container lp-proof__inner">
            <div class="lp-proof__copy">
              <p class="lp-section-label">Prova visual</p>
              <h2 id="lp-proof-title">O relatório que o cliente recebe</h2>
              <p>PDF profissional, com dados, fotos e histórico. Não é planilha — é entrega de serviço.</p>
            </div>
            <div class="lp-pdf lp-pdf--image" role="img" aria-label="Exemplo de PDF profissional gerado pelo CoolTrack Pro">
              <img src="/brand/passo-3-pdf.png" alt="Preview do relatório de manutenção gerado em PDF" loading="lazy" />
            </div>
          </div>
        </section>

        <section class="lp-pricing" aria-labelledby="lp-pricing-title">
          <div class="lp-container">
            <div class="lp-section-head lp-section-head--center">
              <p class="lp-section-label">Planos</p>
              <h2 id="lp-pricing-title">Comece grátis. Cresça quando precisar.</h2>
              <p class="lp-section-sub">Sem fidelidade, sem contrato longo. Você testa em um cliente real e decide depois.</p>
            </div>
            <div class="lp-pricing-toggle" id="lp-pricing-toggle" role="group" aria-label="Ciclo de cobrança">
              <button type="button" class="lp-pricing-toggle__btn lp-pricing-toggle__btn--active" data-billing="monthly" aria-pressed="true">Mensal</button>
              <button type="button" class="lp-pricing-toggle__btn" data-billing="annual" aria-pressed="false">Anual <span class="lp-pricing-toggle__save">-17%</span></button>
            </div>
            <div class="lp-pricing__grid">
              ${plans.map((plan) => `<article class="lp-plan${plan.featured ? ' lp-plan--featured' : ''}">${plan.badge ? `<span class="lp-plan__badge">${plan.badge}</span>` : ''}<h3 class="lp-plan__name">${plan.name}</h3><div class="lp-plan__prices"><p class="lp-plan__price" data-price-monthly>R$ ${plan.priceM}<span>${plan.sufM}</span></p><p class="lp-plan__price" data-price-annual hidden>R$ ${plan.priceY}<span>${plan.sufY}</span></p></div><p class="lp-plan__annual-note" data-price-annual hidden>${plan.annualNote}</p><p class="lp-plan__tag">${plan.tag}</p><ul class="lp-plan__list">${plan.deltaIntro ? `<li class="lp-plan__list-intro">${plan.deltaIntro}</li>` : ''}${plan.features.map((f) => `<li>${ICON_CHECK}<span>${f}</span></li>`).join('')}</ul><button class="lp-btn lp-btn--${plan.ctaVariant} lp-plan__cta" type="button" data-action="start-trial" data-source="plan-${plan.name.toLowerCase()}">${plan.cta}</button><p class="lp-plan__foot">${plan.foot}</p></article>`).join('')}
            </div>
            <div class="lp-pricing__trust">${seals}</div>
          </div>
        </section>

        <section class="lp-final" aria-labelledby="lp-final-title">
          <div class="lp-container">
            <div class="lp-final__card">
              <p class="lp-section-label">Proximo atendimento</p>
              <h2 id="lp-final-title">Use no seu próximo atendimento</h2>
              <p>Em menos de 10 minutos você já testa no campo e vê a diferença</p>
              <button class="lp-btn lp-btn--primary" type="button" data-action="start-trial" data-source="final">Testar no próximo serviço ${ICON_ARROW}</button>
              <p class="lp-final__alt">Ou crie conta em 30 segundos — sem cartão</p>
              <p class="lp-final__meta"><span>● Plano gratuito para sempre</span><span>● Sem cartão de crédito</span><span>● Cancele quando quiser</span></p>
            </div>
          </div>
        </section>
      </main>

      <footer class="lp-footer">
        <div class="lp-container lp-footer__inner">
          <div class="lp-footer__seals" aria-label="Selos de confiança">${seals}</div>
          <div class="lp-footer__brand">
            <div class="lp-brand"><span class="lp-brand__mark" aria-hidden="true"><span></span></span><span class="lp-brand__text"><span class="lp-brand__name">CoolTrack</span><span class="lp-brand__tag">PRO</span></span></div>
            <p>Feito para técnico que quer terminar o serviço com tudo documentado.</p>
          </div>
          <div class="lp-footer__col">
            <h3>Produto</h3>
            <a href="#lp-how-title">Como funciona</a>
            <a href="#lp-proof-title">Relatório em PDF</a>
            <a href="#lp-pricing-title">Planos</a>
            <a href="#lp-about-title">Quem sou</a>
            <button type="button" data-action="login" data-source="footer">${ICON_LOGIN} Entrar</button>
          </div>
          <div class="lp-footer__col">
            <h3>Legal</h3>
            <a href="/legal/termos.html">Termos de uso</a>
            <a href="/legal/privacidade.html">Política de privacidade</a>
            <a href="/legal/lgpd.html">LGPD</a>
          </div>
          <div class="lp-footer__bottom">
            <span>© 2026 CoolTrack Pro</span>
            <span class="lp-footer__version" aria-label="Versão do app">${typeof __APP_VERSION__ !== 'undefined' ? `v${__APP_VERSION__}${typeof __APP_COMMIT__ !== 'undefined' && __APP_COMMIT__ !== 'dev' ? ` · ${__APP_COMMIT__}` : ''}` : 'v1.0.0'}</span>
            <a href="mailto:suporte@cooltrackpro.com.br">suporte@cooltrackpro.com.br</a>
          </div>
        </div>
      </footer>

      <div class="lp-sticky" aria-label="Acao principal mobile">
        <button class="lp-btn lp-btn--primary" type="button" data-action="start-trial" data-source="sticky">Testar no próximo serviço</button>
      </div>
    </div>
  `;
}
