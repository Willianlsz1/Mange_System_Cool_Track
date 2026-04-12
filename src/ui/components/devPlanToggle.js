/**
 * Dev Plan Toggle — botão flutuante visível apenas para usuários is_dev.
 * Permite alternar entre planos Free e Pro com 1 clique para testar funcionalidades.
 */

import { DevPlanOverride } from '../../core/devPlanOverride.js';

const TOGGLE_ID = 'dev-plan-toggle';

function getLabel(plan) {
  return plan === 'pro' ? 'PRO' : 'FREE';
}

function getBadgeStyle(plan) {
  return plan === 'pro' ? 'background:#00c870;color:#07111f;' : 'background:#4a6880;color:#e8f2fa;';
}

export const DevPlanToggle = {
  mount() {
    if (document.getElementById(TOGGLE_ID)) return;

    const current = DevPlanOverride.get() ?? 'free';

    const el = document.createElement('div');
    el.id = TOGGLE_ID;
    el.setAttribute('role', 'status');
    el.setAttribute('aria-label', 'Dev: alternador de plano');
    el.innerHTML = `
      <style>
        #dev-plan-toggle {
          position: fixed;
          bottom: 16px;
          right: 16px;
          z-index: 9999;
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(7, 17, 31, 0.92);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 999px;
          padding: 6px 10px 6px 8px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.5);
          backdrop-filter: blur(8px);
          font-family: inherit;
          user-select: none;
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
      </style>
      <span id="dev-plan-toggle__label">DEV</span>
      <span id="dev-plan-toggle__badge" style="${getBadgeStyle(current)}">${getLabel(current)}</span>
      <button id="dev-plan-toggle__btn" type="button" title="Alternar plano para testes">trocar</button>
    `;

    document.body.appendChild(el);

    el.querySelector('#dev-plan-toggle__btn').addEventListener('click', () => {
      const next = DevPlanOverride.toggle();
      el.querySelector('#dev-plan-toggle__badge').textContent = getLabel(next);
      el.querySelector('#dev-plan-toggle__badge').setAttribute('style', getBadgeStyle(next));
      // Recarrega para aplicar o novo plano em todas as telas
      window.location.reload();
    });
  },

  unmount() {
    document.getElementById(TOGGLE_ID)?.remove();
  },
};
