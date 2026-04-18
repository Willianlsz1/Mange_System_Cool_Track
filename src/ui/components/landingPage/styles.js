/**
 * CoolTrack Pro - LandingPage / styles
 * CSS embutido da landing page (namespace .lp-*). Exportado como template
 * string para ser injetado dentro de <style> pelo orquestrador.
 */

export const landingPageStyles = `
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
`;
