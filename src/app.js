import { getState, seedIfEmpty } from './core/state.js';
import { bindEvents }            from './core/events.js';
import { Modal }                 from './core/modal.js';
import { goTo }                  from './core/router.js';
import { initController }        from './ui/controller.js';
import { FirstTimeExperience }   from './ui/components/onboarding.js';
import { Auth }                  from './core/auth.js';
import { AuthScreen }            from './ui/components/authscreen.js';

async function bootstrap() {
  const isGuest = localStorage.getItem('cooltrack-guest-mode') === '1';
  const user    = await Auth.getUser();

  if (!user && !isGuest) {
    AuthScreen.show();
    return;
  }

  Modal.init();
  bindEvents();
  initController();

  if (isGuest) seedIfEmpty();

  goTo('inicio');

  const { equipamentos } = getState();
  setTimeout(() => FirstTimeExperience.show(equipamentos), 300);
}

bootstrap();