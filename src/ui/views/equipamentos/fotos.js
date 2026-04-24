import { Utils } from '../../../core/utils.js';
import { findEquip, setState } from '../../../core/state.js';
import { Toast } from '../../../core/toast.js';
import { ErrorCodes, handleError } from '../../../core/errors.js';
import { trackEvent } from '../../../core/telemetry.js';
import { uploadPendingPhotos, normalizePhotoList } from '../../../core/photoStorage.js';
import { isCachedPlanPlusOrHigher } from '../../../core/plans/planCache.js';
import { goTo } from '../../../core/router.js';
import { EquipmentPhotos } from '../../components/equipmentPhotos.js';

let viewEquipFallback = null;

export function configureEquipPhotos({ viewEquip } = {}) {
  viewEquipFallback = typeof viewEquip === 'function' ? viewEquip : null;
}

/**
 * Mostra/esconde o container CONTEXTO do modal de cadastro — só aparece
 * quando o filho (setor) está visível. Mantém o modal enxuto pra usuários
 * Free. V4: o bloco de fotos saiu daqui, então só setor influencia.
 */
export function syncContextGroupVisibility() {
  const group = Utils.getEl('eq-context-group');
  if (!group) return;
  const setorVisible = Utils.getEl('eq-setor-wrapper')?.style.display !== 'none';
  group.style.display = setorVisible ? '' : 'none';
}

/**
 * Wire do CTA do locked state. Idempotente — chamado toda vez que o modal
 * abre pra Free, mas o listener é bound uma única vez via dataset flag.
 * Click → telemetria + navega pra /pricing com highlight em Plus + reason
 * pra que o renderPricing possa mostrar copy contextual se quiser.
 */
function _bindPhotosUpsellCta() {
  const cta = document.querySelector('#equip-photo-locked [data-action="photos-upsell-cta"]');
  if (!cta || cta.dataset.upsellBound === '1') return;
  cta.dataset.upsellBound = '1';
  cta.addEventListener('click', () => {
    trackEvent('photo_upsell_clicked', { source: 'equip_modal' });
    goTo('pricing', { highlightPlan: 'plus', reason: 'photos_upsell' });
  });
}

/**
 * Mostra o bloco de fotos do equipamento no modal.
 * - Plus+/Pro → dropzone normal (user pode tirar/carregar fotos)
 * - Free → mesmo wrapper visível, mas troca o conteúdo pro locked state
 *   (card com lock + CTA "Desbloquear com Plus"). A visibilidade é feita
 *   via classe `.equip-photo-block--locked` no CSS, então os listeners
 *   dos file inputs ficam intactos e funcionam de volta assim que o user
 *   faz upgrade e reabre o modal.
 *
 * Motivação da mudança (v3.5): antes escondiamos o bloco inteiro pra Free.
 * Isso tirava a feature do radar do usuário e reduzia conversão. Mostrar
 * um upsell contextual ("ah, fotos seriam úteis aqui") é mais efetivo que
 * só mencionar na pricing page.
 */
export function applyEquipPhotosGate(isPlusOrPro = false) {
  const wrapper = Utils.getEl('eq-fotos-wrapper');
  if (!wrapper) return;

  // Wrapper sempre visível agora — o que muda é o conteúdo.
  wrapper.style.display = '';

  const block = Utils.getEl('equip-photo-block');
  const locked = Utils.getEl('equip-photo-locked');

  if (isPlusOrPro) {
    // Plano pago → dropzone normal + preview.
    if (block) block.classList.remove('equip-photo-block--locked');
    if (locked) locked.hidden = true;
  } else {
    // Free → card de upsell. Limpa o state do componente pra evitar que
    // fotos "fantasma" persistam depois de um downgrade (defesa em
    // profundidade — a view já é escondida via CSS).
    if (block) block.classList.add('equip-photo-block--locked');
    if (locked) locked.hidden = false;
    try {
      EquipmentPhotos.clear();
    } catch (_err) {
      /* ignora */
    }
    _bindPhotosUpsellCta();

    // Telemetria: primeira exibição por abertura do modal. Dataset flag
    // no wrapper é limpo em `closeEquipModal` ou quando re-renderiza.
    if (!wrapper.dataset.upsellShown) {
      wrapper.dataset.upsellShown = '1';
      trackEvent('photo_upsell_shown', { source: 'equip_modal' });
    }
  }

  syncContextGroupVisibility();
}

// ── Photos editor (V4): modal dedicado aberto do detail view ──────────────

/**
 * Wire do CTA upsell do modal-eq-photos (Free vê card de locked + CTA).
 * Idempotente via dataset flag — bound uma vez por lifecycle do elemento.
 */
function _bindEqPhotosUpsellCta() {
  const cta = document.querySelector('#eq-photos-locked [data-action="eq-photos-upsell-cta"]');
  if (!cta || cta.dataset.upsellBound === '1') return;
  cta.dataset.upsellBound = '1';
  cta.addEventListener('click', async () => {
    trackEvent('photo_upsell_clicked', { source: 'equip_detail' });
    try {
      const { Modal: M } = await import('../../../core/modal.js');
      M.close('modal-eq-photos');
    } catch (_err) {
      /* segue pra pricing mesmo se Modal.close falhar */
    }
    goTo('pricing', { highlightPlan: 'plus', reason: 'photos_upsell' });
  });
}

/**
 * Gate Plus+/Pro do editor de fotos (modal-eq-photos).
 * Plus+/Pro: dropzone + preview normais. Free: card de upsell.
 * Na prática esse modal nem é aberto pra Free (o CTA no detail view vai
 * direto pra pricing), mas deixamos o gate como defense-in-depth pra caso
 * alguém force a abertura do modal via devtools.
 */
export function applyEquipPhotosEditorGate(isPlusOrPro = false) {
  const block = Utils.getEl('eq-photos-block');
  const locked = Utils.getEl('eq-photos-locked');
  if (!block) return;
  if (isPlusOrPro) {
    block.classList.remove('equip-photo-block--locked');
    if (locked) locked.hidden = true;
  } else {
    block.classList.add('equip-photo-block--locked');
    if (locked) locked.hidden = false;
    try {
      EquipmentPhotos.clear();
    } catch (_err) {
      /* ignora */
    }
    _bindEqPhotosUpsellCta();
  }
}

/**
 * Abre o editor de fotos pro equipamento dado. Entry point chamado pelo
 * handler `open-eq-photos-editor`. Configura o EquipmentPhotos component
 * com os IDs prefixados `eq-photos-*`, carrega as fotos existentes, aplica
 * o gate (sync via cache + async recheck igual ao modal-add-eq) e abre.
 */
let _editingPhotosEquipId = null;
export function getEditingPhotosEquipId() {
  return _editingPhotosEquipId;
}

export async function openEquipPhotosEditor(equipId) {
  const eq = findEquip(equipId);
  if (!eq) {
    Toast.error('Equipamento não encontrado.');
    return;
  }

  _editingPhotosEquipId = equipId;

  // Target IDs do novo modal.
  EquipmentPhotos.configure({
    previewId: 'eq-photos-preview',
    dropTextId: 'eq-photos-drop-text',
    dropZoneId: 'eq-photos-drop-zone',
    subId: null, // modal-eq-photos não tem sub-label; usa lead texto
    counterSelector: '.equip-photo-counter',
  });
  EquipmentPhotos.setExisting(normalizePhotoList(eq.fotos));

  // Gate sync inicial (via cache). Modal-eq-photos aceita só Plus+/Pro.
  const cachedIsPlusOrPro = isCachedPlanPlusOrHigher();
  applyEquipPhotosEditorGate(cachedIsPlusOrPro);

  try {
    const { Modal: M } = await import('../../../core/modal.js');
    M.open('modal-eq-photos');
  } catch (error) {
    handleError(error, {
      code: ErrorCodes.NETWORK_ERROR,
      message: 'Não foi possível abrir o editor de fotos.',
      context: { action: 'equipamentos.openEquipPhotosEditor', equipId },
    });
    return;
  }

  // Re-check async do plano real (mesmo padrão do modal-add-eq). O cache
  // local pode estar stale; se o profile real discordar, aplica o gate
  // correto. Silencioso em caso de falha (mantém estado do cache).
  (async () => {
    try {
      const { fetchMyProfileBilling } = await import('../../../core/plans/monetization.js');
      const { hasPlusAccess } = await import('../../../core/plans/subscriptionPlans.js');
      const { profile } = await fetchMyProfileBilling();
      const realIsPlusOrPro = hasPlusAccess(profile);
      if (realIsPlusOrPro !== cachedIsPlusOrPro) {
        applyEquipPhotosEditorGate(realIsPlusOrPro);
      }
    } catch (_) {
      /* offline / sessão expirada — mantém estado do cache */
    }
  })();
}

/**
 * Salva só o campo `fotos` do equipamento em edição. Upload das pending,
 * update narrow via setState (o subscriber sincroniza com Supabase).
 * Fecha o modal e re-renderiza o detail view pra atualizar o avatar.
 */
export async function saveEquipPhotos() {
  const equipId = _editingPhotosEquipId;
  if (!equipId) {
    Toast.error('Nenhum equipamento selecionado.');
    return false;
  }

  const eq = findEquip(equipId);
  if (!eq) {
    Toast.error('Equipamento não encontrado.');
    return false;
  }

  // Runtime gate: mesmo padrão do saveEquip. Se o user degradou o plano
  // pra Free, as pending são descartadas e só as existing são persistidas.
  const canUploadPhotos = isCachedPlanPlusOrHigher();
  let fotosPayload = [];

  if (!canUploadPhotos) {
    const pendingCount = EquipmentPhotos.pending?.length || 0;
    if (pendingCount > 0) {
      trackEvent('photo_upload_blocked_non_plus', {
        equipId,
        pendingCount,
        source: 'equip_detail',
      });
      Toast.warning('Fotos no equipamento são um recurso do plano Plus. Upgrade pra liberar.');
    }
    fotosPayload = normalizePhotoList(EquipmentPhotos.existing);
  } else {
    try {
      const uploaded = await uploadPendingPhotos(EquipmentPhotos.getAll(), {
        recordId: equipId,
        scope: 'equipamentos',
      });
      fotosPayload = uploaded.photos;
      if (uploaded.failedCount > 0) {
        Toast.warning(
          'Algumas fotos não foram enviadas para a nuvem e permaneceram salvas localmente.',
        );
      }
    } catch (err) {
      fotosPayload = normalizePhotoList(EquipmentPhotos.existing);
      handleError(err, {
        code: ErrorCodes.SYNC_FAILED,
        severity: 'warning',
        message: 'Foto não enviada. Tente novamente quando estiver online.',
        context: { action: 'equipamentos.saveEquipPhotos.uploadPhotos', equipId },
        showToast: false,
      });
    }
  }

  // Update narrow: só o campo fotos. O subscriber do setState persiste no
  // Supabase via mapEquipamentoRow (que inclui fotos).
  setState((prev) => ({
    ...prev,
    equipamentos: prev.equipamentos.map((e) =>
      e.id === equipId ? { ...e, fotos: fotosPayload } : e,
    ),
  }));

  trackEvent('equip_photos_saved', {
    equipId,
    count: fotosPayload.length,
    source: 'equip_detail',
  });

  try {
    const { Modal: M } = await import('../../../core/modal.js');
    M.close('modal-eq-photos');
  } catch (_err) {
    /* noop */
  }

  // Limpa estado de edição + componente. Targets voltam pro default pra
  // não vazar config entre aberturas.
  _editingPhotosEquipId = null;
  try {
    EquipmentPhotos.clear();
    EquipmentPhotos.resetTargets();
  } catch (_err) {
    /* noop */
  }

  // Re-render do detail view pra atualizar o avatar/contadores.
  // Usa a própria viewEquip deste módulo (hoisted) — a mesma que o handler
  // view-equip dispara (source of truth única do detail flow).
  try {
    await viewEquipFallback?.(equipId);
  } catch (_err) {
    /* se o detail estiver fechado, noop */
  }

  Toast.success('Fotos salvas.');
  return true;
}

/** Reset do estado do editor de fotos (chamado no close sem salvar). */
export function clearEquipPhotosEditingState() {
  _editingPhotosEquipId = null;
  try {
    EquipmentPhotos.clear();
    EquipmentPhotos.resetTargets();
  } catch (_err) {
    /* noop */
  }
}
