export const LandingPage = {
  render({ onStartTrial, onLogin } = {}) {
    const app = document.getElementById('app');
    if (!app) return;

    app.classList.add('landing-active');
    app.innerHTML = `
      <style>
        /* ── Reset de qualquer overflow herdado ── */
        body { overflow-x: hidden; }

        /* ── LANDING ROOT ── */
        .lp {
          font-family: var(--font, system-ui, sans-serif);
          background: #060c16;
          color: #d8eaf6;
          min-height: 100dvh;
          display: flex;
          flex-direction: column;
        }

        /* ─────────────────────────────────────
           TOPBAR
        ───────────────────────────────────── */
        .lp-topbar {
          display: flex; align-items: center; justify-content: space-between;
          padding: 18px 24px;
          position: sticky; top: 0; z-index: 50;
          background: rgba(6, 12, 22, 0.9);
          backdrop-filter: blur(10px);
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .lp-brand {
          display: flex; align-items: center; gap: 8px;
        }
        .lp-brand__icon {
          width: 30px; height: 30px; border-radius: 7px;
          background: rgba(0,200,232,0.1); border: 1px solid rgba(0,200,232,0.22);
          display: flex; align-items: center; justify-content: center;
        }
        .lp-brand__name {
          font-size: 16px; font-weight: 700; color: #e8f4fc; letter-spacing: -.2px;
        }
        .lp-brand__badge {
          font-size: 9px; font-weight: 700; color: #00c8e8; letter-spacing: 1px;
          background: rgba(0,200,232,0.1); border: 1px solid rgba(0,200,232,0.25);
          padding: 2px 5px; border-radius: 4px;
        }
        .lp-nav-btn {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px; padding: 8px 16px;
          color: #c8dce8; font-size: 13px; font-weight: 500;
          font-family: inherit; cursor: pointer;
          transition: border-color .18s, background .18s;
          display: flex; align-items: center; gap: 6px;
        }
        .lp-nav-btn:hover { border-color: rgba(0,200,232,0.35); background: rgba(0,200,232,0.06); color: #00c8e8; }

        /* ─────────────────────────────────────
           HERO — full-viewport
        ───────────────────────────────────── */
        .lp-hero {
          flex: 1;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          text-align: center;
          padding: 64px 24px 72px;
          position: relative; overflow: hidden;
        }
        /* Glow orb de fundo */
        .lp-hero::before {
          content: '';
          position: absolute; top: -120px; left: 50%; transform: translateX(-50%);
          width: 600px; height: 600px; border-radius: 50%;
          background: radial-gradient(circle, rgba(0,200,232,0.07) 0%, transparent 65%);
          pointer-events: none;
        }

        .lp-kicker {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 12px; font-weight: 600; letter-spacing: .8px; text-transform: uppercase;
          color: #00c8e8; background: rgba(0,200,232,0.08);
          border: 1px solid rgba(0,200,232,0.2); border-radius: 20px;
          padding: 5px 12px; margin-bottom: 28px;
        }
        .lp-kicker::before { content: '●'; font-size: 7px; animation: lp-blink 1.8s infinite; }
        @keyframes lp-blink { 0%,100% { opacity: 1 } 50% { opacity: .3 } }

        .lp-h1 {
          font-size: clamp(2rem, 5.5vw, 3.4rem);
          font-weight: 800; line-height: 1.1; letter-spacing: -.5px;
          color: #f0f8ff; margin-bottom: 20px; max-width: 780px;
        }
        .lp-h1 em {
          font-style: normal;
          background: linear-gradient(90deg, #00c8e8, #0098d4);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .lp-sub {
          font-size: clamp(15px, 2vw, 17px); color: #5a7a96;
          max-width: 520px; line-height: 1.6; margin-bottom: 40px;
        }

        /* CTAs */
        .lp-ctas {
          display: flex; flex-wrap: wrap; gap: 12px;
          align-items: center; justify-content: center;
          margin-bottom: 16px;
        }
        .lp-btn-primary {
          display: flex; align-items: center; gap: 8px;
          padding: 15px 28px; border-radius: 12px; border: none; cursor: pointer;
          font-size: 15px; font-weight: 700; font-family: inherit;
          background: linear-gradient(135deg, #00c8e8 0%, #0090c8 100%);
          color: #06101e;
          box-shadow: 0 8px 28px rgba(0,200,232,0.28);
          transition: transform .18s, box-shadow .18s;
        }
        .lp-btn-primary:hover { transform: translateY(-2px); box-shadow: 0 12px 36px rgba(0,200,232,0.36); }

        .lp-btn-secondary {
          display: flex; align-items: center; gap: 8px;
          padding: 14px 24px; border-radius: 12px; cursor: pointer;
          font-size: 15px; font-weight: 500; font-family: inherit;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.12); color: #b8d4e8;
          transition: border-color .18s, background .18s;
        }
        .lp-btn-secondary:hover { border-color: rgba(0,200,232,0.3); background: rgba(0,200,232,0.06); }

        .lp-microcopy {
          font-size: 12px; color: #2a4258;
        }

        /* ── Mockup card ── */
        .lp-mockup {
          margin-top: 48px;
          width: 100%; max-width: 540px;
          background: #0b1929;
          border: 1px solid rgba(0,200,232,0.18);
          border-radius: 14px;
          padding: 20px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,200,232,0.05);
          text-align: left;
          position: relative;
        }
        .lp-mockup__bar {
          position: absolute; top: 0; left: 0; right: 0; height: 2px;
          background: linear-gradient(90deg, #00c8e8, transparent);
          border-radius: 14px 14px 0 0;
        }
        .lp-mockup__header {
          display: flex; justify-content: space-between; align-items: center;
          margin-bottom: 12px; gap: 8px;
        }
        .lp-mockup__equip { font-size: 14px; font-weight: 600; color: #c8dce8; }
        .lp-mockup__score {
          font-size: 12px; font-weight: 700; color: #ff8a9a;
          background: rgba(255,80,100,0.1); border: 1px solid rgba(255,80,100,0.25);
          padding: 3px 8px; border-radius: 6px;
        }
        .lp-mockup__badge {
          display: inline-flex; align-items: center; gap: 5px;
          font-size: 11px; font-weight: 700; letter-spacing: .5px;
          color: #ff8a9a; background: rgba(255,80,100,0.08);
          border: 1px solid rgba(255,80,100,0.22); border-radius: 6px;
          padding: 4px 9px; margin-bottom: 12px;
        }
        .lp-mockup__badge::before { content: '●'; font-size: 8px; }
        .lp-mockup__action {
          font-size: 14px; font-weight: 600; color: #e8f4fc;
          margin-bottom: 14px; line-height: 1.4;
        }
        .lp-mockup__chips {
          display: flex; flex-wrap: wrap; gap: 8px;
        }
        .lp-mockup__chip {
          font-size: 11px; color: #4a6880;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 20px; padding: 4px 10px;
        }

        /* ─────────────────────────────────────
           FEATURES ROW — 3 itens horizontais
        ───────────────────────────────────── */
        .lp-features {
          padding: 0 24px 72px;
          max-width: 880px; margin: 0 auto; width: 100%;
        }
        .lp-features__grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 14px;
        }
        .lp-feat {
          display: flex; align-items: flex-start; gap: 14px;
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 12px; padding: 18px;
          transition: border-color .2s;
        }
        .lp-feat:hover { border-color: rgba(0,200,232,0.2); }
        .lp-feat__icon {
          width: 38px; height: 38px; border-radius: 9px; flex-shrink: 0;
          background: rgba(0,200,232,0.07); border: 1px solid rgba(0,200,232,0.12);
          display: flex; align-items: center; justify-content: center; font-size: 18px;
        }
        .lp-feat__title { font-size: 14px; font-weight: 600; color: #c8dce8; margin-bottom: 4px; }
        .lp-feat__desc { font-size: 12px; color: #3a5870; line-height: 1.5; }

        /* ─────────────────────────────────────
           HOW IT WORKS — passos numerados
        ───────────────────────────────────── */
        .lp-how {
          padding: 0 24px 72px;
          max-width: 880px; margin: 0 auto; width: 100%;
        }
        .lp-section-label {
          font-size: 11px; font-weight: 700; letter-spacing: 1px; color: #00c8e8;
          text-transform: uppercase; margin-bottom: 24px; text-align: center;
        }
        .lp-how__steps {
          display: grid; gap: 2px;
        }
        .lp-step {
          display: flex; align-items: flex-start; gap: 16px;
          padding: 20px;
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.06);
          transition: border-color .2s;
        }
        .lp-step:first-child { border-radius: 12px 12px 0 0; }
        .lp-step:last-child  { border-radius: 0 0 12px 12px; }
        .lp-step:hover { border-color: rgba(0,200,232,0.18); }
        .lp-step__num {
          width: 30px; height: 30px; flex-shrink: 0;
          background: linear-gradient(135deg, #00c8e8, #0090c8);
          color: #06101e; font-size: 13px; font-weight: 800;
          border-radius: 50%; display: flex; align-items: center; justify-content: center;
        }
        .lp-step__title { font-size: 14px; font-weight: 600; color: #c8dce8; margin-bottom: 4px; }
        .lp-step__desc { font-size: 13px; color: #3a5870; line-height: 1.5; }

        /* ─────────────────────────────────────
           FINAL CTA SECTION
        ───────────────────────────────────── */
        .lp-final {
          padding: 0 24px 72px;
          max-width: 880px; margin: 0 auto; width: 100%;
        }
        .lp-final__card {
          background: linear-gradient(135deg, rgba(0,200,232,0.07), rgba(0,200,232,0.02));
          border: 1px solid rgba(0,200,232,0.18);
          border-radius: 16px; padding: 40px 32px;
          text-align: center;
        }
        .lp-final__title {
          font-size: 22px; font-weight: 700; color: #f0f8ff;
          margin-bottom: 10px; letter-spacing: -.3px;
        }
        .lp-final__sub { font-size: 14px; color: #4a6880; margin-bottom: 28px; }
        .lp-final__ctas {
          display: flex; flex-wrap: wrap; gap: 12px;
          justify-content: center;
        }

        /* ─────────────────────────────────────
           STICKY MOBILE CTA
        ───────────────────────────────────── */
        .lp-sticky {
          position: fixed; bottom: 0; left: 0; right: 0; z-index: 80;
          padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
          background: rgba(6,12,22,0.96); backdrop-filter: blur(10px);
          border-top: 1px solid rgba(255,255,255,0.06);
        }
        .lp-sticky .lp-btn-primary {
          width: 100%; justify-content: center;
        }

        @media (min-width: 1024px) {
          .lp-sticky { display: none; }
          .lp-hero { padding: 80px 24px 80px; }
        }
      </style>

      <div class="lp">

        <!-- ── TOPBAR ── -->
        <header class="lp-topbar">
          <div class="lp-brand">
            <div class="lp-brand__icon">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="1" y="1" width="14" height="14" rx="2" stroke="#00C8E8" stroke-width="1.2"/>
                <circle cx="8" cy="8" r="2.5" stroke="#00C8E8" stroke-width="1.2"/>
                <path d="M8 1v2.5M8 12.5V15M1 8h2.5M12.5 8H15" stroke="#00C8E8" stroke-width="1.2" stroke-linecap="round"/>
              </svg>
            </div>
            <span class="lp-brand__name">CoolTrack</span>
            <span class="lp-brand__badge">PRO</span>
          </div>
          <button class="lp-nav-btn" type="button" data-action="login">
            <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
            </svg>
            Entrar
          </button>
        </header>

        <!-- ── HERO ── -->
        <section class="lp-hero">
          <span class="lp-kicker">Para técnicos de climatização</span>

          <h1 class="lp-h1">
            Chega de manutenção<br><em>no papel e no achismo.</em>
          </h1>
          <p class="lp-sub">
            Registre serviços em campo, gere relatórios PDF com assinatura e nunca perca uma preventiva. Tudo no celular, funciona sem internet.
          </p>

          <div class="lp-ctas">
            <button class="lp-btn-primary" type="button" data-action="start-trial">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
              Testar agora — grátis
            </button>
            <button class="lp-btn-secondary" type="button" data-action="login">
              <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
                <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
              </svg>
              Entrar com Google
            </button>
          </div>
          <p class="lp-microcopy">Sem cadastro &bull; Sem cartão de crédito &bull; Comece em segundos</p>

          <!-- Product mockup -->
          <div class="lp-mockup">
            <div class="lp-mockup__bar"></div>
            <div class="lp-mockup__header">
              <span class="lp-mockup__equip">Hospital Central — Chiller 02</span>
              <span class="lp-mockup__score">Risco: 87</span>
            </div>
            <span class="lp-mockup__badge">ALERTA CRÍTICO</span>
            <p class="lp-mockup__action">⚡ Ação sugerida: Inspecionar compressor e registrar corretiva imediata</p>
            <div class="lp-mockup__chips">
              <span class="lp-mockup__chip">Prioridade: Máxima</span>
              <span class="lp-mockup__chip">Último serviço: 18 dias</span>
              <span class="lp-mockup__chip">3 ocorrências este mês</span>
            </div>
          </div>
        </section>

        <!-- ── FEATURES ── -->
        <section class="lp-features">
          <div class="lp-features__grid">
            <div class="lp-feat">
              <div class="lp-feat__icon">📋</div>
              <div>
                <div class="lp-feat__title">Relatório PDF em 1 toque</div>
                <div class="lp-feat__desc">Laudo profissional pronto para enviar pelo WhatsApp, com fotos e assinatura do cliente.</div>
              </div>
            </div>
            <div class="lp-feat">
              <div class="lp-feat__icon">🧊</div>
              <div>
                <div class="lp-feat__title">Histórico de cada equipamento</div>
                <div class="lp-feat__desc">Todas as manutenções, peças e anomalias organizadas por unidade atendida.</div>
              </div>
            </div>
            <div class="lp-feat">
              <div class="lp-feat__icon">🚨</div>
              <div>
                <div class="lp-feat__title">Alertas de preventivas</div>
                <div class="lp-feat__desc">O sistema avisa o que está vencido ou perto do prazo — sem planilha, sem achismo.</div>
              </div>
            </div>
          </div>
        </section>

        <!-- ── HOW IT WORKS ── -->
        <section class="lp-how">
          <p class="lp-section-label">Como funciona</p>
          <div class="lp-how__steps">
            <div class="lp-step">
              <div class="lp-step__num">1</div>
              <div>
                <div class="lp-step__title">Chegou no equipamento?</div>
                <div class="lp-step__desc">Abra o CoolTrack, selecione o equipamento e veja o histórico completo na tela.</div>
              </div>
            </div>
            <div class="lp-step">
              <div class="lp-step__num">2</div>
              <div>
                <div class="lp-step__title">Registre o serviço</div>
                <div class="lp-step__desc">Descrição, fotos, peças trocadas e assinatura — tudo em menos de 2 minutos.</div>
              </div>
            </div>
            <div class="lp-step">
              <div class="lp-step__num">3</div>
              <div>
                <div class="lp-step__title">Gere o PDF e envie</div>
                <div class="lp-step__desc">Um toque gera o laudo com sua marca. Envie pelo WhatsApp direto para o cliente.</div>
              </div>
            </div>
          </div>
        </section>

        <!-- ── FINAL CTA ── -->
        <section class="lp-final">
          <div class="lp-final__card">
            <div class="lp-final__title">Pronto para organizar seus atendimentos?</div>
            <div class="lp-final__sub">Comece agora. Leva menos de 30 segundos, sem cartão.</div>
            <div class="lp-final__ctas">
              <button class="lp-btn-primary" type="button" data-action="start-trial">
                Testar grátis agora
              </button>
              <button class="lp-btn-secondary" type="button" data-action="login">
                Já tenho conta
              </button>
            </div>
          </div>
        </section>

      </div><!-- /.lp -->

      <!-- ── STICKY MOBILE ── -->
      <div class="lp-sticky">
        <button class="lp-btn-primary" type="button" data-action="start-trial">
          Testar agora — grátis, sem cadastro
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

    app
      .querySelectorAll('[data-action="start-trial"]')
      .forEach((btn) => btn.addEventListener('click', startTrialHandler));

    app
      .querySelectorAll('[data-action="login"]')
      .forEach((btn) => btn.addEventListener('click', loginHandler));
  },

  clear() {
    const app = document.getElementById('app');
    app?.classList.remove('landing-active');
  },
};
