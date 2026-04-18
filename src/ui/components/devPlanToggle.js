/**
 * Dev Plan Toggle — botão flutuante visível apenas para usuários is_dev
 * (ou com cooltrack-dev-mode = true). Cicla entre Free → Plus → Pro → Free
 * para testar funcionalidades dos 3 tiers.
 *
 * Features:
 * - Arrastar para qualquer lugar da tela (posição salva em localStorage)
 * - Minimizar para um ícone circular pequeno (estado salvo em localStorage)
 * - Double-click no ícone minimizado volta para a posição default
 */

import { DevPlanOverride } from '../../core/devPlanOverride.js';
import { wipeAllUserData } from '../../core/devWipeData.js';
import { CustomConfirm } from '../../core/modal.js';
import { Toast } from '../../core/toast.js';

const TOGGLE_ID = 'dev-plan-toggle';
const LS_POS = 'cooltrack-dev-toggle-pos';
const LS_MIN = 'cooltrack-dev-toggle-minimized';
const DRAG_THRESHOLD = 4; // px — evita que clicks virem drag

function getLabel(plan) {
  if (plan === 'pro') return 'PRO';
  if (plan === 'plus') return 'PLUS';
  return 'FREE';
}

function getBadgeStyle(plan) {
  if (plan === 'pro') return 'background:#00c870;color:#07111f;';
  if (plan === 'plus') return 'background:#3a8ee6;color:#07111f;';
  return 'background:#4a6880;color:#e8f2fa;';
}

function getBadgeColor(plan) {
  if (plan === 'pro') return '#00c870';
  if (plan === 'plus') return '#3a8ee6';
  return '#4a6880';
}

function loadPos() {
  try {
    const raw = localStorage.getItem(LS_POS);
    if (!raw) return null;
    const pos = JSON.parse(raw);
    if (typeof pos?.left === 'number' && typeof pos?.top === 'number') return pos;
  } catch (_) {
    /* ignora */
  }
  return null;
}

function savePos(left, top) {
  try {
    localStorage.setItem(LS_POS, JSON.stringify({ left, top }));
  } catch (_) {
    /* ignora */
  }
}

function clearPos() {
  try {
    localStorage.removeItem(LS_POS);
  } catch (_) {
    /* ignora */
  }
}

function isMinimized() {
  try {
    return localStorage.getItem(LS_MIN) === '1';
  } catch (_) {
    return false;
  }
}

function setMinimized(val) {
  try {
    if (val) localStorage.setItem(LS_MIN, '1');
    else localStorage.removeItem(LS_MIN);
  } catch (_) {
    /* ignora */
  }
}

function clampToViewport(left, top, elWidth, elHeight) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const margin = 4;
  const maxLeft = Math.max(margin, vw - elWidth - margin);
  const maxTop = Math.max(margin, vh - elHeight - margin);
  return {
    left: Math.min(Math.max(margin, left), maxLeft),
    top: Math.min(Math.max(margin, top), maxTop),
  };
}

function applyPosition(el) {
  const pos = loadPos();
  if (pos) {
    // Precisa ser rendered pra ter width/height corretos
    requestAnimationFrame(() => {
      const { left, top } = clampToViewport(pos.left, pos.top, el.offsetWidth, el.offsetHeight);
      el.style.left = `${left}px`;
      el.style.top = `${top}px`;
      el.style.right = 'auto';
      el.style.bottom = 'auto';
    });
  } else {
    // Posição default: canto inferior direito
    el.style.left = '';
    el.style.top = '';
    el.style.right = '16px';
    el.style.bottom = '16px';
  }
}

function renderExpanded(el, current) {
  el.classList.remove('dev-plan-toggle--minimized');
  el.innerHTML = `
    <span id="dev-plan-toggle__drag" title="Arrastar" aria-hidden="true">⋮⋮</span>
    <span id="dev-plan-toggle__label">DEV</span>
    <span id="dev-plan-toggle__badge" style="${getBadgeStyle(current)}">${getLabel(current)}</span>
    <button id="dev-plan-toggle__btn" type="button" title="Alternar plano (Free → Plus → Pro)">ciclar</button>
    <button id="dev-plan-toggle__wipe" type="button" title="Apagar todos os equipamentos, registros e técnicos (apenas dados de teste)" aria-label="Limpar dados de teste">🗑</button>
    <button id="dev-plan-toggle__min" type="button" title="Minimizar" aria-label="Minimizar">–</button>
  `;
}

function renderMinimized(el, current) {
  el.classList.add('dev-plan-toggle--minimized');
  el.innerHTML = `
    <button id="dev-plan-toggle__expand" type="button"
      title="DEV ${getLabel(current)} — clique para expandir, duplo-clique volta pra posição padrão"
      style="background:${getBadgeColor(current)};">
      <span style="color:${current === 'free' ? '#e8f2fa' : '#07111f'};">${getLabel(current)[0]}</span>
    </button>
  `;
}

function setupDrag(el, getDraggableEl) {
  let startX = 0;
  let startY = 0;
  let origLeft = 0;
  let origTop = 0;
  let dragging = false;
  let moved = false;

  function onPointerDown(ev) {
    // Só arrasta com botão esquerdo (ou toque)
    if (ev.button !== undefined && ev.button !== 0) return;

    const target = ev.target;
    // Não inicia drag se clicou em botão funcional
    if (
      target.closest('#dev-plan-toggle__btn') ||
      target.closest('#dev-plan-toggle__min') ||
      target.closest('#dev-plan-toggle__wipe')
    ) {
      return;
    }

    dragging = true;
    moved = false;
    const rect = el.getBoundingClientRect();
    origLeft = rect.left;
    origTop = rect.top;
    startX = ev.clientX;
    startY = ev.clientY;

    // Fixa posição via left/top antes de começar a arrastar
    el.style.left = `${origLeft}px`;
    el.style.top = `${origTop}px`;
    el.style.right = 'auto';
    el.style.bottom = 'auto';

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp, { once: true });
    ev.preventDefault();
  }

  function onPointerMove(ev) {
    if (!dragging) return;
    const dx = ev.clientX - startX;
    const dy = ev.clientY - startY;
    if (!moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    moved = true;
    el.classList.add('dev-plan-toggle--dragging');

    const { left, top } = clampToViewport(
      origLeft + dx,
      origTop + dy,
      el.offsetWidth,
      el.offsetHeight,
    );
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }

  function onPointerUp(_ev) {
    document.removeEventListener('pointermove', onPointerMove);
    dragging = false;
    el.classList.remove('dev-plan-toggle--dragging');
    if (moved) {
      const rect = el.getBoundingClientRect();
      savePos(rect.left, rect.top);
    }
    moved = false;
  }

  const draggable = getDraggableEl();
  if (draggable) draggable.addEventListener('pointerdown', onPointerDown);

  // Retorna função de limpeza (não usada diretamente, mas útil pra re-bind)
  return () => {
    if (draggable) draggable.removeEventListener('pointerdown', onPointerDown);
  };
}

function bindExpandedHandlers(el, api) {
  // Drag em qualquer parte que não seja botão
  setupDrag(el, () => el);

  el.querySelector('#dev-plan-toggle__btn')?.addEventListener('click', (ev) => {
    ev.stopPropagation();
    const next = DevPlanOverride.cycle();
    const badge = el.querySelector('#dev-plan-toggle__badge');
    if (badge) {
      badge.textContent = getLabel(next);
      badge.setAttribute('style', getBadgeStyle(next));
    }
    // Recarrega para aplicar o novo plano em todas as telas
    window.location.reload();
  });

  el.querySelector('#dev-plan-toggle__min')?.addEventListener('click', (ev) => {
    ev.stopPropagation();
    setMinimized(true);
    api.switchTo('minimized');
  });

  el.querySelector('#dev-plan-toggle__wipe')?.addEventListener('click', async (ev) => {
    ev.stopPropagation();
    const confirmed = await CustomConfirm.show(
      'Apagar todos os dados de teste?',
      'Isso vai remover TODOS os equipamentos, registros de serviço, técnicos e contadores de uso — tanto localmente quanto no Supabase. A conta e o plano continuam intactos. Não dá pra desfazer.',
      { confirmLabel: 'Apagar tudo', cancelLabel: 'Cancelar', tone: 'danger' },
    );
    if (!confirmed) return;

    const wipeBtn = el.querySelector('#dev-plan-toggle__wipe');
    if (wipeBtn) {
      wipeBtn.disabled = true;
      wipeBtn.textContent = '⏳';
    }

    const result = await wipeAllUserData();
    if (!result.ok) {
      if (wipeBtn) {
        wipeBtn.disabled = false;
        wipeBtn.textContent = '🗑';
      }
      Toast?.error?.(`Falha ao limpar: ${result.error || 'erro desconhecido'}`);
      return;
    }

    Toast?.success?.(
      result.localOnly ? 'Dados locais apagados.' : 'Equipamentos, registros e técnicos apagados.',
    );
    // Pequeno delay pra mostrar o toast, depois recarrega pra re-bootar vazio
    setTimeout(() => window.location.reload(), 600);
  });
}

function bindMinimizedHandlers(el, api) {
  const btn = el.querySelector('#dev-plan-toggle__expand');
  if (!btn) return;

  setupDrag(el, () => btn);

  let lastClick = 0;
  btn.addEventListener('click', (ev) => {
    // Ignora clicks que são resultado de drag
    if (el.classList.contains('dev-plan-toggle--was-dragged')) {
      el.classList.remove('dev-plan-toggle--was-dragged');
      return;
    }

    ev.stopPropagation();
    const now = Date.now();
    if (now - lastClick < 350) {
      // Duplo-clique: reseta posição
      clearPos();
      applyPosition(el);
      lastClick = 0;
      return;
    }
    lastClick = now;

    // Click simples expande
    setTimeout(() => {
      if (Date.now() - lastClick >= 340) {
        setMinimized(false);
        api.switchTo('expanded');
      }
    }, 350);
  });
}

export const DevPlanToggle = {
  mount() {
    if (document.getElementById(TOGGLE_ID)) return;

    const el = document.createElement('div');
    el.id = TOGGLE_ID;
    el.setAttribute('role', 'status');
    el.setAttribute('aria-label', 'Dev: alternador de plano');

    // Style global (uma vez só)
    if (!document.getElementById('dev-plan-toggle-style')) {
      const style = document.createElement('style');
      style.id = 'dev-plan-toggle-style';
      style.textContent = `
        #dev-plan-toggle {
          position: fixed;
          z-index: 9999;
          display: flex;
          align-items: center;
          gap: 6px;
          background: rgba(7, 17, 31, 0.92);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 999px;
          padding: 6px 8px 6px 6px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.5);
          backdrop-filter: blur(8px);
          font-family: inherit;
          user-select: none;
          touch-action: none;
          cursor: grab;
          transition: box-shadow 0.15s;
        }
        #dev-plan-toggle.dev-plan-toggle--dragging {
          cursor: grabbing;
          box-shadow: 0 8px 32px rgba(0,0,0,0.7);
        }
        #dev-plan-toggle.dev-plan-toggle--minimized {
          padding: 0;
          background: transparent;
          border: none;
          box-shadow: none;
          backdrop-filter: none;
        }
        #dev-plan-toggle__drag {
          font-size: 10px;
          color: #4a6880;
          padding: 0 2px;
          letter-spacing: -2px;
          cursor: grab;
        }
        #dev-plan-toggle__label {
          font-size: 10px;
          color: #4a6880;
          letter-spacing: 0.08em;
          font-weight: 600;
        }
        #dev-plan-toggle__badge {
          font-size: 11px;
          font-weight: 700;
          border-radius: 999px;
          padding: 3px 9px;
          letter-spacing: 0.06em;
          transition: background 0.15s, color 0.15s;
        }
        #dev-plan-toggle__btn {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 999px;
          color: #8aaac8;
          font-size: 11px;
          font-family: inherit;
          font-weight: 600;
          padding: 3px 10px;
          cursor: pointer;
          transition: background 0.15s;
        }
        #dev-plan-toggle__btn:hover {
          background: rgba(255,255,255,0.12);
        }
        #dev-plan-toggle__min {
          background: transparent;
          border: 1px solid rgba(255,255,255,0.12);
          color: #8aaac8;
          border-radius: 999px;
          width: 20px;
          height: 20px;
          padding: 0;
          font-size: 14px;
          font-family: inherit;
          line-height: 1;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s, color 0.15s;
        }
        #dev-plan-toggle__min:hover {
          background: rgba(255,255,255,0.12);
          color: #e8f2fa;
        }
        #dev-plan-toggle__wipe {
          background: rgba(255, 80, 80, 0.12);
          border: 1px solid rgba(255, 80, 80, 0.35);
          color: #ff8a8a;
          border-radius: 999px;
          width: 22px;
          height: 22px;
          padding: 0;
          font-size: 11px;
          font-family: inherit;
          line-height: 1;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s, color 0.15s, border-color 0.15s;
        }
        #dev-plan-toggle__wipe:hover:not(:disabled) {
          background: rgba(255, 80, 80, 0.22);
          border-color: rgba(255, 80, 80, 0.6);
          color: #ffbaba;
        }
        #dev-plan-toggle__wipe:disabled {
          cursor: wait;
          opacity: 0.6;
        }
        #dev-plan-toggle__expand {
          width: 32px;
          height: 32px;
          border-radius: 999px;
          border: 2px solid rgba(7,17,31,0.85);
          cursor: grab;
          font-size: 11px;
          font-weight: 800;
          font-family: inherit;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          box-shadow: 0 2px 10px rgba(0,0,0,0.5);
          transition: transform 0.15s, box-shadow 0.15s;
        }
        #dev-plan-toggle__expand:hover {
          transform: scale(1.1);
          box-shadow: 0 4px 14px rgba(0,0,0,0.6);
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(el);

    const api = {
      switchTo(mode) {
        const current = DevPlanOverride.get() ?? 'free';
        if (mode === 'minimized') {
          renderMinimized(el, current);
          bindMinimizedHandlers(el, api);
        } else {
          renderExpanded(el, current);
          bindExpandedHandlers(el, api);
        }
        applyPosition(el);
      },
    };

    // Render inicial baseado no estado persistido
    api.switchTo(isMinimized() ? 'minimized' : 'expanded');

    // Re-clamp no resize (caso janela encolha e o botão fique fora)
    window.addEventListener('resize', () => {
      const pos = loadPos();
      if (!pos) return;
      const { left, top } = clampToViewport(pos.left, pos.top, el.offsetWidth, el.offsetHeight);
      el.style.left = `${left}px`;
      el.style.top = `${top}px`;
      if (left !== pos.left || top !== pos.top) savePos(left, top);
    });
  },

  unmount() {
    document.getElementById(TOGGLE_ID)?.remove();
  },
};
