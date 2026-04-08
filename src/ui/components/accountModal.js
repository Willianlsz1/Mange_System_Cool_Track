import { Profile } from '../../features/profile.js';

const ACCOUNT_MODAL_ID = 'account-modal-overlay';

function getInitials(name) {
  return String(name || 'Tecnico')
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
  const name = profile.nome || 'Tecnico';
  const email = user?.email || '';

  const overlay = document.createElement('div');
  overlay.id = ACCOUNT_MODAL_ID;
  overlay.className = 'modal-overlay is-open account-modal-overlay';
  overlay.innerHTML = `
    <div class="modal account-modal">
      <div class="account-modal__header">
        <div class="account-modal__avatar"></div>
        <div class="account-modal__identity">
          <div class="account-modal__name"></div>
          <div class="account-modal__email"></div>
        </div>
      </div>
      <div class="account-modal__actions">
        <button type="button" class="account-modal__action account-modal__action--neutral" id="btn-edit-profile">
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
            <circle cx="7.5" cy="5" r="3" stroke="currentColor" stroke-width="1.2"></circle>
            <path d="M2 14c0-3 2.5-4.5 5.5-4.5S13 11 13 14" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"></path>
          </svg>
          Editar perfil
        </button>
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

  const avatarEl = overlay.querySelector('.account-modal__avatar');
  const nameEl = overlay.querySelector('.account-modal__name');
  const emailEl = overlay.querySelector('.account-modal__email');
  if (avatarEl) avatarEl.textContent = getInitials(name);
  if (nameEl) nameEl.textContent = name;
  if (emailEl) emailEl.textContent = email;

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) closeAccountModal();
  });

  overlay.querySelector('#btn-edit-profile')?.addEventListener('click', () => {
    closeAccountModal();
    onEditProfile?.();
  });

  overlay.querySelector('#btn-signout')?.addEventListener('click', () => {
    closeAccountModal();
    onSignOut?.();
  });

  document.body.appendChild(overlay);
}
