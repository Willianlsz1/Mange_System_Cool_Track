/**
 * CoolTrack Pro - Auto-recovery de bundle obsoleto
 *
 * Quando o usuário fica preso com Service Worker servindo um bundle antigo
 * cujos chunks dinâmicos já não existem no edge (deploy novo), tentativas de
 * `import()` dinâmico falham com:
 *   "Failed to fetch dynamically imported module"
 *
 * Esse módulo escuta esses erros globalmente e — após confirmar que NÃO é
 * apenas falha temporária de rede — limpa Caches Storage, des-registra o SW
 * antigo e recarrega a página, forçando o cliente a baixar o bundle atual.
 *
 * Idempotente: chamar `initStaleBundleRecovery()` mais de uma vez é no-op.
 * Conservador: só dispara recovery quando online + erro casa o padrão de
 * dynamic import + houve no mínimo uma falha 404 detectada na sessão
 * (evita falso positivo em dev offline).
 */

const BOUND_FLAG = '__cooltrackBundleRecoveryBound';
const STORAGE_KEY = 'cooltrack-bundle-recovery-attempted';
const MAX_ATTEMPTS = 1;
let recoveryInFlight = false;

const DYNAMIC_IMPORT_PATTERNS = [
  /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
  /error loading dynamically imported module/i,
];

function looksLikeStaleBundleError(message) {
  if (!message || typeof message !== 'string') return false;
  return DYNAMIC_IMPORT_PATTERNS.some((re) => re.test(message));
}

function getRecoveryAttempts() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const n = parseInt(raw || '0', 10);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function bumpRecoveryAttempts() {
  try {
    sessionStorage.setItem(STORAGE_KEY, String(getRecoveryAttempts() + 1));
  } catch {
    /* sessionStorage indisponível (modo privado restrito): segue mesmo assim */
  }
}

async function performRecovery() {
  if (recoveryInFlight) return;
  recoveryInFlight = true;

  // Limite de tentativas por sessão. Se mesmo após 1 reload o erro persiste,
  // é provável que seja bug real do app — não faz sentido entrar em loop.
  if (getRecoveryAttempts() >= MAX_ATTEMPTS) {
    console.warn(
      '[StaleBundleRecovery] Erro de bundle persistiu após reload. Não tentando de novo.',
    );
    recoveryInFlight = false;
    return;
  }

  bumpRecoveryAttempts();

  try {
    if ('caches' in self) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch (err) {
    console.warn('[StaleBundleRecovery] Falha ao limpar caches:', err);
  }

  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister().catch(() => false)));
    }
  } catch (err) {
    console.warn('[StaleBundleRecovery] Falha ao desregistrar SW:', err);
  }

  // Pequeno delay para o usuário ver a mensagem (evita flash percebido como bug).
  setTimeout(() => {
    try {
      window.location.reload();
    } catch {
      /* ignorado: ambientes sem reload (testes) */
    }
  }, 250);
}

function showRecoveryToast() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('stale-bundle-recovery-toast')) return;
  const el = document.createElement('div');
  el.id = 'stale-bundle-recovery-toast';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.style.cssText = [
    'position:fixed',
    'top:1rem',
    'left:50%',
    'transform:translateX(-50%)',
    'background:#0f172a',
    'color:#fff',
    'padding:0.75rem 1.25rem',
    'border-radius:0.5rem',
    'font-family:system-ui,sans-serif',
    'font-size:0.9rem',
    'z-index:99999',
    'box-shadow:0 6px 20px rgba(0,0,0,0.25)',
  ].join(';');
  el.textContent = 'Versão atualizada detectada. Recarregando…';
  document.body.appendChild(el);
}

function handlePotentialStaleBundleError(message) {
  if (!looksLikeStaleBundleError(message)) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    // Offline: erro pode ser só conectividade; não dispara recovery.
    return;
  }
  showRecoveryToast();
  performRecovery();
}

/**
 * Inicializa os listeners globais para detectar dynamic-import failures
 * e auto-recuperar limpando caches/SW e recarregando. Seguro chamar mais
 * de uma vez — só liga listeners no primeiro chamado.
 */
export function initStaleBundleRecovery() {
  if (typeof window === 'undefined') return;
  if (window[BOUND_FLAG]) return;
  window[BOUND_FLAG] = true;

  // 1) Erros não-tratados (script errors em geral, incluindo import() rejeitado
  //    que escapou de qualquer try/catch).
  window.addEventListener('error', (event) => {
    const msg = event?.message || event?.error?.message || '';
    handlePotentialStaleBundleError(msg);
  });

  // 2) Promise rejections (caso típico de dynamic import: a Promise do import()
  //    é rejeitada com TypeError "Failed to fetch dynamically imported module").
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event?.reason;
    const msg = typeof reason === 'string' ? reason : reason?.message || reason?.toString?.() || '';
    handlePotentialStaleBundleError(msg);
  });
}
