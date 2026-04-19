/**
 * CoolTrack Pro - LandingPage / styles
 * CSS embutido da landing page (namespace .lp-*). Exportado como template
 * string para ser injetado dentro de <style> pelo orquestrador.
 *
 * V2Refined — herdando signature moments do AccountModal:
 *   1. DUAL ORB nos cards (gold top-left + cyan bottom-right)
 *   2. GRAD WORD (cyan→gold) numa palavra do h1 e do final CTA
 *   3. FILLED CHIPS com check-circle inline
 *   4. CTA primary com bolt + sombra cyan projetada
 *   5. Mini cyan orb por phone frame na gallery
 */

export const landingPageStyles = `
  /* ── Reset de qualquer overflow herdado ── */
  body { overflow-x: hidden; }

  /* ── LANDING ROOT ── */
  .lp {
    font-family: var(--font, system-ui, sans-serif);
    background: #07111f;
    color: #e8f2fa;
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
    background: rgba(7,17,31,0.9);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border-bottom: 1px solid rgba(255,255,255,0.06);
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
    font-size: 16px; font-weight: 700; color: #e8f2fa; letter-spacing: -.2px;
  }
  .lp-brand__badge {
    font-size: 9px; font-weight: 700; color: #00c8e8; letter-spacing: 1px;
    background: rgba(0,200,232,0.12); border: 1px solid rgba(0,200,232,0.28);
    padding: 2px 5px; border-radius: 4px;
  }
  .lp-nav-btn {
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 8px; padding: 8px 16px;
    color: #8aaac8; font-size: 13px; font-weight: 500;
    font-family: inherit; cursor: pointer;
    transition: border-color .18s, background .18s, color .18s;
    display: flex; align-items: center; gap: 6px;
  }
  .lp-nav-btn:hover { border-color: rgba(0,200,232,0.35); background: rgba(0,200,232,0.06); color: #00c8e8; }

  /* ─────────────────────────────────────
     HERO
  ───────────────────────────────────── */
  .lp-hero {
    flex: 1;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    text-align: center;
    padding: 64px 24px 72px;
    position: relative; overflow: hidden;
  }
  /* Glow orb atmosférico de fundo da página (single, sutil) */
  .lp-hero::before {
    content: '';
    position: absolute; top: -120px; left: 50%; transform: translateX(-50%);
    width: 600px; height: 600px; border-radius: 50%;
    background: radial-gradient(circle, rgba(0,200,232,0.07) 0%, transparent 65%);
    pointer-events: none;
    z-index: 0;
  }
  .lp-hero > * { position: relative; z-index: 1; }

  .lp-kicker {
    display: inline-flex; align-items: center; gap: 8px;
    font-size: 11px; font-weight: 700; letter-spacing: .8px; text-transform: uppercase;
    color: #00c8e8; background: rgba(0,200,232,0.08);
    border: 1px solid rgba(0,200,232,0.22); border-radius: 999px;
    padding: 6px 12px; margin-bottom: 28px;
  }
  .lp-kicker__dot {
    width: 7px; height: 7px; border-radius: 999px; background: #00c8e8;
    box-shadow: 0 0 10px #00c8e8;
    animation: lp-pulse 1.8s ease-in-out infinite;
  }
  @keyframes lp-pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%      { opacity: .45; transform: scale(.82); }
  }

  .lp-h1 {
    font-size: clamp(2rem, 5.5vw, 3.4rem);
    font-weight: 800; line-height: 1.08; letter-spacing: -0.02em;
    color: #f0f8ff; margin: 0 0 20px; max-width: 780px;
    text-wrap: balance;
  }
  /* SIGNATURE MOMENT 2 — uma palavra com fill gradiente cyan→gold. */
  .lp-grad {
    background: linear-gradient(135deg, #00c8e8 0%, #e8b94a 100%);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    background-clip: text; color: transparent;
  }

  .lp-sub {
    font-size: clamp(15px, 2vw, 17px); color: #8aaac8;
    max-width: 520px; line-height: 1.6; margin: 0 0 32px;
    text-wrap: pretty;
  }

  /* CTAs */
  .lp-ctas {
    display: flex; flex-wrap: wrap; gap: 12px;
    align-items: center; justify-content: center;
    margin-bottom: 16px;
  }
  /* SIGNATURE MOMENT 4 — bolt + sombra projetada (DNA do AccountModal upgrade btn). */
  .lp-btn-primary {
    display: inline-flex; align-items: center; justify-content: center; gap: 10px;
    padding: 0 28px; height: 52px;
    border-radius: 12px; border: none; cursor: pointer;
    font-size: 15px; font-weight: 700; font-family: inherit;
    letter-spacing: -0.01em;
    background: linear-gradient(135deg, #00c8e8 0%, #0090c8 100%);
    color: #06101e;
    box-shadow:
      0 8px 28px rgba(0,200,232,0.35),
      inset 0 0 0 1px rgba(0,200,232,0.2);
    transition: transform .18s, box-shadow .18s;
  }
  .lp-btn-primary:hover {
    transform: translateY(-2px);
    box-shadow:
      0 12px 36px rgba(0,200,232,0.45),
      inset 0 0 0 1px rgba(0,200,232,0.25);
  }
  .lp-btn-primary svg {
    flex-shrink: 0;
  }

  .lp-btn-secondary {
    display: inline-flex; align-items: center; justify-content: center; gap: 10px;
    padding: 0 24px; height: 48px;
    border-radius: 12px; cursor: pointer;
    font-size: 15px; font-weight: 500; font-family: inherit;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.12); color: #e8f2fa;
    transition: border-color .18s, background .18s;
  }
  .lp-btn-secondary:hover { border-color: rgba(0,200,232,0.3); background: rgba(0,200,232,0.06); }

  .lp-microcopy {
    font-size: 12.5px; color: #6a8ba8; font-weight: 500;
    margin: 0;
  }

  /* ─────────────────────────────────────
     HERO MOCKUP CARD — SIGNATURE MOMENT 1 (DUAL ORB gold+cyan)
  ───────────────────────────────────── */
  .lp-mockup {
    position: relative; overflow: hidden;
    margin-top: 44px;
    width: 100%; max-width: 360px;
    background: #0b1929;
    border: 1px solid rgba(0,200,232,0.18);
    border-radius: 14px;
    padding: 20px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,200,232,0.05);
    text-align: left;
  }
  /* Dual orb: orb1 gold top-left, orb2 cyan bottom-right. */
  .lp-mockup::before,
  .lp-mockup::after {
    content: '';
    position: absolute;
    border-radius: 50%;
    pointer-events: none;
    z-index: 0;
  }
  .lp-mockup::before {
    top: -40px; left: -40px;
    width: 220px; height: 220px;
    background: radial-gradient(circle, rgba(232,185,74,0.35), transparent 70%);
    filter: blur(60px);
  }
  .lp-mockup::after {
    bottom: -60px; right: -60px;
    width: 260px; height: 260px;
    background: radial-gradient(circle, rgba(0,200,232,0.45), transparent 70%);
    filter: blur(70px);
  }
  .lp-mockup__bar {
    position: absolute; top: 0; left: 0; right: 0; height: 2px;
    background: linear-gradient(90deg, #00c8e8, transparent);
    border-radius: 14px 14px 0 0;
    z-index: 1;
  }
  .lp-mockup > *:not(.lp-mockup__bar):not(::before):not(::after) {
    position: relative;
    z-index: 1;
  }
  .lp-mockup__header {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 16px; gap: 8px;
  }
  .lp-mockup__equip { font-size: 13px; font-weight: 600; color: #e8f2fa; }
  .lp-mockup__unit  { font-size: 11px; font-weight: 500; color: #6a8ba8; }

  /* Score disk — o "87" gigante em red */
  .lp-mockup__score {
    display: flex; flex-direction: column; align-items: center;
    padding: 12px 0 16px;
  }
  .lp-mockup__disk {
    width: 92px; height: 92px; border-radius: 50%;
    border: 6px solid #ff5577; background: #07111f;
    display: grid; place-items: center;
    box-shadow:
      0 0 40px rgba(255,85,119,0.25),
      inset 0 0 20px rgba(255,85,119,0.08);
  }
  .lp-mockup__disk span {
    color: #ff5577; font-size: 32px; font-weight: 800; letter-spacing: -.5px;
    font-variant-numeric: tabular-nums;
  }
  .lp-mockup__badge {
    margin-top: 10px;
    display: inline-flex; align-items: center; gap: 6px;
    color: #ff5577; font-size: 11px; font-weight: 700; letter-spacing: .5px;
    text-transform: uppercase;
  }

  /* SIGNATURE MOMENT 3 — chips filled com check-circle inline */
  .lp-mockup__chips {
    display: flex; flex-direction: column; align-items: flex-start;
    gap: 8px; margin-top: 4px;
  }
  .lp-chip {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 6px 10px 6px 8px;
    border-radius: 999px;
    background: rgba(0,200,232,0.12);
    border: 1px solid rgba(0,200,232,0.25);
    color: #00c8e8;
    font-size: 11px; font-weight: 600; letter-spacing: .5px;
    text-transform: uppercase;
  }
  .lp-chip svg { flex-shrink: 0; }

  /* ─────────────────────────────────────
     SCREENSHOT GALLERY — Play Store style
  ───────────────────────────────────── */
  .lp-gallery {
    padding: 0 0 56px;
    overflow: hidden;
  }
  .lp-gallery__head {
    padding: 0 24px 28px;
    max-width: 880px; margin: 0 auto;
    display: flex; align-items: flex-end; justify-content: space-between;
    gap: 12px;
  }
  .lp-section-label {
    font-size: 11px; font-weight: 700; letter-spacing: .8px; color: #00c8e8;
    text-transform: uppercase; margin: 0 0 10px;
  }
  .lp-gallery__title {
    font-size: 22px; font-weight: 700; color: #f0f8ff; letter-spacing: -0.01em;
    margin: 0;
    text-wrap: balance;
  }
  .lp-gallery__hint {
    font-size: 12px; color: #6a8ba8; white-space: nowrap;
    display: inline-flex; align-items: center; gap: 4px;
  }
  .lp-gallery__track {
    display: flex;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    -webkit-overflow-scrolling: touch;
    gap: 18px;
    padding: 4px 24px 20px;
    scrollbar-width: none;
  }
  .lp-gallery__track::-webkit-scrollbar { display: none; }

  /* Phone card — SIGNATURE MOMENT 5 (mini cyan orb bottom-right). */
  .lp-screen {
    position: relative;
    flex-shrink: 0;
    width: 200px;
    scroll-snap-align: center;
    border-radius: 22px;
    border: 1.5px solid rgba(0,200,232,0.18);
    background: #080f1c;
    box-shadow: 0 30px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(0,200,232,0.06);
    overflow: hidden;
  }
  .lp-screen::before {
    content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
    background: linear-gradient(90deg, #00c8e8, transparent);
    z-index: 2;
  }
  .lp-screen::after {
    content: '';
    position: absolute;
    bottom: -40px; right: -40px;
    width: 160px; height: 160px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(0,200,232,0.25), transparent 70%);
    filter: blur(50px);
    pointer-events: none;
    z-index: 0;
  }
  /* phone status bar */
  .lp-screen__status {
    position: relative; z-index: 1;
    display: flex; align-items: center; justify-content: space-between;
    padding: 8px 12px 4px;
    font-size: 8px; color: #6a8ba8; font-weight: 600;
    background: #07111f;
    border-bottom: 1px solid rgba(255,255,255,0.04);
  }
  .lp-screen__header {
    position: relative; z-index: 1;
    padding: 10px 12px 8px;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    background: #0a1525;
  }
  .lp-screen__header-label {
    font-size: 9px; font-weight: 700; letter-spacing: .8px;
    color: #00c8e8; text-transform: uppercase; margin-bottom: 2px;
  }
  .lp-screen__header-title {
    font-size: 13px; font-weight: 700; color: #e8f2fa;
  }
  .lp-screen__body {
    position: relative; z-index: 1;
    padding: 10px 10px;
    display: flex; flex-direction: column; gap: 6px;
    min-height: 280px;
  }
  /* equipment row card */
  .lp-sc-row {
    background: rgba(0,200,232,0.05);
    border: 1px solid rgba(0,200,232,0.10);
    border-radius: 8px; padding: 7px 8px;
    display: flex; align-items: center; gap: 7px;
  }
  .lp-sc-dot {
    width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0;
  }
  .lp-sc-dot--ok     { background: #00c870; box-shadow: 0 0 4px rgba(0,200,112,.5); }
  .lp-sc-dot--warn   { background: #e8b94a; box-shadow: 0 0 4px rgba(232,185,74,.5); }
  .lp-sc-dot--danger { background: #ff5577; box-shadow: 0 0 4px rgba(255,85,119,.5); }
  .lp-sc-row__info { flex: 1; min-width: 0; }
  .lp-sc-row__name { font-size: 10px; font-weight: 600; color: #e8f2fa; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .lp-sc-row__sub  { font-size: 8px; color: #6a8ba8; margin-top: 1px; }
  .lp-sc-badge {
    font-size: 8px; font-weight: 700; border-radius: 4px; padding: 2px 5px; flex-shrink: 0;
  }
  .lp-sc-badge--ok     { color: #00c870; background: rgba(0,200,112,.1); border: 1px solid rgba(0,200,112,.2); }
  .lp-sc-badge--warn   { color: #e8b94a; background: rgba(232,185,74,.12); border: 1px solid rgba(232,185,74,.22); }
  .lp-sc-badge--danger { color: #ff5577; background: rgba(255,85,119,.12); border: 1px solid rgba(255,85,119,.22); }
  /* small section label inside screen */
  .lp-sc-section {
    font-size: 8px; font-weight: 700; letter-spacing: .7px; color: #6a8ba8;
    text-transform: uppercase; margin: 2px 0 0 2px;
    display: inline-flex; align-items: center; gap: 4px;
  }
  /* stat tiles */
  .lp-sc-tiles {
    display: grid; grid-template-columns: 1fr 1fr; gap: 5px;
  }
  .lp-sc-tile {
    background: rgba(0,200,232,0.05);
    border: 1px solid rgba(0,200,232,0.10);
    border-radius: 7px; padding: 7px 7px;
    text-align: center;
  }
  .lp-sc-tile__val { font-size: 18px; font-weight: 800; line-height: 1; }
  .lp-sc-tile__lbl { font-size: 7.5px; color: #6a8ba8; margin-top: 2px; }
  /* form fields */
  .lp-sc-field {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 6px; padding: 6px 8px;
  }
  .lp-sc-field__label { font-size: 7.5px; color: #6a8ba8; margin-bottom: 2px; font-weight: 600; letter-spacing: .3px; text-transform: uppercase; }
  .lp-sc-field__value { font-size: 10px; color: #8aaac8; }
  .lp-sc-field--filled .lp-sc-field__value { color: #e8f2fa; }
  /* alert card */
  .lp-sc-alert {
    border-radius: 8px; padding: 8px 8px; border-left: 3px solid;
    background: rgba(255,255,255,0.025);
    border-color: transparent;
  }
  .lp-sc-alert--danger { border-color: #ff5577; }
  .lp-sc-alert--warn   { border-color: #e8b94a; }
  .lp-sc-alert__title { font-size: 10px; font-weight: 700; margin-bottom: 2px; }
  .lp-sc-alert--danger .lp-sc-alert__title { color: #ff5577; }
  .lp-sc-alert--warn   .lp-sc-alert__title { color: #e8b94a; }
  .lp-sc-alert__sub { font-size: 8px; color: #6a8ba8; }
  /* pdf preview mockup */
  .lp-sc-pdf {
    background: #0f1e30; border: 1px solid rgba(255,255,255,0.06); border-radius: 6px; padding: 8px 8px;
  }
  .lp-sc-pdf__bar { height: 2px; background: linear-gradient(90deg, #00c8e8, transparent); margin-bottom: 6px; border-radius: 1px; }
  .lp-sc-pdf__title { font-size: 11px; font-weight: 800; color: #e8f2fa; margin-bottom: 1px; }
  .lp-sc-pdf__sub   { font-size: 7.5px; color: #6a8ba8; margin-bottom: 8px; }
  .lp-sc-pdf__grid  { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-bottom: 6px; }
  .lp-sc-pdf__stat  { background: rgba(255,255,255,0.03); border-radius: 4px; padding: 4px 5px; text-align: center; }
  .lp-sc-pdf__stat-val { font-size: 14px; font-weight: 800; }
  .lp-sc-pdf__stat-lbl { font-size: 7px; color: #6a8ba8; }
  .lp-sc-pdf__line  { height: 1px; background: rgba(255,255,255,0.06); margin: 4px 0; }
  .lp-sc-pdf__row   { display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px; }
  .lp-sc-pdf__row-label { font-size: 8px; color: #6a8ba8; }
  .lp-sc-pdf__row-val   { font-size: 8px; font-weight: 600; color: #e8f2fa; }
  /* fab-style button */
  .lp-sc-fab {
    margin: 6px 0 0;
    background: linear-gradient(135deg, #00c8e8, #0090c8);
    color: #06101e; font-size: 10px; font-weight: 700;
    border-radius: 8px; padding: 8px; text-align: center;
    border: none; width: 100%;
    display: inline-flex; align-items: center; justify-content: center; gap: 5px;
    font-family: inherit; cursor: pointer;
  }
  /* gallery scroll dots */
  .lp-gallery__dots {
    display: flex; gap: 6px; justify-content: center; padding-top: 4px;
  }
  .lp-gallery__dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: rgba(255,255,255,0.12);
    transition: background .2s, width .2s;
  }
  .lp-gallery__dot:first-child { background: #00c8e8; width: 18px; border-radius: 3px; }

  /* ─────────────────────────────────────
     SOCIAL PROOF STRIP
  ───────────────────────────────────── */
  .lp-social {
    display: flex; flex-wrap: wrap; justify-content: center; align-items: center;
    gap: 14px;
    padding: 28px 20px;
    color: #8aaac8; font-size: 13.5px; font-weight: 500;
    max-width: 880px; margin: 0 auto;
  }
  .lp-social__num {
    color: #e8f2fa; font-weight: 700; font-variant-numeric: tabular-nums;
    font-size: 15px;
  }
  .lp-social__sep {
    width: 6px; height: 6px; border-radius: 999px;
    background: #00c8e8; opacity: .85;
    flex-shrink: 0;
  }
  .lp-social__item {
    display: inline-flex; align-items: center; gap: 6px;
  }
  .lp-social__icon { color: #00c8e8; flex-shrink: 0; }

  /* ─────────────────────────────────────
     FINAL CTA — SIGNATURE MOMENT 1 (dual orb cyan+cyan) + 2 (grad word)
  ───────────────────────────────────── */
  .lp-final {
    padding: 8px 24px 72px;
    max-width: 880px; margin: 0 auto; width: 100%;
  }
  .lp-final__card {
    position: relative; overflow: hidden;
    background: linear-gradient(135deg, rgba(0,200,232,0.08), rgba(0,200,232,0.02));
    border: 1px solid rgba(0,200,232,0.18);
    border-radius: 16px; padding: 40px 32px;
    text-align: center;
    max-width: 720px; margin: 0 auto;
  }
  .lp-final__card::before,
  .lp-final__card::after {
    content: ''; position: absolute; border-radius: 50%;
    pointer-events: none; z-index: 0;
  }
  .lp-final__card::before {
    top: -80px; left: -80px;
    width: 280px; height: 280px;
    background: radial-gradient(circle, rgba(0,200,232,0.30), transparent 70%);
    filter: blur(80px);
  }
  .lp-final__card::after {
    bottom: -80px; right: -80px;
    width: 320px; height: 320px;
    background: radial-gradient(circle, rgba(0,200,232,0.40), transparent 70%);
    filter: blur(90px);
  }
  .lp-final__title,
  .lp-final__sub,
  .lp-final__ctas { position: relative; z-index: 1; }

  .lp-final__title {
    font-size: 26px; font-weight: 700; color: #f0f8ff;
    margin: 0 0 10px; letter-spacing: -0.01em;
    line-height: 1.2; text-wrap: balance;
  }
  .lp-final__sub {
    font-size: 15px; color: #8aaac8; margin: 0 0 24px;
    line-height: 1.6; text-wrap: balance;
  }
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
    background: rgba(7,17,31,0.96); backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border-top: 1px solid rgba(255,255,255,0.06);
  }
  .lp-sticky .lp-btn-primary {
    width: 100%;
  }

  /* ─────────────────────────────────────
     RESPONSIVE
  ───────────────────────────────────── */
  @media (max-width: 540px) {
    .lp-topbar { padding: 14px 16px; }
    .lp-hero { padding: 40px 16px 56px; }
    .lp-h1 {
      font-size: clamp(1.85rem, 9vw, 2.4rem);
      overflow-wrap: break-word;
      max-width: 320px;
    }
    .lp-h1 br { display: none; }
    .lp-sub { font-size: 14px; padding: 0 4px; }
    .lp-mockup { padding: 16px; margin-top: 32px; }
    .lp-ctas { flex-direction: column; width: 100%; gap: 10px; }
    .lp-ctas .lp-btn-primary,
    .lp-ctas .lp-btn-secondary { width: 100%; }
    .lp-final__card { padding: 28px 20px; }
    .lp-final__title { font-size: 22px; }
    .lp-final__ctas { flex-direction: column; width: 100%; }
    .lp-final__ctas .lp-btn-primary,
    .lp-final__ctas .lp-btn-secondary { width: 100%; }
    .lp-gallery__head { flex-direction: column; align-items: flex-start; gap: 8px; }
    .lp-gallery__hint { align-self: flex-end; }
    /* Reserva espaço pra sticky mobile CTA */
    .lp { padding-bottom: 84px; }
  }

  @media (min-width: 541px) and (max-width: 1023px) {
    .lp-hero { padding: 56px 32px 64px; }
    .lp { padding-bottom: 84px; }
  }

  @media (min-width: 1024px) {
    .lp-sticky { display: none; }
    .lp-hero { padding: 80px 24px 80px; }
    .lp-gallery__track { padding-left: calc((100vw - 1040px) / 2); padding-right: calc((100vw - 1040px) / 2); }
    .lp-gallery__hint { display: none; }
    .lp-screen { width: 220px; }
  }
`;
