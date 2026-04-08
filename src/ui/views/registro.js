/**
 * CoolTrack Pro - Registro View v5.0
 * Funções: initRegistro, saveRegistro, clearRegistro
 */

import { Utils } from '../../core/utils.js';
import { getState, findEquip, setState, lastRegForEquip } from '../../core/state.js';
import { Toast } from '../../core/toast.js';
import { goTo } from '../../core/router.js';
import { Photos } from '../components/photos.js';
import { SavedHighlight } from '../components/onboarding.js';
import { Profile } from '../../features/profile.js';
import { ErrorCodes, handleError } from '../../core/errors.js';
import { uploadPendingPhotos } from '../../core/photoStorage.js';

const CONTAINER_ID = 'form-progress-container-v5';

// ── Barra de progresso do formulário ──────────────────
const _fields = [
  { id: 'r-equip', validate: (v) => v !== '' },
  { id: 'r-data', validate: (v) => v !== '' },
  { id: 'r-tipo', validate: (v) => v !== '' },
  { id: 'r-tecnico', validate: (v) => v.trim() !== '' },
  { id: 'r-obs', validate: (v) => v.trim().length >= 10 },
];

function _ensureProgressBar(formView) {
  if (document.getElementById(CONTAINER_ID)) return;
  const c = document.createElement('div');
  c.id = CONTAINER_ID;
  c.className = 'form-progress';
  c.innerHTML = `<div class="form-progress__text"><span>Campos preenchidos</span><span id="form-progress-count">0/${_fields.length}</span></div>
    <div class="form-progress__bar"><div class="form-progress__fill" id="form-progress-fill"></div></div>`;
  formView.querySelector('.card')?.insertBefore(c, formView.querySelector('.card').firstChild);
}

function _updateProgressBar() {
  const filled = _fields.filter((f) => {
    const i = Utils.getEl(f.id);
    return i && f.validate(i.value);
  }).length;
  const bar = document.getElementById('form-progress-fill');
  const cnt = document.getElementById('form-progress-count');
  if (bar) bar.style.width = `${(filled / _fields.length) * 100}%`;
  if (cnt) cnt.textContent = `${filled}/${_fields.length}`;
}

// ── Aviso de manutenção agendada ───────────────────────
function _bindEquipChangeWarning() {
  const sel = Utils.getEl('r-equip');
  if (!sel) return;
  sel.addEventListener('change', () => {
    const id = sel.value;
    document.getElementById('reg-pending-warning')?.remove();
    if (!id) return;
    const lastReg = lastRegForEquip(id);
    if (lastReg && Utils.daysDiff(lastReg.proxima) >= 0) {
      const w = document.createElement('div');
      w.id = 'reg-pending-warning';
      w.className = 'reg-pending-warning';
      w.textContent = '⚠ Manutenção preventiva agendada. Registre apenas em emergência.';
      sel.parentNode.parentNode.insertBefore(w, sel.parentNode.nextSibling);
    }
  });
}

// ═══════════════════════════════════════════════════════
// API PÚBLICA
// ═══════════════════════════════════════════════════════

export function initRegistro() {
  const formView = Utils.getEl('view-registro');
  if (!formView) return;

  _ensureProgressBar(formView);
  if (!formView.dataset.bound) {
    _fields.forEach((f) => {
      const i = Utils.getEl(f.id);
      if (i) {
        i.addEventListener('input', _updateProgressBar);
        i.addEventListener('change', _updateProgressBar);
      }
    });
    _bindEquipChangeWarning();
    formView.dataset.bound = '1';
  }
  _updateProgressBar();

  // Data padrão
  if (!Utils.getVal('r-data')) Utils.setVal('r-data', Utils.nowDatetime());

  // H1: técnico padrão
  const rTecnico = Utils.getEl('r-tecnico');
  if (rTecnico && !rTecnico.value) {
    const def = Profile.getDefaultTecnico();
    if (def) rTecnico.value = def;
  }
}

export async function saveRegistro() {
  if (localStorage.getItem('cooltrack-guest-mode') === '1') {
    Toast.info('Crie uma conta grátis para salvar seus registros.');
    try {
      const { AuthScreen } = await import('../components/authscreen.js');
      AuthScreen.show();
    } catch (error) {
      handleError(error, {
        code: ErrorCodes.NETWORK_ERROR,
        message: 'Não foi possível abrir a tela de cadastro no momento.',
        context: { action: 'registro.saveRegistro.authscreen' },
      });
    }
    return;
  }
  const equipId = Utils.getVal('r-equip');
  const data = Utils.getVal('r-data');
  const tipo = Utils.getVal('r-tipo');
  const obs = Utils.getVal('r-obs').trim();
  const tecnico = Utils.getVal('r-tecnico').trim();

  const missing = [];
  if (!equipId) missing.push('Equipamento');
  if (!data) missing.push('Data');
  if (!tipo) missing.push('Tipo de Serviço');
  if (!tecnico) missing.push('Técnico Responsável');
  if (!obs || obs.length < 10) missing.push('Descrição (mín. 10 caracteres)');
  if (missing.length) {
    Toast.warning(`Campos obrigatórios: ${missing.join(', ')}`);
    return;
  }

  const proxima = Utils.getVal('r-proxima');
  if (proxima && proxima < data.slice(0, 10)) {
    Toast.error('Próxima manutenção não pode ser anterior ao serviço.');
    return;
  }

  const status = Utils.getVal('r-status');
  const custoPecas = parseFloat(Utils.getVal('r-custo-pecas') || '0') || 0;
  const custoMaoObra = parseFloat(Utils.getVal('r-custo-mao-obra') || '0') || 0;

  Profile.saveLastTecnico(tecnico);

  // Modo edição — atualiza registro existente
  const editingId = sessionStorage.getItem('cooltrack-editing-id');
  if (editingId) {
    setState((prev) => ({
      ...prev,
      registros: prev.registros.map((r) =>
        r.id === editingId
          ? {
              ...r,
              equipId,
              data,
              tipo,
              obs,
              tecnico,
              status,
              pecas: Utils.getVal('r-pecas').trim(),
              proxima: Utils.getVal('r-proxima'),
              custoPecas,
              custoMaoObra,
            }
          : r,
      ),
      equipamentos: prev.equipamentos.map((e) => (e.id === equipId ? { ...e, status } : e)),
    }));
    sessionStorage.removeItem('cooltrack-editing-id');
    clearRegistro();
    Toast.success('Registro atualizado.');
    goTo('historico');
    return;
  }

  // Modo criação — continua fluxo normal
  const novoId = Utils.uid();
  let fotosRegistro = [...Photos.pending];

  // D1: assinatura digital
  let assinatura = null;
  let SignatureModal;
  let saveSignatureForRecord;
  try {
    ({ SignatureModal, saveSignatureForRecord } = await import('../components/signature.js'));
  } catch (error) {
    handleError(error, {
      code: ErrorCodes.NETWORK_ERROR,
      severity: 'warning',
      message: 'Não foi possível carregar o módulo de assinatura.',
      context: { action: 'registro.saveRegistro.signatureImport' },
    });
  }
  const eq = findEquip(equipId);
  if (SignatureModal?.request) {
    try {
      assinatura = await SignatureModal.request(novoId, eq?.nome || 'Equipamento');
      if (assinatura && saveSignatureForRecord) saveSignatureForRecord(novoId, assinatura);
    } catch (error) {
      handleError(error, {
        code: ErrorCodes.VALIDATION_ERROR,
        severity: 'warning',
        message: 'Não foi possível registrar a assinatura digital.',
        context: { action: 'registro.saveRegistro.signatureRequest', registroId: novoId },
      });
    }
  }

  if (fotosRegistro.length > 0) {
    try {
      const uploadResult = await uploadPendingPhotos(fotosRegistro, { recordId: novoId });
      fotosRegistro = uploadResult.photos;
      if (uploadResult.failedCount > 0) {
        Toast.warning(
          'Algumas fotos não puderam ser enviadas para a nuvem e ficaram salvas localmente.',
        );
      }
    } catch (error) {
      handleError(error, {
        code: ErrorCodes.SYNC_FAILED,
        severity: 'warning',
        message: 'Falha no upload das fotos. O registro será salvo com fallback local.',
        context: { action: 'registro.saveRegistro.photoUpload', registroId: novoId },
      });
    }
  }

  setState((prev) => {
    const currentTecs = prev.tecnicos || [];
    const updatedTecs =
      tecnico && !currentTecs.includes(tecnico) ? [...currentTecs, tecnico] : currentTecs;
    return {
      ...prev,
      tecnicos: updatedTecs,
      registros: [
        ...prev.registros,
        {
          id: novoId,
          equipId,
          data,
          tipo,
          obs,
          status,
          pecas: Utils.getVal('r-pecas').trim(),
          proxima,
          fotos: fotosRegistro,
          tecnico,
          custoPecas,
          custoMaoObra,
          assinatura: assinatura ? true : false,
        },
      ],
      equipamentos: prev.equipamentos.map((e) => (e.id === equipId ? { ...e, status } : e)),
    };
  });

  SavedHighlight.markForHighlight(novoId);
  clearRegistro();
  Toast.success('Serviço registrado com sucesso.');

  const { registros } = getState();
  if (registros.length > 0 && registros.length % 3 === 0) {
    setTimeout(
      () =>
        Toast.info(
          `💡 Você tem ${registros.length} registros. Gere um relatório PDF para enviar ao cliente.`,
        ),
      1800,
    );
  }

  goTo('historico');
}

export function clearRegistro(preserveEquip = false) {
  const toClear = [
    'r-tipo',
    'r-pecas',
    'r-obs',
    'r-proxima',
    'r-tecnico',
    'r-custo-pecas',
    'r-custo-mao-obra',
  ];
  if (!preserveEquip) toClear.push('r-equip');
  Utils.clearVals(...toClear);
  Utils.setVal('r-status', 'ok');
  Utils.setVal('r-data', Utils.nowDatetime());
  Photos.clear();
  document.getElementById(CONTAINER_ID)?.remove();

  const rTecnico = Utils.getEl('r-tecnico');
  if (rTecnico) rTecnico.value = Profile.getDefaultTecnico();

  const saveBtn = document.querySelector('[data-action="save-registro"]');
  if (saveBtn) {
    saveBtn.textContent = 'Salvar registro';
    saveBtn.classList.remove('btn--editing');
  }
  const title = document.querySelector('#view-registro .section-title');
  if (title) title.textContent = 'O que foi feito hoje?';
}
export function loadRegistroForEdit(id) {
  const { registros } = getState();
  const r = registros.find((r) => r.id === id);
  if (!r) return;

  sessionStorage.setItem('cooltrack-editing-id', id);

  Utils.setVal('r-equip', r.equipId);
  Utils.setVal('r-data', r.data);
  Utils.setVal('r-tipo', r.tipo);
  Utils.setVal('r-obs', r.obs);
  Utils.setVal('r-tecnico', r.tecnico);
  Utils.setVal('r-pecas', r.pecas || '');
  Utils.setVal('r-custo-pecas', String(r.custoPecas || ''));
  Utils.setVal('r-custo-mao-obra', String(r.custoMaoObra || ''));
  Utils.setVal('r-proxima', r.proxima || '');
  Utils.setVal('r-status', r.status);

  const btn = document.querySelector('[data-action="save-registro"]');
  if (btn) {
    btn.textContent = 'Salvar alterações';
    btn.classList.add('btn--editing');
  }

  const title = document.querySelector('#view-registro .section-title');
  if (title) title.textContent = 'Editar registro';
}
