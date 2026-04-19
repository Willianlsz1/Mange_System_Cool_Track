import { buildLandingHtml } from './landingPage/template.js';
import { landingPageStyles } from './landingPage/styles.js';

export const LandingPage = {
  render({ onStartTrial, onLogin } = {}) {
    const app = document.getElementById('app');
    if (!app) return;

    app.classList.add('landing-active');
    app.innerHTML = `<style>${landingPageStyles}</style>${buildLandingHtml()}`;

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
