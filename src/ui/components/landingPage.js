function buildFeatureItems(items) {
  return items
    .map(
      ({ title, text }) => `
        <article class="landing-card">
          <h3>${title}</h3>
          <p>${text}</p>
        </article>
      `,
    )
    .join('');
}

function buildHowItWorksSteps(steps) {
  return steps
    .map(
      ({ title, text }, index) => `
        <li class="landing-step-item">
          <span class="landing-step-item__index">${index + 1}</span>
          <div>
            <strong>${title}</strong>
            <p>${text}</p>
          </div>
        </li>
      `,
    )
    .join('');
}

export const LandingPage = {
  render({ onStartTrial, onLogin } = {}) {
    const app = document.getElementById('app');
    if (!app) return;

    app.classList.add('landing-active');
    app.innerHTML = `
      <main class="landing" aria-label="Página inicial CoolTrack">
        <header class="landing-topbar">
          <div class="landing-brand">
            <span class="landing-brand__name">CoolTrack</span>
            <span class="landing-brand__badge">PRO</span>
          </div>
          <button class="landing-link" type="button" data-action="login">Entrar com Google</button>
        </header>

        <section class="landing-hero">
          <p class="landing-kicker">HVAC em campo sem atraso</p>
          <h1>Pare de perder tempo com manutenção desorganizada.</h1>
          <p class="landing-subtitle">
            Registre o serviço em segundos e receba prioridade com ação sugerida para cada equipamento.
          </p>
          <div class="landing-cta-group">
            <button class="landing-btn landing-btn--primary" type="button" data-action="start-trial">
              Testar agora sem conta
            </button>
            <button class="landing-btn landing-btn--ghost" type="button" data-action="login">
              Entrar com Google
            </button>
          </div>
          <p class="landing-microcopy">Sem cadastro &bull; Sem cartão &bull; Comece em segundos</p>
          <article class="landing-mockup" aria-label="Exemplo da tela do CoolTrack">
            <header class="landing-mockup__header">
              <strong>Hospital Central — Chiller 02</strong>
              <span>Score de risco: 87</span>
            </header>
            <div class="landing-mockup__status">ALERTA CRÍTICO</div>
            <p class="landing-mockup__text">Ação sugerida: Inspecionar compressor e registrar corretiva imediata</p>
            <div class="landing-mockup__chips">
              <span>Prioridade: Máxima</span>
              <span>Último serviço: 18 dias</span>
            </div>
          </article>
        </section>

        <section class="landing-section">
          <h2>Como funciona</h2>
          <ol class="landing-steps landing-steps--cards">
            ${buildHowItWorksSteps([
              {
                title: 'Selecione o equipamento',
                text: 'Escolha a unidade em atendimento e inicie o registro direto no celular.',
              },
              {
                title: 'Registre o serviço em segundos',
                text: 'Descreva o que foi feito e conclua sem fluxo longo ou cadastro obrigatório.',
              },
              {
                title: 'Receba prioridade e ação recomendada',
                text: 'Veja na hora o nível de risco e a próxima ação para evitar parada.',
              },
            ])}
          </ol>
        </section>

        <section class="landing-section landing-section--result">
          <h2>Tome decisão mais rápido em campo</h2>
          <div class="landing-grid landing-grid--result">
            ${buildFeatureItems([
              {
                title: 'Alerta crítico',
                text: 'Identifique imediatamente equipamentos fora de operação.',
              },
              {
                title: 'Score de risco',
                text: 'Priorize visitas com base em impacto real da falha.',
              },
              {
                title: 'Ação sugerida',
                text: 'Receba orientação objetiva para agir sem perder tempo.',
              },
            ])}
          </div>
        </section>

        <section class="landing-section">
          <h2>Diferenciais</h2>
          <div class="landing-grid">
            ${buildFeatureItems([
              {
                title: 'Sem cadastro obrigatório',
                text: 'Clique, teste e registre sem criar conta.',
              },
              { title: 'Registro em segundos', text: 'Fluxo curto para quem está em campo.' },
              {
                title: 'Prioridade automática',
                text: 'Saiba o que resolver primeiro sem planilha.',
              },
              { title: 'Relatório pronto', text: 'Histórico organizado para auditoria e repasse.' },
            ])}
          </div>
        </section>

        <section class="landing-section landing-section--final-cta">
          <h2>Comece agora — leva menos de 30 segundos</h2>
          <div class="landing-cta-group landing-cta-group--final">
            <button class="landing-btn landing-btn--primary" type="button" data-action="start-trial">
              Testar sem conta
            </button>
            <button class="landing-btn landing-btn--ghost" type="button" data-action="login">
              Entrar com Google
            </button>
          </div>
        </section>
      </main>

      <div class="landing-sticky-cta" aria-label="CTA fixo mobile">
        <button class="landing-btn landing-btn--primary" type="button" data-action="start-trial">
          Testar agora sem conta
        </button>
      </div>
    `;

    const startTrialHandler =
      onStartTrial ||
      (() => {
        localStorage.setItem('cooltrack-guest-mode', '1');
        window.location.reload();
      });

    const loginHandler =
      onLogin ||
      (() => {
        import('./authscreen.js').then(({ AuthScreen }) => AuthScreen.show());
      });

    app.querySelectorAll('[data-action="start-trial"]').forEach((button) => {
      button.addEventListener('click', startTrialHandler);
    });

    app.querySelectorAll('[data-action="login"]').forEach((button) => {
      button.addEventListener('click', loginHandler);
    });
  },

  clear() {
    const app = document.getElementById('app');
    app?.classList.remove('landing-active');
  },
};
