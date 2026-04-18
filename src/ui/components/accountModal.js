import { Profile } from '../../features/profile.js';
import {
  getEffectivePlan,
  PLAN_CODE_PLUS,
  PLAN_CODE_PRO,
} from '../../core/subscriptionPlans.js';
import { goTo } from '../../core/router.js';

const ACCOUNT_MODAL_ID = 'account-modal-overlay';

function getInitials(name) {
  return String(name || 'T')
    .split(' ')
    .map((part) => part[0] || '')
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function closeAccountModal() {
  document.getElementById(ACCOUNT_MODAL_ID)?.remove();
}

export function openAccountModal(user, { onEditProfile, onSignOut } = {}) {
  closeAccountModal();

  const profile = Profile.get() || {};
  const name = profile.nome || 'Técnico';
  const email = user?.email || '';

  // Plano: passa o profile real pra getEffectivePlan, que já respeita o dev
  // mode e override de localStorage. Antes passava null e ignorava o plano
  // real do usuário — bug que fazia Plus aparecer como Free.
  const planCode = getEffectivePlan(profile);
  const isPro = planCode === PLAN_CODE_PRO;
  const isPlus = planCode === PLAN_CODE_PLUS;
  const isPaid = isPro || isPlus;

  let planBadgeClass = 'account-modal__plan-badge account-modal__plan-badge--free';
  if (isPro) planBadgeClass = 'account-modal__plan-badge account-modal__plan-badge--pro';
  else if (isPlus) planBadgeClass = 'account-modal__plan-badge account-modal__plan-badge--plus';

  let planLabel = 'Free';
  if (isPro) planLabel = 'Pro';
  else if (isPlus) planLabel = 'Plus';

  const overlay = document.createElement('div');
  overlay.id = ACCOUNT_MODAL_ID;
  overlay.className = 'modal-overlay is-open account-modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', 'Menu da conta');

  overlay.innerHTML = `
    <div class="modal account-modal" role="menu">

      <div class="account-modal__header">
        <div class="account-modal__avatar"></div>
        <div class="account-modal__identity">
          <div class="account-modal__name"></div>
          <div class="account-modal__email"></div>
        </div>
      </div>

      <div class="account-modal__plan-row">
        <span class="account-modal__plan-label">Plano atual</span>
        ${
          isPaid
            ? `<span class="${planBadgeClass}">✓ ${planLabel}</span>`
            : `<div style="display:flex;align-items:center;gap:6px;">
               <span class="${planBadgeClass}">${planLabel}</span>
               <button type="button" class="account-modal__upgrade-btn" id="btn-upgrade-plan">
                 Fazer upgrade →
               </button>
             </div>`
        }
      </div>

      <div class="account-modal__actions">
        <button type="button" class="account-modal__action account-modal__action--neutral" id="btn-edit-profile">
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
            <circle cx="7.5" cy="5" r="3" stroke="currentColor" stroke-width="1.2"></circle>
            <path d="M2 14c0-3 2.5-4.5 5.5-4.5S13 11 13 14" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"></path>
          </svg>
          Editar perfil
        </button>
        ${
          isPaid
            ? `
        <button type="button" class="account-modal__action account-modal__action--neutral" id="btn-manage-plan">
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
            <rect x="1.5" y="3.5" width="12" height="9" rx="1.5" stroke="currentColor" stroke-width="1.2"></rect>
            <path d="M1.5 6.5h12" stroke="currentColor" stroke-width="1.2"></path>
          </svg>
          Gerenciar assinatura
        </button>`
            : ''
        }
        <button type="button" class="account-modal__action account-modal__action--danger" id="btn-signout">
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
            <path d="M6 2H3a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"></path>
            <path d="M10 10l3-2.5L10 5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"></path>
            <path d="M13 7.5H6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"></path>
          </svg>
          Sair da conta
        </button>
      </div>

    </div>
  `;

  // Preenche conteúdo dinâmico
  const avatarEl = overlay.querySelector('.account-modal__avatar');
  const nameEl = overlay.querySelector('.account-modal__name');
  const emailEl = overlay.querySelector('.account-modal__email');
  if (avatarEl) avatarEl.textContent = getInitials(name);
  if (nameEl) nameEl.textContent = name;
  if (emailEl) emailEl.textContent = email;

  // Fechar ao clicar fora
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) closeAccountModal();
  });

  // Fechar com Escape
  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      closeAccountModal();
      document.removeEventListener('keydown', onKeyDown);
    }
  };
  document.addEventListener('keydown', onKeyDown);

  overlay.querySelector('#btn-edit-profile')?.addEventListener('click', () => {
    closeAccountModal();
    onEditProfile?.();
  });

  overlay.querySelector('#btn-upgrade-plan')?.addEventListener('click', () => {
    closeAccountModal();
    goTo('pricing');
  });

  overlay.querySelector('#btn-manage-plan')?.addEventListener('click', () => {
    closeAccountModal();
    goTo('pricing');
  });

  overlay.querySelector('#btn-signout')?.addEventListener('click', () => {
    closeAccountModal();
    onSignOut?.();
  });

  document.body.appendChild(overlay);
}
