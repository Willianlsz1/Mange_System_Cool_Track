import { on } from '../../../core/events.js';
import { CustomConfirm } from '../../../core/modal.js';
import { ErrorCodes, handleError } from '../../../core/errors.js';
import {
  saveRegistro,
  clearRegistro,
  applyQuickTemplate,
  setChecklistItemStatus,
  setChecklistItemObs,
  setChecklistItemMeasure,
} from '../../views/registro.js';
import { deleteReg } from '../../views/historico.js';
import { runAsyncAction } from '../../components/actionFeedback.js';

export function bindRegistroHandlers() {
  on('save-registro', async (el) => {
    try {
      await runAsyncAction(el, { loadingLabel: 'Salvando...' }, async () => {
        const saved = await saveRegistro();
        if (!saved) return;
      });
    } catch (error) {
      handleError(error, {
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Não foi possível salvar o registro.',
        context: { action: 'controller.save-registro' },
      });
    }
  });
  on('clear-registro', () => clearRegistro());
  on('quick-service-template', (el) => applyQuickTemplate(el.dataset.template, el));

  // PMOC Fase 3: handlers do checklist NBR. Click nos botões ✓/✗/⊘ alterna
  // status; input no textarea persiste obs no state local. Os handlers só
  // delegam pro state — re-render de DOM acontece dentro do registro.js
  // pra preservar foco em textareas em foco.
  on('r-checklist-set', (el) => {
    const itemId = el.dataset.item;
    const status = el.dataset.status;
    if (!itemId || !status) return;
    setChecklistItemStatus(itemId, status);
  });

  // O textarea do obs usa data-action='r-checklist-obs' mas precisa do evento
  // 'input', não 'click'. Como o delegator global só escuta clicks, fazemos
  // bind direto no nível do body do checklist usando event delegation manual.
  if (typeof document !== 'undefined' && !document.body.dataset.checklistObsBound) {
    document.body.dataset.checklistObsBound = '1';
    document.addEventListener('input', (event) => {
      const target = event.target;
      // Obs textarea
      if (target instanceof HTMLTextAreaElement && target.dataset?.action === 'r-checklist-obs') {
        const itemId = target.dataset.item;
        if (itemId) setChecklistItemObs(itemId, target.value);
        return;
      }
      // PMOC Fase 4: input numérico de medição
      if (target instanceof HTMLInputElement && target.dataset?.action === 'r-checklist-measure') {
        const itemId = target.dataset.item;
        const unit = target.dataset.unit || '';
        if (itemId) setChecklistItemMeasure(itemId, target.value, unit);
      }
    });
  }

  on('delete-reg', async (el) => {
    try {
      const ok = await CustomConfirm.show(
        'Excluir Registro',
        'Este registro sera removido do historico e pode alterar o status atual do equipamento.',
        {
          confirmLabel: 'Excluir registro',
          cancelLabel: 'Cancelar',
          tone: 'danger',
        },
      );
      if (ok) await Promise.resolve(deleteReg(el.dataset.id));
    } catch (error) {
      handleError(error, {
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Não foi possível confirmar a exclusao do registro.',
        context: { action: 'controller.delete-reg', id: el.dataset.id },
      });
    }
  });
}
