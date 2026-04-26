/**
 * CoolTrack Pro - Service Worker
 * Estratégia: Cache-first para assets estáticos, Network-first para API/Supabase.
 *
 * v10 (force-update): chama self.skipWaiting() automaticamente no install
 * pra desbloquear clientes presos com cache do v9 servindo bundles cujos
 * chunks ja nao existem no edge (sintoma: 404 em /assets/<hash>.js + erro
 * "Failed to fetch dynamically imported module"). A partir do v11 voltar
 * pro fluxo de banner "Nova versao disponivel" controlado pelo cliente.
 */

const CACHE_NAME = 'cooltrack-pro-v11';
const OFFLINE_PAGE = '/offline.html';

// Assets que sempre ficam em cache
const PRECACHE_ASSETS = [OFFLINE_PAGE];

// Origens que nunca devem ser cacheadas (Supabase, fontes externas etc.)
const NETWORK_ONLY_ORIGINS = ['supabase.co', 'fonts.googleapis.com', 'fonts.gstatic.com'];

// Detecta respostas de SPA fallback servindo HTML para URLs de asset/script —
// sintoma típico de hash inválido + rewrite catch-all do Cloudflare/Netlify.
// Cachear isso seria envenenar permanentemente o cache (até bumpar CACHE_NAME).
function isHtmlMasqueradingAsAsset(response, request) {
  if (!response) return false;
  const ct = response.headers.get('content-type') || '';
  if (!ct.includes('text/html')) return false;
  const dest = request.destination;
  return dest === 'script' || dest === 'style' || dest === 'font' || dest === 'image';
}

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
  // v10: skipWaiting() automatico para forcar update dos clientes presos
  // com cache do v9 servindo bundles cujos chunks ja nao existem no edge.
  // A partir do v11+, voltar a aguardar SKIP_WAITING do cliente para
  // preservar a UX do banner "Nova versao disponivel".
  self.skipWaiting();
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

  // Navegação (HTML): Network-only com fallback offline.
  // Não cacheamos o index.html — se o HTML antigo ficar cacheado, o usuário
  // fica preso pedindo bundles com hash que não existem mais no deploy atual.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_PAGE)));
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
          const networkFetch = fetch(request)
            .then((response) => {
              // Asset com hash sumiu do edge (deploy novo invalidou o hash).
              // Remove a entrada cacheada pra evitar servir stub infinitamente -
              // o cliente vai bater num erro de dynamic import e o handler em
              // recoverFromStaleBundle.js dispara o reload de auto-recovery.
              if (response.status === 404) {
                cache.delete(request).catch(() => {});
                return response;
              }
              // Nao cacheia HTML em URL de asset (sintoma de SPA fallback
              // servindo index.html para hash que nao existe).
              if (response.ok && !isHtmlMasqueradingAsAsset(response, request)) {
                cache.put(request, response.clone());
              }
              return response;
            })
            .catch((err) => {
              // Network falhou (offline). Se temos cached, o `cached ||`
              // abaixo cobre. Senao, propagamos o erro.
              if (cached) return cached;
              throw err;
            });
          return cached || networkFetch;
        }),
      ),
    );
    return;
  }
});

/**
 * ─── Web Push notifications (rich) ────────────────────────────────
 * Listener `push`: recebe payload da Edge Function e mostra notificação
 * nativa do OS estilo "app instalado" — heads-up no topo do Android,
 * vibração padrão, ações inline.
 *
 * Payload esperado (JSON serializado pela Edge Function):
 *   {
 *     title:    string                      — obrigatório
 *     body:     string                      — corpo
 *     url?:     string                      — rota pra abrir no click
 *     tag?:     string                      — agrupa notificações
 *     image?:   string                      — banner grande horizontal
 *     icon?:    string                      — ícone colorido (default 192px)
 *     kind?:    'preventiva'|'orcamento'    — define ações + comportamento
 *     equipId?: string                      — pra ação "snooze 7d"
 *   }
 *
 * Ações inline (botões na notificação) variam por `kind`:
 *   preventiva → [Ver equipamento, Adiar 7 dias]
 *   orcamento  → [Ver orçamento]
 *   default    → nenhuma (notificação simples)
 */

function buildNotificationOptions(payload) {
  const url = payload.url || '/';
  const kind = payload.kind || 'default';

  const actions = [];
  if (kind === 'preventiva') {
    actions.push(
      { action: 'view', title: 'Ver equipamento' },
      { action: 'snooze', title: 'Adiar 7 dias' },
    );
  } else if (kind === 'orcamento') {
    actions.push({ action: 'view', title: 'Ver orçamento' });
  }

  return {
    body: payload.body || '',
    icon: payload.icon || '/icons/icon-192x192.png',
    // badge: usado pelo Android na status bar (96x96 monochrome ideal).
    // Reusa o icon-192 — não é ótimo mas é o asset disponível hoje.
    badge: '/icons/icon-192x192.png',
    image: payload.image || undefined,
    tag: payload.tag || `cooltrack-${kind}`,
    // Vibração padrão — curto-pausa-curto, atenção sem irritar.
    vibrate: [200, 100, 200],
    // requireInteraction só pra preventiva — alerta importante que precisa
    // de ação. Outras tipos auto-dispensam após 5s (default do OS).
    requireInteraction: kind === 'preventiva',
    actions,
    data: {
      url,
      kind,
      equipId: payload.equipId || null,
      timestamp: Date.now(),
    },
  };
}

function parsePushPayload(data) {
  if (!data) return {};
  try {
    return data.json();
  } catch (_e) {
    return { title: 'CoolTrack Pro', body: data.text() };
  }
}

self.addEventListener('push', (event) => {
  const payload = parsePushPayload(event.data);
  const title = payload.title || 'CoolTrack Pro';
  event.waitUntil(self.registration.showNotification(title, buildNotificationOptions(payload)));
});

/**
 * Click em notificação ou em uma das ações inline. Comportamento:
 *   - action='snooze' → não abre o app, marca pra suprimir esse equipId
 *     por 7 dias (gravado em IDB do SW; consultado pelo app no boot).
 *   - action='view' ou click no corpo → foca aba aberta + navega ou abre nova.
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const action = event.action;

  if (action === 'snooze' && data.equipId) {
    event.waitUntil(snoozeEquipPreventiva(data.equipId, 7));
    return;
  }

  const url = data.url || '/';
  event.waitUntil(focusOrOpen(url));
});

/**
 * Foca uma aba existente do app ou abre uma nova. Tenta navegar pra `url`
 * se a aba já estiver aberta.
 */
function focusOrOpen(url) {
  return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
    for (const client of clientList) {
      if ('focus' in client) {
        client.focus();
        if ('navigate' in client && url) {
          try {
            client.navigate(url);
          } catch (_e) {
            /* navigate() falhou — provável cross-origin; aba focada já basta */
          }
        }
        return;
      }
    }
    if (self.clients.openWindow) {
      return self.clients.openWindow(url);
    }
  });
}

/**
 * Marca um equipamento como "adiado por N dias" pra suprimir notificações
 * de preventiva por esse período. Persiste em IndexedDB via fallback
 * simples — quando o app abrir, lê esse store e respeita.
 *
 * Implementação mínima: localStorage não é acessível do SW, então usamos
 * um fetch pra um endpoint do app que persiste no Supabase. Como a Edge
 * Function de envio de push pode consultar o mesmo estado, evita reenvio.
 *
 * Por ora, log silencioso — implementar quando a Edge Function existir.
 */
function snoozeEquipPreventiva(equipId, days) {
  console.log(`[SW] snooze ${equipId} por ${days} dias (TODO: persistir no backend)`);
  return Promise.resolve();
}
