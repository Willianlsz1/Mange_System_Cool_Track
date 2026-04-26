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
import { formatDadosPlacaRows } from '../../domain/dadosPlacaDisplay.js';
import { DadosPlacaValidationError, formatDecimalHint } from '../../domain/dadosPlacaValidation.js';
import { emptyStateHtml } from '../components/emptyState.js';
import { validateEquipamentoPayload } from '../../core/inputValidation.js';
import { EquipmentPhotos } from '../components/equipmentPhotos.js';
import { resetCamposExtrasState, setCamposExtrasState } from '../components/nameplateCapture.js';
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
  resetNameplateMetadata,
  setNameplateMetadata,
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

// ── Tipos de climatização que tem componente (evap/cond/única) ────────────
// Lista de tipos onde o select de "componente" aparece no modal. Outros tipos
// (Geladeira, Freezer, etc) não tem split, entao o campo fica oculto.
const TIPOS_COM_COMPONENTE = new Set([
  'Split Hi-Wall',
  'Split Cassette',
  'Split Piso Teto',
  'VRF / VRV',
  'GHP',
  'Fan Coil',
  'Chiller',
  'Self Contained',
  'Roof Top',
]);

/**
 * Mostra/esconde o select de componente baseado no tipo selecionado.
 * Idempotente — pode ser chamado a qualquer momento (open modal, change tipo,
 * edit equip).
 */
export function syncComponenteVisibility() {
  const tipo = Utils.getVal('eq-tipo');
  const wrapper = Utils.getEl('eq-componente-wrapper');
  if (!wrapper) return;
  if (TIPOS_COM_COMPONENTE.has(tipo)) {
    wrapper.style.display = '';
  } else {
    wrapper.style.display = 'none';
    // Limpa o valor pra não salvar componente em equipamento que não usa
    Utils.setVal('eq-componente', '');
  }
}

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
  if (saveBtn) saveBtn.textContent = 'Cadastrar equipamento';
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
  // Reset dos extras + metadata da nameplate pra próximo cadastro começar limpo.
  try {
    resetCamposExtrasState();
  } catch (_e) {
    /* review UI ainda não renderizada */
  }
  resetNameplateMetadata();
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

/** Atualiza a toolbar da view de equipamentos.
 *  hideDefaultCta=true suprime o "+ Novo equipamento" default (usado em
 *  contexto cliente, onde adicionar equipamento é feito via drill-down
 *  de setor — não via toolbar global). */
function _setToolbar({ title, extraBtn, hideDefaultCta = false } = {}) {
  const titleEl = Utils.getEl('equip-page-title');
  const actionsEl = Utils.getEl('equip-toolbar-actions');
  if (titleEl) titleEl.textContent = title || 'Parque de Equipamentos';
  if (actionsEl) {
    // CTA único "+ Novo equipamento". Antes eram 2 botões ("Cadastrar com
    // foto" primário + "Novo equipamento" outline), o que duplicava a ação
    // na toolbar — ambos abriam o mesmo modal-add-eq.
    const defaultCta = hideDefaultCta
      ? ''
      : `<button class="btn btn--primary btn--sm"
          data-action="open-modal" data-id="modal-add-eq"
          data-source="toolbar_primary"
          data-testid="equipamentos-add-equipment"
          aria-label="Cadastrar novo equipamento (manual ou via foto da etiqueta)">+ Novo equipamento</button>`;
    actionsEl.innerHTML = `
      ${extraBtn || ''}
      ${defaultCta}
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

/** Navega para dentro de um setor (ou volta ao grid se id === null).
 *  Preserva clienteId se estivermos no contexto de um cliente — assim o
 *  drill-down dentro do cliente ainda mostra o chip "Limpar cliente" e
 *  o titulo "Setor X de [Cliente Y]". */
export function setActiveSector(id) {
  const currentCtx = _getRouteEquipCtx();
  _navigateEquipCtx({
    sectorId: id ?? null,
    quickFilter: null,
    // Preserva contexto de cliente se houver. Quando id é null (back to grid),
    // mantemos clienteId pra voltar pra grade do cliente, não a global.
    clienteId: currentCtx.clienteId || null,
    clienteNome: currentCtx.clienteNome || null,
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

/**
 * Renderiza grade de setores filtrada por cliente. Vinda de
 * /clientes -> "Ver equipamentos". Mostra so os setores DAQUELE cliente.
 * Empty state: "Crie o primeiro setor de [Cliente]" + CTA pre-fill clienteId.
 *
 * Inclui tile "Sem setor" se houver equipamentos do cliente sem setor
 * (compat: equipamentos antigos cadastrados antes da hierarquia).
 */
function renderSetorGridForCliente(clienteId, clienteNome) {
  const el = Utils.getEl('lista-equip');
  if (!el) return;

  const { setores, equipamentos } = getState();
  // Esconde search bar + view toggle em contexto cliente (irrelevantes na
  // grade de setores enxuta).
  const searchBar = Utils.getEl('equip-search-bar');
  if (searchBar) searchBar.style.display = 'none';
  const viewToggle = document.querySelector('.equip-view-toggle');
  if (viewToggle) viewToggle.style.display = 'none';

  const safeNome = clienteNome || 'cliente';
  // Toolbar enxuto: SEM "+ Novo equipamento" (acessado via drill-down do setor).
  // Apenas: + Novo setor (primario) + Limpar cliente (ghost discreto).
  // O "+ Novo equipamento" default vem do _setToolbar — passamos hideDefaultCta
  // pra suprimir.
  _setToolbar({
    title: `Setores de ${safeNome}`,
    extraBtn: `
      <button class="btn btn--primary btn--sm" data-action="open-setor-modal" data-cliente-id="${Utils.escapeAttr(clienteId)}">+ Novo setor</button>
      <button class="btn btn--ghost btn--sm" data-action="equip-clear-cliente-filter" title="Voltar pra grade global">x Limpar cliente</button>
    `,
    hideDefaultCta: true,
  });

  // Bug fix #100: Filtra setores DUAL-PATH pra ser robusto a sync issues.
  //
  //   Caminho 1 (direto): setor.clienteId === clienteId
  //     Funciona quando o setor.cliente_id chegou do Supabase OK.
  //   Caminho 2 (derivado): setor tem equipamento.clienteId === clienteId
  //     Funciona quando setor.cliente_id foi STRIPPED do payload (migration
  //     setores.cliente_id pendente no remoto), mas o equipamento.clienteId
  //     persistiu. Sem esse fallback, criar setor + equipamento dentro do
  //     contexto de cliente "some" ao voltar pra view do cliente.
  const equipsDoCliente = (equipamentos || []).filter((e) => e.clienteId === clienteId);
  const setoresIdsViaEquip = new Set(equipsDoCliente.map((e) => e.setorId).filter(Boolean));
  const setoresDoCliente = (setores || []).filter(
    (s) => s.clienteId === clienteId || setoresIdsViaEquip.has(s.id),
  );
  // Equipamentos do cliente sem setor (compat backward)
  const equipsSemSetor = equipsDoCliente.filter((e) => !e.setorId);

  // Hero convidativo + (opcional) banner Sem setor: mostrado quando o cliente
  // ainda não tem nenhum setor real cadastrado. Equipamentos sem setor (compat
  // backward) aparecem como banner discreto secundario, NÃO como card primary.
  if (!setoresDoCliente.length) {
    const semSetorBanner = equipsSemSetor.length
      ? `
        <div class="setor-cliente-empty__sem-banner">
          <div class="setor-cliente-empty__sem-icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
              <line x1="12" y1="22.08" x2="12" y2="12"/>
            </svg>
          </div>
          <div class="setor-cliente-empty__sem-body">
            <strong>${equipsSemSetor.length} equipamento${equipsSemSetor.length !== 1 ? 's' : ''} sem setor vinculado</strong>
            <p>Apos criar o primeiro setor, você pode vincular os equipamentos existentes a ele.</p>
          </div>
          <button type="button" class="setor-cliente-empty__sem-link"
            data-action="open-setor" data-id="__sem_setor__">
            Ver equipamento${equipsSemSetor.length !== 1 ? 's' : ''}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="9 6 15 12 9 18"/>
            </svg>
          </button>
        </div>`
      : '';

    el.innerHTML = `
      <section class="setor-cliente-empty" aria-label="Cliente sem setores ainda">
        <div class="setor-cliente-empty__hero">
          <div class="setor-cliente-empty__art" aria-hidden="true">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 7v13a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V7"/>
              <path d="M21 7H3l1.5-3a1 1 0 0 1 .9-.5h13.2a1 1 0 0 1 .9.5L21 7z"/>
              <line x1="10" y1="12" x2="14" y2="12"/>
            </svg>
          </div>
          <h2 class="setor-cliente-empty__title">Crie o primeiro setor de ${Utils.escapeHtml(safeNome)}</h2>
          <p class="setor-cliente-empty__sub">
            Setores agrupam equipamentos por área, andar ou bloco. Ajuda a organizar
            grandes carteiras (matriz, filial, sala tecnica) e gerar PMOC certinho.
          </p>
          <button type="button" class="setor-cliente-empty__cta"
            data-action="open-setor-modal" data-cliente-id="${Utils.escapeAttr(clienteId)}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            <span>Criar primeiro setor</span>
          </button>
          <div class="setor-cliente-empty__hints">
            <div class="setor-cliente-empty__hint">
              <span class="setor-cliente-empty__hint-num">1</span>
              <span>Crie um setor (ex: "Sala 1", "Cozinha", "Bloco A")</span>
            </div>
            <div class="setor-cliente-empty__hint">
              <span class="setor-cliente-empty__hint-num">2</span>
              <span>Adicione equipamentos a esse setor</span>
            </div>
            <div class="setor-cliente-empty__hint">
              <span class="setor-cliente-empty__hint-num">3</span>
              <span>Registre manutenções e gere relatórios PMOC</span>
            </div>
          </div>
        </div>
        ${semSetorBanner}
      </section>`;
    return;
  }

  // Cliente JA tem setores: mostra grade dos setores + tile "Sem setor"
  // (compat backward) caso ainda haja equipamentos sem vínculo de setor.
  // Bug fix #100: filtro AND (setorId === s.id) AND (clienteId match OR
  // sem clienteId pra preservar setores compartilhados entre clientes que
  // existiam antes do PMOC). Evita misturar equips de outros clientes
  // que por acaso compartilhem setor (raro mas possivel).
  const setorCards = setoresDoCliente.map((s) => {
    const eqs = equipamentos.filter(
      (e) => e.setorId === s.id && (!e.clienteId || e.clienteId === clienteId),
    );
    return setorCardHtml(s, eqs);
  });

  let semSetorTile = '';
  if (equipsSemSetor.length) {
    semSetorTile = `
      <article class="setor-card setor-card--sem-setor" data-action="open-setor" data-id="__sem_setor__">
        <div class="setor-card__head">
          <div class="setor-card__title">
            <h3 class="setor-card__name">Sem setor</h3>
            <p class="setor-card__sub">${equipsSemSetor.length} equipamento${equipsSemSetor.length !== 1 ? 's' : ''} sem setor vinculado</p>
          </div>
        </div>
      </article>`;
  }

  el.innerHTML = `<div class="setor-grid">${setorCards.join('')}${semSetorTile}</div>`;
}

/** Renderiza a lista flat de equipamentos (FREE ou drill-down de um setor). */
function renderFlatList(filtro = '', options = {}, setorId = null) {
  const { equipamentos, registros } = getState();
  const evalCtx = _createEquipRenderEvalContext();
  const q = filtro.toLowerCase();
  // Filtros por statusFilter — cada um constrói um Set de IDs permitidos (null = sem filtro).
  //  · 'preventiva-7d' (legado do handler "go-alertas")
  //  · 'preventiva-30d' (quick filter novo)
  //  · 'em-atenção' / 'criticos' (quick filters novos, avaliados via priority engine)
  let allowedIds = null;
  if (options.statusFilter === 'preventiva-7d') {
    allowedIds = new Set(getPreventivaDueEquipmentIds(registros, 7));
  } else if (options.statusFilter === 'preventiva-30d') {
    allowedIds = new Set(getPreventivaDueEquipmentIds(registros, 30));
  } else if (options.statusFilter === 'em-atenção') {
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

  // Filtro por cliente vindo da view /clientes ("Ver equipamentos"). Se
  // setado em options.clienteId, restringe a lista a equipamentos vinculados.
  const filterClienteId = options.clienteId || null;

  let list = equipamentos.filter((e) => {
    // Filtra por setor se estiver em drill-down
    if (setorId === '__sem_setor__') {
      if (e.setorId) return false;
    } else if (setorId) {
      if (e.setorId !== setorId) return false;
    }
    // Filtra por cliente se vier do "Ver equipamentos" da view Clientes.
    if (filterClienteId && e.clienteId !== filterClienteId) return false;
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
    // Filtro por cliente vindo de /clientes -> "Ver equipamentos". Empty state
    // customizado com nome do cliente e CTA pra adicionar o primeiro.
    if (filterClienteId) {
      const clienteNomeFromOpts = options.clienteNome || 'este cliente';
      return {
        title: `${clienteNomeFromOpts} ainda não tem equipamentos`,
        description:
          'Adicione o primeiro equipamento deste cliente pra começar a registrar manutenções e gerar relatórios.',
        ctaLabel: 'Adicionar primeiro equipamento',
        ctaAction: 'eq-add-for-cliente',
        ctaClienteId: filterClienteId,
      };
    }
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
      case 'em-atenção':
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
        // Cliente filter: usa CTA customizado que pre-seleciona o cliente no
        // modal-add-eq. Outros casos: CTA padrao "Novo equipamento".
        const cta = emptyCopy.ctaAction
          ? {
              label: emptyCopy.ctaLabel,
              action: emptyCopy.ctaAction,
              id: emptyCopy.ctaClienteId || '',
              tone: 'primary',
              size: 'sm',
              autoWidth: true,
            }
          : {
              label: '+ Novo equipamento',
              action: 'open-modal',
              id: 'modal-add-eq',
              tone: 'primary',
              size: 'sm',
              autoWidth: true,
            };
        el.innerHTML = emptyStateHtml({
          icon: emptyCopy.ctaAction ? '👥' : '🔧',
          title: emptyCopy.title,
          description: emptyCopy.description,
          cta,
        });
        return;
      }
      // Banner quick-move: aparece quando estamos vendo equips "sem setor"
      // dentro do contexto cliente E ha setores disponiveis. Inclui:
      //   1. Setores já vinculados a este cliente (priority)
      //   2. Setores "orphan" sem cliente (legacy) — ao escolher, o setor eh
      //      auto-vinculado ao cliente durante o move (preenche o gap da
      //      hierarquia Cliente -> Setor -> Equipamento).
      let quickMoveBannerHtml = '';
      if (filterClienteId && setorId === '__sem_setor__' && sortedList.length > 0) {
        const { setores } = getState();
        const setoresDoCliente = (setores || []).filter((s) => s.clienteId === filterClienteId);
        const setoresOrfaos = (setores || []).filter((s) => !s.clienteId);
        const totalDisponiveis = setoresDoCliente.length + setoresOrfaos.length;

        if (totalDisponiveis > 0) {
          const equipIds = sortedList.map((e) => e.id).join(',');

          // Constroi options agrupadas: do cliente primeiro, depois orphan
          // (com label visual indicando que serão vinculados ao cliente).
          const optClientes = setoresDoCliente
            .map(
              (s) =>
                `<option value="${Utils.escapeAttr(s.id)}">${Utils.escapeHtml(s.nome)}</option>`,
            )
            .join('');
          const optOrfaos = setoresOrfaos
            .map(
              (s) =>
                `<option value="${Utils.escapeAttr(s.id)}">${Utils.escapeHtml(s.nome)} (sem cliente — sera vinculado)</option>`,
            )
            .join('');
          const setorOptions =
            (setoresDoCliente.length
              ? `<optgroup label="Setores deste cliente">${optClientes}</optgroup>`
              : '') +
            (setoresOrfaos.length
              ? `<optgroup label="Setores sem cliente (sera vinculado)">${optOrfaos}</optgroup>`
              : '');
          quickMoveBannerHtml = `
            <div class="quick-move-banner" data-equip-ids="${Utils.escapeAttr(equipIds)}">
              <div class="quick-move-banner__icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                </svg>
              </div>
              <div class="quick-move-banner__body">
                <strong>Organizar ${sortedList.length} equipamento${sortedList.length !== 1 ? 's' : ''} sem setor</strong>
                <p>Escolha um setor para mover todos de uma vez. Ou edite cada equipamento individualmente.</p>
              </div>
              <div class="quick-move-banner__action">
                <select class="quick-move-banner__select" id="quick-move-target-setor"
                  aria-label="Setor de destino">
                  <option value="">Selecione um setor...</option>
                  ${setorOptions}
                </select>
                <button type="button" class="quick-move-banner__btn"
                  data-action="quick-move-equip-batch">
                  Mover todos
                </button>
              </div>
            </div>`;
        }
      }

      if (clusterActive) {
        const idleCardsHtml = idleList
          .map((eq) => equipCardHtml(eq, { showLocal: !setorId, evalCtx }))
          .join('');
        const activeCardsHtml = activeList
          .map((eq) => equipCardHtml(eq, { showLocal: !setorId, evalCtx }))
          .join('');
        el.innerHTML =
          quickMoveBannerHtml + _idleClusterHtml(idleCardsHtml, idleList.length) + activeCardsHtml;
      } else {
        el.innerHTML =
          quickMoveBannerHtml +
          sortedList.map((eq) => equipCardHtml(eq, { showLocal: !setorId, evalCtx })).join('');
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
  const activeClienteId = equipCtx.clienteId;
  const activeClienteNome = equipCtx.clienteNome;
  // Spread opcional pra propagar o filtro de cliente nas renderFlatList calls.
  const renderOptionsWithClient = activeClienteId
    ? { ...renderOptions, clienteId: activeClienteId, clienteNome: activeClienteNome }
    : renderOptions;

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
  // Em contexto cliente eles são escondidos (parte da view global do parque).
  if (activeClienteId) {
    // Esconde explicitamente caso renderizado em sessão anterior
    const heroEl = Utils.getEl('equip-hero');
    if (heroEl) heroEl.hidden = true;
    const filtersEl = Utils.getEl('equip-filters');
    if (filtersEl) filtersEl.hidden = true;
  } else {
    renderEquipHero({ isPro });
    renderEquipFilters();
  }

  // Quick filter ativo sobrescreve o fluxo normal: vai pra flat list com
  // statusFilter correspondente. Sempre rende com a toolbar "← Todos" pra dar
  // caminho de volta claro.
  if (activeQuickFilter) {
    const searchBar = Utils.getEl('equip-search-bar');
    if (searchBar) searchBar.style.display = '';
    const titleMap = {
      'sem-setor': 'Sem setor',
      'em-atenção': 'Em atenção',
      criticos: 'Críticos',
      'preventiva-30d': 'Preventivas ≤30d',
    };
    _setToolbar({
      title: titleMap[activeQuickFilter] || 'Equipamentos',
      extraBtn: `<button class="btn btn--outline btn--sm" data-action="equip-quickfilter" data-id="todos">← Todos</button>`,
    });

    if (activeQuickFilter === 'sem-setor') {
      renderFlatList(filtro, renderOptionsWithClient, '__sem_setor__');
    } else {
      renderFlatList(filtro, { ...renderOptionsWithClient, statusFilter: activeQuickFilter }, null);
    }
    return;
  }

  // Filtro por cliente (vindo de /clientes -> "Ver equipamentos"): hierarquia
  // Cliente -> Setor -> Equipamento. Mostra grade de setores DESTE cliente.
  // Drill-down num setor preserva o clienteId no equipCtx (atrayes do
  // setActiveSector chain que usa _navigateEquipCtx).
  // Se vem com sectorId também (drill-down dentro do cliente), pula direto
  // pra flat list filtrada por cliente + setor.
  if (activeClienteId && !activeSectorId) {
    renderSetorGridForCliente(activeClienteId, activeClienteNome);
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
    renderFlatList(filtro, renderOptionsWithClient, null);
    return;
  }

  // Vista lista (FREE ou drill-down de setor)
  if (searchBar) searchBar.style.display = '';

  if (activeSectorId) {
    // Drill-down: mostra equipamentos do setor
    const setor =
      activeSectorId === '__sem_setor__' ? { nome: 'Sem setor' } : findSetor(activeSectorId);
    const nome = setor?.nome ?? 'Setor';
    // Contexto cliente: titulo "Setor X · Cliente Y" e back vai pra grid do cliente
    const titlePrefix = activeClienteNome
      ? `${Utils.truncate(nome, 22)} - ${Utils.truncate(activeClienteNome, 18)}`
      : Utils.truncate(nome, 28);
    const backLabel = activeClienteNome ? '<- Setores do cliente' : '<- Setores';
    // Bug fix #103: "+ Novo equipamento" precisa carregar o contexto atual.
    // Sem isso, user navega Cliente -> Setor -> + Novo equipamento e o form
    // abre vazio, perdendo a hierarquia que ele acabou de percorrer.
    // data-setor-id + data-cliente-id sao lidos pelo handler open-modal pra
    // pre-preencher os dropdowns Setor e Cliente no modal-add-eq.
    const novoEquipBtn =
      activeSectorId !== '__sem_setor__'
        ? `<button class="btn btn--primary btn--sm"
              data-action="open-modal" data-id="modal-add-eq"
              data-setor-id="${Utils.escapeAttr(activeSectorId)}"
              ${activeClienteId ? `data-cliente-id="${Utils.escapeAttr(activeClienteId)}"` : ''}
              data-source="setor_drill">+ Novo equipamento</button>`
        : '';
    _setToolbar({
      title: titlePrefix,
      extraBtn: `${novoEquipBtn}<button class="btn btn--outline btn--sm" data-action="back-to-setores">${backLabel}</button>`,
      hideDefaultCta: true,
    });
  } else {
    // Vista FREE/Plus: toolbar SEM "+ Novo setor". Setores depende de
    // Clientes (Pro-only) — sem clientes cadastrados, o botão vira ruído.
    // O upgrade aparece naturalmente no hero/empty state quando o user
    // já tem 5+ equipamentos sem setor (ver hero.js).
    _setToolbar({
      title: 'Parque de Equipamentos',
    });
  }

  // O filtro de cliente já foi tratado mais cedo via early-return — aqui
  // segue o flow normal de drill-down em setor ou lista flat default.
  renderFlatList(filtro, renderOptionsWithClient, activeSectorId);
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

/**
 * Move um conjunto de equipamentos pra um setor especifico (batch).
 * Usado pelo banner quick-move no drill-down __sem_setor__ dentro do contexto
 * cliente. Atualiza state.equipamentos e re-renderiza.
 *
 * Se clienteIdToLink for passado e o setor de destino for orphan (sem cliente),
 * o setor TAMBEM é vinculado ao cliente — preenchendo o gap da hierarquia
 * Cliente -> Setor -> Equipamento (assume que o user quer organizar tudo sob
 * a mesma carteira).
 *
 * @param {string[]} equipIds
 * @param {string} setorId
 * @param {string} [clienteIdToLink] — se passado, vincula também o setor
 *   orphan ao cliente. No-op se setor já tiver clienteId.
 * @returns {{moved: number, linkedSetor: boolean}}
 */
export function moveEquipsToSetor(equipIds, setorId, clienteIdToLink = null) {
  if (!Array.isArray(equipIds) || !equipIds.length || !setorId) {
    return { moved: 0, linkedSetor: false };
  }
  const idsSet = new Set(equipIds);
  let moved = 0;
  let linkedSetor = false;

  setState((prev) => {
    // Se for vincular o setor orphan ao cliente, atualiza setores também.
    let nextSetores = prev.setores;
    if (clienteIdToLink) {
      nextSetores = (prev.setores || []).map((s) => {
        if (s.id === setorId && !s.clienteId) {
          linkedSetor = true;
          return { ...s, clienteId: clienteIdToLink };
        }
        return s;
      });
    }
    const nextEquipamentos = (prev.equipamentos || []).map((e) => {
      if (idsSet.has(e.id)) {
        moved++;
        return { ...e, setorId };
      }
      return e;
    });
    return { ...prev, setores: nextSetores, equipamentos: nextEquipamentos };
  });

  return { moved, linkedSetor };
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
  // Reseta clienteId hidden + esconde o badge de contexto
  const clienteHidden = Utils.getEl('setor-cliente-id');
  if (clienteHidden) clienteHidden.value = '';
  const clienteBadge = Utils.getEl('setor-cliente-badge');
  if (clienteBadge) clienteBadge.hidden = true;

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
  // clienteId armazenado em hidden input (preenchido quando o modal abre via
  // contexto de cliente). Hierarquia Cliente -> Setor -> Equipamento: setores
  // novos sempre tem cliente, mas mantemos null como valid value pra compat
  // com setores legacy que ainda não foram vinculados.
  const clienteIdRaw = Utils.getEl('setor-cliente-id')?.value || '';
  const clienteId = clienteIdRaw ? String(clienteIdRaw) : null;

  if (isEditing) {
    const editingId = _editingSetorId;
    setState((prev) => ({
      ...prev,
      setores: (prev.setores || []).map((s) =>
        s.id === editingId
          ? { ...s, nome, cor, descricao, responsavel, ...(clienteId ? { clienteId } : {}) }
          : s,
      ),
    }));
  } else {
    setState((prev) => ({
      ...prev,
      setores: [
        ...(prev.setores || []),
        { id: Utils.uid(), nome, cor, descricao, responsavel, clienteId },
      ],
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

/**
 * Mapa: focusField slug → DOM id do input no modal-add-eq.
 * Centraliza pra triggers passarem só o nome lógico, sem acoplar com IDs.
 * Quando adicionar campo novo, basta estender aqui.
 */
const _EDIT_FOCUS_FIELD_MAP = {
  nome: 'eq-nome',
  local: 'eq-local',
  setor: 'eq-setor',
  tag: 'eq-tag',
  tipo: 'eq-tipo',
  fluido: 'eq-fluido',
  modelo: 'eq-modelo',
  serie: 'eq-número-serie',
  capacidade: 'eq-capacidade-btu',
  tensao: 'eq-tensao',
  frequencia: 'eq-frequencia',
  fase: 'eq-fase',
  potencia: 'eq-potencia',
  'corrente-refrig': 'eq-corrente-refrig',
  'corrente-aquec': 'eq-corrente-aquec',
  'pressao-suc': 'eq-pressao-suc',
  'pressao-desc': 'eq-pressao-desc',
  'grau-protecao': 'eq-grau-protecao',
  ano: 'eq-ano-fabricacao',
  criticidade: 'eq-criticidade',
  prioridade: 'eq-prioridade',
  periodicidade: 'eq-periodicidade',
};

/**
 * Lista de fieldKeys que vivem dentro de #eq-etiqueta-more (progressive
 * disclosure dos campos avançados da etiqueta). Quando o foco for em um
 * desses, o painel precisa ser aberto antes do scroll.
 */
const _EDIT_FOCUS_ETIQUETA_MORE = new Set([
  'tensao',
  'frequencia',
  'fase',
  'potencia',
  'corrente-refrig',
  'corrente-aquec',
  'pressao-suc',
  'pressao-desc',
  'grau-protecao',
  'ano',
]);

/**
 * fieldKeys que vivem fora do accordion "Detalhes técnicos" (#eq-step-2):
 * são os campos da seção Essenciais + Contexto, sempre visíveis.
 * Os demais exigem expandir o accordion antes do scroll.
 */
const _EDIT_FOCUS_ESSENCIAIS = new Set(['nome', 'local', 'setor']);

/**
 * Abre o modal-add-eq em modo edição e, opcionalmente, foca um campo
 * específico — expandindo accordions intermediários se necessário.
 *
 * Pedido UX (abr/2026): o técnico clica em "Adicionar TAG" no detail view
 * e o modal abre já posicionado no campo correspondente, com highlight
 * temporário pra ser fácil achar visualmente. Antes só abria o modal
 * inteiro e o usuário tinha que rolar/expandir até achar o campo.
 *
 * @param {string} id - id do equipamento
 * @param {object} [opts]
 * @param {string} [opts.focusField] - slug do campo a focar (ex: 'tag')
 */
export async function openEditEquip(id, opts = {}) {
  const eq = findEquip(id);
  if (!eq) return;

  _editingEquipId = id;
  const focusField = typeof opts?.focusField === 'string' ? opts.focusField : null;

  // Pre-popula os campos do modal com os dados do equipamento
  Utils.setVal('eq-nome', eq.nome || '');
  Utils.setVal('eq-local', eq.local || '');
  Utils.setVal('eq-tag', eq.tag || '');
  Utils.setVal('eq-tipo', eq.tipo || 'Split Hi-Wall');
  Utils.setVal('eq-fluido', eq.fluido || 'R-410A');
  // Componente (so faz sentido se tipo for de climatização). Sync logo apos
  // pra mostrar/esconder o wrapper. setVal é no-op se o wrapper estiver oculto.
  syncComponenteVisibility();
  if (eq.componente) Utils.setVal('eq-componente', eq.componente);
  Utils.setVal('eq-modelo', eq.modelo || '');
  Utils.setVal('eq-criticidade', eq.criticidade || 'media');
  Utils.setVal('eq-prioridade', eq.prioridadeOperacional || 'normal');
  Utils.setVal('eq-periodicidade', String(eq.periodicidadePreventivaDias || 90));
  restoreDadosPlaca(eq.dadosPlaca);
  // Seed review UI dos extras + metadata a partir do payload salvo. Se o
  // equipamento foi cadastrado antes desta feature, eq.dadosPlaca?.camposExtras
  // é undefined e a lista fica vazia — comportamento retrocompatível.
  try {
    const extras = Array.isArray(eq.dadosPlaca?.camposExtras) ? eq.dadosPlaca.camposExtras : [];
    setCamposExtrasState(extras);
    setNameplateMetadata({
      source: eq.dadosPlaca?._source === 'ai' ? 'ai' : 'manual',
      notas: eq.dadosPlaca?.notas || null,
    });
  } catch (_e) {
    /* review UI pode ainda não ter montado — ok, ficará vazia */
  }

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
  // PMOC Fase 2: pre-popula select de cliente no edit. populateClienteSelect()
  // é chamado em open-modal handler, mas aqui setamos o value após o populate.
  // Como populate é async, usamos requestAnimationFrame pra esperar o render.
  if (eq.clienteId) {
    requestAnimationFrame(() => {
      const select = document.getElementById('eq-cliente');
      if (select) Utils.setVal('eq-cliente', eq.clienteId);
    });
  }

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
    return;
  }

  // Foco em campo específico (focusField). Roda DEPOIS do M.open pra
  // garantir que o DOM está visível e mensurável. requestAnimationFrame
  // dá um tick pro browser pintar antes do scroll/focus — evita o
  // scroll cair em (0,0) num modal que ainda não terminou a transição.
  if (focusField) _focusEditField(focusField);
}

/**
 * Encontra o campo no modal-add-eq pelo slug, expande accordions
 * necessários, faz scroll suave até o centro do campo, foca o input
 * e aplica a classe `is-focus-target` por 2s pra um ring visual.
 *
 * Tolerante: se o slug não existir no mapa ou se o input não for
 * encontrado no DOM (ex: feature flag escondendo o accordion), apenas
 * loga warning e segue — o modal já abriu e o usuário pode editar
 * normalmente.
 */
function _focusEditField(fieldKey) {
  const targetId = _EDIT_FOCUS_FIELD_MAP[fieldKey];
  if (!targetId) {
    console.warn(`[equipamentos] focusField desconhecido: "${fieldKey}"`);
    return;
  }

  // Step 1: garante que a seção "Detalhes técnicos" (#eq-step-2) está aberta
  // se o campo não é um dos Essenciais/Contexto. Isso porque o accordion
  // fica fechado por default e o input nem está renderizado-visível antes.
  const needsTechExpand = !_EDIT_FOCUS_ESSENCIAIS.has(fieldKey);
  if (needsTechExpand) {
    const expandBtn = document.getElementById('eq-expand-details');
    const expandPanel = document.getElementById('eq-step-2');
    if (expandBtn && expandPanel) {
      expandBtn.setAttribute('aria-expanded', 'true');
      expandPanel.classList.add('is-open');
      expandPanel.setAttribute('aria-hidden', 'false');
      expandPanel.style.display = 'block';
    }
  }

  // Step 2: se for um campo avançado da etiqueta, expande o sub-painel
  // #eq-etiqueta-more (progressive disclosure dentro de #eq-step-2).
  if (_EDIT_FOCUS_ETIQUETA_MORE.has(fieldKey)) {
    const moreToggle = document.getElementById('eq-etiqueta-more-toggle');
    const morePanel = document.getElementById('eq-etiqueta-more');
    if (moreToggle && morePanel) {
      moreToggle.setAttribute('aria-expanded', 'true');
      morePanel.hidden = false;
      morePanel.setAttribute('aria-hidden', 'false');
    }
  }

  // Step 3: aguarda paint, depois scroll + focus + highlight.
  // 2 RAFs garantem que o reflow das expansões acima foi aplicado antes
  // de medir position pro scrollIntoView. Em devices lentos 1 RAF basta;
  // o segundo é blindagem barata contra "scroll caiu na posição errada".
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const target = document.getElementById(targetId);
      if (!target) {
        console.warn(`[equipamentos] focusField target #${targetId} não encontrado no DOM`);
        return;
      }

      try {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch {
        target.scrollIntoView();
      }

      // Pequeno delay no focus pra não competir com o scroll smooth
      // (alguns browsers cancelam o scroll quando recebem focus durante).
      setTimeout(() => {
        try {
          target.focus({ preventScroll: true });
        } catch {
          target.focus();
        }
      }, 280);

      // Highlight temporário 2s. Aplica na FormGroup wrapper pra o ring
      // englobar o label + input juntos (mais óbvio do que ring só no
      // input). Fallback: aplica direto no input se o wrapper não existir.
      const host = target.closest('.form-group') || target;
      host.classList.add('is-focus-target');
      setTimeout(() => host.classList.remove('is-focus-target'), 2200);
    });
  });
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
  // PMOC Fase 2: vínculo opcional. Vazio → null (equipamento próprio/demo).
  const clienteId = Utils.getVal('eq-cliente') || null;

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
              componente: TIPOS_COM_COMPONENTE.has(tipo)
                ? Utils.getVal('eq-componente') || null
                : null,
              criticidade,
              prioridadeOperacional,
              periodicidadePreventivaDias,
              setorId,
              clienteId,
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
          componente: TIPOS_COM_COMPONENTE.has(tipo) ? Utils.getVal('eq-componente') || null : null,
          criticidade,
          prioridadeOperacional,
          periodicidadePreventivaDias,
          setorId,
          clienteId,
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
  Utils.setVal('eq-componente', '');
  syncComponenteVisibility();
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

/**
 * Subtítulo do detail view: combina Local + TAG numa única linha muted
 * abaixo do nome do equipamento. Local é obrigatório, TAG é opcional.
 * Sem TAG: apenas o local. Sem local (caso impossível mas defensivo):
 * apenas a TAG ou string vazia.
 */
function _eqDetailSubtitle(eq) {
  const parts = [];
  if (eq.local) parts.push(Utils.escapeHtml(eq.local));
  if (eq.tag && String(eq.tag).trim() !== '') {
    parts.push(
      `<span class="eq-detail-title-block__tag">${Utils.escapeHtml(String(eq.tag).trim())}</span>`,
    );
  }
  return parts.join(' · ');
}

/**
 * Renderiza um info-row__value: mostra o valor se existe, ou um CTA
 * "Adicionar X" clicável (abre o modal de editar) se vazio. Antes, campos
 * vazios mostravam só "—" — desperdício de atenção do técnico. Agora o "—"
 * vira convite a preencher no momento em que ele está lendo a ficha.
 *
 * @param {string} value
 * @param {string} addLabel
 * @param {string} safeId
 * @param {string} [variant] - 'mono' aplica info-row__value--mono
 * @param {string} [fieldKey] - slug pra openEditEquip focar o campo após
 *   abrir o modal (ex: 'tag', 'modelo'). Sem fieldKey, modal abre sem foco.
 */
function _infoRowValueOrEmpty(value, addLabel, safeId, variant = '', fieldKey = '') {
  const clean = value && String(value).trim() !== '' ? String(value).trim() : null;
  if (clean) {
    const variantCls = variant === 'mono' ? ' info-row__value--mono' : '';
    return `<span class="info-row__value${variantCls}">${Utils.escapeHtml(clean)}</span>`;
  }
  const focusAttr = fieldKey ? ` data-focus-field="${Utils.escapeAttr(fieldKey)}"` : '';
  return `<button type="button" class="info-row__value info-row__value--add"
    data-action="edit-equip" data-id="${safeId}"${focusAttr}
    aria-label="${Utils.escapeAttr(addLabel)}">
    ${Utils.escapeHtml(addLabel)}
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
  </button>`;
}

/**
 * Mapeia um "factor" de risco (string vinda de evaluateEquipmentRisk) pra um
 * chip com ou sem CTA. Pedido do refino UX: antes, os factors eram só texto
 * informativo — "preventiva sem agenda" aparecia mas não levava a ação
 * alguma. Agora, chips acionáveis viram atalho: click abre modal de editar
 * (pra agendar) ou o fluxo de registro (pra preventiva vencida).
 *
 * Regra de decisão:
 *  - "sem agenda" / "não agendada" → CTA "Agendar" (edit-equip)
 *  - "vencida" / "atrasada" → CTA "Registrar" (go-register-equip)
 *  - "criticidade alta/crítica/operacional" → CTA "Ajustar" (edit-equip)
 *  - positivos ("rotina estável", "sem corretivas") → chip informativo
 *  - outros → chip informativo neutro
 */
function _riskFactorChipHtml(factor, safeId) {
  const factorStr = String(factor || '').trim();
  const lower = factorStr.toLowerCase();
  const escaped = Utils.escapeHtml(factorStr);

  // Detecta intenção a partir do texto do factor + qual campo focar
  // quando o action é edit-equip (focusField propaga via data attribute).
  let action = null;
  let actionLabel = null;
  let focusField = null;
  if (lower.includes('sem agenda') || lower.includes('não agendada')) {
    action = 'edit-equip';
    actionLabel = 'Agendar';
    focusField = 'periodicidade';
  } else if (lower.includes('vencida') || lower.includes('atrasada')) {
    action = 'go-register-equip';
    actionLabel = 'Registrar';
  } else if (
    lower.includes('criticidade') &&
    (lower.includes('alta') || lower.includes('crítica') || lower.includes('operacional'))
  ) {
    action = 'edit-equip';
    actionLabel = 'Ajustar';
    focusField = 'criticidade';
  }

  if (!action) {
    return `<span class="eq-risk-panel__factor">${escaped}</span>`;
  }
  const focusAttr = focusField ? ` data-focus-field="${focusField}"` : '';
  return `<button type="button"
      class="eq-risk-panel__factor eq-risk-panel__factor--actionable"
      data-action="${action}" data-id="${safeId}"${focusAttr}
      aria-label="${escaped} — ${actionLabel}">
      <span class="eq-risk-panel__factor-text">${escaped}</span>
      <span class="eq-risk-panel__factor-cta">${actionLabel} <span aria-hidden="true">→</span></span>
    </button>`;
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
    : 'Histórico dentro da rotina prevista';

  // SVG ring progress
  const ringR = 30;
  const ringC = +(2 * Math.PI * ringR).toFixed(1);
  const ringOffset = +(ringC * (1 - score / 100)).toFixed(1);

  // Setor como info-row READONLY (não editável inline). Antes era um <select>
  // embutido mas quebrava o padrão visual (todos os outros campos são só
  // label + valor) e não tinha feedback de "quando salva?". Edição completa
  // vai pro modal "Editar" no footer. Clique no "Alterar" leva pra lá.
  const setorSelectHtml = (() => {
    const { setores: _setores } = getState();
    const setorObj = _setores.find((s) => s.id === eq.setorId);
    const setorNome = setorObj ? setorObj.nome : 'Sem setor';
    const setorVisual = setorObj ? '' : 'info-row__value--muted';
    return `<div class="info-row info-row--setor">
      <span class="info-row__label">Setor</span>
      <span class="info-row__value ${setorVisual}">${Utils.escapeHtml(setorNome)}</span>
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
  // tipoEmoji removido em V7 (avatar usa só iniciais).
  // visual.icon ainda é usado por outros consumidores (ex: PDF cover).
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
  // V7: emoji do tipo (floquinho/raio/etc) removido do cover fallback —
  // mesmo princípio do avatar do card da listagem. Avatar usa só iniciais,
  // identificação visual fina é responsabilidade da foto real.
  const coverFallback = `<div class="eq-detail-cover__fallback eq-detail-cover__fallback--tone-${visual.tone}">
      <span class="eq-detail-cover__fallback-initials">${Utils.escapeHtml(visual.initials)}</span>
    </div>`;
  const coverInner = firstPhotoUrl
    ? `<img class="eq-detail-cover__img" src="${Utils.escapeAttr(firstPhotoUrl)}" alt="Foto de ${Utils.escapeAttr(eq.nome)}" loading="lazy" />
       ${coverFallback}
       <button type="button" class="eq-detail-cover__preview-hit" aria-label="Ampliar foto de ${Utils.escapeAttr(eq.nome)}"></button>
       <!-- Pill "ampliar" (V7): sinaliza explicitamente que clicar abre
            a foto em fullscreen. Antes só o cursor zoom-in dava a dica;
            usuário mobile/touch nem via cursor, então a pill resolve. -->
       <span class="eq-detail-cover__zoom-hint" aria-hidden="true">
         <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
           <circle cx="11" cy="11" r="7"/><path d="M11 8v6M8 11h6M20 20l-3.5-3.5"/>
         </svg>
         ampliar
       </span>`
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
  // Separa campos fixos (FIELD_ORDER) de extras dinâmicos. Extras ficam em
  // UMA seção simples "Outras informações da etiqueta" — preservamos os
  // dados mas sem insights automáticos (phase-out/disjuntor) pra não criar
  // ruído visual nem prometer análise que exige validação humana.
  const dadosPlacaFixedRows = dadosPlacaRows.filter((r) => !r.extra);
  const dadosPlacaExtraRows = dadosPlacaRows.filter((r) => r.extra);

  const rowHtml = (row) => `
            <div class="info-row">
              <span class="info-row__label">${Utils.escapeHtml(row.label)}</span>
              <span class="info-row__value${row.mono ? ' info-row__value--mono' : ''}">${Utils.escapeHtml(row.value)}</span>
            </div>`;

  const dadosPlacaSectionHtml = dadosPlacaFixedRows.length
    ? `
      <div class="eq-tech-sheet__section">
        <div class="eq-tech-sheet__title">Dados da etiqueta</div>
        <div class="info-list info-list--spaced info-list--soft">
          ${dadosPlacaFixedRows.map(rowHtml).join('')}
        </div>
      </div>`
    : '';

  const dadosPlacaExtrasSectionHtml = dadosPlacaExtraRows.length
    ? `
      <div class="eq-tech-sheet__section">
        <div class="eq-tech-sheet__title">Outras informações da etiqueta</div>
        <div class="info-list info-list--spaced info-list--soft">
          ${dadosPlacaExtraRows.map(rowHtml).join('')}
        </div>
      </div>`
    : '';

  Utils.getEl('eq-det-corpo').innerHTML = `
    <div class="eq-detail-view">

      ${coverBlock}

      <!--
        Title block consolidado (V7 refino UX): nome em h1 + subtítulo
        muted "Local · TAG". Antes a TAG só aparecia dentro do accordion
        e o local mostrava como info-row separado, exigindo scroll ou
        expansão pra info que o técnico precisa de cara. Agora tudo
        identificador essencial fica visível logo após a foto.
      -->
      <div class="eq-detail-title-block">
        <div class="modal__title" id="eq-det-title">${Utils.escapeHtml(eq.nome)}</div>
        <div class="eq-detail-title-block__sub">${_eqDetailSubtitle(eq)}</div>
      </div>

      <!-- ── Hero: score + status. Ring usa linearGradient cyan→success
           (V7) pra dar identidade visual ao score saudável. Tones --warn
           e --danger continuam usando cor sólida via classe-modifier. -->
      <div class="eq-detail-hero eq-detail-hero--${cls}">
        <div class="eq-detail-hero__body">
          <div class="eq-hero-score">
            <div class="eq-score-ring-wrap">
              <svg class="eq-score-ring" viewBox="0 0 72 72" aria-hidden="true">
                <defs>
                  <linearGradient id="eq-score-grad-${safeId}" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="#00c8e8"/>
                    <stop offset="100%" stop-color="#00c853"/>
                  </linearGradient>
                </defs>
                <circle class="eq-score-ring__track" cx="36" cy="36" r="${ringR}"/>
                <circle class="eq-score-ring__fill eq-score-ring__fill--${cls}" cx="36" cy="36" r="${ringR}"
                  stroke-dasharray="${ringC}" stroke-dashoffset="${ringOffset}"
                  ${cls === 'ok' ? `stroke="url(#eq-score-grad-${safeId})"` : ''}/>
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
            .map((f) => _riskFactorChipHtml(f, safeId))
            .join('')}
        </div>
      </div>

      <!-- ── Ficha técnica (V6: accordion colapsável) ──
           Todos os detalhes técnicos (Identificação, Operação, Dados da
           etiqueta) ficam dentro de um único <details> fechado por default.
           Reduz scroll do modal em ~60% — o técnico no campo quase sempre
           quer só ver a foto + registrar serviço, não reler a ficha toda.
           Summary mostra preview curto dos 2 campos mais essenciais
           (Rotina + Próxima preventiva) pra não precisar expandir em 90% dos
           casos. Click no summary expande tudo. -->
      <details class="eq-tech-sheet-wrap" id="eq-tech-sheet-${safeId}">
        <summary class="eq-tech-sheet-wrap__summary">
          <div class="eq-tech-sheet-wrap__summary-head">
            <span class="eq-tech-sheet-wrap__summary-title">Detalhes técnicos</span>
            <svg class="eq-tech-sheet-wrap__chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </div>
          <div class="eq-tech-sheet-wrap__summary-preview">
            <span class="eq-tech-sheet-wrap__summary-chip">
              <b>${Utils.escapeHtml(`${context?.periodicidadeDias || eq.periodicidadePreventivaDias}`)}</b> dias
            </span>
            <span class="eq-tech-sheet-wrap__summary-chip">
              Próx.: <b>${Utils.escapeHtml(proximaPreventiva)}</b>
            </span>
            <span class="eq-tech-sheet-wrap__summary-hint">toque pra ver tudo</span>
          </div>
        </summary>
        <div class="eq-tech-sheet">
          <div class="eq-tech-sheet__section">
            <div class="eq-tech-sheet__title">Identificação</div>
            <div class="info-list info-list--spaced info-list--soft">
              <div class="info-row"><span class="info-row__label">TAG</span>${_infoRowValueOrEmpty(eq.tag, 'Adicionar TAG', safeId, 'mono', 'tag')}</div>
              <div class="info-row"><span class="info-row__label">Tipo</span><span class="info-row__value">${Utils.escapeHtml(eq.tipo)}</span></div>
              <div class="info-row"><span class="info-row__label">Fluido</span>${_infoRowValueOrEmpty(eq.fluido, 'Adicionar fluido', safeId, '', 'fluido')}</div>
              <div class="info-row"><span class="info-row__label">Modelo</span>${_infoRowValueOrEmpty(eq.modelo, 'Adicionar modelo', safeId, '', 'modelo')}</div>
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
          ${dadosPlacaExtrasSectionHtml}
        </div>
      </details>

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
        <!--
          Kebab "Mais ações" substitui a lixeira vermelha que ficava direto
          no footer. Risco de click acidental era real (botão destrutivo a 1
          toque de distância da ação mais comum). Agora a exclusão fica
          atrás de ⋯ → "Excluir" — padrão consistente com o setor-card V3.
        -->
        <div class="eq-modal-footer__more">
          <button class="eq-modal-footer__more-btn" type="button"
            data-action="toggle-eq-detail-menu" data-id="${safeId}"
            aria-haspopup="menu" aria-expanded="false" aria-controls="eq-detail-menu-${safeId}"
            aria-label="Mais ações para ${Utils.escapeAttr(eq.nome)}"
            title="Mais ações">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
            </svg>
          </button>
          <div class="eq-modal-footer__menu" id="eq-detail-menu-${safeId}" role="menu" hidden>
            <button type="button" class="eq-modal-footer__menu-item eq-modal-footer__menu-item--danger"
              role="menuitem" data-action="delete-equip" data-id="${safeId}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
              </svg>
              <span>Excluir equipamento</span>
            </button>
          </div>
        </div>
      </div>

    </div>`;

  // Setor agora é readonly no detail view (listener inline removido).
  // `assignEquipToSetor` continua exportada pra uso programático (drag-drop).

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
  const { equipamentos, técnicos } = getState();
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
    (técnicos || []).forEach((técnico) => {
      const option = document.createElement('option');
      option.value = String(técnico || '');
      tecDatalist.appendChild(option);
    });
  }

  const rTecnico = Utils.getEl('r-tecnico');
  if (rTecnico && !rTecnico.value) {
    const def = Profile.getDefaultTecnico();
    if (def) rTecnico.value = def;
  }
}
