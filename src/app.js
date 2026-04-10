import { getState, seedIfEmpty, setState } from './core/state.js';
import { bindEvents } from './core/events.js';
import { Modal } from './core/modal.js';
import { goTo, initHistory } from './core/router.js';
import { initController } from './ui/controller.js';
import { initAppShell } from './ui/shell.js';
import { FirstTimeExperience } from './ui/components/onboarding.js';
import { Auth } from './core/auth.js';
import { AuthScreen } from './ui/components/authscreen.js';
import { LandingPage } from './ui/components/landingPage.js';
import { PasswordRecoveryModal } from './ui/components/passwordRecoveryModal.js';
import { Storage } from './core/storage.js';
import { Tour } from './ui/components/tour.js';
import { ErrorCodes, handleError } from './core/errors.js';

{
  const p = new URLSearchParams(window.location.search);
  if (p.has('p')) {
    history.replaceState(null, '', `${window.location.pathname}${window.location.hash || ''}`);
  }
}

async function bootstrap() {
  try {
    await Auth.tryHandlePasswordRecovery(() => PasswordRecoveryModal.openPasswordRecoveryModal());

    let isGuest = localStorage.getItem('cooltrack-guest-mode') === '1';
    const user = await Auth.getUser();
    Auth.finalizeOAuthRedirect(user);

    if (user && isGuest) {
      localStorage.removeItem('cooltrack-guest-mode');
      isGuest = false;
    }

    if (!user && !isGuest) {
      LandingPage.render({ onLogin: () => AuthScreen.show() });
      return;
    }

    Auth.onAuthChange((nextUser) => {
      if (nextUser) localStorage.removeItem('cooltrack-guest-mode');
    });

    LandingPage.clear();
    initAppShell();

    // Carrega dados do Supabase se logado, localStorage se guest
    if (!isGuest) {
      const cloudState = await Storage.loadFromSupabase();
      if (cloudState) {
        setState(() => cloudState, { persist: false, emit: false });
      } else {
        setState(() => ({ equipamentos: [], registros: [], tecnicos: [] }), {
          persist: false,
          emit: false,
        });
      }
    } else {
      seedIfEmpty();
    }

    Modal.init();
    bindEvents();
    initController();
    initHistory();
    goTo('inicio', {}, { replaceHistory: true });

    requestAnimationFrame(() => {
      const { equipamentos } = getState();
      FirstTimeExperience.show(equipamentos);
    });
    Tour.initIfFirstVisit();
  } catch (error) {
    handleError(error, {
      code: ErrorCodes.NETWORK_ERROR,
      message: 'Falha ao iniciar o aplicativo. Recarregue a página.',
      context: { action: 'bootstrap' },
    });
  }
}

window.onerror = (_message, source, lineno, colno, error) => {
  handleError(error || new Error('Erro global não tratado.'), {
    code: ErrorCodes.NETWORK_ERROR,
    message: 'Ocorreu um erro inesperado na aplicação.',
    context: { source, lineno, colno, channel: 'window.onerror' },
  });
  return false;
};

window.onunhandledrejection = (event) => {
  handleError(event?.reason || new Error('Promessa rejeitada sem tratamento.'), {
    code: ErrorCodes.NETWORK_ERROR,
    message: 'Falha inesperada durante uma operação assíncrona.',
    context: { channel: 'window.onunhandledrejection' },
  });
};

bootstrap();
