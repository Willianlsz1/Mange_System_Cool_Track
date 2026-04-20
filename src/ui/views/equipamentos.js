/**
 * CoolTrack Pro - Equipamentos View v5.0
 * Funções: renderEquip, saveEquip, viewEquip, deleteEquip, populateEquipSelects
 */

import { Utils, TIPO_ICON } from '../../core/utils.js';
import { getState, findEquip, setState, regsForEquip, findSetor } from '../../core/state.js';
import { Storage } from '../../core/storage.js';
import { Toast } from '../../core/toast.js';
import { OnboardingBanner } from '../components/onboarding.js';
import { withSkeleton } from '../components/skeleton.js';
import { Profile } from '../../features/profile.js';
import { calcHealthScore, getHealthClass, updateHeader } from './dashboard.js';
import { ErrorCodes, handleError } from '../../core/errors.js';
import { checkPlanLimit, isGuestMode } from '../../core/guestLimits.js';
import { GuestConversionModal } from '../components/guestConversionModal.js';
import { trackEvent } from '../../core/telemetry.js';
import {
  evaluateEquipmentHealth,
  evaluateEquipmentRisk,
  evaluateEquipmentRiskTrend,
  getEquipmentMaintenanceContext,
  getSuggestedPreventiveDays,
  normalizePeriodicidadePreventivaDias,
} from '../../domain/maintenance.js';
import { evaluateEquipmentPriority } from '../../domain/priorityEngine.js';
import { ACTION_CODE, evaluateEquipmentSuggestedAction } from '../../domain/suggestedAction.js';
import { getActionPriorityScore } from '../../domain/actionPriority.js';
import { getPreventivaDueEquipmentIds } from '../../domain/alerts.js';
import { emptyStateHtml } from '../components/emptyState.js';
import { validateEquipamentoPayload } from '../../core/inputValidation.js';
import { EquipmentPhotos } from '../components/equipmentPhotos.js';
import { Photos } from '../components/photos.js';
import { uploadPendingPhotos, normalizePhotoList } from '../../core/photoStorage.js';
import { isCachedPlanPlusOrHigher } from '../../core/planCache.js';
// Labels de UI (rótulos de status/condição/prioridade) ficam em módulo
// separado pra permitir reuso pelo dashboard/historico sem arrastar toda
// a view junto. Single source of truth.
import {
  STATUS_OPERACIONAL,
  CONDICAO_OBSERVADA,
  PRIORIDADE_LABEL,
  RISK_CLASS_LABEL,
} from './equipamentos/constants.js';

// ── Edit mode tracking ─────────────────────────────────────────────────────
// Quando preenchido, saveEquip() atualiza o equipamento existente em vez de criar um novo.
let _editingEquipId = null;
export function getEditingEquipId() {
  return _editingEquipId;
}
export function clearEditingState() {
  _editingEquipId = null;
  const titleEl = Utils.getEl('modal-add-eq-title');
  if (titleEl) titleEl.textContent = 'Qual equipamento você quer monitorar?';
  const saveBtn = document.querySelector('[data-action="save-equip"]');
  if (saveBtn) saveBtn.textContent = 'Cadastrar equipamento →';
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
function renderTrendBadge(trend) {
  if (!trend || trend.trend === 'stable') return '';
  if (trend.trend === 'improving') {
    return `<span class="equip-card__risk-trend equip-card__risk-trend--improving" title="Risco caiu ${Math.abs(trend.delta)} pontos nos últimos 30 dias" aria-label="Tendência melhorando">↓ ${Math.abs(trend.delta)} <span class="equip-card__risk-trend-word">melhorando</span></span>`;
  }
  return `<span class="equip-card__risk-trend equip-card__risk-trend--worsening" title="Risco subiu ${trend.delta} pontos nos últimos 30 dias" aria-label="Tendência piorando">↑ ${trend.delta} <span class="equip-card__risk-trend-word">piorando</span></span>`;
}

/**
 * Labels do tone-pill V3 para status operacional do equipamento.
 * Mesma vocabulária do Setor Card V3 (Estável/Em atenção/Crítico/Aguardando)
 * pra unificar o sistema de pills em todas as superfícies de equipamento.
 */
const _EQUIP_TONE_LABELS = {
  ok: 'Estável',
  warn: 'Em atenção',
  danger: 'Crítico',
};

/**
 * Classifica um factor do risk panel como positivo (verde) ou neutro.
 * Positivos são os que expressam "está tudo em ordem" — preventivas em dia,
 * sem corretivas, rotina estável. Tudo o mais fica neutro.
 */
const _POSITIVE_FACTOR_PATTERNS = [
  'em dia',
  'preventivas consecutivas',
  'sem corretivas',
  'dentro da rotina',
  'rotina estável',
  'estável',
  'sem alertas',
  'histórico limpo',
];
function _classifyFactor(factorStr) {
  const lf = String(factorStr || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return _POSITIVE_FACTOR_PATTERNS.some((p) =>
    lf.includes(p.normalize('NFD').replace(/[\u0300-\u036f]/g, '')),
  )
    ? 'positive'
    : 'neutral';
}

// ── PR4 §12.3 · idle-cluster (threshold baixo + histerese) ────────────────
//
// Equipamentos em rotina sem registros/agenda/alerta são "fullyIdle".
// Brief: mockup sugeriu >10 idles pra ativar cluster — tarde demais; 6 já
// polui o grid. Decisão: cluster coleta idles quando houver ≥5; solta quando
// cair ≤2 (histerese 5→2 mata flicker em listas que oscilam perto do limiar).
//
// State é módulo-level porque a decisão colapsar/não precisa lembrar do
// render anterior pra histerese funcionar. Começa null (sem decisão) e
// resolve no primeiro chamada de _resolveIdleClusterCollapsed.
const IDLE_CLUSTER_COLLAPSE_AT = 5;
const IDLE_CLUSTER_RELEASE_AT = 2;
let _idleClusterCollapsed = null;

function _resolveIdleClusterCollapsed(idleCount) {
  if (_idleClusterCollapsed === null) {
    _idleClusterCollapsed = idleCount >= IDLE_CLUSTER_COLLAPSE_AT;
  } else if (_idleClusterCollapsed && idleCount <= IDLE_CLUSTER_RELEASE_AT) {
    _idleClusterCollapsed = false;
  } else if (!_idleClusterCollapsed && idleCount >= IDLE_CLUSTER_COLLAPSE_AT) {
    _idleClusterCollapsed = true;
  }
  return _idleClusterCollapsed;
}

/** Mesma lógica de `isFullyIdle` do card, extraída pra decisão de partição. */
function _isEquipFullyIdle(eq) {
  const context = getEquipmentMaintenanceContext(eq, regsForEquip(eq.id));
  const scls = Utils.safeStatus(eq.status);
  if (scls !== 'ok') return false;
  const eqRegs = regsForEquip(eq.id);
  const risk = evaluateEquipmentRisk(eq, eqRegs);
  if (risk.classification !== 'baixo') return false;
  const suggestedAction = evaluateEquipmentSuggestedAction(eq, eqRegs);
  const hasAction =
    suggestedAction.actionCode !== ACTION_CODE.NONE &&
    suggestedAction.actionCode !== ACTION_CODE.MONITOR;
  if (hasAction) return false;
  const hasMetrics = Boolean(context.ultimoRegistro) || Boolean(context.proximaPreventiva);
  return !hasMetrics;
}

function _idleClusterHtml(idleCards, count) {
  // Markup: summary button (clickable row w/ counter + CTA) + hidden cards
  // container. O toggle-idle-cluster handler só flipa `data-expanded` — CSS
  // cuida de mostrar/esconder a lista. Zero re-render necessário.
  const label = `${count} equipamento${count === 1 ? '' : 's'} novo${count === 1 ? '' : 's'} aguardando linha de base`;
  return `<div class="equip-idle-cluster" data-expanded="false" role="group" aria-label="${label}">
    <button type="button" class="equip-idle-cluster__summary" data-action="toggle-idle-cluster" aria-expanded="false">
      <div class="equip-idle-cluster__icon" aria-hidden="true">+</div>
      <div class="equip-idle-cluster__text">
        <div class="equip-idle-cluster__title"><b>${count}</b> equipamento${count === 1 ? '' : 's'} novo${count === 1 ? '' : 's'}</div>
        <div class="equip-idle-cluster__sub">aguardando linha de base</div>
      </div>
      <span class="equip-idle-cluster__cta">
        <span class="equip-idle-cluster__cta-text">Ver todos</span>
        <span class="equip-idle-cluster__cta-caret" aria-hidden="true">▾</span>
      </span>
    </button>
    <div class="equip-idle-cluster__cards" role="list">
      ${idleCards}
    </div>
  </div>`;
}

function equipCardIconBlock(eq) {
  const icon = TIPO_ICON[eq.tipo] ?? '⚙️';
  const firstPhoto = Array.isArray(eq.fotos) ? eq.fotos.find((p) => p && (p.url || p.path)) : null;
  const photoUrl = firstPhoto?.url;
  if (photoUrl) {
    const safeUrl = Utils.escapeAttr(photoUrl);
    const safeIcon = icon; // emoji, sem escape
    // onerror: se a signed URL expirou ou falhou, troca por um div com o ícone
    return `<div class="equip-card__type-icon equip-card__type-icon--lg equip-card__type-icon--photo" aria-hidden="true">
      <img src="${safeUrl}" alt="" loading="lazy"
        onerror="this.parentElement.classList.remove('equip-card__type-icon--photo');this.replaceWith(document.createTextNode('${safeIcon}'));" />
    </div>`;
  }
  return `<div class="equip-card__type-icon equip-card__type-icon--lg">${icon}</div>`;
}

export function equipCardHtml(eq, { showLocal: _showLocal = true } = {}) {
  const context = getEquipmentMaintenanceContext(eq, regsForEquip(eq.id));
  const last = context.ultimoRegistro;
  const score = calcHealthScore(eq.id);
  const hcls = getHealthClass(score);
  const scls = Utils.safeStatus(eq.status);
  const safeId = Utils.escapeAttr(eq.id);
  const prioridadeLabel = PRIORIDADE_LABEL[eq.criticidade] || PRIORIDADE_LABEL.media;
  const eqRegs = regsForEquip(eq.id);
  const risk = evaluateEquipmentRisk(eq, eqRegs);
  const riskTrend = evaluateEquipmentRiskTrend(eq, eqRegs);
  const suggestedAction = evaluateEquipmentSuggestedAction(eq, eqRegs);

  function getCtaByAction(actionCode) {
    if (actionCode === ACTION_CODE.REGISTER_CORRECTIVE_IMMEDIATE)
      return 'Registrar serviço corretivo agora';
    if (actionCode === ACTION_CODE.REGISTER_CORRECTIVE) return 'Registrar serviço corretivo';
    if (actionCode === ACTION_CODE.REGISTER_PREVENTIVE) return 'Registrar serviço preventivo';
    if (actionCode === ACTION_CODE.SCHEDULE_PREVENTIVE) return 'Programar serviço preventivo';
    return 'Registrar serviço';
  }

  function recencia(data) {
    const diff = Math.round((new Date() - new Date(data)) / 86400000);
    if (diff === 0) return 'hoje';
    if (diff === 1) return 'ontem';
    if (diff < 30) return `há ${diff} dias`;
    if (diff < 60) return 'há 1 mês';
    return `há ${Math.floor(diff / 30)} meses`;
  }

  // ─── Próxima preventiva label + tom ───────────────────────────────────────
  let proximaLabel = null;
  let proximaTone = 'neutral';
  if (context.proximaPreventiva) {
    const diff = Utils.daysDiff(context.proximaPreventiva);
    if (diff < 0) {
      proximaLabel = `vencida há ${Math.abs(diff)}d`;
      proximaTone = 'danger';
    } else if (diff === 0) {
      proximaLabel = 'hoje';
      proximaTone = 'danger';
    } else if (diff <= 7) {
      proximaLabel = `${diff} dia${diff > 1 ? 's' : ''}`;
      proximaTone = 'warn';
    } else {
      proximaLabel = `${diff} dias`;
    }
  }

  // ─── Estados do card (redesign V2 — port Claude Design) ───────────────────
  //
  // Três densidades pra evitar o "wall of text" da V1:
  //
  //  · isFullyIdle  → equip em rotina sem registros/agenda/alerta. Renderiza
  //                   só header + bloco de onboarding dashed cyan.
  //  · hasAction    → actionCode ≠ NONE/MONITOR → mostra bloco "Ação
  //                   recomendada" com meta autor/tempo do último registro.
  //  · hasMetrics   → pelo menos registro prévio OU preventiva agendada →
  //                   mostra timeline strip (Última ──── Próx.)
  //
  // Em estado ativo (não idle) o card ganha: header com score lateral +
  // EFICIÊNCIA em CAPS no lugar da pill de status, barra full-width,
  // chips compactos em linha, timeline strip e CTA tonal full-width no
  // rodapé (gradient tonal pro scls).
  const hasAction =
    suggestedAction.actionCode !== ACTION_CODE.NONE &&
    suggestedAction.actionCode !== ACTION_CODE.MONITOR;
  const hasMetrics = Boolean(last) || Boolean(context.proximaPreventiva);
  const isFullyIdle = scls === 'ok' && risk.classification === 'baixo' && !hasAction && !hasMetrics;
  const cardModifiers = `equip-card--${scls}${isFullyIdle ? ' equip-card--idle' : ''}`;

  const ctaLabel = !last && !hasAction ? 'Começar' : getCtaByAction(suggestedAction.actionCode);

  // ─── Header right-side: idle = tone-pill V3 / ativo = score + EFICIÊNCIA ───
  //
  // V3: substituímos o risk-chip idle pelo mesmo tone-pill do Setor Card
  // (Estável/Em atenção/Crítico) pra alinhar vocabulário visual em todas
  // as superfícies de equipamento. O ativo mantém o score block porque
  // o % carrega informação adicional ao tom.
  const toneLabel = _EQUIP_TONE_LABELS[scls] || _EQUIP_TONE_LABELS.ok;
  const headerRightHtml = isFullyIdle
    ? `<span class="equip-card__tone-pill equip-card__tone-pill--${scls}">
        <span class="equip-card__tone-pill-dot" aria-hidden="true"></span>
        ${toneLabel}
      </span>`
    : `<div class="equip-card__score-block">
        <span class="equip-card__score-value equip-card__score-value--${hcls}">${score}%</span>
        <span class="equip-card__score-label">Eficiência</span>
      </div>`;

  // E4: delete removido do header do card (V3). A ação destrutiva vive agora
  // só dentro do modal de detalhe do equipamento pra reduzir cliques
  // acidentais em list view — mesmo padrão do Setor Card V3 onde delete está
  // escondido no kebab overflow.
  const deleteBtnHtml = '';

  // ─── Idle body: onboarding dashed cyan (substitui bar/risk/metrics/action)
  if (isFullyIdle) {
    return `<div class="equip-card ${cardModifiers}" data-action="view-equip" data-id="${safeId}" role="listitem" tabindex="0" aria-label="${Utils.escapeHtml(eq.nome)} — ${STATUS_OPERACIONAL[scls]}">
      <div class="equip-card__header">
        ${equipCardIconBlock(eq)}
        <div class="equip-card__meta">
          <div class="equip-card__name">${Utils.escapeHtml(eq.nome)}</div>
          <div class="equip-card__tag">${Utils.escapeHtml(eq.tag || '—')} · ${Utils.escapeHtml(eq.fluido || eq.tipo)} · ${Utils.escapeHtml(prioridadeLabel)}</div>
        </div>
        ${headerRightHtml}
        ${deleteBtnHtml}
      </div>
      <div class="equip-card__onboard">
        <div class="equip-card__onboard-text">
          <div class="equip-card__onboard-title">Novo equipamento</div>
          <div class="equip-card__onboard-sub">Crie a linha de base com seu primeiro serviço</div>
        </div>
        <button class="equip-card__onboard-cta" data-action="go-register-equip" data-id="${safeId}">
          ${ctaLabel} <span aria-hidden="true">→</span>
        </button>
      </div>
    </div>`;
  }

  // ─── Ativo: chips (c/ timeline inline) + primary row (action + CTA fundidos) ─
  //
  // PR2 §12: __action + __cta-bar fundidos em __primary (grid 1fr auto).
  // Timeline migra pra __timeline-inline dentro do chips row. Tree anterior
  // (5 zonas: header / bar / chips / timeline / action / cta-bar) colapsa
  // em 3 zonas de leitura (header / chips+timeline / primary). Reduz ~40%
  // da altura visual do card sem perder informação.
  //
  // E9: factors positivos ganham variante --positive (tom verde discreto);
  // os demais ficam --neutral. Dá hierarquia imediata de leitura sem
  // aumentar densidade.
  const timelineInlineHtml = hasMetrics
    ? `<span class="equip-card__timeline-inline">
        Últ. <b>${last ? Utils.escapeHtml(recencia(last.data)) : '—'}</b>
        <span class="equip-card__timeline-sep" aria-hidden="true"></span>
        Próx. <b class="equip-card__timeline-inline-next--${proximaTone}">${proximaLabel ? Utils.escapeHtml(proximaLabel) : 'sem agenda'}</b>
      </span>`
    : '';

  const chipsHtml = `<div class="equip-card__chips">
      <span class="equip-card__risk-chip equip-card__risk-chip--${risk.classification}">${RISK_CLASS_LABEL[risk.classification]} · ${risk.score}</span>
      ${renderTrendBadge(riskTrend)}
      ${risk.factors
        .slice(0, 3)
        .map(
          (f) =>
            `<span class="equip-card__chip-ctx equip-card__chip-ctx--${_classifyFactor(f)}">${Utils.escapeHtml(f)}</span>`,
        )
        .join('')}
      ${timelineInlineHtml}
    </div>`;

  // PR2 §12.2 — label contextual do __primary: binário (urgente | próxima).
  // Regra: danger OR factor inclui "parado desde"/"preventiva vencida".
  // "PRÓXIMA ROTINA" do mockup foi descartado — ruído cognitivo pro tech.
  const isUrgent =
    scls === 'danger' ||
    risk.factors.some((f) => /parado desde|preventiva vencida/i.test(String(f)));
  const primaryLabelText = isUrgent ? 'AÇÃO URGENTE' : 'PRÓXIMA AÇÃO';
  const primaryTitle = hasAction ? suggestedAction.actionLabel : ctaLabel;
  const primaryMetaHtml =
    hasAction && last?.tecnico
      ? `<div class="equip-card__primary-meta">Por ${Utils.escapeHtml(last.tecnico)} · ${Utils.escapeHtml(recencia(last.data))}</div>`
      : '';

  return `<div class="equip-card ${cardModifiers}" data-action="view-equip" data-id="${safeId}" role="listitem" tabindex="0" aria-label="${Utils.escapeHtml(eq.nome)} — ${STATUS_OPERACIONAL[scls]}">
    <div class="equip-card__header">
      ${equipCardIconBlock(eq)}
      <div class="equip-card__meta">
        <div class="equip-card__name ${scls === 'danger' ? 'equip-card__name--danger' : ''}">${Utils.escapeHtml(eq.nome)}</div>
        <div class="equip-card__tag">${Utils.escapeHtml(eq.tag || '—')} · ${Utils.escapeHtml(eq.fluido || eq.tipo)} · ${Utils.escapeHtml(prioridadeLabel)}</div>
      </div>
      ${headerRightHtml}
      ${deleteBtnHtml}
    </div>
    <div class="equip-card__health-bar-full">
      <div class="equip-card__health-fill equip-card__health-fill--${hcls}" style="width:${score}%"></div>
    </div>
    ${chipsHtml}
    <div class="equip-card__primary">
      <div class="equip-card__primary-text">
        <div class="equip-card__primary-label">${primaryLabelText}</div>
        <div class="equip-card__primary-title">${Utils.escapeHtml(primaryTitle)}</div>
        ${primaryMetaHtml}
      </div>
      <button class="equip-card__primary-cta" data-action="go-register-equip" data-id="${safeId}" aria-label="${Utils.escapeHtml(ctaLabel)}">
        <svg class="equip-card__primary-cta-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>
      </button>
    </div>
  </div>`;
}

// ─── Setor (PRO) ──────────────────────────────────────────────────────────────

/** ID do setor atualmente expandido; null = vista de grid de setores. */
let _activeSectorId = null;

const _SETOR_CORES = ['#00c8e8', '#00c853', '#ffab40', '#ff5252', '#7c4dff', '#448aff'];

/** Status "pior" de uma lista de equipamentos: danger > warn > ok. */
function worstStatus(eqs) {
  if (eqs.some((e) => Utils.safeStatus(e.status) === 'danger')) return 'danger';
  if (eqs.some((e) => Utils.safeStatus(e.status) === 'warn')) return 'warn';
  return 'ok';
}

// Módulo de manutenção cacheado para uso síncrono nos cards de setor.
// Resolvido em tempo de load; acesso defensivo pra não quebrar se o import
// falhar (offline etc) — os cards mostram fallback zerado nesse caso.
let _maintenanceModule = null;
import('../../domain/maintenance.js')
  .then((m) => {
    _maintenanceModule = m;
  })
  .catch(() => {});

/**
 * Agrega KPIs dinâmicos de um setor: score médio (0-100) e % em dia com
 * preventiva. "Em dia" = equipamento sem preventiva vencida (daysToNext >= 0),
 * ou equipamento sem histórico (ainda não tem rotina calculada).
 * Retorna `null` pro setor vazio, e valores sempre definidos pros demais.
 */
function getSetorKpis(equipamentosDoSetor) {
  if (!equipamentosDoSetor.length) return null;
  if (!_maintenanceModule) return null;

  let scoreSum = 0;
  let scoreCount = 0;
  let emDia = 0;

  equipamentosDoSetor.forEach((eq) => {
    try {
      const regs = regsForEquip(eq.id);
      const health = _maintenanceModule.evaluateEquipmentHealth(eq, regs);
      scoreSum += health.score;
      scoreCount += 1;
      const diasProx = health.context?.daysToNext;
      // "Em dia" se não tem preventiva agendada (equip novo) ou se o prazo
      // ainda não venceu. Vencida = daysToNext < 0.
      if (diasProx == null || diasProx >= 0) emDia += 1;
    } catch {
      /* ignora: falhar em 1 equip não deve bloquear o card inteiro */
    }
  });

  if (!scoreCount) return null;
  const avgScore = Math.round(scoreSum / scoreCount);
  const pctEmDia = Math.round((emDia / scoreCount) * 100);
  return { avgScore, pctEmDia };
}

/** Tom (ok/warn/danger) derivado do score e dos status agregados dos equips.
 *  Usa a mesma lógica do antigo `setorStatusChip`, mas sem formatar o label
 *  (porque agora o label é contextual — "Operando normal" etc).
 */
function setorHealthTone(equipamentosDoSetor) {
  if (!equipamentosDoSetor.length) return { tone: 'ok', dangerCount: 0, warnCount: 0 };
  const statuses = equipamentosDoSetor.map((e) => Utils.safeStatus(e.status));
  const dangerCount = statuses.filter((s) => s === 'danger').length;
  const warnCount = statuses.filter((s) => s === 'warn').length;
  if (dangerCount > 0) return { tone: 'danger', dangerCount, warnCount };
  if (warnCount > 0) return { tone: 'warn', dangerCount, warnCount };
  return { tone: 'ok', dangerCount, warnCount };
}

/** Labels do tone pill — mesmas quatro categorias do mockup V3. */
const _SETOR_TONE_LABELS = {
  ok: 'Estável',
  warn: 'Em atenção',
  danger: 'Crítico',
  neutral: 'Aguardando',
};

/** Iniciais (máx 2) pro avatar do responsável. Fallback " · " se vazio. */
function _setorResponsavelInitials(name) {
  const clean = String(name || '').trim();
  if (!clean) return '·';
  const parts = clean.split(/\s+/).slice(0, 2);
  return parts
    .map((p) => p[0] || '')
    .join('')
    .toUpperCase();
}

/**
 * Card de SETOR — Port Claude Design V3 (P2A).
 *
 * Novo layout (substitui a versão V2 com score lateral + bars-duo):
 *  · Left identity bar 4px + wash 10% no topo (ambos puxam --setor-cor)
 *  · Head: nome + descricao (subtítulo) + tone-pill (Estável/Atenção/Crítico)
 *  · Meta strip 3 colunas: Equip · Score · Em dia (valores tonificados)
 *  · Health bar 4px com gradiente --setor-cor → success/warn/danger (% em dia)
 *  · Footer: responsável (avatar + nome) + Editar inline + kebab overflow + CTA "Ver"
 *  · Empty state: ícone + copy dentro da mesma shell (meta + health somem)
 *
 * Fields P1 finalmente surfaçados: `descricao` vira subtítulo (1 linha truncate)
 * e `responsavel` vira chip com avatar. Kebab mantém só Excluir agora (Editar
 * ficou inline no footer, mais descobrível).
 */
export function setorCardHtml(
  setor,
  equipamentosDoSetor,
  { isFallback: _isFallback = false } = {},
) {
  const count = equipamentosDoSetor.length;
  const cor = setor.cor || '#00c8e8';
  const safeId = Utils.escapeAttr(setor.id);
  const kpis = getSetorKpis(equipamentosDoSetor);
  const healthTone = setorHealthTone(equipamentosDoSetor);
  // Empty → neutral (tone pill "Aguardando"). Com dados → usa o healthTone real.
  const tone = count === 0 ? 'neutral' : healthTone.tone;
  const toneLabel = _SETOR_TONE_LABELS[tone];
  const cardModifiers = [
    `setor-card--${worstStatus(equipamentosDoSetor)}`,
    count === 0 ? 'setor-card--empty' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const hasDescricao = !!setor.descricao && String(setor.descricao).trim() !== '';
  const descricaoHtml = hasDescricao
    ? `<p class="setor-card__descricao">${Utils.escapeHtml(setor.descricao)}</p>`
    : count === 0
      ? `<p class="setor-card__descricao">Atribua equipamentos pra começar a acompanhar por área.</p>`
      : '';

  const tonePillHtml = `
      <span class="setor-card__tone-pill setor-card__tone-pill--${tone}">
        <span class="setor-card__tone-pill-dot" aria-hidden="true"></span>
        ${toneLabel}
      </span>`;

  // Meta strip (3 KPIs) — só quando há equipamentos. Valores score/em-dia
  // carregam a classe tonal (__meta-value--ok/warn/danger).
  const metaHtml = kpis
    ? `
      <dl class="setor-card__meta" aria-label="Resumo do setor">
        <div class="setor-card__meta-item">
          <dt class="setor-card__meta-label">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 7v10l9 4 9-4V7"/><path d="M12 11v10"/>
            </svg>
            Equip.
          </dt>
          <dd class="setor-card__meta-value setor-card__meta-value--dot">
            <span class="setor-card__meta-value-dot" aria-hidden="true"></span>
            <span>${count}</span>
          </dd>
        </div>
        <div class="setor-card__meta-item">
          <dt class="setor-card__meta-label">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M3 17l5-5 4 4 7-8"/><polyline points="14 8 20 8 20 14"/>
            </svg>
            Score
          </dt>
          <dd class="setor-card__meta-value setor-card__meta-value--${tone}">${kpis.avgScore}<span class="setor-card__meta-value-suffix">/100</span></dd>
        </div>
        <div class="setor-card__meta-item">
          <dt class="setor-card__meta-label">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/>
            </svg>
            Em dia
          </dt>
          <dd class="setor-card__meta-value setor-card__meta-value--${tone}">${kpis.pctEmDia}<span class="setor-card__meta-value-suffix">%</span></dd>
        </div>
      </dl>`
    : '';

  // Health bar — largura = % em dia; gradiente tonificado puxa --setor-cor.
  const healthHtml = kpis
    ? `
      <div class="setor-card__health" role="presentation">
        <div class="setor-card__health-track">
          <div class="setor-card__health-fill setor-card__health-fill--${tone}" style="width:${kpis.pctEmDia}%"></div>
        </div>
      </div>`
    : '';

  // Empty body — só substitui meta + health. Head + footer continuam.
  const emptyHtml =
    count === 0
      ? `
      <div class="setor-card__empty">
        <div class="setor-card__empty-icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 7v10l9 4 9-4V7"/><path d="M12 11v10"/>
          </svg>
        </div>
        <p class="setor-card__empty-copy">
          <b>Setor vazio.</b> Arraste equipamentos aqui ou use <b>+ Novo equipamento</b> pra popular.
        </p>
      </div>`
      : '';

  const hasResponsavel = !!setor.responsavel && String(setor.responsavel).trim() !== '';
  const responsavelHtml = hasResponsavel
    ? `
        <span class="setor-card__avatar" aria-hidden="true">${Utils.escapeHtml(_setorResponsavelInitials(setor.responsavel))}</span>
        <span class="setor-card__responsavel-name" title="${Utils.escapeAttr(setor.responsavel)}">${Utils.escapeHtml(setor.responsavel)}</span>`
    : `
        <span class="setor-card__responsavel-name setor-card__responsavel-name--empty">Sem responsável</span>`;

  const menuId = `setor-menu-${safeId}`;
  const footerHtml = `
      <div class="setor-card__footer">
        <div class="setor-card__responsavel">${responsavelHtml}
        </div>
        <div class="setor-card__actions">
          <button class="setor-card__btn"
                  data-action="edit-setor"
                  data-id="${safeId}"
                  type="button"
                  aria-label="Editar setor ${Utils.escapeHtml(setor.nome)}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M12 20h9"/>
              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
            </svg>
            Editar
          </button>
          <button class="setor-card__btn setor-card__btn--icon"
                  data-action="toggle-setor-menu"
                  data-id="${safeId}"
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded="false"
                  aria-controls="${menuId}"
                  aria-label="Mais ações para o setor ${Utils.escapeHtml(setor.nome)}"
                  title="Mais ações">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
            </svg>
          </button>
          <button class="setor-card__btn setor-card__btn--cta"
                  data-action="open-setor"
                  data-id="${safeId}"
                  type="button"
                  aria-label="Ver equipamentos do setor ${Utils.escapeHtml(setor.nome)}">
            Ver
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="9 6 15 12 9 18"/>
            </svg>
          </button>
          <div class="setor-card__menu" id="${menuId}" role="menu" hidden>
            <button type="button" class="setor-card__menu-item setor-card__menu-item--danger" role="menuitem"
                    data-action="delete-setor" data-id="${safeId}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                   stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
              </svg>
              <span>Excluir</span>
            </button>
          </div>
        </div>
      </div>`;

  return `
    <article class="setor-card ${cardModifiers}" data-action="open-setor" data-id="${safeId}"
             style="--setor-cor:${Utils.escapeHtml(cor)}" role="button" tabindex="0"
             aria-label="Setor ${Utils.escapeHtml(setor.nome)}: ${count} equipamento${count !== 1 ? 's' : ''} — ${toneLabel}">

      <header class="setor-card__head">
        <div class="setor-card__row-top">
          <div class="setor-card__title-wrap">
            <h3 class="setor-card__nome">${Utils.escapeHtml(setor.nome)}</h3>
            ${descricaoHtml}
          </div>
          ${tonePillHtml}
        </div>
      </header>

      ${metaHtml}
      ${healthHtml}
      ${emptyHtml}

      ${footerHtml}
    </article>`;
}

// ─── Hero "Organizar parque" + Quick Filters ────────────────────────────────
//
// O hero mora acima da toolbar e é persistente entre views (grid de setores,
// flat list Free, drill-down de quick filter). Ele NÃO duplica os KPIs do
// Dashboard (eficiência / anomalias / serviços) — o ângulo aqui é gestão:
// quantos equipamentos estão órfãos de setor? Quantos pedem atenção ou estão
// críticos? Quantas preventivas vencem nos próximos 30 dias?
//
// Os 4 chips de filtro são drill-downs rápidos pra cada KPI + "Todos" (reset)
// + "Sem setor" (só aparece como filtro destacado porque já é a dor #1).

/** Quick filter ativo. null = visão padrão (grid/list). */
let _activeQuickFilter = null;

export function getActiveQuickFilter() {
  return _activeQuickFilter;
}
export function setActiveQuickFilter(id) {
  // null, 'sem-setor', 'em-atencao', 'criticos', 'preventiva-30d'
  _activeQuickFilter = id && id !== 'todos' ? id : null;
  // Ao ativar quick filter, sai do drill-down de setor (evita estados
  // inconsistentes tipo "setor X + filtro Críticos").
  if (_activeQuickFilter) _activeSectorId = null;
  renderEquip();
}

/** Computa os 4 KPIs do hero a partir do state atual.
 *  · semSetor: equipamentos sem setorId (órfãos)
 *  · emAtencao: priority >= ALTA (urgente + alta) + status warn
 *  · criticos: status danger
 *  · preventiva30d: preventivas vencendo em até 30 dias (ou já vencidas)
 *
 * Blindagem: cada equip é avaliado em try/catch — falha em 1 não derruba o hero.
 */
export function computeEquipKpis(state = getState()) {
  const { equipamentos = [], registros = [] } = state || {};
  let semSetor = 0;
  let emAtencao = 0;
  let criticos = 0;

  equipamentos.forEach((eq) => {
    if (!eq.setorId) semSetor += 1;
    const status = Utils.safeStatus(eq.status);
    if (status === 'danger') {
      criticos += 1;
    } else {
      try {
        const regs = regsForEquip(eq.id);
        const priority = evaluateEquipmentPriority(eq, regs);
        // Em atenção = ALTA ou URGENTE (Urgente aparece no chip mesmo sem status:danger
        // porque pode vir de preventiva muito atrasada). Status warn sozinho já
        // conta como atenção ainda que a priority engine retorne OK (signal visual).
        if (priority.priorityLevel >= 3 || status === 'warn') emAtencao += 1;
      } catch {
        if (status === 'warn') emAtencao += 1;
      }
    }
  });

  let preventiva30d;
  try {
    preventiva30d = getPreventivaDueEquipmentIds(registros, 30).length;
  } catch {
    preventiva30d = 0;
  }

  return { semSetor, emAtencao, criticos, preventiva30d };
}

/** Copy do subtítulo do hero, derivada dos KPIs (evita "0 de tudo" genérico). */
function _equipHeroSubCopy({ semSetor, emAtencao, criticos, preventiva30d }) {
  if (criticos > 0) {
    const plural = criticos !== 1 ? 's' : '';
    return `${criticos} equipamento${plural} crítico${plural} precisam de ação imediata.`;
  }
  if (emAtencao > 0) {
    const plural = emAtencao !== 1 ? 's' : '';
    return `${emAtencao} equipamento${plural} pedindo atenção.`;
  }
  if (semSetor > 0) {
    const plural = semSetor !== 1 ? 's' : '';
    return `${semSetor} equipamento${plural} sem setor — organize pra acompanhar por área.`;
  }
  if (preventiva30d > 0) {
    const plural = preventiva30d !== 1 ? 's' : '';
    return `${preventiva30d} preventiva${plural} vencendo nos próximos 30 dias.`;
  }
  return 'Parque em ordem. Monitore as preventivas e organize por setor.';
}

/** Renderiza hero no slot #equip-hero. Idempotente; chamar sempre em render. */
export function renderEquipHero() {
  const hero = Utils.getEl('equip-hero');
  if (!hero) return;
  const { equipamentos = [] } = getState();

  // Sem equipamentos: hero fica hidden (empty state do lista-equip cuida da CTA).
  if (!equipamentos.length) {
    hero.setAttribute('hidden', '');
    return;
  }

  hero.removeAttribute('hidden');
  const kpis = computeEquipKpis();
  const sub = Utils.getEl('equip-hero-sub');
  if (sub) sub.textContent = _equipHeroSubCopy(kpis);

  const slot = Utils.getEl('equip-hero-kpis');
  if (!slot) return;

  const tiles = [
    {
      id: 'sem-setor',
      icon: '#eq-ri-inbox',
      tone: 'neutral',
      value: kpis.semSetor,
      label: 'Sem setor',
    },
    {
      id: 'em-atencao',
      icon: '#eq-ri-alert-triangle',
      tone: kpis.emAtencao > 0 ? 'warn' : 'neutral',
      value: kpis.emAtencao,
      label: 'Em atenção',
    },
    {
      id: 'criticos',
      icon: '#eq-ri-alert-octagon',
      tone: kpis.criticos > 0 ? 'danger' : 'neutral',
      value: kpis.criticos,
      label: 'Críticos',
    },
    {
      id: 'preventiva-30d',
      icon: '#eq-ri-calendar-clock',
      tone: kpis.preventiva30d > 0 ? 'cyan' : 'neutral',
      value: kpis.preventiva30d,
      label: 'Preventivas ≤30d',
    },
  ];

  slot.innerHTML = tiles
    .map((t) => {
      const safeId = Utils.escapeAttr(t.id);
      return `
        <button type="button" class="equip-hero__kpi equip-hero__kpi--${t.tone}" role="listitem"
                data-action="equip-quickfilter" data-id="${safeId}"
                aria-label="${Utils.escapeHtml(t.label)}: ${t.value}. Filtrar por ${Utils.escapeHtml(t.label)}">
          <span class="equip-hero__kpi-icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><use href="${t.icon}"/></svg>
          </span>
          <span class="equip-hero__kpi-value">${t.value}</span>
          <span class="equip-hero__kpi-label">${Utils.escapeHtml(t.label)}</span>
        </button>`;
    })
    .join('');
}

/** Renderiza os chips de quick filter no slot #equip-filters. */
export function renderEquipFilters() {
  const bar = Utils.getEl('equip-filters');
  if (!bar) return;
  const { equipamentos = [] } = getState();
  if (!equipamentos.length) {
    bar.setAttribute('hidden', '');
    bar.innerHTML = '';
    return;
  }
  bar.removeAttribute('hidden');
  const active = _activeQuickFilter || 'todos';

  const chips = [
    { id: 'todos', label: 'Todos' },
    { id: 'sem-setor', label: 'Sem setor' },
    { id: 'em-atencao', label: 'Em atenção' },
    { id: 'criticos', label: 'Críticos' },
    { id: 'preventiva-30d', label: 'Preventiva ≤30d' },
  ];

  bar.innerHTML = chips
    .map((c) => {
      const isActive = c.id === active;
      const safeId = Utils.escapeAttr(c.id);
      return `
        <button type="button" class="equip-filter${isActive ? ' equip-filter--active' : ''}"
                data-action="equip-quickfilter" data-id="${safeId}"
                aria-pressed="${isActive ? 'true' : 'false'}">
          ${Utils.escapeHtml(c.label)}
        </button>`;
    })
    .join('');
}

/** Atualiza a toolbar da view de equipamentos. */
function _setToolbar({ title, extraBtn } = {}) {
  const titleEl = Utils.getEl('equip-page-title');
  const actionsEl = Utils.getEl('equip-toolbar-actions');
  if (titleEl) titleEl.textContent = title || 'Parque de Equipamentos';
  if (actionsEl) {
    actionsEl.innerHTML = `
      ${extraBtn || ''}
      <button class="btn btn--primary btn--sm" data-action="open-modal" data-id="modal-add-eq">+ Novo equipamento</button>
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

/**
 * Mostra/esconde o container CONTEXTO do modal de cadastro — só aparece
 * quando ao menos um filho (setor ou fotos) está visível. Mantém o modal
 * enxuto pra usuários Free (sem setor Pro, sem fotos Plus).
 */
function syncContextGroupVisibility() {
  const group = Utils.getEl('eq-context-group');
  if (!group) return;
  const setorVisible = Utils.getEl('eq-setor-wrapper')?.style.display !== 'none';
  const fotosVisible = Utils.getEl('eq-fotos-wrapper')?.style.display !== 'none';
  group.style.display = setorVisible || fotosVisible ? '' : 'none';
}

/**
 * Mostra/esconde o bloco de fotos do equipamento no modal.
 * Feature Plus+/Pro. Usuários Free não veem o bloco — para manter o modal
 * enxuto. Upgrade é comunicado via pricing, não via "foto bloqueada".
 */
export function applyEquipPhotosGate(isPlusOrPro = false) {
  const wrapper = Utils.getEl('eq-fotos-wrapper');
  if (!wrapper) return;
  wrapper.style.display = isPlusOrPro ? '' : 'none';
  if (!isPlusOrPro) {
    try {
      EquipmentPhotos.clear();
    } catch (_err) {
      /* ignora */
    }
  }
  syncContextGroupVisibility();
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
  _activeSectorId = id ?? null;
  // Sair do quick filter ao entrar num setor — evita estados compostos tipo
  // "setor X + chip Críticos" que o header não consegue expressar de um jeito
  // simples.
  if (_activeSectorId) _activeQuickFilter = null;
  renderEquip();
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
            const pr = evaluateEquipmentPriority(e, regsForEquip(e.id));
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
    const apA = getActionPriorityScore(a, regsForEquip(a.id));
    const apB = getActionPriorityScore(b, regsForEquip(b.id));
    if (apB.actionPriorityScore !== apA.actionPriorityScore)
      return apB.actionPriorityScore - apA.actionPriorityScore;
    const pa = evaluateEquipmentPriority(a, regsForEquip(a.id));
    const pb = evaluateEquipmentPriority(b, regsForEquip(b.id));
    if (pb.priorityLevel !== pa.priorityLevel) return pb.priorityLevel - pa.priorityLevel;
    const ra = evaluateEquipmentRisk(a, regsForEquip(a.id)).score;
    const rb = evaluateEquipmentRisk(b, regsForEquip(b.id)).score;
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
  const idleList = sortedList.filter((eq) => _isEquipFullyIdle(eq));
  const activeList = sortedList.filter((eq) => !_isEquipFullyIdle(eq));
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
          .map((eq) => equipCardHtml(eq, { showLocal: !setorId }))
          .join('');
        const activeCardsHtml = activeList
          .map((eq) => equipCardHtml(eq, { showLocal: !setorId }))
          .join('');
        el.innerHTML = _idleClusterHtml(idleCardsHtml, idleList.length) + activeCardsHtml;
      } else {
        el.innerHTML = sortedList.map((eq) => equipCardHtml(eq, { showLocal: !setorId })).join('');
      }
    },
  );
}

export async function renderEquip(filtro = '', options = {}) {
  // Detecta plano PRO
  let isPro = false;
  try {
    const { fetchMyProfileBilling } = await import('../../core/monetization.js');
    const { hasProAccess } = await import('../../core/subscriptionPlans.js');
    const { profile } = await fetchMyProfileBilling();
    isPro = hasProAccess(profile);
    populateSetorSelect(isPro);
  } catch {
    /* fallback FREE */
  }

  // Hero + filters sempre no topo da view (hidden quando não há equipamentos).
  // Precisa rodar antes de qualquer return — os slots são estáveis entre modos.
  renderEquipHero();
  renderEquipFilters();

  // Quick filter ativo sobrescreve o fluxo normal: vai pra flat list com
  // statusFilter correspondente. Sempre rende com a toolbar "← Todos" pra dar
  // caminho de volta claro.
  if (_activeQuickFilter) {
    const searchBar = Utils.getEl('equip-search-bar');
    if (searchBar) searchBar.style.display = '';
    const titleMap = {
      'sem-setor': 'Sem setor',
      'em-atencao': 'Em atenção',
      criticos: 'Críticos',
      'preventiva-30d': 'Preventivas ≤30d',
    };
    _setToolbar({
      title: titleMap[_activeQuickFilter] || 'Equipamentos',
      extraBtn: `<button class="btn btn--outline btn--sm" data-action="equip-quickfilter" data-id="todos">← Todos</button>`,
    });

    if (_activeQuickFilter === 'sem-setor') {
      renderFlatList(filtro, options, '__sem_setor__');
    } else {
      renderFlatList(filtro, { ...options, statusFilter: _activeQuickFilter }, null);
    }
    return;
  }

  const searchBar = Utils.getEl('equip-search-bar');
  const { setores } = getState();

  if (isPro && _activeSectorId === null) {
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
    renderFlatList(filtro, options, null);
    return;
  }

  // Vista lista (FREE ou drill-down de setor)
  if (searchBar) searchBar.style.display = '';

  if (_activeSectorId) {
    // Drill-down: mostra equipamentos do setor
    const setor =
      _activeSectorId === '__sem_setor__' ? { nome: 'Sem setor' } : findSetor(_activeSectorId);
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

  renderFlatList(filtro, options, _activeSectorId);
}

// ─── Setor CRUD ───────────────────────────────────────────────────────────────

// Setores são feature exclusiva do plano Pro. Todas as mutações devem
// passar por ensureProForSetores() — defesa em profundidade contra gates
// de UI que podem ficar stale se o usuário abrir a modal e depois rebaixar
// o plano em outra aba.
async function ensureProForSetores({ action = 'manage' } = {}) {
  try {
    const { fetchMyProfileBilling } = await import('../../core/monetization.js');
    const { hasProAccess } = await import('../../core/subscriptionPlans.js');
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
const SETOR_NOME_LIMIT = 40;
const SETOR_DESC_LIMIT = 120;

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
  const err = Utils.getEl('setor-nome-err');
  if (err) err.hidden = true;
  const nomeInput = Utils.getEl('setor-nome');
  if (nomeInput) {
    nomeInput.setAttribute('aria-invalid', 'false');
    delete nomeInput.dataset.touched;
  }

  _syncSetorModalPreview();
  _syncSetorModalCounters();
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
  const err = Utils.getEl('setor-nome-err');
  if (err) err.hidden = true;
  const nomeInput = Utils.getEl('setor-nome');
  if (nomeInput) {
    nomeInput.setAttribute('aria-invalid', 'false');
    delete nomeInput.dataset.touched;
  }

  _syncSetorModalPreview();
  _syncSetorModalCounters();

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
    nomeCounter.textContent = `${nome.length}/${SETOR_NOME_LIMIT}`;
    nomeCounter.classList.toggle('setor-modal__counter--over', nome.length > SETOR_NOME_LIMIT);
  }
  const descCounter = Utils.getEl('setor-descricao-counter');
  if (descCounter) {
    descCounter.textContent = `${desc.length}/${SETOR_DESC_LIMIT}`;
    descCounter.classList.toggle('setor-modal__counter--over', desc.length > SETOR_DESC_LIMIT);
  }
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
        const err = Utils.getEl('setor-nome-err');
        const isEmpty = !nomeInput.value.trim();
        const wasTouched = nomeInput.dataset.touched === '1';
        if (err) {
          if (isEmpty && wasTouched) {
            err.hidden = false;
            nomeInput.setAttribute('aria-invalid', 'true');
          } else {
            err.hidden = true;
            nomeInput.setAttribute('aria-invalid', 'false');
          }
        }
        _syncSetorModalPreview();
        _syncSetorModalCounters();
      });
    }
    const descInput = Utils.getEl('setor-descricao');
    if (descInput) descInput.addEventListener('input', _syncSetorModalCounters);
  }

  _syncSetorModalPreview();
  _syncSetorModalCounters();
}

export async function saveSetor() {
  const isEditing = Boolean(_editingSetorId);
  const allowed = await ensureProForSetores({ action: isEditing ? 'update' : 'create' });
  if (!allowed) return false;

  const nome = (Utils.getVal('setor-nome') || '').trim();
  if (!nome) {
    // Validação inline: mostra erro abaixo do input + foco + toast leve.
    // Marca o campo como "touched" pra que o erro passe a reaparecer
    // automaticamente se o usuário esvaziar o input depois de digitar.
    const err = Utils.getEl('setor-nome-err');
    if (err) err.hidden = false;
    const nomeInput = Utils.getEl('setor-nome');
    if (nomeInput) {
      nomeInput.dataset.touched = '1';
      nomeInput.setAttribute('aria-invalid', 'true');
      nomeInput.focus();
    }
    Toast.warning('Digite um nome para o setor.');
    return false;
  }

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

  if (_activeSectorId === id) _activeSectorId = null;
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

  // Marca periodicidade como manual para não ser sobrescrita pelo auto-sugestão
  const periodicidadeInput = Utils.getEl('eq-periodicidade');
  if (periodicidadeInput) periodicidadeInput.dataset.manual = '1';

  // Abre o painel de detalhes direto (pula o step 1 de escolha de tipo)
  const detailsPanel = Utils.getEl('eq-step-2');
  if (detailsPanel) {
    detailsPanel.style.display = 'block';
    detailsPanel.setAttribute('aria-hidden', 'false');
  }

  // Popula o select de setor (apenas Pro) e o bloco de fotos (Plus+/Pro)
  try {
    const { fetchMyProfileBilling } = await import('../../core/monetization.js');
    const { hasProAccess, hasPlusAccess } = await import('../../core/subscriptionPlans.js');
    const { profile } = await fetchMyProfileBilling();
    populateSetorSelect(hasProAccess(profile));
    applyEquipPhotosGate(hasPlusAccess(profile));
  } catch {
    populateSetorSelect(false);
    applyEquipPhotosGate(false);
  }
  if (eq.setorId) Utils.setVal('eq-setor', eq.setorId);

  // Carrega fotos já persistidas para preview (sem re-upload)
  try {
    EquipmentPhotos.setExisting(normalizePhotoList(eq.fotos));
  } catch (_err) {
    /* componente pode não ter sido inicializado ainda — ignora */
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
  }
}

export async function saveEquip() {
  const isGuest = isGuestMode();
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

  // ── Fotos do equipamento (feature Plus+/Pro) ─────────────────────────────
  // 1. O componente tem duas listas: `existing` (já no Storage) e `pending`
  //    (novas capturas em dataURL).
  // 2. `uploadPendingPhotos` sobe só as pending e normaliza as existing;
  //    mantém a ordem. Se falhar o upload, a foto pending é preservada como
  //    dataURL (fallback) — o próximo save tenta de novo.
  // 3. Runtime gate: o `applyEquipPhotosGate` esconde o wrapper no Free, mas
  //    um usuário com dev tools pode desesconder e adicionar fotos. Aqui a
  //    gente força a mão: se não for Plus+, o pending é descartado antes do
  //    upload. `existing` é preservado (usuário pode ter degradado de Plus e
  //    as fotos antigas devem persistir até ele limpar/editar explicitamente).
  const equipId = _editingEquipId || Utils.uid();
  const canUploadPhotos = isCachedPlanPlusOrHigher();
  let fotosPayload = [];

  if (!canUploadPhotos) {
    const pendingCount = EquipmentPhotos.pending?.length || 0;
    if (pendingCount > 0) {
      // Telemetria pra rastrear tentativas de bypass do UI gate.
      trackEvent('photo_upload_blocked_non_plus', {
        equipId,
        pendingCount,
        isEdit: Boolean(_editingEquipId),
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
      // Se não está autenticado ou outro erro de upload, segue sem fotos novas.
      // Em edit mode, preserva as existing que já estão persistidas.
      fotosPayload = normalizePhotoList(EquipmentPhotos.existing);
      handleError(err, {
        code: ErrorCodes.SYNC_FAILED,
        severity: 'warning',
        message: 'Foto não enviada. Suas alterações foram salvas.',
        context: { action: 'equipamentos.saveEquip.uploadPhotos', equipId },
        showToast: false,
      });
    }
  }

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
  Utils.setVal('eq-tipo', 'Split Hi-Wall');
  Utils.setVal('eq-fluido', 'R-410A');
  Utils.setVal('eq-criticidade', 'media');
  Utils.setVal('eq-prioridade', 'normal');
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

  if (isGuest && !wasEditing) {
    GuestConversionModal.open({ reason: 'save_attempt', source: 'save-equip' });
  }

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
  const prioridadeLabel = PRIORIDADE_LABEL[eq.criticidade] || PRIORIDADE_LABEL.media;
  const proximaPreventiva = context?.proximaPreventiva
    ? Utils.formatDate(context.proximaPreventiva)
    : 'Sem agenda';
  const healthSummary = health.reasons.length
    ? Utils.escapeHtml(health.reasons.slice(0, 2).join(' | '))
    : 'Historico dentro da rotina prevista';
  const statusCode = Utils.safeStatus(eq.status);
  const fatorOperacao =
    statusCode === 'ok'
      ? 'Sem restrições no momento'
      : statusCode === 'warn'
        ? 'Operação com restrições'
        : 'Fora de operação';
  const fatorPreventiva =
    context?.daysToNext == null
      ? 'Preventiva sem agenda'
      : context.daysToNext < 0
        ? `Preventiva vencida há ${Math.abs(context.daysToNext)} dia${Math.abs(context.daysToNext) > 1 ? 's' : ''}`
        : context.daysToNext === 0
          ? 'Preventiva vence hoje'
          : `Preventiva em ${context.daysToNext} dia${context.daysToNext > 1 ? 's' : ''}`;
  const _fatorCriticidade = `Criticidade operacional ${prioridadeLabel.toLowerCase()}`;

  // SVG ring progress
  const ringR = 30;
  const ringC = +(2 * Math.PI * ringR).toFixed(1);
  const ringOffset = +(ringC * (1 - score / 100)).toFixed(1);

  // Cor do fator preventiva
  const prevStatCls =
    context?.daysToNext == null
      ? ''
      : context.daysToNext < 0
        ? ' eq-hero-stat__val--danger'
        : context.daysToNext <= 7
          ? ' eq-hero-stat__val--warn'
          : '';
  const opStatCls = statusCode !== 'ok' ? ` eq-hero-stat__val--${statusCode}` : '';

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

  // Fotos do equipamento (feature Plus+). Só renderiza se houver fotos com URL
  // assinada válida. Hero "adota" a primeira foto como destaque (coluna lateral
  // no desktop, banner no mobile). As fotos adicionais (índice 1+) viram uma
  // faixa de miniaturas abaixo do hero, para não poluir quando há 1 só foto.
  // Clicar em qualquer foto (hero ou strip) abre o lightbox existente.
  const fotosList = Array.isArray(eq.fotos) ? eq.fotos.filter((p) => p && p.url) : [];
  const heroPhoto = fotosList[0] || null;
  const extraPhotos = fotosList.slice(1);

  const heroPhotoHtml = heroPhoto
    ? `<button type="button" class="eq-detail-hero__photo" data-eq-photo-idx="0"
        aria-label="Abrir foto principal de ${Utils.escapeAttr(eq.nome)}">
        <img src="${Utils.escapeAttr(heroPhoto.url)}" alt="Foto principal de ${Utils.escapeAttr(eq.nome)}" loading="lazy"
          onerror="this.closest('.eq-detail-hero')?.classList.remove('eq-detail-hero--with-photo'); this.closest('.eq-detail-hero__photo')?.remove();" />
        ${extraPhotos.length ? `<span class="eq-detail-hero__photo-count" aria-hidden="true">+${extraPhotos.length}</span>` : ''}
      </button>`
    : '';

  // Faixa de fotos adicionais só aparece quando há 2+ fotos. Os índices batem
  // com `fotosList` para que o listener use a mesma lista na hora de abrir o
  // lightbox.
  const galleryHtml = extraPhotos.length
    ? `<div class="eq-detail-gallery" role="list" aria-label="Fotos adicionais do equipamento">
        ${extraPhotos
          .map(
            (p, i) => `<button type="button" class="eq-detail-gallery__thumb" role="listitem"
              data-eq-photo-idx="${i + 1}" aria-label="Abrir foto ${i + 2} de ${Utils.escapeAttr(eq.nome)}">
              <img src="${Utils.escapeAttr(p.url)}" alt="Foto ${i + 2} de ${Utils.escapeAttr(eq.nome)}" loading="lazy" />
            </button>`,
          )
          .join('')}
      </div>`
    : '';

  Utils.getEl('eq-det-corpo').innerHTML = `
    <div class="eq-detail-view">

      <div class="modal__title" id="eq-det-title">${Utils.escapeHtml(eq.nome)}</div>

      <!-- ── Hero: foto (opcional) + score + status + mini-stats ──
           V3: quando há foto, a coluna esquerda agrupa foto + faixa de
           thumbs (antes era sibling depois do hero). Isso mantém o 2-col
           compacto e alinha o grid visual (foto + info ao lado). -->
      <div class="eq-detail-hero eq-detail-hero--${cls}${heroPhoto ? ' eq-detail-hero--with-photo' : ''}">
        ${
          heroPhoto
            ? `<div class="eq-detail-hero__photo-col">
          ${heroPhotoHtml}
          ${galleryHtml}
        </div>`
            : ''
        }
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
              <div class="eq-hero-score__label">SCORE OPERACIONAL</div>
              <div class="eq-hero-score__status eq-hero-score__status--${cls}">
                ${cls === 'ok' ? CONDICAO_OBSERVADA.ok : cls === 'warn' ? CONDICAO_OBSERVADA.warn : CONDICAO_OBSERVADA.danger}
              </div>
              <div class="eq-hero-score__summary">${healthSummary}</div>
            </div>
          </div>
          <div class="eq-hero-stats">
            <div class="eq-hero-stat">
              <span class="eq-hero-stat__lbl">Operação</span>
              <span class="eq-hero-stat__val${opStatCls}">${Utils.escapeHtml(fatorOperacao)}</span>
            </div>
            <div class="eq-hero-stat">
              <span class="eq-hero-stat__lbl">Preventiva</span>
              <span class="eq-hero-stat__val${prevStatCls}">${Utils.escapeHtml(fatorPreventiva)}</span>
            </div>
            <div class="eq-hero-stat">
              <span class="eq-hero-stat__lbl">Prioridade</span>
              <span class="eq-hero-stat__val">${Utils.escapeHtml(prioridadeLabel)}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- V3: a faixa de thumbs foi movida pra dentro da coluna da foto
           (eq-detail-hero__photo-col), não é mais irmã do hero. -->

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
            <div class="eq-risk-panel__class">${Utils.escapeHtml(risk.classificationLabel)} · Score ${risk.score}</div>
          </div>
          <span class="eq-risk-panel__badge eq-risk-panel__badge--${risk.classification}">${Utils.escapeHtml(risk.classificationLabel)}</span>
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

  // Listeners das fotos: hero (foto principal) + thumbs extras usam o mesmo
  // seletor `[data-eq-photo-idx]`. O índice referencia a `fotosList` original,
  // então o lightbox recebe a URL correta mesmo com o split hero/galeria.
  if (fotosList.length) {
    const photoTargets = document.querySelectorAll('#eq-det-corpo [data-eq-photo-idx]');
    photoTargets.forEach((el) => {
      el.addEventListener('click', () => {
        const idx = Number(el.dataset.eqPhotoIdx);
        const photo = fotosList[idx];
        if (photo?.url) Photos.openLightbox(photo.url);
      });
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
