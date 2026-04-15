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

        @media (max-width: 540px) {
          .lp-h1 {
            font-size: 1.7rem;
            overflow-wrap: break-word;
            word-break: break-word;
          }
          /* Remove o <br> decorativo para deixar o título fluir naturalmente em telas pequenas */
          .lp-h1 br { display: none; }
          .lp-hero { padding: 48px 16px 72px; }
          .lp-sub { font-size: 14px; padding: 0 4px; }
          .lp-mockup { padding: 16px; }
        }

        /* ─────────────────────────────────────
           SCREENSHOT GALLERY — Play Store style
        ───────────────────────────────────── */
        .lp-gallery {
          padding: 0 0 72px;
          overflow: hidden;
        }
        .lp-gallery__head {
          padding: 0 24px 28px;
          max-width: 880px; margin: 0 auto;
          display: flex; align-items: flex-end; justify-content: space-between;
          gap: 12px;
        }
        .lp-gallery__title {
          font-size: 18px; font-weight: 700; color: #e8f4fc; letter-spacing: -.2px;
        }
        .lp-gallery__hint {
          font-size: 12px; color: #2a4258; white-space: nowrap;
          display: flex; align-items: center; gap: 4px;
        }
        .lp-gallery__track {
          display: flex;
          overflow-x: auto;
          scroll-snap-type: x mandatory;
          -webkit-overflow-scrolling: touch;
          gap: 14px;
          padding: 4px 24px 20px;
          scrollbar-width: none;
        }
        .lp-gallery__track::-webkit-scrollbar { display: none; }
        .lp-screen {
          flex-shrink: 0;
          width: 195px;
          scroll-snap-align: start;
          border-radius: 22px;
          border: 1.5px solid rgba(0,200,232,0.16);
          background: #080f1c;
          box-shadow: 0 12px 40px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04);
          overflow: hidden;
          position: relative;
        }
        /* phone status bar */
        .lp-screen__status {
          display: flex; align-items: center; justify-content: space-between;
          padding: 8px 12px 4px;
          font-size: 8px; color: #3a5870; font-weight: 600;
          background: #060c16;
          border-bottom: 1px solid rgba(255,255,255,0.04);
        }
        /* top accent line */
        .lp-screen::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
          background: linear-gradient(90deg, #00c8e8, transparent);
        }
        /* screen app header */
        .lp-screen__header {
          padding: 10px 12px 8px;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          background: #0a1525;
        }
        .lp-screen__header-label {
          font-size: 9px; font-weight: 700; letter-spacing: .8px;
          color: #00c8e8; text-transform: uppercase; margin-bottom: 2px;
        }
        .lp-screen__header-title {
          font-size: 13px; font-weight: 700; color: #d8eaf6;
        }
        /* screen body */
        .lp-screen__body {
          padding: 10px 10px;
          display: flex; flex-direction: column; gap: 6px;
          min-height: 280px;
        }
        /* equipment row card */
        .lp-sc-row {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 8px; padding: 7px 8px;
          display: flex; align-items: center; gap: 7px;
        }
        .lp-sc-dot {
          width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0;
        }
        .lp-sc-dot--ok     { background: #00c870; box-shadow: 0 0 4px rgba(0,200,112,.5); }
        .lp-sc-dot--warn   { background: #e8a020; box-shadow: 0 0 4px rgba(232,160,32,.5); }
        .lp-sc-dot--danger { background: #e03040; box-shadow: 0 0 4px rgba(224,48,64,.5); }
        .lp-sc-row__info { flex: 1; min-width: 0; }
        .lp-sc-row__name { font-size: 10px; font-weight: 600; color: #c8dce8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .lp-sc-row__sub  { font-size: 8px; color: #2a4258; margin-top: 1px; }
        .lp-sc-badge {
          font-size: 8px; font-weight: 700; border-radius: 4px; padding: 2px 5px; flex-shrink: 0;
        }
        .lp-sc-badge--ok     { color: #00c870; background: rgba(0,200,112,.1); border: 1px solid rgba(0,200,112,.2); }
        .lp-sc-badge--warn   { color: #e8a020; background: rgba(232,160,32,.1); border: 1px solid rgba(232,160,32,.2); }
        .lp-sc-badge--danger { color: #e03040; background: rgba(224,48,64,.1); border: 1px solid rgba(224,48,64,.2); }
        /* small section label inside screen */
        .lp-sc-section {
          font-size: 8px; font-weight: 700; letter-spacing: .7px; color: #1e3a52;
          text-transform: uppercase; margin: 2px 0 0 2px;
        }
        /* stat tiles */
        .lp-sc-tiles {
          display: grid; grid-template-columns: 1fr 1fr; gap: 5px;
        }
        .lp-sc-tile {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 7px; padding: 7px 7px;
          text-align: center;
        }
        .lp-sc-tile__val { font-size: 18px; font-weight: 800; line-height: 1; }
        .lp-sc-tile__lbl { font-size: 7.5px; color: #2a4258; margin-top: 2px; }
        /* form fields */
        .lp-sc-field {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 6px; padding: 6px 8px;
        }
        .lp-sc-field__label { font-size: 7.5px; color: #1e3a52; margin-bottom: 2px; font-weight: 600; letter-spacing: .3px; text-transform: uppercase; }
        .lp-sc-field__value { font-size: 10px; color: #8aaac8; }
        .lp-sc-field--filled .lp-sc-field__value { color: #c8dce8; }
        /* alert card */
        .lp-sc-alert {
          border-radius: 8px; padding: 8px 8px; border-left: 3px solid;
          background: rgba(255,255,255,0.025);
          border-color: transparent;
        }
        .lp-sc-alert--danger { border-color: #e03040; }
        .lp-sc-alert--warn   { border-color: #e8a020; }
        .lp-sc-alert__title { font-size: 10px; font-weight: 700; margin-bottom: 2px; }
        .lp-sc-alert--danger .lp-sc-alert__title { color: #ff6070; }
        .lp-sc-alert--warn   .lp-sc-alert__title { color: #e8a020; }
        .lp-sc-alert__sub { font-size: 8px; color: #2a4258; }
        /* pdf preview mockup */
        .lp-sc-pdf {
          background: #0f1e30; border: 1px solid rgba(255,255,255,0.06); border-radius: 6px; padding: 8px 8px;
        }
        .lp-sc-pdf__bar { height: 2px; background: linear-gradient(90deg, #00c8e8, transparent); margin-bottom: 6px; border-radius: 1px; }
        .lp-sc-pdf__title { font-size: 11px; font-weight: 800; color: #d8eaf6; margin-bottom: 1px; }
        .lp-sc-pdf__sub   { font-size: 7.5px; color: #1e3a52; margin-bottom: 8px; }
        .lp-sc-pdf__grid  { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-bottom: 6px; }
        .lp-sc-pdf__stat  { background: rgba(255,255,255,0.03); border-radius: 4px; padding: 4px 5px; text-align: center; }
        .lp-sc-pdf__stat-val { font-size: 14px; font-weight: 800; }
        .lp-sc-pdf__stat-lbl { font-size: 7px; color: #1e3a52; }
        .lp-sc-pdf__line  { height: 1px; background: rgba(255,255,255,0.06); margin: 4px 0; }
        .lp-sc-pdf__row   { display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px; }
        .lp-sc-pdf__row-label { font-size: 8px; color: #2a4258; }
        .lp-sc-pdf__row-val   { font-size: 8px; font-weight: 600; color: #8aaac8; }
        /* fab-style button */
        .lp-sc-fab {
          margin: 6px 0 0;
          background: linear-gradient(135deg, #00c8e8, #0090c8);
          color: #06101e; font-size: 10px; font-weight: 700;
          border-radius: 8px; padding: 8px; text-align: center;
          border: none; width: 100%;
        }
        /* gallery scroll dots */
        .lp-gallery__dots {
          display: flex; gap: 6px; justify-content: center; padding-top: 4px;
        }
        .lp-gallery__dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: rgba(255,255,255,0.1);
          transition: background .2s, width .2s;
        }
        .lp-gallery__dot:first-child { background: #00c8e8; width: 18px; border-radius: 3px; }

        @media (min-width: 1024px) {
          .lp-sticky { display: none; }
          .lp-hero { padding: 80px 24px 80px; }
          .lp-gallery__track { padding-left: calc((100vw - 880px) / 2); padding-right: calc((100vw - 880px) / 2); }
          .lp-gallery__hint { display: none; }
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

        <!-- ── SCREENSHOT GALLERY ── -->
        <section class="lp-gallery">
          <div class="lp-gallery__head">
            <div>
              <p class="lp-section-label" style="margin-bottom:8px">Veja o app em ação</p>
              <h2 class="lp-gallery__title">Feito para o campo,<br>do celular ao laudo.</h2>
            </div>
            <span class="lp-gallery__hint">Deslize ›</span>
          </div>

          <div class="lp-gallery__track" id="lp-gallery-track">

            <!-- 1 · Painel Geral -->
            <div class="lp-screen">
              <div class="lp-screen__status">
                <span>9:41</span>
                <span>▮▮▮ ◀</span>
              </div>
              <div class="lp-screen__header">
                <div class="lp-screen__header-label">CoolTrack PRO</div>
                <div class="lp-screen__header-title">Painel Geral</div>
              </div>
              <div class="lp-screen__body">
                <div class="lp-sc-tiles">
                  <div class="lp-sc-tile">
                    <div class="lp-sc-tile__val" style="color:#d8eaf6">8</div>
                    <div class="lp-sc-tile__lbl">Equipamentos</div>
                  </div>
                  <div class="lp-sc-tile">
                    <div class="lp-sc-tile__val" style="color:#e03040">2</div>
                    <div class="lp-sc-tile__lbl">Atenção</div>
                  </div>
                  <div class="lp-sc-tile">
                    <div class="lp-sc-tile__val" style="color:#00c870">5</div>
                    <div class="lp-sc-tile__lbl">Operando</div>
                  </div>
                  <div class="lp-sc-tile">
                    <div class="lp-sc-tile__val" style="color:#e8a020">1</div>
                    <div class="lp-sc-tile__lbl">Preventiva</div>
                  </div>
                </div>
                <div class="lp-sc-section">Equipamentos</div>
                <div class="lp-sc-row">
                  <div class="lp-sc-dot lp-sc-dot--danger"></div>
                  <div class="lp-sc-row__info">
                    <div class="lp-sc-row__name">Chiller 02 — Hospital</div>
                    <div class="lp-sc-row__sub">Risco 87 · Serviço há 18d</div>
                  </div>
                  <span class="lp-sc-badge lp-sc-badge--danger">CRÍTICO</span>
                </div>
                <div class="lp-sc-row">
                  <div class="lp-sc-dot lp-sc-dot--warn"></div>
                  <div class="lp-sc-row__info">
                    <div class="lp-sc-row__name">Fan Coil — Sala VIP</div>
                    <div class="lp-sc-row__sub">Risco 52 · Preventiva em 5d</div>
                  </div>
                  <span class="lp-sc-badge lp-sc-badge--warn">ATENÇÃO</span>
                </div>
                <div class="lp-sc-row">
                  <div class="lp-sc-dot lp-sc-dot--ok"></div>
                  <div class="lp-sc-row__info">
                    <div class="lp-sc-row__name">Split — Recepção</div>
                    <div class="lp-sc-row__sub">Risco 12 · Serviço há 3d</div>
                  </div>
                  <span class="lp-sc-badge lp-sc-badge--ok">OK</span>
                </div>
              </div>
            </div>

            <!-- 2 · Detalhes do Equipamento -->
            <div class="lp-screen">
              <div class="lp-screen__status">
                <span>9:41</span>
                <span>▮▮▮ ◀</span>
              </div>
              <div class="lp-screen__header">
                <div class="lp-screen__header-label">Equipamento</div>
                <div class="lp-screen__header-title">Chiller 02</div>
              </div>
              <div class="lp-screen__body">
                <div class="lp-sc-alert lp-sc-alert--danger">
                  <div class="lp-sc-alert__title">⚡ Ação recomendada</div>
                  <div class="lp-sc-alert__sub">Inspecionar compressor — corretiva urgente</div>
                </div>
                <div class="lp-sc-tiles" style="grid-template-columns:1fr 1fr 1fr; gap:4px">
                  <div class="lp-sc-tile">
                    <div class="lp-sc-tile__val" style="color:#e03040;font-size:14px">87</div>
                    <div class="lp-sc-tile__lbl">Risco</div>
                  </div>
                  <div class="lp-sc-tile">
                    <div class="lp-sc-tile__val" style="color:#d8eaf6;font-size:14px">18</div>
                    <div class="lp-sc-tile__lbl">Dias</div>
                  </div>
                  <div class="lp-sc-tile">
                    <div class="lp-sc-tile__val" style="color:#e8a020;font-size:14px">3</div>
                    <div class="lp-sc-tile__lbl">Ocorr.</div>
                  </div>
                </div>
                <div class="lp-sc-section">Histórico recente</div>
                <div class="lp-sc-row">
                  <div class="lp-sc-dot lp-sc-dot--danger"></div>
                  <div class="lp-sc-row__info">
                    <div class="lp-sc-row__name">Manutenção Corretiva</div>
                    <div class="lp-sc-row__sub">15 abr 2026 · João Silva</div>
                  </div>
                </div>
                <div class="lp-sc-row">
                  <div class="lp-sc-dot lp-sc-dot--ok"></div>
                  <div class="lp-sc-row__info">
                    <div class="lp-sc-row__name">Preventiva Mensal</div>
                    <div class="lp-sc-row__sub">27 mar 2026 · João Silva</div>
                  </div>
                </div>
                <div class="lp-sc-row">
                  <div class="lp-sc-dot lp-sc-dot--ok"></div>
                  <div class="lp-sc-row__info">
                    <div class="lp-sc-row__name">Troca de Filtros</div>
                    <div class="lp-sc-row__sub">10 mar 2026 · João Silva</div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 3 · Novo Registro de Serviço -->
            <div class="lp-screen">
              <div class="lp-screen__status">
                <span>9:41</span>
                <span>▮▮▮ ◀</span>
              </div>
              <div class="lp-screen__header">
                <div class="lp-screen__header-label">Novo Serviço</div>
                <div class="lp-screen__header-title">Registrar atendimento</div>
              </div>
              <div class="lp-screen__body">
                <div class="lp-sc-field lp-sc-field--filled">
                  <div class="lp-sc-field__label">Equipamento</div>
                  <div class="lp-sc-field__value">Chiller 02 — Hospital Central</div>
                </div>
                <div class="lp-sc-field lp-sc-field--filled">
                  <div class="lp-sc-field__label">Tipo de serviço</div>
                  <div class="lp-sc-field__value">Manutenção Corretiva</div>
                </div>
                <div class="lp-sc-field lp-sc-field--filled" style="min-height:52px">
                  <div class="lp-sc-field__label">Observações</div>
                  <div class="lp-sc-field__value" style="line-height:1.4">Substituído capacitor do compressor. Verificado nível de gás R-410A...</div>
                </div>
                <div class="lp-sc-field lp-sc-field--filled">
                  <div class="lp-sc-field__label">Peças utilizadas</div>
                  <div class="lp-sc-field__value">Capacitor 45µF CBB65</div>
                </div>
                <div style="display:flex;gap:5px">
                  <div class="lp-sc-field" style="flex:1">
                    <div class="lp-sc-field__label">Custo peças</div>
                    <div class="lp-sc-field__value">R$ 85,00</div>
                  </div>
                  <div class="lp-sc-field" style="flex:1">
                    <div class="lp-sc-field__label">Mão de obra</div>
                    <div class="lp-sc-field__value">R$ 120,00</div>
                  </div>
                </div>
                <div style="display:flex;align-items:center;gap:6px;padding:4px 0">
                  <div style="width:28px;height:28px;background:rgba(0,200,232,.1);border:1px solid rgba(0,200,232,.2);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:14px">📷</div>
                  <div style="font-size:9px;color:#2a4258">2 fotos anexadas</div>
                </div>
              </div>
            </div>

            <!-- 4 · Alertas e Pendências -->
            <div class="lp-screen">
              <div class="lp-screen__status">
                <span>9:41</span>
                <span>▮▮▮ ◀</span>
              </div>
              <div class="lp-screen__header">
                <div class="lp-screen__header-label">CoolTrack PRO</div>
                <div class="lp-screen__header-title">Alertas</div>
              </div>
              <div class="lp-screen__body">
                <div class="lp-sc-section" style="color:#e03040">🔴 Intervenção imediata</div>
                <div class="lp-sc-alert lp-sc-alert--danger">
                  <div class="lp-sc-alert__title">Chiller 02 — Hospital</div>
                  <div class="lp-sc-alert__sub">Risco 87 · Compressor com falha</div>
                </div>
                <div class="lp-sc-alert lp-sc-alert--danger">
                  <div class="lp-sc-alert__title">VRF Bloco B — Andar 3</div>
                  <div class="lp-sc-alert__sub">Risco 74 · Sem serviço há 45 dias</div>
                </div>
                <div class="lp-sc-section" style="color:#e8a020;margin-top:4px">🟡 Preventivas próximas</div>
                <div class="lp-sc-alert lp-sc-alert--warn">
                  <div class="lp-sc-alert__title">Fan Coil — Sala VIP</div>
                  <div class="lp-sc-alert__sub">Preventiva recomendada até 19/04</div>
                </div>
                <div class="lp-sc-alert lp-sc-alert--warn">
                  <div class="lp-sc-alert__title">Split — Diretoria</div>
                  <div class="lp-sc-alert__sub">Preventiva recomendada até 22/04</div>
                </div>
                <div class="lp-sc-alert lp-sc-alert--warn">
                  <div class="lp-sc-alert__title">Condensadora — Cobertura</div>
                  <div class="lp-sc-alert__sub">Limpeza de filtros vencida</div>
                </div>
              </div>
            </div>

            <!-- 5 · Relatório PDF gerado -->
            <div class="lp-screen">
              <div class="lp-screen__status">
                <span>9:41</span>
                <span>▮▮▮ ◀</span>
              </div>
              <div class="lp-screen__header">
                <div class="lp-screen__header-label">Exportar</div>
                <div class="lp-screen__header-title">Relatório PDF</div>
              </div>
              <div class="lp-screen__body">
                <div class="lp-sc-pdf">
                  <div class="lp-sc-pdf__bar"></div>
                  <div class="lp-sc-pdf__title">COOLTRACK<span style="color:#00c8e8">PRO</span></div>
                  <div class="lp-sc-pdf__sub">Relatório de Serviços · Abr 2026</div>
                  <div class="lp-sc-pdf__grid">
                    <div class="lp-sc-pdf__stat">
                      <div class="lp-sc-pdf__stat-val" style="color:#d8eaf6">12</div>
                      <div class="lp-sc-pdf__stat-lbl">Serviços</div>
                    </div>
                    <div class="lp-sc-pdf__stat">
                      <div class="lp-sc-pdf__stat-val" style="color:#00c870">9</div>
                      <div class="lp-sc-pdf__stat-lbl">Operando</div>
                    </div>
                    <div class="lp-sc-pdf__stat">
                      <div class="lp-sc-pdf__stat-val" style="color:#e8a020">2</div>
                      <div class="lp-sc-pdf__stat-lbl">Atenção</div>
                    </div>
                    <div class="lp-sc-pdf__stat">
                      <div class="lp-sc-pdf__stat-val" style="color:#e03040">1</div>
                      <div class="lp-sc-pdf__stat-lbl">Crítico</div>
                    </div>
                  </div>
                  <div class="lp-sc-pdf__line"></div>
                  <div class="lp-sc-pdf__row">
                    <span class="lp-sc-pdf__row-label">Técnico</span>
                    <span class="lp-sc-pdf__row-val">João Silva</span>
                  </div>
                  <div class="lp-sc-pdf__row">
                    <span class="lp-sc-pdf__row-label">Empresa</span>
                    <span class="lp-sc-pdf__row-val">ClimaTech HVAC</span>
                  </div>
                  <div class="lp-sc-pdf__row">
                    <span class="lp-sc-pdf__row-label">Custo total</span>
                    <span class="lp-sc-pdf__row-val" style="color:#00c870">R$ 1.840,00</span>
                  </div>
                </div>
                <button class="lp-sc-fab">📤 Enviar pelo WhatsApp</button>
                <div style="text-align:center;font-size:8px;color:#1e3a52;margin-top:4px">PDF gerado em 1 toque</div>
              </div>
            </div>

          </div><!-- /.lp-gallery__track -->

          <div class="lp-gallery__dots" id="lp-gallery-dots">
            <div class="lp-gallery__dot"></div>
            <div class="lp-gallery__dot"></div>
            <div class="lp-gallery__dot"></div>
            <div class="lp-gallery__dot"></div>
            <div class="lp-gallery__dot"></div>
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

    // Gallery scroll → dots
    const galleryTrack = app.querySelector('#lp-gallery-track');
    const galleryDots = app.querySelectorAll('#lp-gallery-dots .lp-gallery__dot');
    if (galleryTrack && galleryDots.length) {
      galleryTrack.addEventListener(
        'scroll',
        () => {
          const cardW = galleryTrack.firstElementChild?.offsetWidth || 195;
          const gap = 14;
          const index = Math.round(galleryTrack.scrollLeft / (cardW + gap));
          galleryDots.forEach((dot, i) => {
            dot.style.background = i === index ? '#00c8e8' : 'rgba(255,255,255,0.1)';
            dot.style.width = i === index ? '18px' : '6px';
            dot.style.borderRadius = i === index ? '3px' : '50%';
          });
        },
        { passive: true },
      );
    }

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
