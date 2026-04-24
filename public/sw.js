/**
 * CoolTrack Pro - Service Worker
 * Estratégia: Cache-first para assets estáticos, Network-first para API/Supabase.
 *
 * Fluxo de atualização: o SW NÃO chama skipWaiting() automaticamente —
 * entra em estado "waiting" até o cliente postar a mensagem SKIP_WAITING
 * (tipicamente após o usuário confirmar "Nova versão disponível").
 * Isso evita mismatch entre o JS rodando no tab e os chunks no cache.
 */

const CACHE_NAME = 'cooltrack-pro-v8';
const OFFLINE_PAGE = '/offline.html';

// Assets que sempre ficam em cache
const PRECACHE_ASSETS = ['/', '/index.html', OFFLINE_PAGE];

// Origens que nunca devem ser cacheadas (Supabase, fontes externas etc.)
const NETWORK_ONLY_ORIGINS = ['supabase.co', 'fonts.googleapis.com', 'fonts.gstatic.com'];

// ──────────────────────────────────────────────
// Install: pré-carrega assets essenciais
// ──────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch(() => {
        // Ignora erros de precache em dev (arquivo offline.html pode não existir ainda)
      });
    }),
  );
  // NÃO chama skipWaiting() aqui — aguarda confirmação do cliente via
  // postMessage({ type: 'SKIP_WAITING' }) para permitir UX de "Recarregar
  // para atualizar".
});

// Permite o cliente forçar a ativação da nova versão quando o usuário
// aceitar o toast/banner de atualização.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ──────────────────────────────────────────────
// Activate: limpa caches antigos
// ──────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      ),
  );
  self.clients.claim();
});

// ──────────────────────────────────────────────
// Fetch: estratégia por tipo de request
// ──────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignora requests não-GET
  if (request.method !== 'GET') return;

  // Ignora origens externas que precisam de rede (Supabase, fontes)
  const isNetworkOnly = NETWORK_ONLY_ORIGINS.some((origin) => url.hostname.includes(origin));
  if (isNetworkOnly) return;

  // Ignora extensões de browser
  if (url.protocol === 'chrome-extension:') return;

  // Navegação (HTML): Network-first, fallback para offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match(OFFLINE_PAGE))),
    );
    return;
  }

  // Assets estáticos (JS, CSS, imagens): Stale-while-revalidate
  // Serve do cache imediatamente e atualiza em background — nunca trava em versão antiga
  if (
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/icons/') ||
    request.destination === 'image' ||
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'font'
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(request).then((cached) => {
          const networkFetch = fetch(request).then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          });
          // Retorna cache imediatamente se existir, senão aguarda rede
          return cached || networkFetch;
        }),
      ),
    );
    return;
  }
});
