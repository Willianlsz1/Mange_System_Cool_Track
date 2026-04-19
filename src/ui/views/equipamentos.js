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

const STATUS_OPERACIONAL = {
  ok: 'OPERANDO NORMALMENTE',
  warn: 'OPERANDO COM RESTRIÇÕES',
  danger: 'FORA DE OPERAÇÃO',
};
const CONDICAO_OBSERVADA = {
  ok: 'Sem anormalidades',
  warn: 'Condição fora do padrão',
  danger: 'Intervenção necessária',
  unknown: 'Não avaliado',
};
const PRIORIDADE_LABEL = { baixa: 'Baixa', media: 'Média', alta: 'Alta', critica: 'Crítica' };
const RISK_CLASS_LABEL = { baixo: 'Baixo risco', medio: 'Médio risco', alto: 'Alto risco' };

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
  const suggestedAction = evaluateEquipmentSuggestedAction(eq, eqRegs);

  function getCtaByAction(actionCode) {
    if (actionCode === ACTION_CODE.REGISTER_CORRECTIVE_IMMEDIATE)
      return 'Registrar corretiva agora';
    if (actionCode === ACTION_CODE.REGISTER_CORRECTIVE) return 'Registrar corretiva';
    if (actionCode === ACTION_CODE.REGISTER_PREVENTIVE) return 'Registrar preventiva';
    if (actionCode === ACTION_CODE.SCHEDULE_PREVENTIVE) return 'Programar preventiva';
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

  const ctaLabel =
    !last && !hasAction ? 'Primeiro registro' : getCtaByAction(suggestedAction.actionCode);

  // ─── Header right-side: idle = risk chip / ativo = score + EFICIÊNCIA ─────
  const headerRightHtml = isFullyIdle
    ? `<span class="equip-card__risk-chip equip-card__risk-chip--${risk.classification}">${RISK_CLASS_LABEL[risk.classification]}</span>`
    : `<div class="equip-card__score-block">
        <span class="equip-card__score-value equip-card__score-value--${hcls}">${score}%</span>
        <span class="equip-card__score-label">EFICIÊNCIA</span>
      </div>`;

  const deleteBtnHtml = `<div class="equip-card__actions">
      <button class="equip-card__delete" data-action="delete-equip" data-id="${safeId}" aria-label="Excluir ${Utils.escapeHtml(eq.nome)}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
      </button>
    </div>`;

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

  // ─── Ativo: chips + timeline + action + CTA tonal full-width ──────────────
  const chipsHtml = `<div class="equip-card__chips">
      <span class="equip-card__risk-chip equip-card__risk-chip--${risk.classification}">${RISK_CLASS_LABEL[risk.classification]} · ${risk.score}</span>
      ${risk.factors
        .slice(0, 3)
        .map((f) => `<span class="equip-card__chip-ctx">${Utils.escapeHtml(f)}</span>`)
        .join('')}
    </div>`;

  const timelineHtml = hasMetrics
    ? `<div class="equip-card__timeline">
        <svg class="equip-card__timeline-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>
        <span class="equip-card__timeline-last">
          Última <b>${last ? Utils.escapeHtml(recencia(last.data)) : '—'}</b>
        </span>
        <span class="equip-card__timeline-divider" aria-hidden="true"></span>
        <span class="equip-card__timeline-next equip-card__timeline-next--${proximaTone}">
          Próx. <b>${proximaLabel ? Utils.escapeHtml(proximaLabel) : 'sem agenda'}</b>
        </span>
      </div>`
    : '';

  const actionMetaHtml = last?.tecnico
    ? `<div class="equip-card__action-meta">Por ${Utils.escapeHtml(last.tecnico)} · ${Utils.escapeHtml(recencia(last.data))}</div>`
    : '';

  const actionHtml = hasAction
    ? `<div class="equip-card__action">
        <div class="equip-card__action-label equip-card__action-label--${scls}">AÇÃO RECOMENDADA</div>
        <div class="equip-card__action-title">${Utils.escapeHtml(suggestedAction.actionLabel)}</div>
        ${actionMetaHtml}
      </div>`
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
    ${timelineHtml}
    ${actionHtml}
    <button class="equip-card__cta-bar equip-card__cta-bar--${scls}" data-action="go-register-equip" data-id="${safeId}">
      <span class="equip-card__cta-bar-label">${ctaLabel}</span>
      <svg class="equip-card__cta-bar-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>
    </button>
  </div>`;
}

// ─── Setor (PRO) ──────────────────────────────────────────────────────────────

/** ID do setor atualmente expandido; null = vista de grid de setores. */
let _activeSectorId = null;

const _SETOR_CORES = ['#00bcd4', '#00c853', '#ffab40', '#ff5252', '#7c4dff', '#448aff'];

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

/** Rótulo do health meter tonal do setor.
 *   · danger → "Atenção requerida"
 *   · warn → "N alerta(s) ativo(s)"
 *   · ok → "Operando normal"
 */
function setorHealthLabel({ tone, warnCount }) {
  if (tone === 'danger') return 'Atenção requerida';
  if (tone === 'warn') {
    const plural = warnCount !== 1 ? 's' : '';
    return `${warnCount} alerta${plural} ativo${plural}`;
  }
  return 'Operando normal';
}

/**
 * Card de SETOR — Port Claude Design V2 (PR D2).
 *
 * Estrutura nova:
 *  · Head: nome + "N equipamento(s)" (com dot da cor do setor)
 *  · Score lateral direita: "79/100" (valor colorido por tom)
 *  · Health meter tonal: dot + label contextual + "N% em dia"
 *  · 2 barras finas (3px) side-by-side: score + preventiva
 *  · CTA "Ver equipamentos" + ações (editar/excluir) absolute no hover
 *
 * O antigo `isFallback` ("Sem setor") foi promovido a `semSetorStripHtml`
 * e renderizado acima do grid, não mais como card interno.
 */
export function setorCardHtml(
  setor,
  equipamentosDoSetor,
  { isFallback: _isFallback = false } = {},
) {
  const count = equipamentosDoSetor.length;
  const cor = setor.cor || '#00bcd4';
  const safeId = Utils.escapeAttr(setor.id);
  const kpis = getSetorKpis(equipamentosDoSetor);
  const healthTone = setorHealthTone(equipamentosDoSetor);
  const tone = healthTone.tone; // 'ok' | 'warn' | 'danger'
  const cardModifiers = [
    `setor-card--${worstStatus(equipamentosDoSetor)}`,
    count === 0 ? 'setor-card--empty' : '',
  ]
    .filter(Boolean)
    .join(' ');

  // Score lateral (canto direito do head) — só aparece em setores com dados.
  // Em setor vazio, mostra "—/100" em tom muted pra manter a diagramação.
  const scoreLatHtml = kpis
    ? `
      <div class="setor-card__score-lat">
        <div class="setor-card__score-lat-cap">SCORE</div>
        <div class="setor-card__score-lat-num">
          <span class="setor-card__score-lat-val setor-card__score-lat-val--${tone}">${kpis.avgScore}</span><span class="setor-card__score-lat-den">/100</span>
        </div>
      </div>`
    : `
      <div class="setor-card__score-lat setor-card__score-lat--muted">
        <div class="setor-card__score-lat-cap">SCORE</div>
        <div class="setor-card__score-lat-num">
          <span class="setor-card__score-lat-val">—</span><span class="setor-card__score-lat-den">/100</span>
        </div>
      </div>`;

  // Corpo: setores com dados mostram health meter + 2 barras finas.
  // Setor vazio mostra apenas mensagem muted.
  const bodyHtml = kpis
    ? `
      <div class="setor-card__health-block">
        <div class="setor-card__health-meter setor-card__health-meter--${tone}">
          <span class="setor-card__health-dot"></span>
          <span class="setor-card__health-label">${Utils.escapeHtml(setorHealthLabel(healthTone))}</span>
          <span class="setor-card__health-pct">${kpis.pctEmDia}% em dia</span>
        </div>
        <div class="setor-card__bars-duo" role="presentation">
          <div class="setor-card__bar-thin setor-card__bar-thin--${tone}">
            <span style="width:${kpis.avgScore}%"></span>
          </div>
          <div class="setor-card__bar-thin setor-card__bar-thin--ok">
            <span style="width:${kpis.pctEmDia}%"></span>
          </div>
        </div>
      </div>`
    : `
      <div class="setor-card__empty-body">
        <span class="setor-card__empty-hint">Nenhum equipamento atribuído ainda.</span>
      </div>`;

  const menuId = `setor-menu-${safeId}`;
  const actionsHtml = `
      <div class="setor-card__actions">
        <button class="setor-card__kebab"
                data-action="toggle-setor-menu"
                data-id="${safeId}"
                aria-haspopup="menu"
                aria-expanded="false"
                aria-controls="${menuId}"
                aria-label="Mais ações para o setor ${Utils.escapeHtml(setor.nome)}"
                title="Mais ações">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <circle cx="12" cy="5" r="1.8"/>
            <circle cx="12" cy="12" r="1.8"/>
            <circle cx="12" cy="19" r="1.8"/>
          </svg>
        </button>
        <div class="setor-card__menu" id="${menuId}" role="menu" hidden>
          <button type="button" class="setor-card__menu-item" role="menuitem"
                  data-action="edit-setor" data-id="${safeId}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M12 20h9"/>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
            </svg>
            <span>Editar</span>
          </button>
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
      </div>`;

  return `
    <div class="setor-card ${cardModifiers}" data-action="open-setor" data-id="${safeId}"
         style="--setor-cor:${Utils.escapeHtml(cor)}" role="button" tabindex="0"
         aria-label="Setor ${Utils.escapeHtml(setor.nome)}: ${count} equipamento${count !== 1 ? 's' : ''}">

      <div class="setor-card__head">
        <div class="setor-card__info">
          <div class="setor-card__nome">${Utils.escapeHtml(setor.nome)}</div>
          <div class="setor-card__count">
            <span class="setor-card__count-dot"></span>
            ${count} equipamento${count !== 1 ? 's' : ''}
          </div>
        </div>
        ${scoreLatHtml}
      </div>

      ${bodyHtml}

      <div class="setor-card__footer">
        ${actionsHtml}
        <div class="setor-card__cta">
          <span>Ver equipamentos</span>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M5 3l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
      </div>
    </div>`;
}

/**
 * Strip "Sem setor" — promovida pro topo do grid (PR D2).
 *
 * Antes era um card interno (dashed) misturado com os setores reais; agora
 * é um strip horizontal fino acima do grid, com CTA direto pra atribuir.
 * Aparece só quando há equipamentos órfãos.
 *
 * A ação `assign-sem-setor` abre a lista flat desses equipamentos (drill-down
 * no bucket __sem_setor__) — mesma semântica que o antigo card fallback.
 */
export function semSetorStripHtml(count) {
  if (!count) return '';
  const plural = count !== 1 ? 's' : '';
  return `
    <div class="sem-setor-strip" data-action="open-setor" data-id="__sem_setor__"
         role="button" tabindex="0"
         aria-label="${count} equipamento${plural} sem setor atribuído">
      <div class="sem-setor-strip__icon" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      </div>
      <div class="sem-setor-strip__body">
        <div class="sem-setor-strip__title">
          ${count} equipamento${plural} sem setor
        </div>
        <div class="sem-setor-strip__sub">
          Fora dos KPIs até ser${count !== 1 ? 'em' : ''} atribuído${plural}
        </div>
      </div>
      <button class="sem-setor-strip__cta" data-action="open-setor" data-id="__sem_setor__"
              type="button">
        Atribuir setor <span aria-hidden="true">→</span>
      </button>
    </div>`;
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

  // "Sem setor" virou strip no topo do grid (PR D2 — Port Claude Design V2).
  // Aparece só quando há equipamentos órfãos; CTA direto pra atribuir.
  const semSetor = equipamentos.filter((e) => !e.setorId);
  const semSetorStrip = semSetorStripHtml(semSetor.length);

  el.innerHTML = `${semSetorStrip}<div class="setor-grid">${setorCards.join('')}</div>`;
}

/** Renderiza a lista flat de equipamentos (FREE ou drill-down de um setor). */
function renderFlatList(filtro = '', options = {}, setorId = null) {
  const { equipamentos, registros } = getState();
  const q = filtro.toLowerCase();
  const preventivas7dIds =
    options.statusFilter === 'preventiva-7d'
      ? new Set(getPreventivaDueEquipmentIds(registros, 7))
      : null;

  let list = equipamentos.filter((e) => {
    // Filtra por setor se estiver em drill-down
    if (setorId === '__sem_setor__') {
      if (e.setorId) return false;
    } else if (setorId) {
      if (e.setorId !== setorId) return false;
    }
    const matchesStatus = !preventivas7dIds || preventivas7dIds.has(e.id);
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

  withSkeleton(
    el,
    { enabled: true, variant: 'equipment', count: Math.min(Math.max(list.length, 3), 5) },
    () => {
      el.innerHTML = sortedList.length
        ? sortedList.map((eq) => equipCardHtml(eq, { showLocal: !setorId })).join('')
        : emptyStateHtml({
            icon: '🔧',
            title: setorId ? 'Nenhum equipamento neste setor' : 'Nenhum equipamento encontrado',
            description: setorId
              ? 'Atribua equipamentos a este setor ao cadastrá-los.'
              : 'Tente outro termo ou cadastre um novo.',
            cta: {
              label: '+ Novo equipamento',
              action: 'open-modal',
              id: 'modal-add-eq',
              tone: 'primary',
              size: 'sm',
              autoWidth: true,
            },
          });
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
    // Vista FREE: toolbar padrão
    _setToolbar({ title: 'Parque de Equipamentos' });
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

// Estado do fluxo de edição do setor. Quando preenchido, saveSetor()
// atualiza em vez de criar.
let _editingSetorId = null;
export function getEditingSetorId() {
  return _editingSetorId;
}
export function clearSetorEditingState() {
  _editingSetorId = null;
  const titleEl = Utils.getEl('modal-add-setor-title');
  if (titleEl) titleEl.textContent = 'Criar setor';
  const saveBtn = document.querySelector('[data-action="save-setor"]');
  if (saveBtn) saveBtn.textContent = 'Criar setor';
}
export function openEditSetor(id) {
  const setor = findSetor(id);
  if (!setor) {
    Toast.warning('Setor não encontrado.');
    return;
  }
  _editingSetorId = id;
  Utils.setVal('setor-nome', setor.nome);
  // Marca a cor atual no picker
  const picker = Utils.getEl('setor-color-picker');
  const hiddenInput = Utils.getEl('setor-cor');
  if (picker) {
    let matched = false;
    picker.querySelectorAll('.setor-color-btn').forEach((b) => {
      const isMatch = b.dataset.cor === setor.cor;
      b.classList.toggle('setor-color-btn--selected', isMatch);
      b.setAttribute('aria-pressed', isMatch ? 'true' : 'false');
      if (isMatch) matched = true;
    });
    // Cor custom (fora da paleta): deseleciona tudo
    if (!matched) {
      picker.querySelectorAll('.setor-color-btn').forEach((b) => {
        b.classList.remove('setor-color-btn--selected');
        b.setAttribute('aria-pressed', 'false');
      });
    }
  }
  if (hiddenInput) hiddenInput.value = setor.cor || '#00bcd4';
  const titleEl = Utils.getEl('modal-add-setor-title');
  if (titleEl) titleEl.textContent = 'Editar setor';
  const saveBtn = document.querySelector('[data-action="save-setor"]');
  if (saveBtn) saveBtn.textContent = 'Salvar alterações';
  import('../../core/modal.js').then(({ Modal: M }) => M.open('modal-add-setor'));
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
  const isEditing = Boolean(_editingSetorId);
  const allowed = await ensureProForSetores({ action: isEditing ? 'update' : 'create' });
  if (!allowed) return false;

  const nome = (Utils.getVal('setor-nome') || '').trim();
  if (!nome) {
    Toast.warning('Digite um nome para o setor.');
    return false;
  }

  const cor = Utils.getEl('setor-cor')?.value || '#00bcd4';

  if (isEditing) {
    const editingId = _editingSetorId;
    setState((prev) => ({
      ...prev,
      setores: (prev.setores || []).map((s) => (s.id === editingId ? { ...s, nome, cor } : s)),
    }));
  } else {
    setState((prev) => ({
      ...prev,
      setores: [...(prev.setores || []), { id: Utils.uid(), nome, cor }],
    }));
  }

  try {
    const { Modal: M } = await import('../../core/modal.js');
    M.close('modal-add-setor');
  } catch {
    /* ignora */
  }

  // Limpa form + reseta estado de edição
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
        // Usuário não logado — convite para criar conta
        GuestConversionModal.open({ reason: 'limit_equipamentos', source: 'save-equip' });
      } else if (planLimit.planCode === 'pro') {
        // Usuário Pro que atingiu o teto de 30 equipamentos
        GuestConversionModal.open({ reason: 'limit_pro_equipamentos', source: 'save-equip-pro' });
      } else {
        // Usuário Free logado — convite para fazer upgrade
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

  // ── Fotos do equipamento (feature Plus+/Pro) ─────────────────────────────
  // 1. O componente tem duas listas: `existing` (já no Storage) e `pending`
  //    (novas capturas em dataURL).
  // 2. `uploadPendingPhotos` sobe só as pending e normaliza as existing;
  //    mantém a ordem. Se falhar o upload, a foto pending é preservada como
  //    dataURL (fallback) — o próximo save tenta de novo.
  const equipId = _editingEquipId || Utils.uid();
  let fotosPayload = [];
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
              <span class="eq-risk-panel__label">PRIORIDADE DE ATENÇÃO</span>
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
