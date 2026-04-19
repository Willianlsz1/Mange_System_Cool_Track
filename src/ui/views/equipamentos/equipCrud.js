/**
 * CoolTrack Pro - Equipamentos / equipCrud
 *
 * ⚠️  AVISO: este arquivo é CÓDIGO ÓRFÃO — resquício de um refactor não concluído.
 * A versão CANÔNICA de saveEquip/openEditEquip/deleteEquip está em
 * `src/ui/views/equipamentos.js` (usada via `equipmentHandlers.js`).
 *
 * Ao alterar regras de CRUD de equipamento, edite `equipamentos.js`, NÃO este arquivo.
 * Mantido aqui apenas por histórico — deve ser removido quando houver certeza
 * de que nenhuma ferramenta externa (ex: tests de integração) referencia.
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

// Mapa de campo de validação → id do input correspondente no form. Mantido no
// escopo do módulo pra não recriar a cada save.
const EQUIP_FIELD_TO_INPUT_ID = Object.freeze({
  nome: 'eq-nome',
  local: 'eq-local',
  modelo: 'eq-modelo',
  tag: 'eq-tag',
});

// Ids dos inputs de equipamento — iteramos este array ao limpar aria-invalid
// antes de uma nova validação.
const EQUIP_FIELD_INPUT_IDS = Object.freeze(Object.values(EQUIP_FIELD_TO_INPUT_ID));

/**
 * Limpa aria-invalid de todos os campos do form de equipamento. Chamado antes
 * de cada tentativa de save para garantir que o estado reflita apenas os
 * erros da validação atual.
 */
function clearEquipFieldInvalidState() {
  EQUIP_FIELD_INPUT_IDS.forEach((id) => {
    const input = Utils.getEl(id);
    if (input) input.removeAttribute('aria-invalid');
  });
}

/**
 * Marca o input correspondente ao primeiro campo com erro como aria-invalid e
 * move o foco pra ele. Isso garante que leitores de tela anunciem o campo que
 * precisa de atenção quando o usuário dispensar o toast de aviso.
 */
function focusFirstInvalidField(firstErrorField) {
  const inputId = EQUIP_FIELD_TO_INPUT_ID[firstErrorField];
  if (!inputId) return;
  const input = Utils.getEl(inputId);
  if (!input) return;
  input.setAttribute('aria-invalid', 'true');
  // Remove aria-invalid no próximo input pra dar feedback imediato após correção.
  // `once: true` evita acúmulo de listeners se o usuário abrir/fechar o modal.
  input.addEventListener(
    'input',
    () => {
      input.removeAttribute('aria-invalid');
    },
    { once: true },
  );
  try {
    input.focus();
  } catch {
    // Focus pode falhar se o elemento estiver escondido; toast ainda aparece.
  }
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
  clearEquipFieldInvalidState();

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
        // Visitante (sem conta): flow "salve seus dados" (criar conta).
        GuestConversionModal.open({ reason: 'limit_equipamentos', source: 'save-equip' });
      } else if (planLimit.planCode === 'pro') {
        // Pro no teto (30 equipamentos): mensagem específica do Pro.
        GuestConversionModal.open({ reason: 'limit_pro_equipamentos', source: 'save-equip-pro' });
      } else {
        // Free autenticado: flow de UPGRADE para Pro (não "criar conta", já tem).
        GuestConversionModal.open({
          reason: 'limit_free_equipamentos',
          source: 'save-equip-free',
        });
      }
      return false;
    }
  }

  const tipo = Utils.getVal('eq-tipo');
  const criticidade = Utils.getVal('eq-criticidade') || 'media';
  const prioridadeOperacional = Utils.getVal('eq-prioridade') || 'normal';
  // Reset aria-invalid antes de revalidar — garante que campos corrigidos não
  // fiquem com o estado "sujo" de uma tentativa anterior.
  clearEquipFieldInvalidState();
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
    focusFirstInvalidField(payloadValidation.errorFields?.[0]);
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
    // Captura snapshot ANTES do setState pra detectar "primeiro equipamento".
    // Isso cobre o caminho fora do FTX (usuário que pula onboarding e cria equipamento direto).
    const { equipamentos: prevEquipamentos } = getState();
    const isFirstEquipment = prevEquipamentos.length === 0;

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

    if (isFirstEquipment) {
      trackEvent('first_equipment_added', {
        source: 'equip-form',
        tipo,
        fluido: Utils.getVal('eq-fluido'),
      });
    }
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
  clearEquipFieldInvalidState();
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
