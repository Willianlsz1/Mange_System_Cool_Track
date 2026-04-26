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

  // Bug fix #117: actions disparadas pela view /conta (cards "Editar perfil"
  // e "Gerenciar plano"). Antes geravam warning "Sem handler" no console
  // porque essas actions eram declaradas em data-action mas nunca foram
  // bindadas em lugar nenhum. Editar perfil abre o ProfileModal; gerenciar
  // plano vai pra /pricing.
  on('conta-edit-profile', () => ProfileModal.open());
  on('conta-manage-plan', () => goTo('pricing'));

  // Bug fix #119: card "Sair da conta" da view /conta. Confirma antes de
  // deslogar (acao destrutiva — perde sessao + redireciona pra login).
  on('conta-signout', async () => {
    try {
      const { CustomConfirm } = await import('../../../core/modal.js');
      const ok = await CustomConfirm.show(
        'Sair da conta?',
        'Você precisará entrar novamente neste dispositivo.',
        {
          confirmLabel: 'Sair',
          cancelLabel: 'Cancelar',
          tone: 'danger',
          focus: 'cancel',
        },
      );
      if (!ok) return;
      await Auth.signOut();
      window.location.reload();
    } catch (error) {
      handleError(error, {
        code: ErrorCodes.AUTH_FAILED,
        message: 'Não foi possível encerrar a sessão.',
        context: { action: 'controller.conta-signout' },
      });
    }
  });
}
