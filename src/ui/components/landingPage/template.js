/**
 * CoolTrack Pro - LandingPage / template
 *
 * Markup HTML da landing. Mantem os handlers usados pelo orquestrador:
 * data-action="start-trial" e data-action="login".
 */

export function buildLandingHtml() {
  const ICON_ARROW = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>`;
  const ICON_LOGIN = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="m10 17 5-5-5-5"/><path d="M15 12H3"/></svg>`;
  const ICON_CHECK = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>`;
  const ICON_X = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;
  const ICON_FILE = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h5"/></svg>`;
  const ICON_CAMERA = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`;
  const ICON_CLOCK = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`;
  const ICON_WHATSAPP = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.5-4.1A8 8 0 1 1 20 11.5Z"/><path d="M9 8.5c.2 3 2 4.8 5 5"/><path d="M8.8 8.2 10 7l1.4 2-1 .8"/><path d="m13.8 13.5.8-1 2 1.4-1.2 1.2"/></svg>`;

  const problemItems = [
    'Anotação no papel que se perde',
    'Fotos misturadas no WhatsApp',
    'Relatório feito à noite, manual',
    'Sem histórico do equipamento',
  ];

  const steps = [
    {
      title: 'Cadastre o equipamento em segundos',
      text: 'Nome, local, tag e dados importantes ficam salvos para o próximo atendimento.',
    },
    {
      title: 'Marque o que foi feito e tire fotos',
      text: 'Registre limpeza, troca, teste, observacoes e imagens direto no celular.',
    },
    {
      title: 'Gere o PDF e envie na hora pelo WhatsApp',
      text: 'O cliente recebe o relatório antes de você sair do local.',
    },
  ];

  const benefits = [
    'Pare de voltar em cliente por falta de informação',
    'Seu cliente recebe um relatório profissional',
    'Cada equipamento com histórico completo',
    'Terminou o serviço → relatório enviado em segundos',
  ];

  return `
    <div class="lp">
      <header class="lp-topbar" role="banner">
        <a class="lp-brand" href="#lp-hero-title" aria-label="CoolTrack Pro">
          <span class="lp-brand__mark" aria-hidden="true">
            <span></span>
          </span>
          <span class="lp-brand__text">
            <span class="lp-brand__name">CoolTrack</span>
            <span class="lp-brand__tag">PRO</span>
          </span>
        </a>

        <nav class="lp-nav" aria-label="Secoes da landing">
          <a href="#lp-problem-title">Problema</a>
          <a href="#lp-how-title">Como funciona</a>
          <a href="#lp-proof-title">Relatorio</a>
        </nav>

        <button class="lp-login" type="button" data-action="login" data-source="topbar">
          ${ICON_LOGIN}
          Entrar
        </button>
      </header>

      <main>
        <section class="lp-hero" aria-labelledby="lp-hero-title">
          <div class="lp-container lp-hero__inner">
            <div class="lp-hero__copy">
              <p class="lp-kicker">Para técnico de ar-condicionado que precisa entregar rápido</p>
              <h1 class="lp-hero__title" id="lp-hero-title">
                Relatórios de manutenção prontos em minutos, direto do celular.
              </h1>
              <p class="lp-hero__sub">
                Chega de perder tempo com papel e planilha. Cadastre o equipamento, registre o
                serviço e envie o PDF pelo WhatsApp em menos de 1 minuto.
              </p>

              <div class="lp-hero__ctas">
                <button
                  class="lp-btn lp-btn--primary lp-hero__cta"
                  type="button"
                  data-action="start-trial"
                  data-source="hero"
                >
                  Testar no próximo serviço
                  ${ICON_ARROW}
                </button>
                <a class="lp-btn lp-btn--secondary lp-hero__cta-secondary" href="#lp-how-title">
                  Ver como funciona
                </a>
              </div>

              <p class="lp-impact">Antes: 15–20 min por relatório | Agora: menos de 1 minuto</p>
              <p class="lp-microcopy">Sem cadastro complicado · Sem cartão · Funciona offline</p>
            </div>

            <div class="lp-hero__visual" aria-label="Mockup do CoolTrack Pro no celular">
              <div class="lp-phone" role="img" aria-label="Tela do aplicativo registrando manutenção e gerando PDF">
                <div class="lp-phone__screen">
                  <div class="lp-phone__status">
                    <span>09:41</span>
                    <span>4G 87%</span>
                  </div>
                  <div class="lp-phone__header">
                    <div>
                      <span class="lp-phone__eyebrow">Serviço em campo</span>
                      <strong>Split Sala 02</strong>
                    </div>
                    <span class="lp-phone__badge">Online</span>
                  </div>

                  <div class="lp-phone__card lp-phone__card--equipment">
                    <span class="lp-phone__icon">${ICON_CLOCK}</span>
                    <div>
                      <strong>Manutenção preventiva</strong>
                      <span>Cliente: Clinica Norte</span>
                    </div>
                  </div>

                  <div class="lp-phone__checklist">
                    <div>${ICON_CHECK}<span>Filtros limpos</span></div>
                    <div>${ICON_CHECK}<span>Dreno testado</span></div>
                    <div>${ICON_CHECK}<span>Fotos anexadas</span></div>
                  </div>

                  <div class="lp-phone__photos" aria-hidden="true">
                    <span>${ICON_CAMERA} Antes</span>
                    <span>${ICON_CAMERA} Depois</span>
                  </div>

                  <div class="lp-phone__send">
                    <div>
                      <span>PDF gerado</span>
                      <strong>Relatório enviado</strong>
                    </div>
                    <span class="lp-phone__whatsapp">${ICON_WHATSAPP}</span>
                  </div>
                </div>
              </div>

              <div class="lp-hero__ticket" aria-hidden="true">
                <span>Tempo economizado</span>
                <strong>18 min</strong>
                <small>por atendimento</small>
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
              ${problemItems
                .map(
                  (item) => `
                    <article class="lp-problem-card">
                      <span class="lp-problem-card__icon">${ICON_X}</span>
                      <h3>${item}</h3>
                    </article>
                  `,
                )
                .join('')}
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
              ${steps
                .map(
                  (step, index) => `
                    <li class="lp-how__step">
                      <span class="lp-how__num">${index + 1}</span>
                      <div>
                        <h3>${step.title}</h3>
                        <p>${step.text}</p>
                      </div>
                    </li>
                  `,
                )
                .join('')}
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
              ${benefits
                .map(
                  (item) => `
                    <article class="lp-benefit">
                      <span>${ICON_CHECK}</span>
                      <h3>${item}</h3>
                    </article>
                  `,
                )
                .join('')}
            </div>
          </div>
        </section>

        <section class="lp-proof" aria-labelledby="lp-proof-title">
          <div class="lp-container lp-proof__inner">
            <div class="lp-proof__copy">
              <p class="lp-section-label">Prova visual</p>
              <h2 id="lp-proof-title">O relatório que o cliente recebe</h2>
              <p>
                PDF profissional, com dados, fotos e histórico. Não é planilha — é entrega de serviço.
              </p>
            </div>

            <div class="lp-pdf" role="img" aria-label="Exemplo de PDF profissional gerado pelo CoolTrack Pro">
              <div class="lp-pdf__top">
                <div>
                  <span>CoolTrack PRO</span>
                  <strong>Relatório de manutenção</strong>
                </div>
                <span class="lp-pdf__status">Enviado</span>
              </div>
              <div class="lp-pdf__client">
                <span>Cliente</span>
                <strong>Clinica Norte</strong>
              </div>
              <div class="lp-pdf__rows">
                <span></span><span></span><span></span>
              </div>
              <div class="lp-pdf__photos">
                <span>Foto antes</span>
                <span>Foto depois</span>
              </div>
              <div class="lp-pdf__footer">
                ${ICON_FILE}
                <span>Assinatura e histórico anexados</span>
              </div>
            </div>
          </div>
        </section>

        <section class="lp-final" aria-labelledby="lp-final-title">
          <div class="lp-container">
            <div class="lp-final__card">
              <p class="lp-section-label">Proximo atendimento</p>
              <h2 id="lp-final-title">Use o CoolTrack na sua próxima manutenção</h2>
              <p>Em menos de 10 minutos você já testa no campo e vê a diferença</p>
              <button
                class="lp-btn lp-btn--primary"
                type="button"
                data-action="start-trial"
                data-source="final"
              >
                Começar teste agora
                ${ICON_ARROW}
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer class="lp-footer">
        <div class="lp-container lp-footer__inner">
          <div class="lp-footer__brand">
            <div class="lp-brand">
              <span class="lp-brand__mark" aria-hidden="true"><span></span></span>
              <span class="lp-brand__text">
                <span class="lp-brand__name">CoolTrack</span>
                <span class="lp-brand__tag">PRO</span>
              </span>
            </div>
            <p>Feito para técnico que quer terminar o serviço com tudo documentado.</p>
          </div>

          <div class="lp-footer__col">
            <h3>Produto</h3>
            <a href="#lp-how-title">Como funciona</a>
            <a href="#lp-proof-title">Relatório em PDF</a>
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
            <a href="mailto:suporte@cooltrackpro.com.br">suporte@cooltrackpro.com.br</a>
          </div>
        </div>
      </footer>

      <div class="lp-sticky" aria-label="Acao principal mobile">
        <button class="lp-btn lp-btn--primary" type="button" data-action="start-trial" data-source="sticky">
          Testar no próximo serviço
        </button>
      </div>
    </div>
  `;
}
