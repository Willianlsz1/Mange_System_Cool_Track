import { on } from '../../../core/events.js';
import { Auth } from '../../../core/auth.js';
import { ErrorCodes, handleError } from '../../../core/errors.js';
import { goTo } from '../../../core/router.js';
import { ProfileModal } from '../../components/onboarding.js';

/**
 * "open-profile" agora navega pra /conta (full page) em vez de abrir o
 * popover accountModal. Mantemos o nome da action por compatibilidade
 * com data-action="open-profile" no header e no sidebar user-chip.
 *
 * Se o usuário ainda não tem perfil preenchido (Auth.getUser sem retorno),
 * abrimos o ProfileModal direto — fluxo de onboarding inicial.
 */
function openAccountPage() {
  Auth.getUser()
    .then((user) => {
      if (!user) {
        // Sem sessão real — onboarding modal cobre o gap.
        ProfileModal.open();
        return;
      }
      goTo('conta');
    })
    .catch((error) => {
      handleError(error, {
        code: ErrorCodes.AUTH_FAILED,
        message: 'Nao foi possivel carregar o perfil da conta.',
        context: { action: 'controller.open-profile' },
      });
      // Fallback: pelo menos abre o modal de perfil pra não travar o usuário.
      ProfileModal.open();
    });
}

export function bindProfileAccountHandlers() {
  // Header avatar: data-action="open-profile" → vai pra /conta
  on('open-profile', () => openAccountPage());
  // Sidebar user-chip: data-action="open-profile-modal" → mesmo destino,
  // mantido como alias pra não quebrar quem ainda usar o nome antigo.
  on('open-profile-modal', () => openAccountPage());
}
