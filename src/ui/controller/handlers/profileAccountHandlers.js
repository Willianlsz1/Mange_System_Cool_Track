import { on } from '../../../core/events.js';
import { Auth } from '../../../core/auth.js';
import { ErrorCodes, handleError } from '../../../core/errors.js';
import { fetchMyProfileBilling } from '../../../core/plans/monetization.js';
import { ProfileModal } from '../../components/onboarding.js';
import { openAccountModal } from '../../components/accountModal.js';

async function resolveBillingProfile() {
  try {
    const { profile } = await fetchMyProfileBilling();
    return profile;
  } catch {
    // Falha no fetch (offline, erro de rede) — modal usa fallback local.
    // Não bloqueia abertura do menu.
    return null;
  }
}

function openAccountOrProfile() {
  const isGuest = localStorage.getItem('cooltrack-guest-mode') === '1';
  if (isGuest) {
    ProfileModal.open();
    return;
  }

  Auth.getUser()
    .then(async (user) => {
      if (!user) {
        ProfileModal.open();
        return;
      }

      const billingProfile = await resolveBillingProfile();

      openAccountModal(user, {
        billingProfile,
        onEditProfile: () => ProfileModal.open(),
        onSignOut: () => {
          localStorage.removeItem('cooltrack-guest-mode');
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
