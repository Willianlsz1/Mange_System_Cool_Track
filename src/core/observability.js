/**
 * observability — wrapper fino sobre @sentry/browser, gated por
 * VITE_SENTRY_DSN.
 *
 * Filosofia:
 *   - Se DSN não está setado (dev, self-hosted, fork): todas as funções
 *     são no-op. Nada é carregado, bundle não cresce em runtime porque
 *     o import é dinâmico.
 *   - Se DSN está setado: lazy-carrega @sentry/browser, inicializa,
 *     conecta handleError() + trackEvent() como breadcrumbs.
 *   - NUNCA joga: telemetria/observabilidade não pode quebrar o app.
 *
 * Integração:
 *   1. initObservability() é chamado no bootstrap do app.js (fire-and-
 *      forget). Se DSN ausente, retorna imediatamente.
 *   2. handleError() (errors.js) chama captureError() — vira Sentry event.
 *   3. trackEvent() (telemetry.js) chama addBreadcrumb() — vira breadcrumb
 *      no próximo Sentry event, dando contexto do que o user fez antes do
 *      erro.
 *   4. window.onerror e unhandledrejection são capturados pelo init do
 *      SDK Sentry automaticamente, sem precisar fazer nada.
 *
 * Privacidade:
 *   - sendDefaultPii: false (não manda IP, cookies, headers do request).
 *   - setUser() só registra o user_id (uuid Supabase). Nunca email, nome.
 *   - tracesSampleRate: 0 (sem performance tracing — fora de escopo).
 *
 * Instalação:
 *   npm install --save-optional @sentry/browser
 *   # depois definir VITE_SENTRY_DSN no painel da plataforma de deploy.
 */

let sentry = null;
let initialized = false;
let initPromise = null;

/**
 * Lê VITE_SENTRY_DSN via import.meta.env ou process.env (SSR/testes).
 * Retorna string vazia se não está setado (modo no-op).
 */
function getDsn() {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SENTRY_DSN) {
      return String(import.meta.env.VITE_SENTRY_DSN).trim();
    }
  } catch {
    // import.meta não disponível (ambiente exótico)
  }
  try {
    if (typeof process !== 'undefined' && process.env?.VITE_SENTRY_DSN) {
      return String(process.env.VITE_SENTRY_DSN).trim();
    }
  } catch {
    // no-op
  }
  return '';
}

function getEnvName() {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      if (import.meta.env.VITE_SENTRY_ENV) return String(import.meta.env.VITE_SENTRY_ENV);
      if (import.meta.env.MODE) return String(import.meta.env.MODE);
      if (import.meta.env.DEV) return 'development';
      if (import.meta.env.PROD) return 'production';
    }
  } catch {
    // no-op
  }
  return 'production';
}

function getRelease() {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_APP_VERSION) {
      return String(import.meta.env.VITE_APP_VERSION);
    }
  } catch {
    // no-op
  }
  return undefined;
}

/**
 * Inicializa o SDK de observabilidade. Fire-and-forget: retorna uma
 * promise que você pode ignorar. Idempotente — chamar várias vezes é
 * seguro (só inicializa 1x).
 *
 * @param {{ dsn?: string, environment?: string, release?: string }} [config]
 * @returns {Promise<boolean>} true se Sentry foi inicializado, false se no-op.
 */
export async function initObservability(config = {}) {
  if (initialized) return true;
  if (initPromise) return initPromise;

  const dsn = config.dsn || getDsn();
  if (!dsn) {
    initialized = true;
    return false;
  }

  initPromise = (async () => {
    try {
      // Dynamic import: @sentry/browser só entra no bundle quando DSN
      // está setado. Em dev (sem DSN) o chunk nem é baixado.
      //
      // O comentário @vite-ignore instrui o Vite a não tentar resolver
      // o módulo em build/tempo-de-parsing. Isso é necessário porque
      // @sentry/browser é uma optionalDependency — o build pode rodar
      // sem ele instalado (ex.: CI sem Sentry, forks).
      const moduleName = '@sentry/browser';
      const mod = await import(/* @vite-ignore */ moduleName);
      sentry = mod;

      sentry.init({
        dsn,
        environment: config.environment || getEnvName(),
        release: config.release || getRelease(),
        // Nunca manda IP / headers / cookies / body das requests.
        sendDefaultPii: false,
        // Sem performance monitoring por enquanto (tracesSampleRate=0).
        tracesSampleRate: 0,
        // Replay session desligado (também requer configuração extra).
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: 0,
        // Limita profundidade de breadcrumbs pra não vazar muito payload.
        maxBreadcrumbs: 50,
        // Scrub de PII via beforeSend (defensivo, sobre o sendDefaultPii).
        beforeSend(event) {
          if (event.request?.cookies) delete event.request.cookies;
          if (event.user?.email) delete event.user.email;
          if (event.user?.ip_address) delete event.user.ip_address;
          return event;
        },
      });

      initialized = true;
      return true;
    } catch (err) {
      // @sentry/browser não instalado OU init falhou. Silencioso.
      if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
        console.warn('[observability] Sentry init falhou (silenciado):', err?.message || err);
      }
      sentry = null;
      initialized = true; // marca pra não retentar em loop
      return false;
    }
  })();

  return initPromise;
}

/**
 * Captura uma exceção e envia pro Sentry. No-op se observability não
 * está inicializado (DSN ausente).
 *
 * @param {unknown} error — exceção ou AppError
 * @param {{ code?: string, context?: object, severity?: string }} [options]
 */
export function captureError(error, options = {}) {
  if (!sentry || !initialized) return;
  try {
    sentry.captureException(error, {
      level: mapSeverity(options.severity),
      tags: {
        code: options.code || error?.code || 'unknown',
      },
      contexts: {
        app: options.context && typeof options.context === 'object' ? options.context : {},
      },
    });
  } catch {
    // nunca propaga
  }
}

/**
 * Captura uma mensagem arbitrária (ex.: warnings não-exception).
 */
export function captureMessage(message, options = {}) {
  if (!sentry || !initialized) return;
  try {
    sentry.captureMessage(String(message), {
      level: mapSeverity(options.severity) || 'info',
      tags: options.tags || {},
    });
  } catch {
    // no-op
  }
}

/**
 * Adiciona um breadcrumb — vira contexto do próximo erro capturado.
 * Chamado pelo trackEvent() pra ter histórico de ações do usuário
 * antes do erro.
 *
 * @param {{ category?: string, message?: string, data?: object, level?: string }} breadcrumb
 */
export function addBreadcrumb(breadcrumb) {
  if (!sentry || !initialized || !breadcrumb) return;
  try {
    sentry.addBreadcrumb({
      category: String(breadcrumb.category || 'app'),
      message: String(breadcrumb.message || ''),
      data: breadcrumb.data && typeof breadcrumb.data === 'object' ? breadcrumb.data : undefined,
      level: breadcrumb.level || 'info',
      timestamp: Date.now() / 1000,
    });
  } catch {
    // no-op
  }
}

/**
 * Associa eventos à identidade do usuário (só o UUID — nada de email/nome).
 * Passar { id: null } (ou string vazia) limpa.
 */
export function setUser(user) {
  if (!sentry || !initialized) return;
  try {
    if (!user || !user.id) {
      sentry.setUser(null);
      return;
    }
    sentry.setUser({ id: String(user.id) });
  } catch {
    // no-op
  }
}

function mapSeverity(severity) {
  switch (severity) {
    case 'warning':
      return 'warning';
    case 'info':
      return 'info';
    case 'debug':
      return 'debug';
    case 'fatal':
      return 'fatal';
    case 'error':
    default:
      return 'error';
  }
}

/**
 * Reset pra testes. Não faz parte da API pública.
 */
export function __resetObservability() {
  sentry = null;
  initialized = false;
  initPromise = null;
}

/**
 * Exporta estado pra testes.
 */
export const __internal = {
  isInitialized: () => initialized,
  getSentry: () => sentry,
};
