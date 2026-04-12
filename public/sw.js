/**
 * CoolTrack Pro - Service Worker
 * Estratégia: Cache-first para assets estáticos, Network-first para API/Supabase.
 */

const CACHE_NAME = 'cooltrack-pro-v1';
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
  self.skipWaiting();
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

  // Assets estáticos (JS, CSS, imagens): Cache-first
  if (
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/icons/') ||
    request.destination === 'image' ||
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'font'
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            return response;
          }),
      ),
    );
    return;
  }
});
