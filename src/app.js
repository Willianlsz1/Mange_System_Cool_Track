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
import { Toast } from './core/toast.js';
import { sanitizeSessionForCurrentProject, fetchMyProfileBilling } from './core/monetization.js';
import { DevPlanToggle } from './ui/components/devPlanToggle.js';
import { DevPlanOverride } from './core/devPlanOverride.js';
import { setCachedPlan } from './core/planCache.js';
import { getEffectivePlan } from './core/subscriptionPlans.js';

const POST_AUTH_REDIRECT_KEY = 'cooltrack-post-auth-redirect';

{
  const p = new URLSearchParams(window.location.search);
  if (p.has('p')) {
    history.replaceState(null, '', `${window.location.pathname}${window.location.hash || ''}`);
  }
}

async function bootstrap() {
  try {
    try {
      await sanitizeSessionForCurrentProject();
    } catch (sessionError) {
      Toast.warning(sessionError?.message || 'Sessão inválida. Faça login novamente.');
    }

    await Auth.tryHandlePasswordRecovery(() => PasswordRecoveryModal.openPasswordRecoveryModal());

    let isGuest = localStorage.getItem('cooltrack-guest-mode') === '1';
    const user = await Auth.getUser();
    Auth.finalizeOAuthRedirect(user);

    if (user && isGuest) {
      // Limpa todos os dados de demo do localStorage antes de carregar do Supabase.
      // Sem isso, migrateIfNeeded() veria dados no cooltrack_v3 e os enviaria para a conta real.
      const GUEST_DATA_KEYS = [
        'cooltrack_v3',
        'cooltrack-sync-dirty-v1',
        'cooltrack-sync-deletions-v1',
        'cooltrack-cache-owner-v1',
      ];
      GUEST_DATA_KEYS.forEach((k) => localStorage.removeItem(k));
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

      // Monta o painel dev: ativa se is_dev === true no Supabase OU se a flag
      // local 'cooltrack-dev-mode' estiver definida (ativada via console do browser).
      const localDevMode = localStorage.getItem('cooltrack-dev-mode') === 'true';
      if (localDevMode) {
        DevPlanToggle.mount();
        setCachedPlan(DevPlanOverride.get() || 'pro');
      } else {
        try {
          const { profile } = await fetchMyProfileBilling();
          setCachedPlan(getEffectivePlan(profile));
          if (profile?.is_dev === true) {
            DevPlanToggle.mount();
          }
        } catch {
          // ignora — não bloqueia o boot se o perfil falhar
        }
      }
    } else {
      seedIfEmpty();
    }

    Modal.init();
    bindEvents();
    initController();
    initHistory();
    goTo('inicio', {}, { replaceHistory: true });

    const pendingRedirectRaw = localStorage.getItem(POST_AUTH_REDIRECT_KEY);
    if (pendingRedirectRaw) {
      localStorage.removeItem(POST_AUTH_REDIRECT_KEY);
      try {
        const pendingRedirect = JSON.parse(pendingRedirectRaw);
        if (pendingRedirect?.route) {
          goTo(pendingRedirect.route, pendingRedirect.params || {});
        }
      } catch (_error) {
        // ignore malformed redirect payload
      }
    }

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
