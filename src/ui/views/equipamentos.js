/**
 * CoolTrack Pro - Equipamentos View v5.0
 * Funções: renderEquip, saveEquip, viewEquip, deleteEquip, populateEquipSelects
 */

import { Utils } from '../../core/utils.js';
import { getState, findEquip, setState, regsForEquip, findSetor } from '../../core/state.js';
import { Storage } from '../../core/storage.js';
import { Toast } from '../../core/toast.js';
import { OnboardingBanner } from '../components/onboarding.js';
import { withSkeleton } from '../components/skeleton.js';
import { Profile } from '../../features/profile.js';
import { getHealthClass, updateHeader } from './dashboard.js';
import { ErrorCodes, handleError } from '../../core/errors.js';
import { checkPlanLimit } from '../../core/planLimits.js';
import { goTo } from '../../core/router.js';
import { trackEvent } from '../../core/telemetry.js';
import {
  evaluateEquipmentHealth,
  evaluateEquipmentRisk,
  getSuggestedPreventiveDays,
  normalizePeriodicidadePreventivaDias,
} from '../../domain/maintenance.js';
import { getPreventivaDueEquipmentIds } from '../../domain/alerts.js';
import { formatDadosPlacaRows, hasAnyDadosPlaca } from '../../domain/dadosPlacaDisplay.js';
import { DadosPlacaValidationError, formatDecimalHint } from '../../domain/dadosPlacaValidation.js';
import { emptyStateHtml } from '../components/emptyState.js';
import { validateEquipamentoPayload } from '../../core/inputValidation.js';
import { EquipmentPhotos } from '../components/equipmentPhotos.js';
import { Photos } from '../components/photos.js';
import { getEquipmentVisualMeta } from '../components/equipmentVisual.js';
import { normalizePhotoList } from '../../core/photoStorage.js';
import {
  isCachedPlanPlusOrHigher,
  isCachedPlanPro,
  setCachedPlan,
} from '../../core/plans/planCache.js';
import { SETOR_NOME_MAX, validateSetorNome } from '../../core/setorRules.js';
import { getEffectivePlan, hasProAccess } from '../../core/plans/subscriptionPlans.js';
import {
  configureEquipContextState,
  getRouteEquipCtx as _getRouteEquipCtx,
  navigateEquipCtx as _navigateEquipCtx,
  resolveEquipCtx as _resolveEquipCtx,
} from './equipamentos/contextState.js';
import {
  _createEquipRenderEvalContext,
  _idleClusterHtml,
  _resolveIdleClusterCollapsed,
  equipCardHtml,
} from './equipamentos/equipmentCards.js';
import { configureEquipPhotos, syncContextGroupVisibility } from './equipamentos/fotos.js';
import {
  DADOS_PLACA_INPUT_IDS,
  collectDadosPlaca,
  restoreDadosPlaca,
} from './equipamentos/placaData.js';
import { setorCardHtml } from './equipamentos/setores.js';

configureEquipContextState({ renderEquip });
configureEquipPhotos({ viewEquip });

export { equipCardHtml } from './equipamentos/equipmentCards.js';
export { setorCardHtml } from './equipamentos/setores.js';
export {
  applyEquipPhotosEditorGate,
  applyEquipPhotosGate,
  clearEquipPhotosEditingState,
  getEditingPhotosEquipId,
  openEquipPhotosEditor,
  saveEquipPhotos,
} from './equipamentos/fotos.js';

// ── Edit mode tracking ─────────────────────────────────────────────────────
// Quando preenchido, saveEquip() atualiza o equipamento existente em vez de criar um novo.
let _editingEquipId = null;
let _renderEquipPlanToken = 0;
let _renderEquipPlanNeedsRefresh = true;
let _renderEquipPlanEventsBound = false;
let _renderEquipPlanRefreshPromise = null;

function _bindRenderEquipPlanInvalidationEvents() {
  if (_renderEquipPlanEventsBound || typeof window === 'undefined') return;
  _renderEquipPlanEventsBound = true;
  ['cooltrack:auth-changed', 'cooltrack:profile-updated', 'cooltrack:plan-changed'].forEach(
    (eventName) => {
      window.addEventListener(eventName, () => {
        _renderEquipPlanNeedsRefresh = true;
      });
    },
  );
}

function _stripRenderInternalOptions(options = {}) {
  const { __skipPlanRefresh: _skip, ...publicOptions } = options || {};
  return publicOptions;
}

function _refreshRenderEquipPlan({
  filtro = '',
  options = {},
  renderToken,
  isProAtRender = false,
} = {}) {
  if (_renderEquipPlanRefreshPromise) return;

  _renderEquipPlanRefreshPromise = (async () => {
    try {
      const { fetchMyProfileBillingCached } = await import('../../core/plans/monetization.js');
      const { profile } = await fetchMyProfileBillingCached();
      setCachedPlan(getEffectivePlan(profile));
      _renderEquipPlanNeedsRefresh = false;
      const nextIsPro = hasProAccess(profile);
      if (renderToken !== _renderEquipPlanToken) return;
      if (nextIsPro !== isProAtRender) {
        renderEquip(filtro, { ...options, __skipPlanRefresh: true });
      }
    } catch {
      /* fallback silencioso: mantém estado atual de render */
    } finally {
      _renderEquipPlanRefreshPromise = null;
    }
  })();
}

export function getEditingEquipId() {
  return _editingEquipId;
}
export function clearEditingState() {
  _editingEquipId = null;
  const titleEl = Utils.getEl('modal-add-eq-title');
  if (titleEl) titleEl.textContent = 'Qual equipamento você quer monitorar?';
  const saveBtn = document.querySelector('[data-action="save-equip"]');
  if (saveBtn) saveBtn.textContent = '✓ Confirmar e cadastrar';
  const detailsPanel = Utils.getEl('eq-step-2');
  if (detailsPanel) {
    detailsPanel.style.display = '';
    detailsPanel.setAttribute('aria-hidden', 'true');
  }
  // Reset das fotos do equipamento (se o componente estiver montado)
  try {
    EquipmentPhotos.clear();
  } catch (_err) {
    /* componente pode ainda não estar inicializado */
  }
}

/**
 * Renderiza o "bloco do ícone" do card de equipamento:
 * - Se houver foto (feature Plus+/Pro), mostra a primeira como thumbnail.
 * - Caso contrário, cai no ícone do tipo (emoji legado).
 *
 * A url cacheada na referência de foto tem TTL ~24h. Se estiver expirada,
 * o navegador mostra a img quebrada; uma chamada ao `loadFromSupabase`
 * refaz signed URLs. Fallback explícito para o ícone via `onerror`.
 */
/**
 * Badge de tendência de risco (últimos 30 dias).
 * Feedback imediato do efeito das manutenções recentes sobre o score.
 * · stable    → não renderiza (reduz ruído, V3 alinhado)
 * · improving → "↓ N" (risco caiu N pontos)
 * · worsening → "↑ N" (risco subiu N pontos)
 *
 * Decisão de design V3: badge "estável" foi removido porque não carrega
 * informação nova (o tone-pill já comunica o estado atual). Mantemos só
 * os sinais de mudança (improving/worsening), que são actionable.
 */
// Equipment card rendering lives in ./equipamentos/equipmentCards.js.

// Setor card rendering lives in ./equipamentos/setores.js.

export function getActiveQuickFilter() {
  return _getRouteEquipCtx().quickFilter;
}
export function setActiveQuickFilter(id) {
  const quickFilter = id && id !== 'todos' ? id : null;
  const currentCtx = _getRouteEquipCtx();
  _navigateEquipCtx({
    sectorId: quickFilter ? null : currentCtx.sectorId,
    quickFilter,
  });
}

/** Computa os 4 KPIs do hero a partir do state atual.
 *  · semSetor: equipamentos sem setorId (órfãos)
 *  · emAtencao: priority >= ALTA (urgente + alta) + status warn
 *  · criticos: status danger
 *  · preventiva30d: preventivas vencendo em até 30 dias (ou já vencidas)
 *
 * Blindagem: cada equip é avaliado em try/catch — falha em 1 não derruba o hero.
 */
// Hero, KPIs e filtros de quick-action foram extraídos pra reduzir
// o tamanho desse arquivo (audit §1.1, step 1 da quebra incremental).
// Import local pra uso interno + re-export pra preservar imports externos.
import { computeEquipKpis, renderEquipHero, renderEquipFilters } from './equipamentos/hero.js';
export { computeEquipKpis, renderEquipHero, renderEquipFilters };

/** Atualiza a toolbar da view de equipamentos. */
function _setToolbar({ title, extraBtn } = {}) {
  const titleEl = Utils.getEl('equip-page-title');
  const actionsEl = Utils.getEl('equip-toolbar-actions');
  if (titleEl) titleEl.textContent = title || 'Parque de Equipamentos';
  if (actionsEl) {
    // Par de CTAs: "Cadastrar com foto" é o primário — advertise a feature
    // de IA direto da toolbar, sem exigir que o técnico descubra o botão
    // dentro do modal. Ambos abrem o mesmo modal-add-eq; o gate de trial
    // (active/trial/locked) continua sendo aplicado dentro do modal por
    // applyNameplateCtaGate, então não precisamos duplicar essa lógica aqui.
    // A versão secundária "+ Novo equipamento" fica em estilo outline pra
    // preservar muscle memory sem competir visualmente com o primário.
    actionsEl.innerHTML = `
      ${extraBtn || ''}
      <button class="btn btn--primary btn--sm equip-toolbar__photo-cta"
        data-action="open-modal" data-id="modal-add-eq"
        data-source="toolbar_photo"
        aria-label="Cadastrar equipamento tirando foto da etiqueta">
        <span class="equip-toolbar__photo-cta-icon" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><use href="#ri-camera"/></svg>
        </span>
        <span>Cadastrar com foto</span>
      </button>
      <button class="btn btn--outline btn--sm"
        data-action="open-modal" data-id="modal-add-eq"
        data-source="toolbar_manual"
        data-testid="equipamentos-add-equipment">+ Novo equipamento</button>
    `;
  }
}

/**
 * Markup do "+ Novo setor" em modo locked (plano Free/Plus).
 * Visual cinza, disabled de verdade (não dispara o handler open-setor-modal)
 * e com um cadeado + pill PRO pra deixar explícito que é feature paga.
 * Tooltip nativo via `title` explica porque está bloqueado.
 */
function _lockedSetorBtnHtml() {
  return `
    <button
      type="button"
      class="btn btn--outline btn--sm btn--locked"
      disabled
      aria-disabled="true"
      title="Setores é uma feature do plano Pro"
    >
      <span aria-hidden="true">🔒</span>
      + Novo setor
      <span class="btn__pro-pill" aria-hidden="true">PRO</span>
    </button>
  `;
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

/** Navega para dentro de um setor (ou volta ao grid se id === null). */
export function setActiveSector(id) {
  _navigateEquipCtx({
    sectorId: id ?? null,
    quickFilter: null,
  });
}

/** Renderiza a grade de setores (vista PRO). */
function renderSetorGrid() {
  const el = Utils.getEl('lista-equip');
  if (!el) return;

  const { setores, equipamentos } = getState();
  const searchBar = Utils.getEl('equip-search-bar');
  if (searchBar) searchBar.style.display = 'none'; // grade não usa busca

  _setToolbar({
    title: 'Setores',
    extraBtn: `<button class="btn btn--outline btn--sm" data-action="open-setor-modal">+ Novo setor</button>`,
  });

  if (!setores.length) {
    el.innerHTML = emptyStateHtml({
      icon: '🗂️',
      title: 'Nenhum setor criado',
      description: 'Crie setores para organizar seus equipamentos por local ou área de trabalho.',
      cta: {
        label: '+ Criar primeiro setor',
        action: 'open-setor-modal',
        tone: 'primary',
        size: 'sm',
        autoWidth: true,
      },
    });
    return;
  }

  const setorCards = setores.map((s) => {
    const eqs = equipamentos.filter((e) => e.setorId === s.id);
    return setorCardHtml(s, eqs);
  });

  // Órfãos ("Sem setor") são surfaçados pelo tile do equip-hero; o drill-down
  // abre via data-id="sem-setor" → __sem_setor__. Nada aqui no grid.
  el.innerHTML = `<div class="setor-grid">${setorCards.join('')}</div>`;
}

/** Renderiza a lista flat de equipamentos (FREE ou drill-down de um setor). */
function renderFlatList(filtro = '', options = {}, setorId = null) {
  const { equipamentos, registros } = getState();
  const evalCtx = _createEquipRenderEvalContext();
  const q = filtro.toLowerCase();
  // Filtros por statusFilter — cada um constrói um Set de IDs permitidos (null = sem filtro).
  //  · 'preventiva-7d' (legado do handler "go-alertas")
  //  · 'preventiva-30d' (quick filter novo)
  //  · 'em-atencao' / 'criticos' (quick filters novos, avaliados via priority engine)
  let allowedIds = null;
  if (options.statusFilter === 'preventiva-7d') {
    allowedIds = new Set(getPreventivaDueEquipmentIds(registros, 7));
  } else if (options.statusFilter === 'preventiva-30d') {
    allowedIds = new Set(getPreventivaDueEquipmentIds(registros, 30));
  } else if (options.statusFilter === 'em-atencao') {
    allowedIds = new Set(
      equipamentos
        .filter((e) => {
          const status = Utils.safeStatus(e.status);
          if (status === 'danger') return false; // críticos têm chip próprio
          try {
            const pr = evalCtx.getPriority(e);
            return pr.priorityLevel >= 3 || status === 'warn';
          } catch {
            return status === 'warn';
          }
        })
        .map((e) => e.id),
    );
  } else if (options.statusFilter === 'criticos') {
    allowedIds = new Set(
      equipamentos.filter((e) => Utils.safeStatus(e.status) === 'danger').map((e) => e.id),
    );
  }

  let list = equipamentos.filter((e) => {
    // Filtra por setor se estiver em drill-down
    if (setorId === '__sem_setor__') {
      if (e.setorId) return false;
    } else if (setorId) {
      if (e.setorId !== setorId) return false;
    }
    const matchesStatus = !allowedIds || allowedIds.has(e.id);
    const matchesSearch =
      !q ||
      e.nome.toLowerCase().includes(q) ||
      e.local.toLowerCase().includes(q) ||
      (e.tag || '').toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const el = Utils.getEl('lista-equip');
  if (!el) return;

  const sortedList = [...list].sort((a, b) => {
    const apA = evalCtx.getActionPriority(a);
    const apB = evalCtx.getActionPriority(b);
    if (apB.actionPriorityScore !== apA.actionPriorityScore)
      return apB.actionPriorityScore - apA.actionPriorityScore;
    const pa = evalCtx.getPriority(a);
    const pb = evalCtx.getPriority(b);
    if (pb.priorityLevel !== pa.priorityLevel) return pb.priorityLevel - pa.priorityLevel;
    const ra = evalCtx.getRisk(a).score;
    const rb = evalCtx.getRisk(b).score;
    return rb - ra;
  });

  // Copy contextual do empty state: depende do que o usuário tentou filtrar.
  const emptyCopy = (() => {
    if (setorId === '__sem_setor__') {
      return {
        title: 'Nenhum equipamento órfão',
        description: 'Todos os equipamentos já estão atribuídos a um setor. 👏',
      };
    }
    if (setorId) {
      return {
        title: 'Nenhum equipamento neste setor',
        description: 'Atribua equipamentos a este setor ao cadastrá-los.',
      };
    }
    switch (options.statusFilter) {
      case 'em-atencao':
        return {
          title: 'Nenhum equipamento pedindo atenção',
          description: 'Parque em ordem — nada pra olhar com lupa agora.',
        };
      case 'criticos':
        return {
          title: 'Nenhum equipamento crítico',
          description: 'Tudo operacional. Volte aqui se algum alerta aparecer.',
        };
      case 'preventiva-7d':
      case 'preventiva-30d':
        return {
          title: 'Nenhuma preventiva vencendo',
          description: 'Agenda de manutenção em dia.',
        };
      default:
        // Distingue primeiro uso (nenhum equipamento cadastrado) vs filtro
        // sem resultado. Copy mais acolhedor pro técnico que acabou de criar
        // a conta — mostra tempo estimado pra reduzir fricção inicial.
        if (!filtro && !equipamentos.length) {
          return {
            title: 'Você ainda não tem equipamentos cadastrados',
            description:
              'Cadastre o primeiro em menos de 1 minuto. A foto da etiqueta já preenche a maioria dos campos.',
          };
        }
        return {
          title: 'Nenhum equipamento encontrado',
          description: 'Tente outro termo ou cadastre um novo.',
        };
    }
  })();

  // PR4 §12.3 · Particiona idle vs ativo pra decidir sobre idle-cluster.
  //  · Cluster coleta idles quando ≥5 (histerese solta ≤2).
  //  · Posição: cluster sempre acima dos cards ativos — mas só se houver
  //    ao menos 1 card ativo pra contrastar. Em lista só-de-idle o cluster
  //    perde valor (nada pra "esconder") e volta a render linear.
  const idleList = [];
  const activeList = [];
  sortedList.forEach((eq) => {
    if (evalCtx.isFullyIdle(eq)) idleList.push(eq);
    else activeList.push(eq);
  });
  const clusterActive =
    _resolveIdleClusterCollapsed(idleList.length) && idleList.length > 0 && activeList.length > 0;

  withSkeleton(
    el,
    { enabled: true, variant: 'equipment', count: Math.min(Math.max(list.length, 3), 5) },
    () => {
      if (!sortedList.length) {
        el.innerHTML = emptyStateHtml({
          icon: '🔧',
          title: emptyCopy.title,
          description: emptyCopy.description,
          cta: {
            label: '+ Novo equipamento',
            action: 'open-modal',
            id: 'modal-add-eq',
            tone: 'primary',
            size: 'sm',
            autoWidth: true,
          },
        });
        return;
      }
      if (clusterActive) {
        const idleCardsHtml = idleList
          .map((eq) => equipCardHtml(eq, { showLocal: !setorId, evalCtx }))
          .join('');
        const activeCardsHtml = activeList
          .map((eq) => equipCardHtml(eq, { showLocal: !setorId, evalCtx }))
          .join('');
        el.innerHTML = _idleClusterHtml(idleCardsHtml, idleList.length) + activeCardsHtml;
      } else {
        el.innerHTML = sortedList
          .map((eq) => equipCardHtml(eq, { showLocal: !setorId, evalCtx }))
          .join('');
      }
      _bindEquipCardImageFallbacks(el);
    },
  );
}

function _bindEquipCardImageFallbacks(root) {
  const scope = root instanceof Element ? root : document;
  scope.querySelectorAll('.equip-card__type-icon--photo img').forEach((img) => {
    if (!(img instanceof HTMLImageElement)) return;
    if (img.dataset.fallbackBound === '1') return;
    img.dataset.fallbackBound = '1';
    const iconWrap = img.closest('.equip-card__type-icon');
    if (!iconWrap) return;

    const markLoaded = () => {
      iconWrap.classList.add('equip-card__type-icon--loaded');
    };
    const applyFallback = () => {
      iconWrap.classList.add('equip-card__type-icon--fallback');
      img.remove();
    };

    img.addEventListener('load', markLoaded, { once: true });
    img.addEventListener('error', applyFallback, { once: true });

    // Cobertura para imagens já resolvidas no momento do bind (cache quente).
    if (img.complete) {
      if (img.naturalWidth > 0) markLoaded();
      else applyFallback();
    }
  });
}

export async function renderEquip(filtro = '', options = {}) {
  _bindRenderEquipPlanInvalidationEvents();
  const renderToken = ++_renderEquipPlanToken;
  const renderOptions = _stripRenderInternalOptions(options);
  const equipCtx = _resolveEquipCtx(renderOptions);
  const activeSectorId = equipCtx.sectorId;
  const activeQuickFilter = equipCtx.quickFilter;

  // Renderiza imediatamente com snapshot local do plano (não bloqueia a tela).
  // O refresh assíncrono corrige drift e evita fetch repetido em cada render.
  const isPro = isCachedPlanPro();
  populateSetorSelect(isPro);
  if (!options?.__skipPlanRefresh && _renderEquipPlanNeedsRefresh) {
    _refreshRenderEquipPlan({
      filtro,
      options: renderOptions,
      renderToken,
      isProAtRender: isPro,
    });
  }

  // Hero + filters sempre no topo da view (hidden quando não há equipamentos).
  // Precisa rodar antes de qualquer return — os slots são estáveis entre modos.
  renderEquipHero({ isPro });
  renderEquipFilters();

  // Quick filter ativo sobrescreve o fluxo normal: vai pra flat list com
  // statusFilter correspondente. Sempre rende com a toolbar "← Todos" pra dar
  // caminho de volta claro.
  if (activeQuickFilter) {
    const searchBar = Utils.getEl('equip-search-bar');
    if (searchBar) searchBar.style.display = '';
    const titleMap = {
      'sem-setor': 'Sem setor',
      'em-atencao': 'Em atenção',
      criticos: 'Críticos',
      'preventiva-30d': 'Preventivas ≤30d',
    };
    _setToolbar({
      title: titleMap[activeQuickFilter] || 'Equipamentos',
      extraBtn: `<button class="btn btn--outline btn--sm" data-action="equip-quickfilter" data-id="todos">← Todos</button>`,
    });

    if (activeQuickFilter === 'sem-setor') {
      renderFlatList(filtro, renderOptions, '__sem_setor__');
    } else {
      renderFlatList(filtro, { ...renderOptions, statusFilter: activeQuickFilter }, null);
    }
    return;
  }

  const searchBar = Utils.getEl('equip-search-bar');
  const { setores } = getState();

  if (isPro && activeSectorId === null) {
    // Pro COM setores → grade de setores (organização por grupo).
    // Pro SEM setores ainda → lista flat igual Free, mas com CTA "+ Novo setor"
    // na toolbar. O usuário escolhe quando começar a organizar por setor —
    // a gente não bloqueia o acesso aos equipamentos só pra forçar a criação.
    if (setores.length) {
      renderSetorGrid();
      return;
    }

    if (searchBar) searchBar.style.display = '';
    _setToolbar({
      title: 'Parque de Equipamentos',
      extraBtn: `<button class="btn btn--outline btn--sm" data-action="open-setor-modal">+ Novo setor</button>`,
    });
    renderFlatList(filtro, renderOptions, null);
    return;
  }

  // Vista lista (FREE ou drill-down de setor)
  if (searchBar) searchBar.style.display = '';

  if (activeSectorId) {
    // Drill-down: mostra equipamentos do setor
    const setor =
      activeSectorId === '__sem_setor__' ? { nome: 'Sem setor' } : findSetor(activeSectorId);
    const nome = setor?.nome ?? 'Setor';
    _setToolbar({
      title: Utils.truncate(nome, 28),
      extraBtn: `<button class="btn btn--outline btn--sm" data-action="back-to-setores">← Setores</button>`,
    });
  } else {
    // Vista FREE/Plus: toolbar padrão + "+ Novo setor" em modo locked, pra
    // sinalizar que a feature existe mas pede upgrade pro Pro.
    _setToolbar({
      title: 'Parque de Equipamentos',
      extraBtn: _lockedSetorBtnHtml(),
    });
  }

  renderFlatList(filtro, renderOptions, activeSectorId);
}

// ─── Setor CRUD ───────────────────────────────────────────────────────────────

// Setores são feature exclusiva do plano Pro. Todas as mutações devem
// passar por ensureProForSetores() — defesa em profundidade contra gates
// de UI que podem ficar stale se o usuário abrir a modal e depois rebaixar
// o plano em outra aba.
async function ensureProForSetores({ action = 'manage' } = {}) {
  try {
    const { fetchMyProfileBilling } = await import('../../core/plans/monetization.js');
    const { hasProAccess } = await import('../../core/plans/subscriptionPlans.js');
    const { profile } = await fetchMyProfileBilling();
    if (hasProAccess(profile)) return true;
  } catch {
    // Em modo guest ou sem conexão, bloqueia por padrão
  }
  const message =
    action === 'delete'
      ? 'Exclusão de setor é um recurso Pro. Faça upgrade para continuar.'
      : action === 'update'
        ? 'Edição de setor é um recurso Pro. Faça upgrade para continuar.'
        : action === 'assign'
          ? 'Atribuir setores é um recurso Pro. Faça upgrade para continuar.'
          : 'Criar setores é um recurso Pro. Faça upgrade para continuar.';
  Toast.warning(message);
  return false;
}

// ── Setor modal: paleta curada, live preview, validation ─────────────────
//
// Paleta de 10 cores (expandida de 6) pra dar mais identidade visual aos
// setores sem virar arco-íris. Default = --primary (#00c8e8, Ciano).
const SETOR_PALETTE = [
  { hex: '#00c8e8', nome: 'Ciano' },
  { hex: '#00c853', nome: 'Esmeralda' },
  { hex: '#ffab40', nome: 'Âmbar' },
  { hex: '#ff5252', nome: 'Coral' },
  { hex: '#7c4dff', nome: 'Violeta' },
  { hex: '#448aff', nome: 'Azul' },
  { hex: '#f06292', nome: 'Rosa' },
  { hex: '#9ccc65', nome: 'Verde-lima' },
  { hex: '#ff7043', nome: 'Laranja' },
  { hex: '#26a69a', nome: 'Teal' },
];
const SETOR_DESC_LIMIT = 120;

function _getSetorNomeValidation(nomeRaw = Utils.getVal('setor-nome') || '') {
  const { empty, tooLong, isValid } = validateSetorNome(nomeRaw);
  return { empty, tooLong, isValid };
}

/** Relative luminance (WCAG). hex deve estar em forma #RRGGBB. */
function _hexLuminance(hex) {
  const h = String(hex || '').replace('#', '');
  if (h.length !== 6) return 0;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const toLin = (v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
}

/** Contraste entre uma cor de acento e branco (pro badge do preview). */
export function setorContrastWithWhite(hex) {
  const L = _hexLuminance(hex);
  return 1.05 / (L + 0.05);
}

/** Busca metadados da paleta por hex. Retorna null se não encontrado. */
function _findPaletteEntry(hex) {
  if (!hex) return null;
  const target = String(hex).toLowerCase();
  return SETOR_PALETTE.find((p) => p.hex.toLowerCase() === target) || null;
}

function _setSaveBtnLabel(text) {
  const btn = Utils.getEl('setor-save-btn');
  if (!btn) return;
  const label = btn.querySelector('.setor-modal__btn-label');
  if (label) label.textContent = text;
}

function _setSetorNomeValidationState({ showError, focus = false, markTouched = false } = {}) {
  const err = Utils.getEl('setor-nome-err');
  const nomeInput = Utils.getEl('setor-nome');
  if (err) err.hidden = !showError;
  if (nomeInput) {
    if (markTouched) nomeInput.dataset.touched = '1';
    nomeInput.setAttribute('aria-invalid', showError ? 'true' : 'false');
    if (focus) nomeInput.focus();
  }
}

function _syncSetorSaveButtonState() {
  const saveBtn = Utils.getEl('setor-save-btn');
  if (!saveBtn) return;
  const { isValid } = _getSetorNomeValidation();
  saveBtn.disabled = !isValid;
  saveBtn.setAttribute('aria-disabled', isValid ? 'false' : 'true');
}

// Estado do fluxo de edição do setor. Quando preenchido, saveSetor()
// atualiza em vez de criar.
let _editingSetorId = null;
export function getEditingSetorId() {
  return _editingSetorId;
}

/** Reseta todo o form do modal e volta pra modo "criar". */
export function clearSetorEditingState() {
  _editingSetorId = null;
  const titleEl = Utils.getEl('modal-add-setor-title');
  if (titleEl) titleEl.textContent = 'Novo setor';
  _setSaveBtnLabel('Criar setor →');

  // Limpa os 4 campos do form
  Utils.setVal('setor-nome', '');
  Utils.setVal('setor-descricao', '');
  Utils.setVal('setor-responsavel', '');
  const hiddenInput = Utils.getEl('setor-cor');
  if (hiddenInput) hiddenInput.value = SETOR_PALETTE[0].hex;

  // Reseta picker pra primeira cor
  const picker = Utils.getEl('setor-color-picker');
  if (picker) {
    picker.querySelectorAll('.setor-modal__swatch').forEach((btn) => {
      const cell = btn.closest('.setor-modal__swatch-cell');
      const isFirst = btn.dataset.cor === SETOR_PALETTE[0].hex;
      btn.classList.toggle('setor-modal__swatch--selected', isFirst);
      btn.setAttribute('aria-checked', isFirst ? 'true' : 'false');
      if (cell) cell.classList.toggle('setor-modal__swatch-cell--selected', isFirst);
    });
  }

  // Esconde erro inline
  _setSetorNomeValidationState({ showError: false });
  const nomeInput = Utils.getEl('setor-nome');
  if (nomeInput) {
    delete nomeInput.dataset.touched;
    delete nomeInput.dataset.interacted;
  }

  _syncSetorModalPreview();
  _syncSetorModalCounters();
  _syncSetorSaveButtonState();
}

export function openEditSetor(id) {
  const setor = findSetor(id);
  if (!setor) {
    Toast.warning('Setor não encontrado.');
    return;
  }
  _editingSetorId = id;

  Utils.setVal('setor-nome', setor.nome || '');
  Utils.setVal('setor-descricao', setor.descricao || '');
  Utils.setVal('setor-responsavel', setor.responsavel || '');

  const hiddenInput = Utils.getEl('setor-cor');
  const cor = setor.cor || SETOR_PALETTE[0].hex;
  if (hiddenInput) hiddenInput.value = cor;

  // Marca a cor atual no picker (ou deseleciona tudo se for cor custom)
  const picker = Utils.getEl('setor-color-picker');
  if (picker) {
    picker.querySelectorAll('.setor-modal__swatch').forEach((btn) => {
      const cell = btn.closest('.setor-modal__swatch-cell');
      const isMatch = btn.dataset.cor === cor;
      btn.classList.toggle('setor-modal__swatch--selected', isMatch);
      btn.setAttribute('aria-checked', isMatch ? 'true' : 'false');
      if (cell) cell.classList.toggle('setor-modal__swatch-cell--selected', isMatch);
    });
  }

  const titleEl = Utils.getEl('modal-add-setor-title');
  if (titleEl) titleEl.textContent = 'Editar setor';
  _setSaveBtnLabel('Salvar alterações');

  // Esconde erro inline
  _setSetorNomeValidationState({ showError: false });
  const nomeInput = Utils.getEl('setor-nome');
  if (nomeInput) {
    delete nomeInput.dataset.touched;
    delete nomeInput.dataset.interacted;
  }

  _syncSetorModalPreview();
  _syncSetorModalCounters();
  _syncSetorSaveButtonState();

  import('../../core/modal.js').then(({ Modal: M }) => M.open('modal-add-setor'));
}

/**
 * Atualiza o card de prévia lendo o estado atual do form (nome + cor).
 * Roda síncrono e barato: altera textContent + CSS custom property.
 * Também pulsa o card por 350ms pra sinalizar troca de cor.
 */
function _syncSetorModalPreview() {
  const card = Utils.getEl('setor-modal-preview-card');
  if (!card) return;

  const nome = (Utils.getVal('setor-nome') || '').trim();
  const cor = Utils.getEl('setor-cor')?.value || SETOR_PALETTE[0].hex;
  const entry = _findPaletteEntry(cor);

  // Nome do card (placeholder "Novo setor" quando vazio)
  const nameEl = Utils.getEl('setor-modal-preview-name');
  if (nameEl) nameEl.textContent = nome || 'Novo setor';

  // Cor: CSS custom property no card raiz + readout do nome/hex
  card.style.setProperty('--setor-cor', cor);
  const nameReadout = Utils.getEl('setor-color-name');
  if (nameReadout) nameReadout.textContent = entry?.nome || 'Custom';
  const hexReadout = Utils.getEl('setor-color-hex');
  if (hexReadout) hexReadout.textContent = cor;

  // Contraste AA (branco sobre a cor de acento — serve só de guia visual)
  const contrastEl = Utils.getEl('setor-contrast');
  if (contrastEl) {
    const ratio = setorContrastWithWhite(cor);
    const pass = ratio >= 4.5;
    contrastEl.dataset.aa = pass ? 'pass' : 'warn';
    contrastEl.textContent = `${pass ? 'AA ✓' : 'AA ⚠'} · ${ratio.toFixed(1)}:1`;
  }

  const statusLabelEl = Utils.getEl('setor-modal-preview-status-label');
  const statusMetaEl = Utils.getEl('setor-modal-preview-status-meta');
  if (statusLabelEl) {
    statusLabelEl.textContent = nome
      ? 'Pronto para receber equipamentos'
      : 'Este setor começará vazio';
  }
  if (statusMetaEl) {
    statusMetaEl.textContent = nome
      ? 'Você poderá mover equipamentos para cá a qualquer momento'
      : 'Você poderá adicionar equipamentos depois';
  }

  // Pulso visual quando muda
  card.classList.remove('is-pulsing');
  // Force reflow to restart animation
  void card.offsetWidth;
  card.classList.add('is-pulsing');
}

/** Atualiza contadores (0/40, 0/120) + marca como over quando passa do limite. */
function _syncSetorModalCounters() {
  const nome = Utils.getVal('setor-nome') || '';
  const desc = Utils.getVal('setor-descricao') || '';
  const nomeCounter = Utils.getEl('setor-nome-counter');
  if (nomeCounter) {
    nomeCounter.textContent = `${nome.length}/${SETOR_NOME_MAX}`;
    nomeCounter.classList.toggle('setor-modal__counter--over', nome.length > SETOR_NOME_MAX);
  }
  const descCounter = Utils.getEl('setor-descricao-counter');
  if (descCounter) {
    descCounter.textContent = `${desc.length}/${SETOR_DESC_LIMIT}`;
    descCounter.classList.toggle('setor-modal__counter--over', desc.length > SETOR_DESC_LIMIT);
  }
  _syncSetorSaveButtonState();
}

/**
 * Inicializa o color picker + live preview do modal de setor. Idempotente:
 * Se já foi wirado, apenas sincroniza o preview sem rebindar listeners.
 */
export function initSetorColorPicker() {
  const picker = Utils.getEl('setor-color-picker');
  const hiddenInput = Utils.getEl('setor-cor');
  if (!picker || !hiddenInput) return;

  // Bind único: marca com data attr pra não duplicar listeners em reabertura.
  if (!picker.dataset.setorModalBound) {
    picker.dataset.setorModalBound = '1';

    picker.querySelectorAll('.setor-modal__swatch').forEach((btn) => {
      btn.addEventListener('click', () => {
        picker.querySelectorAll('.setor-modal__swatch').forEach((b) => {
          const cell = b.closest('.setor-modal__swatch-cell');
          b.classList.remove('setor-modal__swatch--selected');
          b.setAttribute('aria-checked', 'false');
          if (cell) cell.classList.remove('setor-modal__swatch-cell--selected');
        });
        btn.classList.add('setor-modal__swatch--selected');
        btn.setAttribute('aria-checked', 'true');
        const cell = btn.closest('.setor-modal__swatch-cell');
        if (cell) cell.classList.add('setor-modal__swatch-cell--selected');
        hiddenInput.value = btn.dataset.cor;
        _syncSetorModalPreview();
      });
    });

    // Inputs do form → sincroniza preview + counters + gerencia erro inline
    // Regra: depois que o usuário já foi avisado uma vez (data-touched=1), o
    // erro some ao digitar e volta ao esvaziar o campo. Antes do primeiro
    // aviso o campo fica "limpo" enquanto o usuário não tenta salvar.
    const nomeInput = Utils.getEl('setor-nome');
    if (nomeInput) {
      nomeInput.addEventListener('input', () => {
        nomeInput.dataset.interacted = '1';
        const { empty, tooLong } = _getSetorNomeValidation(nomeInput.value);
        const wasTouched = nomeInput.dataset.touched === '1';
        _setSetorNomeValidationState({ showError: wasTouched && (empty || tooLong) });
        _syncSetorModalPreview();
        _syncSetorModalCounters();
      });
      nomeInput.addEventListener('blur', () => {
        const { empty, tooLong } = _getSetorNomeValidation(nomeInput.value);
        const wasTouched = nomeInput.dataset.touched === '1';
        const interacted = nomeInput.dataset.interacted === '1';
        if ((!empty && !tooLong) || (!wasTouched && !interacted)) return;
        _setSetorNomeValidationState({
          showError: true,
          markTouched: true,
        });
      });
    }
    const descInput = Utils.getEl('setor-descricao');
    if (descInput) descInput.addEventListener('input', _syncSetorModalCounters);
  }

  _syncSetorModalPreview();
  _syncSetorModalCounters();
  _syncSetorSaveButtonState();
}

export async function saveSetor() {
  const isEditing = Boolean(_editingSetorId);
  const allowed = await ensureProForSetores({ action: isEditing ? 'update' : 'create' });
  if (!allowed) return false;

  const nomeRaw = Utils.getVal('setor-nome') || '';
  const { empty, tooLong } = _getSetorNomeValidation(nomeRaw);
  if (empty || tooLong) {
    // Validação inline: mostra erro abaixo do input + foco + toast leve.
    // Marca o campo como "touched" pra que o erro passe a reaparecer
    // automaticamente se o usuário esvaziar o input depois de digitar.
    _setSetorNomeValidationState({ showError: true, focus: true, markTouched: true });
    Toast.warning(
      tooLong
        ? `Use no máximo ${SETOR_NOME_MAX} caracteres no nome do setor.`
        : 'Digite um nome para o setor.',
    );
    return false;
  }
  const nome = nomeRaw.trim();

  const cor = Utils.getEl('setor-cor')?.value || SETOR_PALETTE[0].hex;
  const descricao = (Utils.getVal('setor-descricao') || '').trim().slice(0, SETOR_DESC_LIMIT);
  const responsavel = (Utils.getVal('setor-responsavel') || '').trim();

  if (isEditing) {
    const editingId = _editingSetorId;
    setState((prev) => ({
      ...prev,
      setores: (prev.setores || []).map((s) =>
        s.id === editingId ? { ...s, nome, cor, descricao, responsavel } : s,
      ),
    }));
  } else {
    setState((prev) => ({
      ...prev,
      setores: [...(prev.setores || []), { id: Utils.uid(), nome, cor, descricao, responsavel }],
    }));
  }

  try {
    const { Modal: M } = await import('../../core/modal.js');
    M.close('modal-add-setor');
  } catch {
    /* ignora */
  }

  // Limpa form + reseta estado de edição
  clearSetorEditingState();

  Toast.success(isEditing ? `Setor "${nome}" atualizado.` : `Setor "${nome}" criado.`);
  renderEquip();
  return true;
}

export async function deleteSetor(id) {
  if (id === '__sem_setor__') return;

  const allowed = await ensureProForSetores({ action: 'delete' });
  if (!allowed) return;

  // Remove setorId dos equipamentos que pertencem ao setor
  setState((prev) => ({
    ...prev,
    setores: (prev.setores || []).filter((s) => s.id !== id),
    equipamentos: prev.equipamentos.map((e) => (e.setorId === id ? { ...e, setorId: null } : e)),
  }));

  // Enfileira deleção remota (Supabase). ON DELETE SET NULL no FK cuida dos equipamentos.
  try {
    Storage.markSetorDeleted(id);
  } catch {
    /* ignora — a queue é melhor esforço */
  }

  const activeSectorId = _getRouteEquipCtx().sectorId;
  if (activeSectorId === id) {
    _navigateEquipCtx({ sectorId: null, quickFilter: null });
    return;
  }
  Toast.info('Setor removido. Os equipamentos foram movidos para "Sem setor".');
  renderEquip();
}

/**
 * Atribui (ou remove) um setor a um equipamento já cadastrado.
 * Chamado pelo select inline no modal de detalhes.
 */
export async function assignEquipToSetor(equipId, setorId) {
  const eq = findEquip(equipId);
  if (!eq) return;

  const allowed = await ensureProForSetores({ action: 'assign' });
  if (!allowed) return;

  setState((prev) => ({
    ...prev,
    equipamentos: prev.equipamentos.map((e) =>
      e.id === equipId ? { ...e, setorId: setorId || null } : e,
    ),
  }));
  const setor = setorId ? findSetor(setorId) : null;
  const label = setor ? `"${setor.nome}"` : '"Sem setor"';
  Toast.success(`${Utils.escapeHtml(eq.nome)} movido para ${label}.`);
  renderEquip(); // atualiza os cards de setor em background
}

// Nameplate data helpers live in ./equipamentos/placaData.js.

export async function openEditEquip(id) {
  const eq = findEquip(id);
  if (!eq) return;

  _editingEquipId = id;

  // Pre-popula os campos do modal com os dados do equipamento
  Utils.setVal('eq-nome', eq.nome || '');
  Utils.setVal('eq-local', eq.local || '');
  Utils.setVal('eq-tag', eq.tag || '');
  Utils.setVal('eq-tipo', eq.tipo || 'Split Hi-Wall');
  Utils.setVal('eq-fluido', eq.fluido || 'R-410A');
  Utils.setVal('eq-modelo', eq.modelo || '');
  Utils.setVal('eq-criticidade', eq.criticidade || 'media');
  Utils.setVal('eq-prioridade', eq.prioridadeOperacional || 'normal');
  Utils.setVal('eq-periodicidade', String(eq.periodicidadePreventivaDias || 90));
  restoreDadosPlaca(eq.dadosPlaca);

  // Marca periodicidade como manual para não ser sobrescrita pelo auto-sugestão
  const periodicidadeInput = Utils.getEl('eq-periodicidade');
  if (periodicidadeInput) periodicidadeInput.dataset.manual = '1';

  // Abre o painel de detalhes direto (pula o step 1 de escolha de tipo)
  const detailsPanel = Utils.getEl('eq-step-2');
  if (detailsPanel) {
    detailsPanel.style.display = 'block';
    detailsPanel.setAttribute('aria-hidden', 'false');
  }

  // Popula o select de setor (apenas Pro) e aplica gate do hero CTA de placa.
  // V4: bloco de fotos saiu daqui — agora é via detail view.
  // V4.1: gate agora tem 3 estados (active / trial / locked) — pra Free,
  // busca a quota mensal e passa `trialRemaining` pro state 'trial' quando
  // o user ainda tem teste grátis disponível no mês.
  try {
    const [monetization, plans, capture, usageLimits] = await Promise.all([
      import('../../core/plans/monetization.js'),
      import('../../core/plans/subscriptionPlans.js'),
      import('../components/nameplateCapture.js'),
      import('../../core/usageLimits.js'),
    ]);
    const { fetchMyProfileBilling } = monetization;
    const { hasProAccess, hasPlusAccess } = plans;
    const { applyNameplateCtaGate } = capture;
    const { getMonthlyUsageSnapshot, USAGE_RESOURCE_NAMEPLATE_ANALYSIS, getMonthlyLimitForPlan } =
      usageLimits;
    const { profile } = await fetchMyProfileBilling();
    populateSetorSelect(hasProAccess(profile));

    const isPlusOrPro = hasPlusAccess(profile);
    if (isPlusOrPro) {
      applyNameplateCtaGate({ isPlusOrPro: true, trialRemaining: null });
    } else {
      try {
        const { supabase } = await import('../../core/supabase.js');
        const {
          data: { user },
        } = await supabase.auth.getUser();
        let trialRemaining = null;
        if (user?.id) {
          const snap = await getMonthlyUsageSnapshot(user.id);
          const used = Number(snap?.[USAGE_RESOURCE_NAMEPLATE_ANALYSIS] ?? 0) || 0;
          const limit = getMonthlyLimitForPlan(
            profile?.plan_code ?? 'free',
            USAGE_RESOURCE_NAMEPLATE_ANALYSIS,
          );
          trialRemaining = Number.isFinite(limit) ? Math.max(0, limit - used) : 0;
        }
        applyNameplateCtaGate({ isPlusOrPro: false, trialRemaining });
      } catch (_) {
        applyNameplateCtaGate({ isPlusOrPro: false, trialRemaining: null });
      }
    }
  } catch {
    populateSetorSelect(false);
    try {
      const { applyNameplateCtaGate } = await import('../components/nameplateCapture.js');
      applyNameplateCtaGate({ isPlusOrPro: false, trialRemaining: null });
    } catch (_) {
      /* noop */
    }
  }
  if (eq.setorId) Utils.setVal('eq-setor', eq.setorId);

  // Atualiza textos do modal
  const titleEl = Utils.getEl('modal-add-eq-title');
  if (titleEl) titleEl.textContent = 'Editar equipamento';
  const saveBtn = document.querySelector('[data-action="save-equip"]');
  if (saveBtn) saveBtn.textContent = 'Salvar alterações →';

  // Fecha o modal de detalhes e abre o de edição
  try {
    const { Modal: M } = await import('../../core/modal.js');
    M.close('modal-eq-det');
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
  const { equipamentos } = getState();

  // Pula a verificação de limite quando está editando (não cria novo registro)
  if (!_editingEquipId) {
    const planLimit = await checkPlanLimit('equipamentos', equipamentos.length);
    if (planLimit.blocked) {
      trackEvent('limit_reached', {
        resource: 'equipamentos',
        current: planLimit.current,
        limit: planLimit.limit,
        planCode: planLimit.planCode,
      });
      const msg =
        planLimit.planCode === 'pro'
          ? 'Você atingiu o limite de equipamentos do seu plano.'
          : 'Você atingiu o limite do plano Free. Faça upgrade para continuar.';
      Toast.warning(msg);
      if (planLimit.planCode !== 'pro') {
        goTo('pricing');
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

  // Dados da etiqueta (13 campos opcionais). Coletados em JSONB pra persistência
  // em equipamentos.dados_placa. Se nenhum foi preenchido, mantém object vazio
  // (migration constraint: jsonb_typeof = 'object').
  //
  // collectDadosPlaca() pode lançar DadosPlacaValidationError quando um valor
  // decimal ultrapassa o range plausível (provável separador decimal esquecido).
  // Traduzimos pra Toast amigável e focamos o input em vez de propagar o erro.
  let dadosPlaca;
  try {
    dadosPlaca = collectDadosPlaca();
  } catch (err) {
    if (err instanceof DadosPlacaValidationError) {
      const hint = formatDecimalHint(err.value);
      Toast.warning(
        `${err.label} (${err.unit}): ${err.value} parece alto demais. ` +
          `Use vírgula como separador decimal — ex: ${hint} em vez de ${err.value}.`,
      );
      const input = document.getElementById(err.inputId);
      if (input) {
        input.focus();
        if (typeof input.select === 'function') input.select();
      }
      return false;
    }
    throw err;
  }

  // ── Fotos do equipamento ─────────────────────────────────────────────────
  // V4: upload de fotos saiu desse fluxo. Criação/edição de dados só lida
  // com os campos textuais; fotos são gerenciadas via detail view →
  // modal-eq-photos. Em edit mode, preservamos as fotos já persistidas
  // (eq.fotos) pra não perdê-las ao salvar alterações de texto.
  const equipId = _editingEquipId || Utils.uid();
  const fotosPayload = _editingEquipId
    ? normalizePhotoList(findEquip(_editingEquipId)?.fotos || [])
    : [];

  if (_editingEquipId) {
    // ── UPDATE: atualiza equipamento existente ──────────────────────────────
    const editingId = _editingEquipId;
    setState((prev) => ({
      ...prev,
      equipamentos: prev.equipamentos.map((e) =>
        e.id === editingId
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
              fotos: fotosPayload,
              dadosPlaca,
            }
          : e,
      ),
    }));
  } else {
    // ── CREATE: novo equipamento ────────────────────────────────────────────
    setState((prev) => ({
      ...prev,
      equipamentos: [
        ...prev.equipamentos,
        {
          id: equipId,
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
          fotos: fotosPayload,
          dadosPlaca,
        },
      ],
    }));
  }

  const wasEditing = Boolean(_editingEquipId);

  try {
    const { Modal: M } = await import('../../core/modal.js');
    M.close('modal-add-eq');
  } catch (error) {
    handleError(error, {
      code: ErrorCodes.NETWORK_ERROR,
      message: 'Não foi possível fechar o modal de cadastro.',
      context: { action: 'equipamentos.saveEquip.closeModal' },
      severity: 'warning',
    });
  }

  Utils.clearVals('eq-nome', 'eq-tag', 'eq-local', 'eq-modelo', 'eq-periodicidade');
  // Limpa os 12 inputs da etiqueta pra não "vazar" valor entre cadastros.
  Utils.clearVals(...DADOS_PLACA_INPUT_IDS);
  Utils.setVal('eq-tipo', 'Split Hi-Wall');
  Utils.setVal('eq-fluido', 'R-410A');
  Utils.setVal('eq-criticidade', 'media');
  Utils.setVal('eq-prioridade', 'normal');
  Utils.setVal('eq-frequencia', '60');
  Utils.setVal('eq-periodicidade', String(getSuggestedPreventiveDays('Split Hi-Wall', 'media')));
  const periodicidadeInput = Utils.getEl('eq-periodicidade');
  if (periodicidadeInput) periodicidadeInput.dataset.manual = '0';

  // Reset do estado de edição e UI do modal
  clearEditingState();

  OnboardingBanner.remove();
  try {
    const { renderDashboard } = await import('./dashboard.js');
    renderDashboard();
  } catch (error) {
    handleError(error, {
      code: ErrorCodes.NETWORK_ERROR,
      message: 'Equipamento salvo, mas houve falha ao atualizar o painel.',
      context: { action: 'equipamentos.saveEquip.renderDashboard' },
      severity: 'warning',
    });
  }
  renderEquip();
  updateHeader();
  Toast.success(wasEditing ? 'Equipamento atualizado.' : 'Equipamento cadastrado.');

  return true;
}

export async function viewEquip(id) {
  const eq = findEquip(id);
  if (!eq) return;
  const regs = regsForEquip(id).sort((a, b) => b.data.localeCompare(a.data));
  const health = evaluateEquipmentHealth(eq, regs);
  const score = health.score;
  const cls = getHealthClass(score);
  const safeId = Utils.escapeAttr(id);
  const context = health.context;
  const risk = evaluateEquipmentRisk(eq, regs);
  const proximaPreventiva = context?.proximaPreventiva
    ? Utils.formatDate(context.proximaPreventiva)
    : 'Sem agenda';
  const healthSummary = health.reasons.length
    ? Utils.escapeHtml(health.reasons.slice(0, 2).join(' | '))
    : 'Historico dentro da rotina prevista';

  // SVG ring progress
  const ringR = 30;
  const ringC = +(2 * Math.PI * ringR).toFixed(1);
  const ringOffset = +(ringC * (1 - score / 100)).toFixed(1);

  // Setor select (inline na ficha técnica)
  const setorSelectHtml = (() => {
    const { setores: _setores } = getState();
    if (!_setores.length) return '';
    const opts = _setores
      .map(
        (s) =>
          `<option value="${Utils.escapeAttr(s.id)}"${eq.setorId === s.id ? ' selected' : ''}>${Utils.escapeHtml(s.nome)}</option>`,
      )
      .join('');
    return `<div class="info-row info-row--setor">
      <span class="info-row__label">Setor</span>
      <span class="info-row__value">
        <select class="info-row__setor-select" id="eq-det-setor-${safeId}" data-eq-id="${safeId}">
          <option value=""${!eq.setorId ? ' selected' : ''}>Sem setor</option>
          ${opts}
        </select>
      </span>
    </div>`;
  })();

  // Timeline de serviços
  const svcTimeline =
    regs.length === 0
      ? `<div class="eq-svc-empty">Nenhum serviço registrado ainda.</div>`
      : `<div class="eq-svc-timeline">
        ${regs
          .slice(0, 5)
          .map(
            (r) => `
          <div class="eq-svc-item">
            <div class="eq-svc-item__dot"></div>
            <div class="eq-svc-item__content">
              <span class="eq-svc-item__tipo">${Utils.escapeHtml(r.tipo)}</span>
              <span class="eq-svc-item__data">${Utils.formatDatetime(r.data)}</span>
            </div>
          </div>`,
          )
          .join('')}
        ${regs.length > 5 ? `<div class="eq-svc-more">+${regs.length - 5} serviços anteriores</div>` : ''}
      </div>`;

  // ── Cover block (V4.1) ──
  // Foto "de capa" edge-to-edge no topo do modal de detalhes. Dá identidade
  // visual imediata (o técnico reconhece o equipamento antes de ler o nome).
  // Se não houver foto: placeholder com gradiente + emoji do tipo +
  // CTA centralizado "Adicionar foto". Se houver foto: img cobre o espaço
  // todo e o CTA "Gerenciar fotos" fica overlay no canto inferior direito.
  // Na listagem, o card continua com avatar/thumb redondo (equipCardIconBlock).
  const visual = getEquipmentVisualMeta(eq);
  const tipoEmoji = visual.icon;
  const firstPhotoUrl = visual.photoUrl;
  const photosCount = Array.isArray(eq.fotos)
    ? eq.fotos.filter((p) => p && (typeof p === 'string' ? p : p.url || p.path)).length
    : 0;
  const canEditPhotos = isCachedPlanPlusOrHigher();
  // Copy do CTA muda por plano pra deixar claro que Free é um gate (antes
  // dizia "Adicionar foto PLUS", confundindo — parecia que o clique abriria
  // a câmera, quando na verdade abre a tela de pricing).
  //   Free  : "Desbloquear com Plus" + ícone de cadeado
  //   Plus+ : "Adicionar foto" / "Gerenciar fotos" + ícone de câmera
  const photoCtaLabel = canEditPhotos
    ? photosCount === 0
      ? 'Adicionar foto'
      : 'Gerenciar fotos'
    : 'Desbloquear com Plus';
  // Pra Free o CTA vira upsell (abre pricing). Pro/Plus abre o editor.
  const photoCtaAction = canEditPhotos ? 'open-eq-photos-editor' : 'open-upgrade';
  const photoCtaExtra = canEditPhotos
    ? ''
    : ' data-upgrade-source="equip_detail_photos" data-highlight-plan="plus"';
  const photoCtaBadge = canEditPhotos
    ? ''
    : '<span class="plus-badge plus-badge--inline" aria-hidden="true">PLUS</span>';
  const photoCtaVariantCls = canEditPhotos ? '' : ' eq-detail-cover__cta--locked';
  const photoCameraIcon = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M4 7h3l2-2h6l2 2h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z"/>
      <circle cx="12" cy="13" r="3.5"/>
    </svg>`;
  const photoLockIcon = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <rect x="4" y="11" width="16" height="10" rx="2"/>
      <path d="M8 11V7a4 4 0 0 1 8 0v4"/>
    </svg>`;
  const photoCtaIcon = canEditPhotos ? photoCameraIcon : photoLockIcon;
  // Nota: o fallback de erro no <img> (quando firstPhotoUrl falha) é anexado
  // via addEventListener('error') logo depois que o innerHTML é aplicado
  // (busca por _wireEqDetailCoverFallback abaixo). Antes usávamos `onerror=`
  // inline, mas isso viola CSP `script-src 'self'` (sem 'unsafe-inline').
  // Decisão UX (V4.3): quando há foto, o CTA NÃO fica mais sobreposto a ela
  // (era "Gerenciar fotos" flutuando no canto inferior direito do img e
  // obstruía a etiqueta). Agora a foto fica limpa e o CTA vira uma linha
  // dedicada logo abaixo — ação separada, visível, sem interferir na leitura.
  // Quando NÃO há foto (placeholder), o CTA continua centralizado sobre o
  // gradiente porque nesse caso ele É o próprio conteúdo convidando à ação.
  const coverFallback = `<div class="eq-detail-cover__fallback eq-detail-cover__fallback--tone-${visual.tone}">
      <span class="eq-detail-cover__fallback-initials">${Utils.escapeHtml(visual.initials)}</span>
      <span class="eq-detail-cover__emoji eq-detail-cover__emoji--placeholder" aria-hidden="true">${tipoEmoji}</span>
    </div>`;
  const coverInner = firstPhotoUrl
    ? `<img class="eq-detail-cover__img" src="${Utils.escapeAttr(firstPhotoUrl)}" alt="Foto de ${Utils.escapeAttr(eq.nome)}" loading="lazy" />
       ${coverFallback}
       <button type="button" class="eq-detail-cover__preview-hit" aria-label="Ampliar foto de ${Utils.escapeAttr(eq.nome)}"></button>`
    : `${coverFallback}
       <button type="button" class="eq-detail-cover__cta eq-detail-cover__cta--center${photoCtaVariantCls}"
         data-action="${photoCtaAction}" data-id="${safeId}"${photoCtaExtra}
         aria-label="${canEditPhotos ? 'Adicionar foto' : 'Fotos bloqueadas — desbloqueie com o plano Plus'}">
         ${photoCtaIcon}
         <span>${photoCtaLabel}</span>
         ${photoCtaBadge}
       </button>`;
  const coverHasPhotoClass = firstPhotoUrl
    ? ' eq-detail-cover--has-photo'
    : ' eq-detail-cover--empty';
  const coverLockedClass = canEditPhotos ? '' : ' eq-detail-cover--locked';
  // Linha de ação logo abaixo da foto — só renderizada quando existe foto.
  // No caso empty, o CTA já tá dentro do placeholder (centralizado).
  const coverActionsBlock = firstPhotoUrl
    ? `<div class="eq-detail-cover-actions">
        <button type="button" class="eq-detail-cover-action${photoCtaVariantCls}"
          data-action="${photoCtaAction}" data-id="${safeId}"${photoCtaExtra}
          aria-label="${canEditPhotos ? 'Gerenciar fotos' : 'Fotos bloqueadas — desbloqueie com o plano Plus'}">
          ${photoCtaIcon}
          <span>${photoCtaLabel}</span>
          ${photoCtaBadge}
        </button>
      </div>`
    : '';
  const coverBlock = `
    <div class="eq-detail-cover${coverHasPhotoClass}${coverLockedClass}">
      ${coverInner}
    </div>
    ${coverActionsBlock}`;

  // ── Seção "Dados da etiqueta" (V5) ──
  // Renderiza os 12 campos extraídos da etiqueta (via IA no cadastro ou
  // digitados manualmente). Se o equip foi cadastrado antes da feature OU
  // o usuário não preencheu, a seção é omitida inteira — evita ruído visual
  // com uma lista de "—".
  //
  // Decisão UX: não exibimos CTA "Adicionar dados da etiqueta" aqui porque o
  // botão "Editar" do footer já abre o modal de edição completo com a seção
  // da etiqueta visível. Adicionar outro CTA duplicaria caminhos e confundiria.
  //
  // Nomenclatura: user-facing usa "etiqueta" (menos ambíguo que "placa", que
  // remete a PCB/componente eletrônico). Internamente a column e os identifiers
  // continuam como `dados_placa`/`dadosPlaca` pra não quebrar schema + tests.
  const dadosPlacaRows = formatDadosPlacaRows(eq.dadosPlaca);
  const dadosPlacaSectionHtml = hasAnyDadosPlaca(eq.dadosPlaca)
    ? `
      <div class="eq-tech-sheet__section">
        <div class="eq-tech-sheet__title">Dados da etiqueta</div>
        <div class="info-list info-list--spaced info-list--soft">
          ${dadosPlacaRows
            .map(
              (row) => `
            <div class="info-row">
              <span class="info-row__label">${Utils.escapeHtml(row.label)}</span>
              <span class="info-row__value${row.mono ? ' info-row__value--mono' : ''}">${Utils.escapeHtml(row.value)}</span>
            </div>`,
            )
            .join('')}
        </div>
      </div>`
    : '';

  Utils.getEl('eq-det-corpo').innerHTML = `
    <div class="eq-detail-view">

      ${coverBlock}

      <div class="modal__title" id="eq-det-title">${Utils.escapeHtml(eq.nome)}</div>

      <!-- ── Hero: score + status (V4: sem foto lateral). As fotos saíram
           daqui e viraram o avatar no topo, abrindo o editor dedicado
           (modal-eq-photos) via "Gerenciar fotos". -->
      <div class="eq-detail-hero eq-detail-hero--${cls}">
        <div class="eq-detail-hero__body">
          <div class="eq-hero-score">
            <div class="eq-score-ring-wrap">
              <svg class="eq-score-ring" viewBox="0 0 72 72" aria-hidden="true">
                <circle class="eq-score-ring__track" cx="36" cy="36" r="${ringR}"/>
                <circle class="eq-score-ring__fill eq-score-ring__fill--${cls}" cx="36" cy="36" r="${ringR}"
                  stroke-dasharray="${ringC}" stroke-dashoffset="${ringOffset}"/>
              </svg>
              <div class="eq-score-ring__num eq-score-ring__num--${cls}" aria-label="Score ${score}%">${score}%</div>
            </div>
            <div class="eq-hero-score__info">
              <div class="eq-hero-score__summary">${healthSummary}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- V4: galeria/lightbox saíram daqui. Fotos agora são editadas via
           modal-eq-photos aberto pelo avatar CTA. -->

      <!-- ── Painel de risco (V3: sem fórmula exposta) ──
           A fórmula do score saiu deste painel; agora existe apenas um
           botão "?" pequeno no cabeçalho que abre o modal explicativo
           (modal-score-info) com as faixas e fatores.
           O resumo/explicação do risco foi removido também, ficando só:
           label + botão ajuda + classificação+score + chip + factors. -->
      <div class="eq-risk-panel eq-risk-panel--${risk.classification}">
        <div class="eq-risk-panel__header">
          <div>
            <div class="eq-risk-panel__label-row">
              <span class="eq-risk-panel__label">Fatores de risco</span>
              <button type="button" class="eq-risk-panel__help" data-action="open-modal"
                      data-id="modal-score-info" title="Como calculamos o score"
                      aria-label="Como calculamos o score de risco">?</button>
            </div>
          </div>
        </div>
        <div class="eq-risk-panel__factors">
          ${(risk.factors.length ? risk.factors : ['rotina estável'])
            .map((f) => `<span class="eq-risk-panel__factor">${Utils.escapeHtml(f)}</span>`)
            .join('')}
        </div>
      </div>

      <!-- ── Ficha técnica ── -->
      <div class="eq-tech-sheet">
        <div class="eq-tech-sheet__section">
          <div class="eq-tech-sheet__title">Identificação</div>
          <div class="info-list info-list--spaced info-list--soft">
            <div class="info-row"><span class="info-row__label">TAG</span><span class="info-row__value info-row__value--mono">${Utils.escapeHtml(eq.tag || '—')}</span></div>
            <div class="info-row"><span class="info-row__label">Tipo</span><span class="info-row__value">${Utils.escapeHtml(eq.tipo)}</span></div>
            <div class="info-row"><span class="info-row__label">Fluido</span><span class="info-row__value">${Utils.escapeHtml(eq.fluido || '—')}</span></div>
            <div class="info-row"><span class="info-row__label">Modelo</span><span class="info-row__value">${Utils.escapeHtml(eq.modelo || '—')}</span></div>
            <div class="info-row"><span class="info-row__label">Local</span><span class="info-row__value">${Utils.escapeHtml(eq.local)}</span></div>
            ${setorSelectHtml}
          </div>
        </div>
        <div class="eq-tech-sheet__section">
          <div class="eq-tech-sheet__title">Operação</div>
          <div class="info-list info-list--spaced info-list--soft">
            <div class="info-row"><span class="info-row__label">Rotina preventiva</span><span class="info-row__value">${Utils.escapeHtml(`${context?.periodicidadeDias || eq.periodicidadePreventivaDias} dias`)}</span></div>
            <div class="info-row"><span class="info-row__label">Próxima preventiva</span><span class="info-row__value">${Utils.escapeHtml(proximaPreventiva)}</span></div>
          </div>
        </div>
        ${dadosPlacaSectionHtml}
      </div>

      <!-- ── Histórico de serviços ── -->
      <div class="eq-svc-section">
        <div class="eq-svc-section__header">
          <span class="eq-svc-section__title">Histórico de serviços</span>
          <button class="btn ${regs.length === 0 ? 'btn--primary' : 'btn--outline'} btn--sm eq-svc-section__cta" data-action="go-register-equip" data-id="${safeId}">
            + Registrar ${regs.length === 0 ? 'primeiro ' : ''}serviço
          </button>
        </div>
        ${svcTimeline}
      </div>

      <!-- ── Footer (V3: 3-ações) ──
           Hierarquia nova:
           · "Registrar serviço" (primary, 60% da largura) — ação mais frequente
           · "Editar" (outline, flex 1) — ação rotineira secundária
           · "Excluir" (danger icon 36×36) — ação irreversível reduzida
           Antes só tinha Editar + Excluir; a primary "Registrar" estava escondida
           no header da seção de histórico (fora do modal). Promovê-la aqui
           alinha a UI com o fluxo real: abrir detalhes → registrar serviço. -->
      <div class="eq-modal-footer eq-modal-footer--tri">
        <button class="btn btn--primary btn--sm eq-modal-footer__btn eq-modal-footer__btn--primary eq-modal-footer__btn--register"
                data-action="go-register-equip" data-id="${safeId}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          Registrar serviço
        </button>
        <button class="btn btn--outline btn--sm eq-modal-footer__btn eq-modal-footer__btn--edit"
                data-action="edit-equip" data-id="${safeId}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          Editar
        </button>
        <button class="eq-modal-footer__delete" data-action="delete-equip" data-id="${safeId}"
          aria-label="Excluir equipamento ${Utils.escapeAttr(eq.nome)}" title="Excluir equipamento">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
          </svg>
        </button>
      </div>

    </div>`;

  // Listener para troca de setor inline
  const setorSel = document.getElementById(`eq-det-setor-${safeId}`);
  if (setorSel) {
    setorSel.addEventListener('change', (e) => {
      assignEquipToSetor(id, e.target.value || null);
    });
  }

  // V4: listener das fotos do hero/gallery removido — o bloco foi substituído
  // pelo avatar CTA, que abre `modal-eq-photos`. Lightbox continua sendo
  // útil para abrir a foto em grande a partir do editor, se necessário.

  // Fallback da foto de capa quebrada: se a URL expira ou falha (offline,
  // 404), aplica `eq-detail-cover--fallback` pra o emoji do tipo aparecer
  // no lugar do img quebrado. Anexado via addEventListener em vez de
  // `onerror=` inline por causa do CSP `script-src 'self'`.
  const coverImg = document.querySelector('.eq-detail-cover__img');
  if (coverImg instanceof HTMLImageElement) {
    coverImg.addEventListener(
      'load',
      () => {
        coverImg.closest('.eq-detail-cover')?.classList.add('eq-detail-cover--loaded');
      },
      { once: true },
    );
    coverImg.addEventListener(
      'error',
      () => {
        coverImg.closest('.eq-detail-cover')?.classList.add('eq-detail-cover--fallback');
        coverImg.remove();
      },
      { once: true },
    );
  }
  const coverPreviewHit = document.querySelector('.eq-detail-cover__preview-hit');
  if (coverPreviewHit && firstPhotoUrl) {
    coverPreviewHit.addEventListener('click', () => {
      Photos.openLightbox(firstPhotoUrl);
    });
  }

  try {
    const { Modal: M } = await import('../../core/modal.js');
    M.open('modal-eq-det');
  } catch (error) {
    handleError(error, {
      code: ErrorCodes.NETWORK_ERROR,
      message: 'Não foi possível abrir os detalhes do equipamento.',
      context: { action: 'equipamentos.viewEquip.openModal', id },
    });
  }
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
    const { Modal: M } = await import('../../core/modal.js');
    M.close('modal-eq-det');
  } catch (error) {
    handleError(error, {
      code: ErrorCodes.NETWORK_ERROR,
      message: 'Equipamento removido, mas não foi possível fechar o modal.',
      context: { action: 'equipamentos.deleteEquip.closeModal', id },
      severity: 'warning',
    });
  }
  renderEquip();
  updateHeader();
  Toast.info('Equipamento removido.');
}

export function populateEquipSelects() {
  const { equipamentos, tecnicos } = getState();
  const selectConfigs = [
    { id: 'r-equip', placeholder: 'Selecione o equipamento...' },
    { id: 'hist-equip', placeholder: 'Todos os equipamentos' },
    { id: 'rel-equip', placeholder: 'Todos' },
  ];

  selectConfigs.forEach(({ id, placeholder }) => {
    const el = Utils.getEl(id);
    if (!el) return;

    el.textContent = '';
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = placeholder;
    el.appendChild(defaultOption);

    equipamentos.forEach((equipamento) => {
      const option = document.createElement('option');
      option.value = String(equipamento.id || '');
      option.textContent = `${equipamento.nome || '—'} — ${equipamento.local || '—'}`;
      el.appendChild(option);
    });
  });

  const tecDatalist = Utils.getEl('tec-datalist');
  if (tecDatalist) {
    tecDatalist.textContent = '';
    (tecnicos || []).forEach((tecnico) => {
      const option = document.createElement('option');
      option.value = String(tecnico || '');
      tecDatalist.appendChild(option);
    });
  }

  const rTecnico = Utils.getEl('r-tecnico');
  if (rTecnico && !rTecnico.value) {
    const def = Profile.getDefaultTecnico();
    if (def) rTecnico.value = def;
  }
}
