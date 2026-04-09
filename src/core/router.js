/**
 * CoolTrack Pro - Router v1.1
 * Roteamento puro — sem dependências de UI
 * Orquestrado pelo ui/controller.js que injeta os handlers de cada view
 */

const _routes = new Map(); // name → { onEnter, onLeave }
let _current = null;
let _transitioning = false;
let _historyBound = false;

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

/**
 * Navega para uma rota.
 * @param {string} name
 * @param {object} [params] — dados extras passados ao onEnter
 */
export function goTo(name, params = {}, options = {}) {
  const { fromHistory = false, replaceHistory = false } = options;
  if (_transitioning || _current === name) return;
  if (!_routes.has(name)) {
    console.warn(`[Router] Rota desconhecida: "${name}"`);
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

  // Chamar onLeave da rota anterior
  if (_current && _routes.has(_current)) {
    _routes.get(_current).onLeave?.();
  }

  // Animação de saída
  if (prevEl) {
    prevEl.classList.add('is-exiting');
    afterAnimation(prevEl, 150, () => {
      prevEl.classList.remove('active', 'is-exiting');
      _activateRoute(name, nextEl, params, { fromHistory, replaceHistory });
    });
  } else {
    _activateRoute(name, nextEl, params, { fromHistory, replaceHistory });
  }
}

function _activateRoute(name, el, params, options = {}) {
  const { fromHistory = false, replaceHistory = false } = options;

  // Atualizar nav
  document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('is-active'));
  document.getElementById(`nav-${name}`)?.classList.add('is-active');

  // Ativar view
  el.classList.add('active');

  // Chamar onEnter
  _routes.get(name)?.onEnter(params);

  _current = name;
  _transitioning = false;

  if (!fromHistory && typeof window !== 'undefined' && window.history) {
    const state = { route: name };
    if (replaceHistory)
      window.history.replaceState(state, '', window.location.pathname + window.location.search);
    else window.history.pushState(state, '', window.location.pathname + window.location.search);
  }

  // Scroll + foco
  document.getElementById('main-content')?.focus();
  window.scrollTo(0, 0);
  requestAnimationFrame(() => setRoutingState(false));
}

export function currentRoute() {
  return _current;
}

export function initHistory() {
  if (_historyBound || typeof window === 'undefined') return;
  _historyBound = true;

  window.addEventListener('popstate', (e) => {
    const route = e.state?.route;
    if (route && _routes.has(route)) {
      goTo(route, {}, { fromHistory: true });
    }
  });

  document.addEventListener('backbutton', (e) => {
    if (_current && _current !== 'inicio') {
      e.preventDefault?.();
      window.history.back();
    }
  });
}
