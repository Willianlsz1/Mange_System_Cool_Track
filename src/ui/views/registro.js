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
import { getOperationalStatus, validateOperationalPayload } from '../../core/equipmentRules.js';
import { checkGuestLimit, isGuestMode } from '../../core/guestLimits.js';
import { GuestConversionModal } from '../components/guestConversionModal.js';
import { trackEvent } from '../../core/telemetry.js';
import { withViewSkeleton } from '../components/skeleton.js';
import { validateRegistroPayload } from '../../core/inputValidation.js';
import { isCachedPlanPlusOrHigher } from '../../core/planCache.js';

const CONTAINER_ID = 'form-progress-container-v5';
const QUICK_TEMPLATE_MAP = {
  limpeza: {
    tipo: 'Limpeza de Filtros',
    prioridade: 'media',
    descricao:
      'Limpeza preventiva realizada no equipamento. Filtros higienizados e operação validada em funcionamento normal.',
  },
  recarga_gas: {
    tipo: 'Carga de Gás Refrigerante',
    prioridade: 'alta',
    descricao:
      'Recarga de gás refrigerante aplicada após verificação de pressão e vedação. Sistema estabilizado para operação.',
  },
  troca_filtro: {
    tipo: 'Limpeza de Filtros',
    prioridade: 'media',
    descricao:
      'Troca de filtro executada para restabelecer vazão de ar e qualidade da operação. Equipamento testado após a substituição.',
  },
  inspecao: {
    tipo: 'Inspeção Geral',
    prioridade: 'baixa',
    descricao:
      'Inspeção técnica geral concluída com checklist visual e funcional. Sem anomalias críticas no momento.',
  },
  manutencao_corretiva: {
    tipo: 'Manutenção Corretiva',
    prioridade: 'alta',
    descricao:
      'Atendimento corretivo realizado para falha reportada em campo. Correção aplicada e equipamento reavaliado em funcionamento.',
  },
};

const EDITING_KEY = 'cooltrack-editing-id';
// Persiste o último cliente preenchido para auto-prefill no próximo registro —
// técnico que atende o mesmo cliente em sequência não precisa digitar de novo.
const LAST_CLIENT_KEY = 'cooltrack-last-client';

function _loadLastClient() {
  try {
    return JSON.parse(localStorage.getItem(LAST_CLIENT_KEY) || 'null');
  } catch (_err) {
    return null;
  }
}

function _saveLastClient(cliente) {
  try {
    // Só persiste se algum campo estiver preenchido — evita sobrescrever com
    // registros salvos "no modo rápido" que não tocam os campos do cliente.
    if (!cliente || (!cliente.clienteNome && !cliente.localAtendimento)) return;
    localStorage.setItem(LAST_CLIENT_KEY, JSON.stringify(cliente));
  } catch (_err) {
    // localStorage indisponível — ignora
  }
}

function resetEditingState() {
  sessionStorage.removeItem(EDITING_KEY);
  const formView = Utils.getEl('view-registro');
  if (formView) formView.dataset.editMode = '0';
}

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
      w.textContent = '⚠ Manutenção preventiva agendada. Registre apenas em emergência.';
      sel.parentNode.parentNode.insertBefore(w, sel.parentNode.nextSibling);
    }
  });
}

// ═══════════════════════════════════════════════════════
// API PÚBLICA
// ═══════════════════════════════════════════════════════

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

    // Data padrão
    if (!Utils.getVal('r-data')) Utils.setVal('r-data', Utils.nowDatetime());

    // H1: técnico padrão
    const rTecnico = Utils.getEl('r-tecnico');
    if (rTecnico && !rTecnico.value) {
      const def = Profile.getDefaultTecnico();
      if (def) rTecnico.value = def;
    }

    // Pré-preenchimento vindo de fluxo (dashboard/equipamento/alerta)
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
  Toast.success('Ação rápida aplicada. Revise e toque em salvar.');
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
      clienteNome: Utils.getVal('r-cliente-nome'),
      clienteDocumento: Utils.getVal('r-cliente-documento'),
      localAtendimento: Utils.getVal('r-local-atendimento'),
      clienteContato: Utils.getVal('r-cliente-contato'),
    },
    { existingEquipamentos: equipamentos },
  );

  if (!payloadValidation.valid) {
    Toast.warning(payloadValidation.errors[0]);
    return false;
  }

  const {
    equipId,
    data,
    tipo,
    tecnico,
    obs,
    pecas,
    proxima,
    status,
    custoPecas,
    custoMaoObra,
    clienteNome,
    clienteDocumento,
    localAtendimento,
    clienteContato,
  } = payloadValidation.value;

  const descricaoFinal =
    obs && obs.length >= 10 ? obs : `Servico de ${tipo.toLowerCase()} registrado em modo rapido.`;

  const validation = validateOperationalPayload({ data, status });
  if (!validation.valid) {
    Toast.error(validation.errors[0]);
    return false;
  }

  Profile.saveLastTecnico(tecnico);

  // Modo edição — atualiza registro existente
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
              clienteNome,
              clienteDocumento,
              localAtendimento,
              clienteContato,
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
    _saveLastClient({ clienteNome, clienteDocumento, localAtendimento, clienteContato });
    resetEditingState();
    clearRegistro();
    Toast.success('Registro atualizado.');
    goTo('historico');
    return true;
  }

  // Modo criação — continua fluxo normal
  const novoId = Utils.uid();
  let fotosRegistro = [...Photos.pending];

  // D1: assinatura digital — recurso exclusivo Plus+ (diferencial pago).
  // Para Free, pulamos silenciosamente o modal para não interromper o fluxo.
  let assinatura = null;
  const canUseSignature = isCachedPlanPlusOrHigher();
  let SignatureModal;
  let saveSignatureForRecord;
  if (canUseSignature) {
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
  }
  const eq = findEquip(equipId);
  if (canUseSignature && SignatureModal?.request) {
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
          obs: descricaoFinal,
          status,
          pecas,
          proxima,
          fotos: fotosRegistro,
          tecnico,
          prioridade,
          custoPecas,
          custoMaoObra,
          clienteNome,
          clienteDocumento,
          localAtendimento,
          clienteContato,
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
  _saveLastClient({ clienteNome, clienteDocumento, localAtendimento, clienteContato });
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
    'r-cliente-nome',
    'r-cliente-documento',
    'r-local-atendimento',
    'r-cliente-contato',
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

  // Auto-prefill do último cliente — técnico que atende o mesmo cliente em
  // sequência (ex.: manutenção de várias unidades no mesmo prédio) não precisa
  // redigitar. O usuário pode apagar os campos se for para outro cliente.
  const lastClient = _loadLastClient();
  if (lastClient) {
    if (lastClient.clienteNome) Utils.setVal('r-cliente-nome', lastClient.clienteNome);
    if (lastClient.clienteDocumento)
      Utils.setVal('r-cliente-documento', lastClient.clienteDocumento);
    if (lastClient.localAtendimento)
      Utils.setVal('r-local-atendimento', lastClient.localAtendimento);
    if (lastClient.clienteContato) Utils.setVal('r-cliente-contato', lastClient.clienteContato);
  }

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
  Utils.setVal('r-cliente-nome', r.clienteNome || '');
  Utils.setVal('r-cliente-documento', r.clienteDocumento || '');
  Utils.setVal('r-local-atendimento', r.localAtendimento || '');
  Utils.setVal('r-cliente-contato', r.clienteContato || '');

  const btn = document.querySelector('[data-action="save-registro"]');
  if (btn) {
    btn.textContent = 'Salvar alterações';
    btn.classList.add('btn--editing');
  }

  const title = document.querySelector('#view-registro .section-title');
  if (title) title.textContent = 'Editar registro';
}
