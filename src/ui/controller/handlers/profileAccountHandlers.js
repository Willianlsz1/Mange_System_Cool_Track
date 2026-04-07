import { on } from '../../../core/events.js';
import { Auth } from '../../../core/auth.js';
import { ErrorCodes, handleError } from '../../../core/errors.js';
import { ProfileModal } from '../../components/onboarding.js';
import { openAccountModal } from '../../components/accountModal.js';

function openAccountOrProfile() {
  const isGuest = localStorage.getItem('cooltrack-guest-mode') === '1';
  if (isGuest) {
    ProfileModal.open();
    return;
  }

  Auth.getUser()
    .then((user) => {
      if (!user) {
        ProfileModal.open();
        return;
      }

      openAccountModal(user, {
        onEditProfile: () => ProfileModal.open(),
        onSignOut: () => {
          localStorage.removeItem('cooltrack-guest-mode');
          localStorage.removeItem('cooltrack-ftx-done');
          Auth.signOut();
        },
      });
    })
    .catch((error) => {
      handleError(error, {
        code: ErrorCodes.AUTH_FAILED,
        message: 'Nao foi possivel carregar o perfil da conta.',
        context: { action: 'controller.open-profile' },
      });
      ProfileModal.open();
    });
}

export function bindProfileAccountHandlers() {
  on('open-profile', () => openAccountOrProfile());
}
