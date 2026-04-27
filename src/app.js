import { getState, setState } from './core/state.js';
import { bindEvents } from './core/events.js';
import { Modal } from './core/modal.js';
import { goTo, initHistory } from './core/router.js';
import { initController } from './ui/controller.js';
import { initAppShell } from './ui/shell.js';
import { FirstTimeExperience } from './ui/components/onboarding.js';
import { OnboardingChecklist } from './ui/components/onboarding/onboardingChecklist.js';
import { PushOptInCard } from './ui/components/pushOptInCard.js';
import { setupPushNotifications } from './core/pushNotifications.js';
import { InstallAppPrompt, captureInstallEvent } from './ui/components/installAppPrompt.js';

// Capture beforeinstallprompt cedo — antes do user interagir.
captureInstallEvent();
import { Auth } from './core/auth.js';
import { setCurrentUser, migrateLegacyKey } from './core/userStorage.js';
import { AuthScreen } from './ui/components/authscreen.js';
import { PasswordRecoveryModal } from './ui/components/passwordRecoveryModal.js';
import { Storage } from './core/storage.js';
import { Tour } from './ui/components/tour.js';
import { ErrorCodes, handleError } from './core/errors.js';
import { Toast } from './core/toast.js';
import {
  sanitizeSessionForCurrentProject,
  fetchMyProfileBilling,
} from './core/plans/monetization.js';
// DevPlanToggle: dynamic-imported abaixo apenas em ambiente de dev.
// Em produção, Vite faz tree-shake do módulo inteiro (≈9 KB + 492 LoC).
import { DevPlanOverride } from './core/plans/devPlanOverride.js';
import { setCachedPlan } from './core/plans/planCache.js';
import { getEffectivePlan } from './core/plans/subscriptionPlans.js';
import { supabase } from './core/supabase.js';
import { initTelemetrySink } from './core/telemetrySink.js';
import { initObservability, setUser as setObservabilityUser } from './core/observability.js';
import { initSwUpdate } from './core/swUpdate.js';
import { initStaleBundleRecovery } from './core/recoverFromStaleBundle.js';

// Liga listeners globais de recovery de bundle obsoleto ANTES de qualquer
// import() dinamico. Se um chunk falhar ao carregar (deploy novo invalidou
// o hash que o SW tem cacheado), o handler limpa Caches Storage, desregistra
// o SW e recarrega a pagina automaticamente. Idempotente; seguro em SSR.
initStaleBundleRecovery();

const POST_AUTH_REDIRECT_KEY = 'cooltrack-post-auth-redirect';
let _appInitialized = false;
let _authChangeBound = false;

function _emitAuthChanged(user) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('cooltrack:auth-changed', {
      detail: { userId: user?.id || null },
    }),
  );
}

function _setAuthLoading(isLoading) {
  const mount = document.getElementById('app');
  if (!mount) return;
  if (isLoading) {
    mount.dataset.authLoading = '1';
    if (!mount.hasChildNodes()) {
      mount.innerHTML =
        '<div class="app-loading" style="padding:24px;text-align:center">Carregando sessão...</div>';
    }
    return;
  }
  delete mount.dataset.authLoading;
}

async function _enterAuthenticatedApp(user) {
  if (!user || _appInitialized) return;
  _appInitialized = true;

  // Escopo de storage por usuário — chaves subsequentes vão pra
  // `ct:<userId>:<key>`.
  setCurrentUser(user.id);
  _emitAuthChanged(user);

  // Migração incremental (idempotente).
  migrateLegacyKey('cooltrack-last-tecnico');

  // Inline do LandingPage.clear() pra evitar baixar o chunk da landing quando
  // o usuário já tá logado.
  document.getElementById('app')?.classList.remove('landing-active');
  initAppShell();

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
  // inteiro — o chunk de devPlanToggle nem é emitido no bundle.
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

  OnboardingChecklist.init(user?.id || null);
  PushOptInCard.init(user?.id || null);

  if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && user?.id) {
    setupPushNotifications(user.id).catch((err) => {
      console.warn('[boot] setupPushNotifications falhou:', err);
    });
  }
}

{
  const p = new URLSearchParams(window.location.search);
  if (p.has('p')) {
    history.replaceState(null, '', `${window.location.pathname}${window.location.hash || ''}`);
  }
}

// Fase 2 — Assinatura digital de orçamento.
// Se a URL tem ?orc-sign=TOKEN, intercepta ANTES de qualquer auth/landing/SW
// e monta a página standalone de assinatura. O cliente do técnico não precisa
// (e nem pode) ter conta — usa RPCs públicas no Supabase com token UUID.
const _orcSignToken = new URLSearchParams(window.location.search).get('orc-sign');

async function bootstrap() {
  try {
    _setAuthLoading(true);
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

    if (!_authChangeBound) {
      _authChangeBound = true;
      Auth.onAuthChange((nextUser) => {
        setCurrentUser(nextUser?.id || 'anon');
        _emitAuthChanged(nextUser);
        if (nextUser?.id && !_appInitialized) {
          _enterAuthenticatedApp(nextUser).catch((error) => {
            handleError(error, {
              code: ErrorCodes.NETWORK_ERROR,
              message: 'Não foi possível finalizar o login.',
              context: { action: 'bootstrap.authChange' },
            });
          });
        }
      });
    }

    const user = await Auth.getSessionUser();
    Auth.finalizeOAuthRedirect(user);

    // Escopo de storage por usuário — chaves subsequentes vão pra
    // `ct:<userId>:<key>`. Sem usuário, cai em `ct:anon:*`.
    setCurrentUser(user?.id || 'anon');

    if (!user) {
      // Sem usuário autenticado → landing page.
      // Code-split: carrega landingPage (JS + CSS ~48KB) só pra quem não tá logado.
      const { LandingPage } = await import('./ui/components/landingPage.js');
      LandingPage.render({ onLogin: () => AuthScreen.show() });
      _setAuthLoading(false);
      return;
    }
    await _enterAuthenticatedApp(user);
    _setAuthLoading(false);

    // FirstTimeExperience (overlay 2-passos focado em equipamento) e Tour
    // (slide-modal walkthrough) ficam DESATIVADOS pra novos usuários — o
    // OnboardingChecklist cobre a função deles de forma menos intrusiva.
    // Tour continua disponível sob demanda via menu Ajuda.
    //
    // Reativar no futuro só se o checklist se mostrar insuficiente nos
    // dados de telemetria (onboarding_step_completed por etapa).
    //
    // requestAnimationFrame(() => {
    //   const { equipamentos } = getState();
    //   FirstTimeExperience.show(equipamentos, { userId: user?.id || null });
    // });
    // Tour.initIfFirstVisit({ userId: user?.id || null });
  } catch (error) {
    _setAuthLoading(false);
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

// Roteamento de boot: assinatura digital de orçamento OU bootstrap padrão.
// O fluxo de assinatura é totalmente standalone — substitui o body inteiro,
// sem auth/sidebar/SW.
if (_orcSignToken) {
  import('./ui/components/orcamentoSignaturePage.js')
    .then(({ OrcamentoSignaturePage }) => OrcamentoSignaturePage.mount(_orcSignToken))
    .catch((error) => {
      document.body.innerHTML =
        '<div style="padding:40px;text-align:center;font-family:sans-serif;color:#02131f;">' +
        '<h2>Erro ao carregar página de assinatura</h2>' +
        '<p style="color:#647585;">Tente recarregar a página. Se o problema persistir, contate o técnico.</p>' +
        '</div>';
      console.error('[orc-sign] mount failed', error);
    });
} else {
  bootstrap();
}
