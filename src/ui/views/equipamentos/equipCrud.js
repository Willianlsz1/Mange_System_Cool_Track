/**
 * CoolTrack Pro - Equipamentos / equipCrud
 * Fluxos CRUD do equipamento: criar/editar (saveEquip), abrir edição (openEditEquip)
 * e excluir (deleteEquip).
 */

import { Utils } from '../../../core/utils.js';
import { getState, findEquip, setState } from '../../../core/state.js';
import { Storage } from '../../../core/storage.js';
import { Toast } from '../../../core/toast.js';
import { OnboardingBanner } from '../../components/onboarding.js';
import { ErrorCodes, handleError } from '../../../core/errors.js';
import { checkPlanLimit, isGuestMode } from '../../../core/guestLimits.js';
import { GuestConversionModal } from '../../components/guestConversionModal.js';
import { trackEvent } from '../../../core/telemetry.js';
import {
  getSuggestedPreventiveDays,
  normalizePeriodicidadePreventivaDias,
} from '../../../domain/maintenance.js';
import { validateEquipamentoPayload } from '../../../core/inputValidation.js';
import { updateHeader } from '../dashboard.js';

// ─── Edit mode tracking ────────────────────────────────────────────────────
let _editingEquipId = null;

/**
 * Callback de re-render injetado pelo orquestrador (evita ciclos com equipamentos.js).
 * @type {() => void}
 */
let _renderAfterChange = () => {};
export function setRenderCallback(fn) {
  _renderAfterChange = typeof fn === 'function' ? fn : () => {};
}

export async function openEditEquip(id) {
  const eq = findEquip(id);
  if (!eq) return;

  _editingEquipId = id;

  // Pre-fill modal fields
  Utils.setVal('eq-nome', eq.nome || '');
  Utils.setVal('eq-local', eq.local || '');
  Utils.setVal('eq-tag', eq.tag || '');
  Utils.setVal('eq-tipo', eq.tipo || 'Split Hi-Wall');
  Utils.setVal('eq-fluido', eq.fluido || 'R-410A');
  Utils.setVal('eq-modelo', eq.modelo || '');
  Utils.setVal('eq-criticidade', eq.criticidade || 'media');
  Utils.setVal('eq-prioridade', eq.prioridadeOperacional || 'normal');
  Utils.setVal('eq-periodicidade', String(eq.periodicidadePreventivaDias || 90));

  // Show details panel
  const detailsPanel = Utils.getEl('eq-step-2');
  if (detailsPanel) {
    detailsPanel.style.display = 'block';
    detailsPanel.setAttribute('aria-hidden', 'false');
  }

  // Update modal title and button text
  const titleEl = Utils.getEl('modal-add-eq-title');
  if (titleEl) titleEl.textContent = 'Editar equipamento';

  const saveBtn = document.querySelector('[data-action="save-equip"]');
  if (saveBtn) saveBtn.textContent = 'Salvar alterações →';

  // Open modal
  try {
    const { Modal: M } = await import('../../../core/modal.js');
    M.open('modal-add-eq');
  } catch (error) {
    handleError(error, {
      code: ErrorCodes.NETWORK_ERROR,
      message: 'Não foi possível abrir o modal de edição.',
      context: { action: 'equipamentos.openEditEquip', id },
    });
  }
}

export async function saveEquip() {
  const isGuest = isGuestMode();
  const { equipamentos } = getState();

  // Skip plan limit check when editing
  if (!_editingEquipId) {
    const planLimit = await checkPlanLimit('equipamentos', equipamentos.length);
    if (planLimit.blocked) {
      trackEvent('limit_reached', {
        resource: 'equipamentos',
        current: planLimit.current,
        limit: planLimit.limit,
        planCode: planLimit.planCode,
      });
      if (planLimit.isGuest) {
        GuestConversionModal.open({ reason: 'limit_equipamentos', source: 'save-equip' });
      } else if (planLimit.planCode === 'pro') {
        GuestConversionModal.open({ reason: 'limit_pro_equipamentos', source: 'save-equip-pro' });
      } else {
        GuestConversionModal.open({ reason: 'limit_equipamentos', source: 'save-equip' });
      }
      return false;
    }
  }

  const tipo = Utils.getVal('eq-tipo');
  const criticidade = Utils.getVal('eq-criticidade') || 'media';
  const prioridadeOperacional = Utils.getVal('eq-prioridade') || 'normal';
  const payloadValidation = validateEquipamentoPayload(
    {
      nome: Utils.getVal('eq-nome'),
      local: Utils.getVal('eq-local'),
      tag: Utils.getVal('eq-tag'),
      modelo: Utils.getVal('eq-modelo'),
    },
    { existingEquipamentos: equipamentos, editingId: _editingEquipId },
  );

  if (!payloadValidation.valid) {
    Toast.warning(payloadValidation.errors[0]);
    return false;
  }

  const periodicidadePreventivaDias = normalizePeriodicidadePreventivaDias(
    Utils.getVal('eq-periodicidade'),
    tipo,
    criticidade,
  );

  const setorId = Utils.getVal('eq-setor') || null;

  if (_editingEquipId) {
    setState((prev) => ({
      ...prev,
      equipamentos: prev.equipamentos.map((e) =>
        e.id === _editingEquipId
          ? {
              ...e,
              nome: payloadValidation.value.nome,
              local: payloadValidation.value.local,
              tag: payloadValidation.value.tag,
              tipo,
              modelo: payloadValidation.value.modelo,
              fluido: Utils.getVal('eq-fluido'),
              criticidade,
              prioridadeOperacional,
              periodicidadePreventivaDias,
              setorId,
            }
          : e,
      ),
    }));
  } else {
    setState((prev) => ({
      ...prev,
      equipamentos: [
        ...prev.equipamentos,
        {
          id: Utils.uid(),
          nome: payloadValidation.value.nome,
          local: payloadValidation.value.local,
          status: 'ok',
          tag: payloadValidation.value.tag,
          tipo,
          modelo: payloadValidation.value.modelo,
          fluido: Utils.getVal('eq-fluido'),
          criticidade,
          prioridadeOperacional,
          periodicidadePreventivaDias,
          setorId,
        },
      ],
    }));
  }

  try {
    const { Modal: M } = await import('../../../core/modal.js');
    M.close('modal-add-eq');
  } catch (error) {
    handleError(error, {
      code: ErrorCodes.NETWORK_ERROR,
      message: 'Não foi possível fechar o modal de cadastro.',
      context: { action: 'equipamentos.saveEquip.closeModal' },
      severity: 'warning',
    });
  }

  // Reset modal UI
  const titleEl = Utils.getEl('modal-add-eq-title');
  if (titleEl) titleEl.textContent = 'Qual equipamento você quer monitorar?';

  const saveBtn = document.querySelector('[data-action="save-equip"]');
  if (saveBtn) saveBtn.textContent = 'Cadastrar equipamento →';

  const detailsPanel = Utils.getEl('eq-step-2');
  if (detailsPanel && _editingEquipId) {
    detailsPanel.style.display = '';
    detailsPanel.setAttribute('aria-hidden', 'true');
  }

  const wasEditing = Boolean(_editingEquipId);
  _editingEquipId = null;

  Utils.clearVals('eq-nome', 'eq-tag', 'eq-local', 'eq-modelo', 'eq-periodicidade');
  Utils.setVal('eq-tipo', 'Split Hi-Wall');
  Utils.setVal('eq-fluido', 'R-410A');
  Utils.setVal('eq-criticidade', 'media');
  Utils.setVal('eq-prioridade', 'normal');
  Utils.setVal('eq-periodicidade', String(getSuggestedPreventiveDays('Split Hi-Wall', 'media')));
  const periodicidadeInput = Utils.getEl('eq-periodicidade');
  if (periodicidadeInput) periodicidadeInput.dataset.manual = '0';

  OnboardingBanner.remove();
  try {
    const { renderDashboard } = await import('../dashboard.js');
    renderDashboard();
  } catch (error) {
    handleError(error, {
      code: ErrorCodes.NETWORK_ERROR,
      message: 'Equipamento salvo, mas houve falha ao atualizar o painel.',
      context: { action: 'equipamentos.saveEquip.renderDashboard' },
      severity: 'warning',
    });
  }
  _renderAfterChange();
  updateHeader();
  Toast.success(wasEditing ? 'Equipamento atualizado.' : 'Equipamento cadastrado.');

  if (isGuest && !wasEditing) {
    GuestConversionModal.open({ reason: 'save_attempt', source: 'save-equip' });
  }

  return true;
}

export async function deleteEquip(id) {
  const { registros } = getState();
  const linkedRegistros = registros.filter((r) => r.equipId === id).map((r) => r.id);
  Storage.markEquipDeleted(id, linkedRegistros);

  setState((prev) => ({
    ...prev,
    equipamentos: prev.equipamentos.filter((e) => e.id !== id),
    registros: prev.registros.filter((r) => r.equipId !== id),
  }));
  try {
    const { Modal: M } = await import('../../../core/modal.js');
    M.close('modal-eq-det');
  } catch (error) {
    handleError(error, {
      code: ErrorCodes.NETWORK_ERROR,
      message: 'Equipamento removido, mas não foi possível fechar o modal.',
      context: { action: 'equipamentos.deleteEquip.closeModal', id },
      severity: 'warning',
    });
  }
  _renderAfterChange();
  updateHeader();
  Toast.info('Equipamento removido.');
}
