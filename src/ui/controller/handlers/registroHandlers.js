import { on } from '../../../core/events.js';
import { CustomConfirm } from '../../../core/modal.js';
import { ErrorCodes, handleError } from '../../../core/errors.js';
import { saveRegistro, clearRegistro } from '../../views/registro.js';
import { deleteReg } from '../../views/historico.js';

export function bindRegistroHandlers() {
  on('save-registro', () => saveRegistro());
  on('clear-registro', () => clearRegistro());

  on('delete-reg', async (el) => {
    try {
      const ok = await CustomConfirm.show(
        'Excluir Registro',
        'Remover este registro do historico?',
      );
      if (ok) deleteReg(el.dataset.id);
    } catch (error) {
      handleError(error, {
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Nao foi possivel confirmar a exclusao do registro.',
        context: { action: 'controller.delete-reg', id: el.dataset.id },
      });
    }
  });
}
