/**
 * CoolTrack Pro - Equipamentos / setorCrud
 * Operações CRUD de setor (criar, excluir, atribuir equip → setor) e color picker.
 */

import { Utils } from '../../../core/utils.js';
import { getState, setState, findEquip, findSetor } from '../../../core/state.js';
import { Toast } from '../../../core/toast.js';

/**
 * Callback de re-render injetado pelo orquestrador (evita ciclos com equipamentos.js).
 * @type {() => void}
 */
let _renderAfterChange = () => {};
export function setRenderCallback(fn) {
  _renderAfterChange = typeof fn === 'function' ? fn : () => {};
}

/**
 * Callback para sinalizar que o setor atualmente ativo foi removido.
 * @type {(id: string) => void}
 */
let _onSectorDeleted = () => {};
export function setSectorDeletedCallback(fn) {
  _onSectorDeleted = typeof fn === 'function' ? fn : () => {};
}

/**
 * Mantém o container CONTEXTO visível só quando pelo menos um filho
 * (setor ou fotos) está ativo. Mantém modal enxuto para usuários Free.
 */
function syncContextGroupVisibility() {
  const group = Utils.getEl('eq-context-group');
  if (!group) return;
  const setorVisible = Utils.getEl('eq-setor-wrapper')?.style.display !== 'none';
  const fotosVisible = Utils.getEl('eq-fotos-wrapper')?.style.display !== 'none';
  group.style.display = setorVisible || fotosVisible ? '' : 'none';
}

/** Popula o select de setores no modal de cadastro de equipamento. */
export function populateSetorSelect(isPro = false) {
  const wrapper = Utils.getEl('eq-setor-wrapper');
  const select = Utils.getEl('eq-setor');
  if (!wrapper || !select) {
    syncContextGroupVisibility();
    return;
  }

  if (!isPro) {
    wrapper.style.display = 'none';
    syncContextGroupVisibility();
    return;
  }

  const { setores } = getState();
  if (!setores.length) {
    wrapper.style.display = 'none';
    syncContextGroupVisibility();
    return;
  }

  wrapper.style.display = '';
  select.innerHTML = '<option value="">Sem setor</option>';
  setores.forEach((s) => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.nome;
    select.appendChild(opt);
  });
  syncContextGroupVisibility();
}

/** Inicializa o color picker do modal de setor. */
export function initSetorColorPicker() {
  const picker = Utils.getEl('setor-color-picker');
  const hiddenInput = Utils.getEl('setor-cor');
  if (!picker || !hiddenInput) return;

  picker.querySelectorAll('.setor-color-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      picker.querySelectorAll('.setor-color-btn').forEach((b) => {
        b.classList.remove('setor-color-btn--selected');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('setor-color-btn--selected');
      btn.setAttribute('aria-pressed', 'true');
      if (hiddenInput) hiddenInput.value = btn.dataset.cor;
    });
  });
}

export async function saveSetor() {
  const nome = (Utils.getVal('setor-nome') || '').trim();
  if (!nome) {
    Toast.warning('Digite um nome para o setor.');
    return false;
  }

  const cor = Utils.getEl('setor-cor')?.value || '#00bcd4';

  setState((prev) => ({
    ...prev,
    setores: [...(prev.setores || []), { id: Utils.uid(), nome, cor }],
  }));

  try {
    const { Modal: M } = await import('../../../core/modal.js');
    M.close('modal-add-setor');
  } catch {
    /* ignora */
  }

  // Limpa form
  Utils.setVal('setor-nome', '');
  const picker = Utils.getEl('setor-color-picker');
  if (picker) {
    picker.querySelectorAll('.setor-color-btn').forEach((b, i) => {
      b.classList.toggle('setor-color-btn--selected', i === 0);
      b.setAttribute('aria-pressed', i === 0 ? 'true' : 'false');
    });
    const hi = Utils.getEl('setor-cor');
    if (hi) hi.value = '#00bcd4';
  }

  Toast.success(`Setor "${nome}" criado.`);
  _renderAfterChange();
  return true;
}

export async function deleteSetor(id) {
  if (id === '__sem_setor__') return;

  setState((prev) => ({
    ...prev,
    setores: (prev.setores || []).filter((s) => s.id !== id),
    equipamentos: prev.equipamentos.map((e) => (e.setorId === id ? { ...e, setorId: null } : e)),
  }));

  _onSectorDeleted(id);
  Toast.info('Setor removido. Os equipamentos foram movidos para "Sem setor".');
  _renderAfterChange();
}

/**
 * Atribui (ou remove) um setor a um equipamento já cadastrado.
 * Chamado pelo select inline no modal de detalhes.
 */
export function assignEquipToSetor(equipId, setorId) {
  const eq = findEquip(equipId);
  if (!eq) return;
  setState((prev) => ({
    ...prev,
    equipamentos: prev.equipamentos.map((e) =>
      e.id === equipId ? { ...e, setorId: setorId || null } : e,
    ),
  }));
  const setor = setorId ? findSetor(setorId) : null;
  const label = setor ? `"${setor.nome}"` : '"Sem setor"';
  Toast.success(`${Utils.escapeHtml(eq.nome)} movido para ${label}.`);
  _renderAfterChange();
}
