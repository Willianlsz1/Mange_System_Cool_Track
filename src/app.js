import { getState, seedIfEmpty, setState } from './core/state.js';
import { bindEvents }                      from './core/events.js';
import { Modal }                           from './core/modal.js';
import { goTo, initHistory }               from './core/router.js';
import { initController }                  from './ui/controller.js';
import { initAppShell }                    from './ui/shell.js';
import { FirstTimeExperience }             from './ui/components/onboarding.js';
import { Auth }                            from './core/auth.js';
import { AuthScreen }                      from './ui/components/authscreen.js';
import { Storage }                         from './core/storage.js';
import { Tour }                            from './ui/components/tour.js';

{
  const p = new URLSearchParams(window.location.search);
  if (p.has('p')) {
    history.replaceState(null, '', `${window.location.pathname}${window.location.hash || ''}`);
  }
}

async function bootstrap() {
  initAppShell();
  await Auth.tryHandlePasswordRecovery();

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
  initHistory();
  goTo('inicio', {}, { replaceHistory: true });

  const { equipamentos } = getState();
  setTimeout(() => FirstTimeExperience.show(equipamentos), 300);
  Tour.initIfFirstVisit();
}

bootstrap();
