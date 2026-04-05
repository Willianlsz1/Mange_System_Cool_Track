/**
 * CoolTrack Pro - Router v1.0
 * Roteamento puro — sem dependências de UI
 * Orquestrado pelo ui/controller.js que injeta os handlers de cada view
 */

const _routes   = new Map();  // name → { onEnter, onLeave }
let _current    = null;
let _transitioning = false;

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
export function goTo(name, params = {}) {
  if (_transitioning || _current === name) return;
  if (!_routes.has(name)) {
    console.warn(`[Router] Rota desconhecida: "${name}"`);
    return;
  }

  _transitioning = true;

  const prevEl = _current ? document.getElementById(`view-${_current}`) : null;
  const nextEl = document.getElementById(`view-${name}`);

  if (!nextEl) {
    _transitioning = false;
    return;
  }

  // Chamar onLeave da rota anterior
  if (_current && _routes.has(_current)) {
    _routes.get(_current).onLeave?.();
  }

  // Animação de saída
  if (prevEl) {
    prevEl.classList.add('is-exiting');
    setTimeout(() => {
      prevEl.classList.remove('active', 'is-exiting');
      _activateRoute(name, nextEl, params);
    }, 150);
  } else {
    _activateRoute(name, nextEl, params);
  }
}

function _activateRoute(name, el, params) {
  // Atualizar nav
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('is-active'));
  document.getElementById(`nav-${name}`)?.classList.add('is-active');

  // Ativar view
  el.classList.add('active');

  // Chamar onEnter
  _routes.get(name)?.onEnter(params);

  _current       = name;
  _transitioning = false;

  // Scroll + foco
  document.getElementById('main-content')?.focus();
  window.scrollTo(0, 0);
}

export function currentRoute() { return _current; }