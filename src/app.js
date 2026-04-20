import { getState, seedIfEmpty, setState } from './core/state.js';
import { bindEvents } from './core/events.js';
import { Modal } from './core/modal.js';
import { goTo, initHistory } from './core/router.js';
import { initController } from './ui/controller.js';
import { initAppShell } from './ui/shell.js';
import { FirstTimeExperience } from './ui/components/onboarding.js';
import { Auth } from './core/auth.js';
import { AuthScreen } from './ui/components/authscreen.js';
import { PasswordRecoveryModal } from './ui/components/passwordRecoveryModal.js';
import { Storage } from './core/storage.js';
import { Tour } from './ui/components/tour.js';
import { ErrorCodes, handleError } from './core/errors.js';
import { Toast } from './core/toast.js';
import { sanitizeSessionForCurrentProject, fetchMyProfileBilling } from './core/monetization.js';
// DevPlanToggle: dynamic-imported abaixo apenas em ambiente de dev.
// Em produção, Vite faz tree-shake do módulo inteiro (≈9 KB + 492 LoC).
import { DevPlanOverride } from './core/devPlanOverride.js';
import { setCachedPlan } from './core/planCache.js';
import { getEffectivePlan } from './core/subscriptionPlans.js';
import { supabase } from './core/supabase.js';
import { initTelemetrySink } from './core/telemetrySink.js';
import { initObservability, setUser as setObservabilityUser } from './core/observability.js';
import { initSwUpdate } from './core/swUpdate.js';

const POST_AUTH_REDIRECT_KEY = 'cooltrack-post-auth-redirect';

{
  const p = new URLSearchParams(window.location.search);
  if (p.has('p')) {
    history.replaceState(null, '', `${window.location.pathname}${window.location.hash || ''}`);
  }
}

async function bootstrap() {
  try {
    // Se o SW foi registrado em index.html antes do bootstrap, liga o fluxo
    // de update (banner "Nova versão disponível"). Em dev ou sem SW não há
    // registration e esta chamada é no-op.
    if (typeof window !== 'undefined') {
      const existingReg = window.__cooltrackSwRegistration;
      if (existingReg) {
        initSwUpdate(existingReg);
      } else if ('serviceWorker' in navigator) {
        // Fallback: se a registration ainda não chegou (race condition entre
        // o script inline e o module bootstrap), aguarda e tenta novamente.
        navigator.serviceWorker
          .getRegistration()
          .then((reg) => reg && initSwUpdate(reg))
          .catch(() => {
            /* sem SW registrado — OK, seguimos sem update flow */
          });
      }
    }

    // Observability (Sentry) — lazy-inicializado se VITE_SENTRY_DSN estiver
    // setado. Fire-and-forget: se falhar ou DSN estiver ausente, no-op
    // silencioso. Precisa rodar ANTES do telemetrySink pra que breadcrumbs
    // do fluxo de auth já entrem no contexto.
    initObservability().catch(() => {
      // initObservability() já é defensivo; essa linha cobre edge cases
      // onde o import falha antes de entrarmos no try/catch interno.
    });

    // Liga o user_id do Supabase ao Sentry quando a sessão muda. Só passa
    // o UUID — nada de email/nome (config sendDefaultPii=false + filtro
    // em observability.setUser).
    try {
      supabase.auth.onAuthStateChange((_event, session) => {
        setObservabilityUser(session?.user ? { id: session.user.id } : null);
      });
    } catch {
      // no-op: observability nunca pode quebrar boot
    }

    // Inicializa sink de telemetria cedo — antes de LandingPage.render() pra
    // garantir que lp_view e lp_cta_click cheguem na fila.
    // getUserId usa getSession() (lê do localStorage, sem round-trip) pra não
    // adicionar latência a cada flush — getUser() iria ao server toda vez.
    initTelemetrySink({
      supabaseClient: supabase,
      getUserId: async () => {
        try {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          return session?.user?.id || null;
        } catch {
          return null;
        }
      },
    });

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
      // Code-split: carrega landingPage (JS + CSS ~48KB) só pra quem não tá logado.
      // Usuário logado / guest pula esse chunk inteiro.
      const { LandingPage } = await import('./ui/components/landingPage.js');
      LandingPage.render({ onLogin: () => AuthScreen.show() });
      return;
    }

    Auth.onAuthChange((nextUser) => {
      if (nextUser) localStorage.removeItem('cooltrack-guest-mode');
    });

    // Inline do LandingPage.clear() pra evitar baixar o chunk da landing quando
    // o usuário já tá logado.
    document.getElementById('app')?.classList.remove('landing-active');
    initAppShell();

    if (!isGuest) {
      const cloudState = await Storage.loadFromSupabase();
      if (cloudState) {
        setState(() => cloudState, { persist: false, emit: false });
      } else {
        setState(() => ({ equipamentos: [], registros: [], tecnicos: [], setores: [] }), {
          persist: false,
          emit: false,
        });
      }

      // Monta o painel dev: ativa se is_dev === true no Supabase OU se a flag
      // local 'cooltrack-dev-mode' estiver definida (ativada via console do browser).
      // Em produção (import.meta.env.DEV === false), Vite faz tree-shake do bloco
      // inteiro — o chunk de devPlanToggle nem é emitido no bundle. Isso fecha
      // o vetor de F12 + localStorage que foi identificado na auditoria.
      if (import.meta.env.DEV) {
        const localDevMode = localStorage.getItem('cooltrack-dev-mode') === 'true';
        const mountDevToggle = async () => {
          const { DevPlanToggle } = await import('./ui/components/devPlanToggle.js');
          DevPlanToggle.mount();
        };
        if (localDevMode) {
          await mountDevToggle();
          setCachedPlan(DevPlanOverride.get() || 'pro');
        } else {
          try {
            const { profile } = await fetchMyProfileBilling();
            setCachedPlan(getEffectivePlan(profile));
            if (profile?.is_dev === true) {
              await mountDevToggle();
            }
          } catch {
            // ignora — não bloqueia o boot se o perfil falhar
          }
        }
      } else {
        // Prod: só consulta o plano real (sem nenhum caminho pra dev override).
        try {
          const { profile } = await fetchMyProfileBilling();
          setCachedPlan(getEffectivePlan(profile));
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
