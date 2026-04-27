/**
 * CoolTrack Pro - Router v1.1
 * Roteamento puro — sem dependências de UI
 * Orquestrado pelo ui/controller.js que injeta os handlers de cada view
 */

import { Toast } from './toast.js';
import { handleError, ErrorCodes } from './errors.js';
import { Modal } from './modal.js';

// ──────────────────────────────────────────────────────────────────────
// Registry de "blocking layers" — modais ou overlays que precisam ser
// fechados pelo botao voltar do browser. UI camadas se REGISTRAM aqui em
// vez do core importar de ui/* (o que viola a regra core ↛ ui).
//
// Cada entry: { id: string, isOpen: () => boolean, close: () => void, getElement?: () => Element|null }
// O id e usado pra dedupe (mesma camada não registra duas vezes).
// ──────────────────────────────────────────────────────────────────────
const _blockingLayerRegistry = new Map();

export function registerBlockingLayer({ id, isOpen, close, getElement }) {
  if (!id || typeof isOpen !== 'function' || typeof close !== 'function') return;
  _blockingLayerRegistry.set(id, { isOpen, close, getElement });
}

export function unregisterBlockingLayer(id) {
  _blockingLayerRegistry.delete(id);
}

const _routes = new Map(); // name → { onEnter, onLeave }
let _current = null;
let _currentParams = {};
let _transitioning = false;
let _historyBound = false;
let _blockingLayerDepth = 0;
let _blockingLayerSyncSuspended = false;
let _blockingLayerObserver = null;
let _blockingLayerHistoryCompacting = false;
const UI_CTX_VERSION = 1;

function normalizeRouteParams(params) {
  if (!params || typeof params !== 'object' || Array.isArray(params)) return {};
  return params;
}

function buildHistoryState(route, params = {}, options = {}) {
  return {
    route,
    params: normalizeRouteParams(params),
    uiCtxVersion: UI_CTX_VERSION,
    ...(options.blockingLayer ? { blockingLayer: true } : {}),
  };
}

function parseHistoryState(state) {
  if (!state || typeof state !== 'object') return { route: null, params: {} };
  return {
    route: typeof state.route === 'string' ? state.route : null,
    // Compat legado: state antigo sem params
    params: normalizeRouteParams(state.params),
  };
}

function setRoutingState(isRouting) {
  if (typeof document === 'undefined') return;
  document.body?.classList.toggle('is-routing', isRouting);
}

function afterAnimation(element, fallbackMs, callback) {
  if (!element) {
    callback();
    return;
  }

  let settled = false;
  const finish = () => {
    if (settled) return;
    settled = true;
    element.removeEventListener('animationend', onAnimationEnd);
    window.clearTimeout(timeoutId);
    callback();
  };
  const onAnimationEnd = (event) => {
    if (event.target === element) finish();
  };
  const timeoutId = window.setTimeout(finish, fallbackMs);

  element.addEventListener('animationend', onAnimationEnd);
}

function getScrollRoot() {
  if (typeof document === 'undefined') return null;
  return document.getElementById('main-content');
}

function emitRouteChanged(route, previousRoute) {
  if (typeof document === 'undefined') return;
  document.dispatchEvent(
    new CustomEvent('app:route-changed', {
      detail: { route, previousRoute },
    }),
  );
}

function closeTopBlockingLayer() {
  if (typeof document === 'undefined') return false;

  const candidates = [];

  // Modal padrão (infra atual).
  const overlays = [...document.querySelectorAll('.modal-overlay.is-open')];
  const topOverlay = overlays[overlays.length - 1];
  if (topOverlay) {
    candidates.push({
      element: topOverlay,
      close: () => {
        const dismissRoute = topOverlay?.dataset?.dismissRoute;
        const dismissFromRoute = topOverlay?.dataset?.dismissFromRoute;
        if (topOverlay?.id) Modal.close(topOverlay.id);
        else topOverlay.classList.remove('is-open');
        if (
          dismissRoute &&
          _routes.has(dismissRoute) &&
          (!dismissFromRoute || dismissFromRoute === _current)
        ) {
          goTo(dismissRoute, {}, { fromHistory: true, replaceHistory: true });
        }
      },
    });
  }

  // Camadas registradas via registerBlockingLayer (signature modals etc.).
  // Inversao de dependencia — core não importa de ui/* mais.
  _blockingLayerRegistry.forEach((entry) => {
    if (!entry.isOpen()) return;
    const element = entry.getElement?.() || null;
    candidates.push({ element, close: entry.close });
  });

  // Lightbox de fotos (não usa .modal-overlay).
  const lightbox = document.getElementById('lightbox');
  if (lightbox?.classList.contains('is-open')) {
    candidates.push({
      element: lightbox,
      close: () => lightbox.classList.remove('is-open'),
    });
  }

  // Overflow modal do dashboard (usa class `overflow-modal-overlay`, não
  // `modal-overlay`, e só existe no DOM enquanto aberto — audit §1.3).
  // Preferimos clicar no botão dismiss pra preservar a telemetria de close;
  // fallback pra .remove() se algo quebrou a estrutura interna.
  const overflowModal = document.getElementById('dash-overflow-modal');
  if (overflowModal) {
    candidates.push({
      element: overflowModal,
      close: () => {
        const dismissBtn = overflowModal.querySelector('[data-action="dismiss"]');
        if (dismissBtn instanceof HTMLElement) dismissBtn.click();
        else overflowModal.remove();
      },
    });
  }

  if (!candidates.length) return false;

  // Fecha apenas a camada mais ao topo (última no DOM).
  const top = candidates.reduce((currentTop, candidate) => {
    if (!currentTop) return candidate;
    const relation = currentTop.element.compareDocumentPosition(candidate.element);
    const isCandidateAfterCurrent = Boolean(relation & Node.DOCUMENT_POSITION_FOLLOWING);
    return isCandidateAfterCurrent ? candidate : currentTop;
  }, null);

  top?.close?.();
  return true;
}

function countOpenBlockingLayers() {
  if (typeof document === 'undefined') return 0;
  const modalCount = document.querySelectorAll('.modal-overlay.is-open').length;
  const lightboxCount = document.getElementById('lightbox')?.classList.contains('is-open') ? 1 : 0;
  const sigCaptureCount = document
    .getElementById('modal-signature-overlay')
    ?.classList.contains('is-open')
    ? 1
    : 0;
  const sigViewerCount = document
    .getElementById('modal-signature-viewer-overlay')
    ?.classList.contains('is-open')
    ? 1
    : 0;
  // Overflow modal existe no DOM só enquanto aberto (sem class is-open),
  // então basta checar presença (audit §1.3).
  const overflowCount = document.getElementById('dash-overflow-modal') ? 1 : 0;
  return modalCount + lightboxCount + sigCaptureCount + sigViewerCount + overflowCount;
}

function syncBlockingLayerHistoryDepth() {
  if (typeof window === 'undefined' || !window.history || _blockingLayerSyncSuspended) return;
  if (!_current) return;
  const nextDepth = countOpenBlockingLayers();
  if (nextDepth < _blockingLayerDepth) {
    const delta = _blockingLayerDepth - nextDepth;
    _blockingLayerDepth = nextDepth;
    if (window.history.state?.blockingLayer) {
      _blockingLayerHistoryCompacting = true;
      window.history.go(-delta);
    }
    return;
  }
  if (nextDepth === _blockingLayerDepth) {
    return;
  }

  const delta = nextDepth - _blockingLayerDepth;
  for (let i = 0; i < delta; i += 1) {
    window.history.pushState(
      buildHistoryState(_current, _currentParams, { blockingLayer: true }),
      '',
      window.location.pathname + window.location.search,
    );
  }
  _blockingLayerDepth = nextDepth;
}

function bindBlockingLayerHistoryObserver() {
  if (_blockingLayerObserver || typeof document === 'undefined') return;
  _blockingLayerDepth = countOpenBlockingLayers();
  _blockingLayerObserver = new MutationObserver(() => syncBlockingLayerHistoryDepth());
  _blockingLayerObserver.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['class'],
  });

  // Sinal explícito do Modal.open/close — torna o sync determinístico quando
  // o usuário fecha via UI. MutationObserver acima continua como safety net
  // pra overlays que não passam pelo módulo Modal (lightbox, signature).
  document.addEventListener('modal:opened', syncBlockingLayerHistoryDepth);
  document.addEventListener('modal:closed', syncBlockingLayerHistoryDepth);
}

/**
 * Registra uma rota com seus hooks de ciclo de vida.
 * Chamado pelo controller no bootstrap.
 *
 * @param {string}   name
 * @param {Function} onEnter  — chamado ao ativar a view
 * @param {Function} [onLeave] — chamado ao sair da view
 */
export function registerRoute(name, onEnter, onLeave = null) {
  _routes.set(name, { onEnter, onLeave });
}

// ──────────────────────────────────────────────────────────────────────
// Guard de navegação — uma view pode bloquear sair em estados sujos
// (ex.: edição não salva). O guard recebe (nextRoute, nextParams) e
// retorna boolean OU Promise<boolean>. Se false, navegação é cancelada.
// O guard é AUTOMATICAMENTE limpo após a primeira navegação confirmada
// (sucesso) — quem instala precisa re-instalar se quiser persistir.
// ──────────────────────────────────────────────────────────────────────
let _navGuard = null;

export function setRouteGuard(guardFn) {
  _navGuard = typeof guardFn === 'function' ? guardFn : null;
}

export function clearRouteGuard() {
  _navGuard = null;
}

/**
 * Navega para uma rota.
 * @param {string} name
 * @param {object} [params] — dados extras passados ao onEnter
 */
export function goTo(name, params = {}, options = {}) {
  const { fromHistory = false, replaceHistory = false, bypassGuard = false } = options;
  const safeParams = normalizeRouteParams(params);
  if (_transitioning) return;
  if (!_routes.has(name)) {
    console.warn(`[Router] Rota desconhecida: "${name}"`);
    return;
  }

  // Guard check — só dispara se ha guard E rota destino diferente da atual
  // E não e fromHistory (back/forward do browser tem fluxo proprio) E não
  // explicitamente bypassed. Resultado pode ser sync (boolean) ou async.
  if (_navGuard && _current !== name && !fromHistory && !bypassGuard) {
    const guardResult = _navGuard(name, safeParams);
    if (guardResult && typeof guardResult.then === 'function') {
      // Async: aguarda a promise e re-chama com bypass se aprovado
      guardResult
        .then((allowed) => {
          if (allowed) {
            _navGuard = null;
            goTo(name, safeParams, { ...options, bypassGuard: true });
          }
        })
        .catch(() => {
          /* erro no guard não deve bloquear permanente — log e libera */
          console.warn('[Router] Guard rejeitou com erro; navegacao cancelada');
        });
      return;
    }
    if (!guardResult) return;
    // Sync allowed — limpa o guard e prossegue
    _navGuard = null;
  }

  const hasParams = params && Object.keys(params).length > 0;
  if (_current === name) {
    // Mesmo na mesma rota, permitimos reentrada quando há params
    // (ex.: trocar filtro/intent/equipId sem mudar de tela).
    if (!hasParams) return;

    const currentEl = document.getElementById(`view-${name}`);
    if (!currentEl) return;

    try {
      const result = _routes.get(name)?.onEnter(safeParams);
      if (result && typeof result.then === 'function') {
        result.catch((asyncError) => _handleViewError(name, currentEl, asyncError));
      }
    } catch (syncError) {
      _handleViewError(name, currentEl, syncError);
    }

    emitRouteChanged(name, name);

    if (!fromHistory && typeof window !== 'undefined' && window.history) {
      // Mesma rota + params: evita poluir stack com entradas idênticas.
      const state = buildHistoryState(name, safeParams);
      window.history.replaceState(state, '', window.location.pathname + window.location.search);
    }

    return;
  }

  _transitioning = true;
  setRoutingState(true);

  const prevEl = _current ? document.getElementById(`view-${_current}`) : null;
  const nextEl = document.getElementById(`view-${name}`);

  if (!nextEl) {
    _transitioning = false;
    setRoutingState(false);
    return;
  }

  // Chamar onLeave da rota anterior — falhas aqui não podem bloquear a navegação
  if (_current && _routes.has(_current)) {
    try {
      _routes.get(_current).onLeave?.();
    } catch (leaveError) {
      handleError(leaveError, {
        code: ErrorCodes.NETWORK_ERROR,
        message: 'Falha ao sair da tela anterior.',
        context: { route: _current, phase: 'onLeave' },
        showToast: false,
      });
    }
  }

  // Animação de saída
  if (prevEl) {
    prevEl.classList.add('is-exiting');
    afterAnimation(prevEl, 150, () => {
      prevEl.classList.remove('active', 'is-exiting');
      _activateRoute(name, nextEl, safeParams, { fromHistory, replaceHistory });
    });
  } else {
    _activateRoute(name, nextEl, safeParams, { fromHistory, replaceHistory });
  }
}

/**
 * Renderiza fallback dentro do container da view quando o onEnter falha.
 * Evita tela em branco e oferece caminho de recuperação (recarregar).
 */
function _handleViewError(name, el, error) {
  handleError(error, {
    code: ErrorCodes.NETWORK_ERROR,
    message: 'Não foi possível carregar esta tela. Tente novamente.',
    context: { route: name, phase: 'onEnter' },
    showToast: false,
  });
  Toast.error('Não foi possível carregar esta tela. Tente novamente.');

  // Só escreve fallback se o container existe e parece vazio (evita
  // sobrescrever conteúdo parcialmente renderizado com mensagem de erro).
  const container = el?.querySelector('.view-content') || el;
  if (!container) return;
  const hasContent = container.children && container.children.length > 0;
  if (hasContent) return;

  container.innerHTML = `
    <div class="view-error-boundary" role="alert" aria-live="assertive">
      <div class="view-error-boundary__icon" aria-hidden="true">⚠️</div>
      <h2 class="view-error-boundary__title">Não foi possível carregar esta tela</h2>
      <p class="view-error-boundary__desc">
        Algo deu errado ao montar o conteúdo. Tente recarregar a página.
      </p>
      <button type="button" class="btn btn--primary view-error-boundary__retry">
        Recarregar
      </button>
    </div>
  `;
  container.querySelector('.view-error-boundary__retry')?.addEventListener('click', () => {
    window.location.reload();
  });
}

function _activateRoute(name, el, params, options = {}) {
  const { fromHistory = false, replaceHistory = false } = options;
  const safeParams = normalizeRouteParams(params);

  const previousRoute = _current;

  // Atualizar nav (bottom nav mobile + sidebar desktop espelham mesmo state)
  document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('is-active'));
  document.getElementById(`nav-${name}`)?.classList.add('is-active');
  document
    .querySelectorAll('.app-sidebar__nav-item')
    .forEach((b) => b.classList.remove('is-active'));
  document.getElementById(`sidenav-${name}`)?.classList.add('is-active');

  // Expor rota atual para CSS (ex.: hide de header-stats-bar no painel)
  if (typeof document !== 'undefined' && document.body) {
    document.body.setAttribute('data-route', name);
  }

  // Ativar view
  el.classList.add('active');

  // Error boundary de view — se o onEnter estourar (sync ou async),
  // renderiza fallback dentro do container pra evitar tela em branco
  // e garante que _transitioning seja resetado.
  try {
    const result = _routes.get(name)?.onEnter(safeParams);
    if (result && typeof result.then === 'function') {
      result.catch((asyncError) => _handleViewError(name, el, asyncError));
    }
  } catch (syncError) {
    _handleViewError(name, el, syncError);
  }

  _current = name;
  _currentParams = safeParams;
  emitRouteChanged(name, previousRoute);
  _transitioning = false;

  if (!fromHistory && typeof window !== 'undefined' && window.history) {
    const state = buildHistoryState(name, safeParams);
    if (replaceHistory)
      window.history.replaceState(state, '', window.location.pathname + window.location.search);
    else window.history.pushState(state, '', window.location.pathname + window.location.search);
  }

  // Scroll + foco
  const scrollRoot = getScrollRoot();
  scrollRoot?.focus?.();
  if (scrollRoot) scrollRoot.scrollTop = 0;
  else window.scrollTo(0, 0);
  requestAnimationFrame(() => setRoutingState(false));
}

export function currentRoute() {
  return _current;
}

export function currentRouteParams() {
  return { ..._currentParams };
}

export function initHistory() {
  if (_historyBound || typeof window === 'undefined') return;
  _historyBound = true;

  // Garante que a entrada atual da rota tenha shape consistente
  // ({ route, params, uiCtxVersion }). Sem isso, um reload profundo pode
  // deixar `history.state` nulo e o primeiro back perde contexto da UI.
  if (_current && window.history) {
    const { route, params } = parseHistoryState(window.history.state);
    if (route !== _current) {
      window.history.replaceState(
        buildHistoryState(_current, _currentParams),
        '',
        window.location.pathname + window.location.search,
      );
    } else if (JSON.stringify(params) !== JSON.stringify(_currentParams)) {
      window.history.replaceState(
        buildHistoryState(_current, _currentParams),
        '',
        window.location.pathname + window.location.search,
      );
    }
  }

  window.addEventListener('popstate', (e) => {
    if (_blockingLayerHistoryCompacting) {
      _blockingLayerHistoryCompacting = false;
      return;
    }
    if (closeTopBlockingLayer()) {
      // Consumimos o back para fechar camada sobreposta, sem re-push corretivo.
      _blockingLayerSyncSuspended = true;
      _blockingLayerDepth = countOpenBlockingLayers();
      _blockingLayerSyncSuspended = false;
      return;
    }
    const { route, params } = parseHistoryState(e.state);
    if (route && _routes.has(route)) {
      goTo(route, params, { fromHistory: true });
      return;
    }

    // Fallback defensivo: histórico externo/legado sem route válida pode
    // chegar aqui. Se houver rota inicial registrada, volta pra ela em vez
    // de deixar a UI em estado indefinido.
    if (_routes.has('inicio') && _current !== 'inicio') {
      goTo('inicio', {}, { fromHistory: true });
    }
  });

  document.addEventListener('backbutton', (e) => {
    if (closeTopBlockingLayer()) {
      e.preventDefault?.();
      return;
    }
    if (_current && _current !== 'inicio') {
      e.preventDefault?.();
      window.history.back();
    }
  });

  bindBlockingLayerHistoryObserver();
}
