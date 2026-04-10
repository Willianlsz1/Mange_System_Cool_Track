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

function buildCtaBlock() {
  return `
    <div class="landing-inline-cta">
      <button class="landing-btn landing-btn--primary" type="button" data-action="start-trial">
        Testar agora sem conta
      </button>
    </div>
  `;
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
          <p class="landing-kicker">Manutenção com prioridade clara</p>
          <h1>Saiba exatamente o que fazer em cada equipamento.</h1>
          <p class="landing-subtitle">
            O CoolTrack prioriza, mostra o que precisa de atenção e sugere a próxima ação — direto no campo.
          </p>
          <div class="landing-cta-group">
            <button class="landing-btn landing-btn--primary" type="button" data-action="start-trial">
              Testar agora sem conta
            </button>
            <button class="landing-btn landing-btn--ghost" type="button" data-action="login">
              Já tenho conta
            </button>
          </div>
          <ul class="landing-proof-list" aria-label="Provas rápidas">
            <li>Sem cadastro</li>
            <li>Funciona no celular</li>
            <li>Comece em segundos</li>
          </ul>
          <article class="landing-mockup" aria-label="Exemplo da tela do CoolTrack">
            <header class="landing-mockup__header">
              <strong>Unidade Rooftop 03</strong>
              <span>Score 67</span>
            </header>
            <div class="landing-mockup__status">FORA DE OPERAÇÃO</div>
            <p class="landing-mockup__text">Ação recomendada: Registrar manutenção preventiva</p>
            <div class="landing-mockup__chips">
              <span>Prioridade: Alta</span>
              <span>Última visita: 14 dias</span>
            </div>
          </article>
        </section>

        <section class="landing-section">
          <h2>Problema</h2>
          <ul class="landing-bullet-list">
            <li>Equipamentos esquecidos</li>
            <li>Preventivas atrasadas</li>
            <li>Corretivas repetidas</li>
            <li>Falta de prioridade clara</li>
          </ul>
        </section>

        <section class="landing-section">
          <h2>Solução</h2>
          <p class="landing-section__lead">O sistema analisa os registros e mostra:</p>
          <ul class="landing-bullet-list">
            <li>o que é crítico</li>
            <li>o que precisa de atenção</li>
            <li>o que pode esperar</li>
          </ul>
          ${buildCtaBlock()}
        </section>

        <section class="landing-section">
          <h2>Diferenciais</h2>
          <div class="landing-grid">
            ${buildFeatureItems([
              { title: 'Prioridade automática', text: 'Veja primeiro o que realmente importa.' },
              {
                title: 'Ação recomendada',
                text: 'Saiba exatamente o que fazer em cada equipamento.',
              },
              {
                title: 'Fluxo rápido',
                text: 'Registre um serviço em segundos, direto no campo.',
              },
            ])}
          </div>
          ${buildCtaBlock()}
        </section>

        <section class="landing-section">
          <h2>Como funciona</h2>
          <ol class="landing-steps">
            <li>Abra o sistema</li>
            <li>Veja o que precisa de atenção</li>
            <li>Resolva e registre</li>
          </ol>
          ${buildCtaBlock()}
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
              <p>Dados persistidos na nuvem.</p>
              <button class="landing-btn landing-btn--ghost" type="button" data-action="login">
                Já tenho conta
              </button>
            </article>
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
