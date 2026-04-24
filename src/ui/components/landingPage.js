import { buildLandingHtml } from './landingPage/template.js';
import './landingPage/styles.css';
import { trackEvent } from '../../core/telemetry.js';

export const LandingPage = {
  render({ onStartTrial, onLogin } = {}) {
    const app = document.getElementById('app');
    if (!app) return;

    app.classList.add('landing-active');
    app.innerHTML = buildLandingHtml();

    // Telemetria — emite lp_view uma vez por render pra ter o denominador
    // do funil (visualizações → CTA → trial started → conversão).
    trackEvent('lp_view', {});

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

    // Pricing toggle (mensal ↔ anual) — alterna visibilidade dos blocos de preço.
    const pricingToggleBtns = app.querySelectorAll('#lp-pricing-toggle .lp-pricing-toggle__btn');
    if (pricingToggleBtns.length) {
      pricingToggleBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
          const billing = btn.dataset.billing;
          const showAnnual = billing === 'annual';

          pricingToggleBtns.forEach((b) => {
            const isActive = b === btn;
            b.classList.toggle('lp-pricing-toggle__btn--active', isActive);
            b.setAttribute('aria-pressed', String(isActive));
          });

          app.querySelectorAll('[data-price-monthly]').forEach((el) => {
            el.hidden = showAnnual;
          });
          app.querySelectorAll('[data-price-annual]').forEach((el) => {
            el.hidden = !showAnnual;
          });

          trackEvent('lp_pricing_toggle', { billing });
        });
      });
    }

    // "Testar no próximo serviço" leva pro cadastro real (tab signup).
    // O antigo modo guest (dados mockados) foi removido — o técnico cria
    // conta e já usa o app real no próximo atendimento.
    const startTrialHandler =
      onStartTrial ||
      (() => {
        import('./authscreen.js').then(({ AuthScreen }) =>
          AuthScreen.show({ initialTab: 'signup' }),
        );
      });

    const loginHandler =
      onLogin ||
      (() => {
        import('./authscreen.js').then(({ AuthScreen }) => AuthScreen.show());
      });

    // Handlers com telemetria — lp_cta_click é emitido ANTES de delegar pro
    // handler real, pra capturar o source mesmo que o handler faça reload/nav.
    app.querySelectorAll('[data-action="start-trial"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        trackEvent('lp_cta_click', {
          action: 'start-trial',
          source: btn.dataset.source || 'unknown',
        });
        startTrialHandler();
      });
    });

    app.querySelectorAll('[data-action="login"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        trackEvent('lp_cta_click', {
          action: 'login',
          source: btn.dataset.source || 'unknown',
        });
        loginHandler();
      });
    });

    // FAQ — emite lp_faq_open quando uma pergunta é expandida. O evento 'toggle'
    // dispara tanto no abrir quanto no fechar; filtramos por details.open.
    app.querySelectorAll('.lp-faq__item').forEach((details) => {
      details.addEventListener('toggle', () => {
        if (!details.open) return;
        trackEvent('lp_faq_open', {
          question: details.dataset.question || 'unknown',
        });
      });
    });

    // Smooth scroll em anchors internos (#lp-pricing-title, #lp-faq-title do footer).
    // Respeita prefers-reduced-motion — usuários com motion reduzido recebem scroll
    // instantâneo. Move foco pro target após scroll (a11y), sem disparar jump extra.
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    app.querySelectorAll('a[href^="#"]').forEach((anchor) => {
      anchor.addEventListener('click', (event) => {
        const href = anchor.getAttribute('href');
        if (!href || href === '#') return;
        const target = app.querySelector(href);
        if (!target) return;

        event.preventDefault();
        target.scrollIntoView({
          behavior: prefersReducedMotion ? 'auto' : 'smooth',
          block: 'start',
        });

        // Foco pro destino sem rolar de novo.
        if (!target.hasAttribute('tabindex')) {
          target.setAttribute('tabindex', '-1');
        }
        target.focus({ preventScroll: true });

        trackEvent('lp_anchor_click', { anchor: href });
      });
    });
  },

  clear() {
    const app = document.getElementById('app');
    app?.classList.remove('landing-active');
  },
};
