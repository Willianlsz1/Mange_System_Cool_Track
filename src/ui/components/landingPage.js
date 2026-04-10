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
          <button class="landing-link" type="button" data-action="login">Já tenho conta</button>
        </header>

        <section class="landing-hero">
          <p class="landing-kicker">Gestão de manutenção sem fricção</p>
          <h1>Organize serviços e comece em segundos.</h1>
          <p class="landing-subtitle">
            Registre atendimentos, acompanhe alertas e gere relatórios em um fluxo simples, mesmo sem criar conta.
          </p>
          <div class="landing-cta-group">
            <button class="landing-btn landing-btn--primary" type="button" data-action="start-trial">
              Testar agora sem conta
            </button>
            <button class="landing-btn landing-btn--ghost" type="button" data-action="login">
              Entrar com conta
            </button>
          </div>
          <div class="landing-media" role="img" aria-label="Demonstração do produto em vídeo ou GIF">
            <p>Espaço para GIF ou vídeo do produto</p>
            <small>Substitua por uma demo curta (10-20s)</small>
          </div>
        </section>

        <section class="landing-section">
          <h2>Problema</h2>
          <p class="landing-section__lead">
            Rotina corrida, dados espalhados e retrabalho para comprovar cada serviço.
          </p>
        </section>

        <section class="landing-section">
          <h2>Solução</h2>
          <p class="landing-section__lead">
            Um único painel para registrar ordens, acompanhar prioridades e entregar relatório final sem atraso.
          </p>
          <button class="landing-btn landing-btn--primary" type="button" data-action="start-trial">
            Testar agora sem conta
          </button>
        </section>

        <section class="landing-section">
          <h2>Diferenciais</h2>
          <div class="landing-grid">
            ${buildFeatureItems([
              { title: 'Fluxo direto', text: 'Comece em modo guest sem cadastro.' },
              {
                title: 'Tudo no mesmo lugar',
                text: 'Equipamentos, registros e alertas no mesmo painel.',
              },
              { title: 'Relatório rápido', text: 'Resumo pronto para envio ao cliente.' },
            ])}
          </div>
        </section>

        <section class="landing-section">
          <h2>Como funciona</h2>
          <ol class="landing-steps">
            <li>Inicie o modo guest com um clique.</li>
            <li>Cadastre equipamento e registre serviço.</li>
            <li>Acompanhe status e compartilhe relatório.</li>
          </ol>
        </section>

        <section class="landing-section">
          <h2>Pricing simples</h2>
          <div class="landing-pricing">
            <article class="landing-plan">
              <h3>Trial Guest</h3>
              <p class="landing-plan__price">R$ 0</p>
              <p>Teste imediato, sem conta.</p>
              <button class="landing-btn landing-btn--primary" type="button" data-action="start-trial">
                Testar agora sem conta
              </button>
            </article>
            <article class="landing-plan">
              <h3>Conta CoolTrack</h3>
              <p class="landing-plan__price">Após trial</p>
              <p>Persistência em nuvem e uso contínuo.</p>
              <button class="landing-btn landing-btn--ghost" type="button" data-action="login">
                Criar/entrar na conta
              </button>
            </article>
          </div>
        </section>
      </main>
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
