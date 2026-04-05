import { getState, seedIfEmpty, setState } from './core/state.js';
import { bindEvents }                      from './core/events.js';
import { Modal }                           from './core/modal.js';
import { goTo }                            from './core/router.js';
import { initController }                  from './ui/controller.js';
import { FirstTimeExperience }             from './ui/components/onboarding.js';
import { Auth }                            from './core/auth.js';
import { AuthScreen }                      from './ui/components/authscreen.js';
import { Storage }                         from './core/storage.js';

async function bootstrap() {
  const isGuest = localStorage.getItem('cooltrack-guest-mode') === '1';
  const user    = await Auth.getUser();

  if (!user && !isGuest) {
    AuthScreen.show();
    return;
  }

  // Carrega dados do Supabase se logado, localStorage se guest
  if (!isGuest) {
    const cloudState = await Storage.loadFromSupabase();
    if (cloudState) {
      setState(() => cloudState, { persist: false, emit: false });
    }
  } else {
    seedIfEmpty();
  }

  Modal.init();
  bindEvents();
  initController();
  goTo('inicio');

  const { equipamentos } = getState();
  setTimeout(() => FirstTimeExperience.show(equipamentos), 300);
}

bootstrap();