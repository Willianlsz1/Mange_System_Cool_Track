/**
 * CoolTrack Pro - Registro View v5.0
 * FunÃ§Ãµes: initRegistro, saveRegistro, clearRegistro
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
import { getOperationalStatus, validateOperationalPayload } from '../../core/equipmentRules.js';
import { checkGuestLimit, isGuestMode } from '../../core/guestLimits.js';
import { GuestConversionModal } from '../components/guestConversionModal.js';
import { trackEvent } from '../../core/telemetry.js';
import { withViewSkeleton } from '../components/skeleton.js';
import { validateRegistroPayload } from '../../core/inputValidation.js';

const CONTAINER_ID = 'form-progress-container-v5';
const QUICK_TEMPLATE_MAP = {
  limpeza: {
    tipo: 'Limpeza de Filtros',
    prioridade: 'media',
    descricao:
      'Limpeza preventiva realizada no equipamento. Filtros higienizados e operaÃ§Ã£o validada em funcionamento normal.',
  },
  recarga_gas: {
    tipo: 'Carga de GÃ¡s Refrigerante',
    prioridade: 'alta',
    descricao:
      'Recarga de gÃ¡s refrigerante aplicada apÃ³s verificaÃ§Ã£o de pressÃ£o e vedaÃ§Ã£o. Sistema estabilizado para operaÃ§Ã£o.',
  },
  troca_filtro: {
    tipo: 'Limpeza de Filtros',
    prioridade: 'media',
    descricao:
      'Troca de filtro executada para restabelecer vazÃ£o de ar e qualidade da operaÃ§Ã£o. Equipamento testado apÃ³s a substituiÃ§Ã£o.',
  },
  inspecao: {
    tipo: 'InspeÃ§Ã£o Geral',
    prioridade: 'baixa',
    descricao:
      'InspeÃ§Ã£o tÃ©cnica geral concluÃ­da com checklist visual e funcional. Sem anomalias crÃ­ticas no momento.',
  },
  manutencao_corretiva: {
    tipo: 'ManutenÃ§Ã£o Corretiva',
    prioridade: 'alta',
    descricao:
      'Atendimento corretivo realizado para falha reportada em campo. CorreÃ§Ã£o aplicada e equipamento reavaliado em funcionamento.',
  },
};

const EDITING_KEY = 'cooltrack-editing-id';

function resetEditingState() {
  sessionStorage.removeItem(EDITING_KEY);
  const formView = Utils.getEl('view-registro');
  if (formView) formView.dataset.editMode = '0';
}

// â”€â”€ Barra de progresso do formulÃ¡rio â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€ Aviso de manutenÃ§Ã£o agendada â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function _bindEquipChangeWarning() {
  const sel = Utils.getEl('r-equip');
  if (!sel) return;
  sel.addEventListener('change', () => {
    const id = sel.value;
    const currentEditingId = sessionStorage.getItem(EDITING_KEY);
    if (currentEditingId) {
      resetEditingState();
      clearRegistro();
      if (id) Utils.setVal('r-equip', id);
    }
    document.getElementById('reg-pending-warning')?.remove();
    if (!id) return;
    const lastReg = lastRegForEquip(id);
    if (lastReg && Utils.daysDiff(lastReg.proxima) >= 0) {
      const w = document.createElement('div');
      w.id = 'reg-pending-warning';
      w.className = 'reg-pending-warning';
      w.textContent = 'âš  ManutenÃ§Ã£o preventiva agendada. Registre apenas em emergÃªncia.';
      sel.parentNode.parentNode.insertBefore(w, sel.parentNode.nextSibling);
    }
  });
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// API PÃšBLICA
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export function initRegistro(params = {}) {
  const formView = Utils.getEl('view-registro');
  if (!formView) return;

  withViewSkeleton(formView, { enabled: true, variant: 'generic', count: 3 }, () => {
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

    // Data padrÃ£o
    if (!Utils.getVal('r-data')) Utils.setVal('r-data', Utils.nowDatetime());

    // H1: tÃ©cnico padrÃ£o
    const rTecnico = Utils.getEl('r-tecnico');
    if (rTecnico && !rTecnico.value) {
      const def = Profile.getDefaultTecnico();
      if (def) rTecnico.value = def;
    }

    // PrÃ©-preenchimento vindo de fluxo (dashboard/equipamento/alerta)
    if (!params.editRegistroId) resetEditingState();
    if (params.equipId) Utils.setVal('r-equip', params.equipId);

    const rPrioridade = Utils.getEl('r-prioridade');
    if (rPrioridade && !rPrioridade.value) rPrioridade.value = 'media';
  });
}

export function applyQuickTemplate(templateId) {
  const template = QUICK_TEMPLATE_MAP[templateId];
  if (!template) return;

  Utils.setVal('r-tipo', template.tipo);
  if (!Utils.getVal('r-obs').trim()) Utils.setVal('r-obs', template.descricao);
  Utils.setVal('r-prioridade', template.prioridade);
  Utils.setVal('r-data', Utils.nowDatetime());
  if (!Utils.getVal('r-tecnico')) {
    const def = Profile.getDefaultTecnico();
    if (def) Utils.setVal('r-tecnico', def);
  }
  _updateProgressBar();
  Toast.success('AÃ§Ã£o rÃ¡pida aplicada. Revise e toque em salvar.');
}

export async function saveRegistro() {
  const isGuest = isGuestMode();
  const guestLimit = checkGuestLimit('registros');
  if (guestLimit.blocked) {
    trackEvent('limit_reached', { resource: 'registros', current: guestLimit.current, limit: 10 });
    GuestConversionModal.open({ reason: 'limit_registros', source: 'save-registro' });
    return false;
  }
  const prioridade = Utils.getVal('r-prioridade') || 'media';
  const { equipamentos } = getState();
  const payloadValidation = validateRegistroPayload(
    {
      equipId: Utils.getVal('r-equip'),
      data: Utils.getVal('r-data'),
      tipo: Utils.getVal('r-tipo'),
      obs: Utils.getVal('r-obs'),
      tecnico: Utils.getVal('r-tecnico'),
      status: Utils.getVal('r-status'),
      pecas: Utils.getVal('r-pecas'),
      proxima: Utils.getVal('r-proxima'),
      custoPecas: Utils.getVal('r-custo-pecas'),
      custoMaoObra: Utils.getVal('r-custo-mao-obra'),
    },
    { existingEquipamentos: equipamentos },
  );

  if (!payloadValidation.valid) {
    Toast.warning(payloadValidation.errors[0]);
    return false;
  }

  const { equipId, data, tipo, tecnico, obs, pecas, proxima, status, custoPecas, custoMaoObra } =
    payloadValidation.value;

  const descricaoFinal =
    obs && obs.length >= 10 ? obs : `Servico de ${tipo.toLowerCase()} registrado em modo rapido.`;

  const validation = validateOperationalPayload({ data, status });
  if (!validation.valid) {
    Toast.error(validation.errors[0]);
    return false;
  }

  Profile.saveLastTecnico(tecnico);

  // Modo ediÃ§Ã£o â€” atualiza registro existente
  const editingId = sessionStorage.getItem(EDITING_KEY);
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
              obs: descricaoFinal,
              tecnico,
              prioridade,
              status,
              pecas,
              proxima,
              custoPecas,
              custoMaoObra,
            }
          : r,
      ),
      equipamentos: prev.equipamentos.map((e) => {
        if (e.id !== equipId) return e;
        const op = getOperationalStatus({ status, lastStatus: status, ultimoRegistro: { status } });
        return {
          ...e,
          status: op.uiStatus === 'unknown' ? 'ok' : op.uiStatus,
          statusDescricao: op.label,
        };
      }),
    }));
    resetEditingState();
    clearRegistro();
    Toast.success('Registro atualizado.');
    goTo('historico');
    return true;
  }

  // Modo criaÃ§Ã£o â€” continua fluxo normal
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
      message: 'NÃ£o foi possÃ­vel carregar o mÃ³dulo de assinatura.',
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
        message: 'NÃ£o foi possÃ­vel registrar a assinatura digital.',
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
          'Algumas fotos nÃ£o puderam ser enviadas para a nuvem e ficaram salvas localmente.',
        );
      }
    } catch (error) {
      handleError(error, {
        code: ErrorCodes.SYNC_FAILED,
        severity: 'warning',
        message: 'Falha no upload das fotos. O registro serÃ¡ salvo com fallback local.',
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
          obs: descricaoFinal,
          status,
          pecas,
          proxima,
          fotos: fotosRegistro,
          tecnico,
          prioridade,
          custoPecas,
          custoMaoObra,
          assinatura: assinatura ? true : false,
        },
      ],
      equipamentos: prev.equipamentos.map((e) => {
        if (e.id !== equipId) return e;
        const op = getOperationalStatus({ status, lastStatus: status, ultimoRegistro: { status } });
        return {
          ...e,
          status: op.uiStatus === 'unknown' ? e.status || 'ok' : op.uiStatus,
          statusDescricao: op.label,
        };
      }),
    };
  });

  SavedHighlight.markForHighlight(novoId);
  clearRegistro();
  Toast.success('ServiÃ§o registrado com sucesso.');

  const { registros } = getState();
  if (registros.length > 0 && registros.length % 3 === 0) {
    setTimeout(
      () =>
        Toast.info(
          `ðŸ’¡ VocÃª tem ${registros.length} registros. Gere um relatÃ³rio PDF para enviar ao cliente.`,
        ),
      1800,
    );
  }

  goTo('historico');

  if (isGuest) {
    GuestConversionModal.open({ reason: 'save_attempt', source: 'save-registro' });
  }

  return true;
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
    'r-prioridade',
  ];
  if (!preserveEquip) toClear.push('r-equip');
  Utils.clearVals(...toClear);
  resetEditingState();
  Utils.setVal('r-status', 'ok');
  Utils.setVal('r-prioridade', 'media');
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

  sessionStorage.setItem(EDITING_KEY, id);
  const formViewEdit = Utils.getEl('view-registro');
  if (formViewEdit) formViewEdit.dataset.editMode = '1';

  Utils.setVal('r-equip', r.equipId);
  Utils.setVal('r-data', r.data);
  Utils.setVal('r-tipo', r.tipo);
  Utils.setVal('r-obs', r.obs);
  Utils.setVal('r-tecnico', r.tecnico);
  Utils.setVal('r-prioridade', r.prioridade || 'media');
  Utils.setVal('r-pecas', r.pecas || '');
  Utils.setVal('r-custo-pecas', String(r.custoPecas || ''));
  Utils.setVal('r-custo-mao-obra', String(r.custoMaoObra || ''));
  Utils.setVal('r-proxima', r.proxima || '');
  Utils.setVal('r-status', r.status);

  const btn = document.querySelector('[data-action="save-registro"]');
  if (btn) {
    btn.textContent = 'Salvar alteraÃ§Ãµes';
    btn.classList.add('btn--editing');
  }

  const title = document.querySelector('#view-registro .section-title');
  if (title) title.textContent = 'Editar registro';
}
