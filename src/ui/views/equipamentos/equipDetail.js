/**
 * CoolTrack Pro - Equipamentos / equipDetail
 * Renderiza o modal de detalhe do equipamento (viewEquip).
 */

import { Utils, TIPO_ICON } from '../../../core/utils.js';
import { getState, findEquip, regsForEquip } from '../../../core/state.js';
import { getHealthClass } from '../dashboard.js';
import { ErrorCodes, handleError } from '../../../core/errors.js';
import { evaluateEquipmentHealth, evaluateEquipmentRisk } from '../../../domain/maintenance.js';
import { STATUS_OPERACIONAL, CONDICAO_OBSERVADA, PRIORIDADE_LABEL } from './constants.js';
import { isCachedPlanPlusOrHigher } from '../../../core/plans/planCache.js';

// ── V3 helpers ────────────────────────────────────────────────────────────

/**
 * PR3 §12.1 — Headline do hero: nomeia o fator dominante, não o estado
 * abstrato. Pro técnico, o headline responde _por que_ olhar esse card,
 * não _que cor_ ele tem. Primeiro match ganha; default por variante é o
 * fallback se nenhum fator específico se aplica.
 *
 * Matriz (brief §12.1):
 * · ok → "Tudo em dia"
 * · warn + preventiva próxima → "Preventiva próxima"
 * · warn + ≥2 corretivas 30d → "Corretivas recorrentes"
 * · warn (default) → "Atenção necessária"
 * · danger + parado desde → "Parado"
 * · danger + preventiva vencida → "Preventiva vencida"
 * · danger + ≥3 corretivas 30d → "Falhas recorrentes"
 * · danger (default) → "Intervenção urgente"
 */
function _extractCorretivasCount(factors) {
  for (const f of factors) {
    const m = String(f).match(/(\d+)\s*corretivas?[^\d]*30d/i);
    if (m) return Number(m[1]);
  }
  return 0;
}
function _computeHeroHeadline(cls, risk) {
  const factors = Array.isArray(risk?.factors) ? risk.factors : [];
  const has = (re) => factors.some((f) => re.test(String(f)));
  if (cls === 'ok') return 'Tudo em dia';
  if (cls === 'danger') {
    if (has(/parado desde/i)) return 'Parado';
    if (has(/preventiva vencida/i)) return 'Preventiva vencida';
    if (_extractCorretivasCount(factors) >= 3) return 'Falhas recorrentes';
    return 'Intervenção urgente';
  }
  // warn
  if (has(/preventiva pr(ó|o)xima/i)) return 'Preventiva próxima';
  if (_extractCorretivasCount(factors) >= 2) return 'Corretivas recorrentes';
  return 'Atenção necessária';
}

// Mapa de tipo de serviço → tom visual do dot no histórico inline (E6).
// Strings vêm normalizadas/lowercase e testadas por inclusão, então
// "Corretiva preventiva" cai em corretiva (danger), "Inspeção geral"
// cai em inspeção (neutral) etc.
const _SVC_TYPE_TONE_PATTERNS = [
  { tone: 'danger', patterns: ['corretiva', 'emergencial', 'reparo'] },
  { tone: 'ok', patterns: ['preventiva', 'limpeza', 'troca de filtro'] },
  { tone: 'neutral', patterns: ['inspecao', 'inspeção', 'diagnostico', 'diagnóstico', 'visita'] },
];
function _svcTypeTone(tipo) {
  const lf = String(tipo || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  for (const { tone, patterns } of _SVC_TYPE_TONE_PATTERNS) {
    if (patterns.some((p) => lf.includes(p.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))))
      return tone;
  }
  return 'neutral';
}

// E9: classificação de factors positive/neutral pro eq-risk-panel.
// Mesma lógica do equipCardHtml — strings que expressam "rotina em ordem"
// são positivas (tom verde discreto); as demais ficam neutras.
const _POSITIVE_FACTOR_PATTERNS = [
  'em dia',
  'preventivas consecutivas',
  'sem corretivas',
  'dentro da rotina',
  'rotina estavel',
  'estavel',
  'sem alertas',
  'historico limpo',
];
function _classifyFactor(factorStr) {
  const lf = String(factorStr || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return _POSITIVE_FACTOR_PATTERNS.some((p) => lf.includes(p)) ? 'positive' : 'neutral';
}

/**
 * Handler invocado quando o select inline de setor muda.
 * Injetado pelo orquestrador para evitar ciclos de import com equipamentos.js.
 * @type {(equipId: string, setorId: string | null) => void}
 */
let _onSetorChange = () => {};
export function setSetorChangeHandler(fn) {
  _onSetorChange = typeof fn === 'function' ? fn : () => {};
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
  const statusOperacional = STATUS_OPERACIONAL[statusCode] || CONDICAO_OBSERVADA.unknown;
  const condicaoObservada = CONDICAO_OBSERVADA[statusCode] || CONDICAO_OBSERVADA.unknown;
  // E3 + E7: strings da meta strip em formato curto (value + label separado)
  // em vez das frases completas antigas. A frase longa dedica repetição visual
  // com o status do ring e o tone-pill — agora cada cell do meta mostra só o
  // dado que é próprio dela.
  const fatorOperacao =
    statusCode === 'ok' ? 'Sem restrições' : statusCode === 'warn' ? 'Com restrições' : 'Parado';
  const fatorPreventiva =
    context?.daysToNext == null
      ? 'Sem agenda'
      : context.daysToNext < 0
        ? `Vencida há ${Math.abs(context.daysToNext)}d`
        : context.daysToNext === 0
          ? 'Vence hoje'
          : `Em ${context.daysToNext}d`;

  // SVG ring progress
  const ringR = 30;
  const ringC = +(2 * Math.PI * ringR).toFixed(1);
  const ringOffset = +(ringC * (1 - score / 100)).toFixed(1);

  // ── Avatar block (V4) ──
  // Foto identificadora do equipamento, no topo do detail view. Substitui o
  // bloco de fotos que antes morava no modal-add-eq — agora cadastro e
  // gerenciamento de fotos ficam semanticamente separados (cadastro = dados
  // da etiqueta; perfil visual = detalhe do equipamento).
  // Free vê o emoji do tipo; Plus+/Pro vê foto ou emoji + botão "Gerenciar
  // fotos" que abre modal-eq-photos.
  const tipoEmoji = TIPO_ICON[eq.tipo] ?? '⚙️';
  const firstPhoto = Array.isArray(eq.fotos) ? eq.fotos.find((p) => p && (p.url || p.path)) : null;
  const firstPhotoUrl = firstPhoto?.url;
  const canEditPhotos = isCachedPlanPlusOrHigher();
  // Nota: o fallback de erro no <img> (quando firstPhotoUrl falha) é anexado
  // via addEventListener('error') logo após o render. Usávamos `onerror=`
  // inline, mas isso viola CSP `script-src 'self'` (sem 'unsafe-inline').
  const avatarInner = firstPhotoUrl
    ? `<img class="eq-detail-avatar__img" src="${Utils.escapeAttr(firstPhotoUrl)}" alt="" />
       <span class="eq-detail-avatar__emoji" aria-hidden="true">${tipoEmoji}</span>`
    : `<span class="eq-detail-avatar__emoji" aria-hidden="true">${tipoEmoji}</span>`;
  const avatarHasPhotoClass = firstPhotoUrl ? ' eq-detail-avatar--has-photo' : '';
  const photoCount = Array.isArray(eq.fotos)
    ? eq.fotos.filter((p) => p && (p.url || p.path)).length
    : 0;
  // Copy/affordance do CTA muda por plano.
  // Free: "Desbloquear com Plus" (ação é upsell, não adicionar) — antes era
  // "Adicionar foto" com badge PLUS, o que sugeria que o clique iria abrir
  // a câmera e confundia o usuário. Agora o verbo deixa claro que é um gate.
  // Plus/Pro: "Adicionar foto" ou "Gerenciar fotos" (ação é o editor).
  const photoCtaLabel = canEditPhotos
    ? photoCount === 0
      ? 'Adicionar foto'
      : 'Gerenciar fotos'
    : 'Desbloquear com Plus';
  const photoCtaAction = canEditPhotos ? 'open-eq-photos-editor' : 'open-upgrade';
  const photoCtaExtra = canEditPhotos
    ? ''
    : ' data-upgrade-source="equip_detail_photos" data-highlight-plan="plus"';
  // Ícone do CTA: câmera pra Plus/Pro (ação = editar fotos),
  // cadeado pra Free (ação = upsell).
  const photoCtaIcon = canEditPhotos
    ? `<svg class="eq-detail-avatar-cta__icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
         <path d="M4 7h3l2-2h6l2 2h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z"/>
         <circle cx="12" cy="13" r="3"/>
       </svg>`
    : `<svg class="eq-detail-avatar-cta__icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
         <rect x="4" y="11" width="16" height="10" rx="2"/>
         <path d="M8 11V7a4 4 0 0 1 8 0v4"/>
       </svg>`;
  // Badge PLUS só pra Free, e sempre depois do label (nunca disfarçado de chip
  // decorativo — agora é o 2º sinal reforçando o 1º, não o único).
  const photoCtaBadge = canEditPhotos
    ? ''
    : '<span class="plus-badge plus-badge--inline" aria-hidden="true">PLUS</span>';
  // Classe de variante no CTA pra CSS tratar o gate (cor + cursor) sem
  // depender de heurística no atributo data-action.
  const photoCtaVariantCls = canEditPhotos ? '' : ' eq-detail-avatar-cta--locked';
  // Pra Free, o avatar fica com visual "locked" (opacity + cadeado).
  // Dispara o mesmo upsell, mas é agora claramente não-interativo-para-foto.
  const avatarLockedCls = canEditPhotos ? '' : ' eq-detail-avatar--locked';
  const avatarHintIcon = canEditPhotos
    ? // Câmera = "você pode editar essa foto"
      `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 7h3l2-2h6l2 2h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z"/>
        <circle cx="12" cy="13" r="3"/>
      </svg>`
    : // Cadeado = "você não pode editar essa foto ainda"
      `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="4" y="11" width="16" height="10" rx="2"/>
        <path d="M8 11V7a4 4 0 0 1 8 0v4"/>
      </svg>`;
  const avatarBlock = `
    <div class="eq-detail-avatar-row">
      <button type="button"
        class="eq-detail-avatar${avatarHasPhotoClass}${avatarLockedCls}"
        data-action="${photoCtaAction}"
        data-id="${safeId}"${photoCtaExtra}
        aria-label="${canEditPhotos ? 'Editar fotos do equipamento' : 'Fotos bloqueadas — desbloqueie com o plano Plus'}">
        ${avatarInner}
        <span class="eq-detail-avatar__edit-hint" aria-hidden="true">
          ${avatarHintIcon}
        </span>
      </button>
      <button type="button" class="eq-detail-avatar-cta${photoCtaVariantCls}"
        data-action="${photoCtaAction}"
        data-id="${safeId}"${photoCtaExtra}>
        ${photoCtaIcon}
        ${photoCtaLabel}
        ${photoCtaBadge}
      </button>
    </div>`;

  // Tom do valor preventiva/operação na meta strip (V3 __meta-value--tone).
  const prevStatCls =
    context?.daysToNext == null
      ? ''
      : context.daysToNext < 0
        ? ' equip-hero-meta__value--danger'
        : context.daysToNext <= 7
          ? ' equip-hero-meta__value--warn'
          : '';
  const opStatCls = statusCode !== 'ok' ? ` equip-hero-meta__value--${statusCode}` : '';
  // PR3 §12.1 — headline contextual calculado aqui pra ficar ao lado do
  // ring no hero (substitui tone-pill + summary redundante).
  const heroHeadline = _computeHeroHeadline(cls, risk);
  // Fallback "tudo em dia" quando healthSummary cai no genérico.
  const heroSummary =
    healthSummary === 'Historico dentro da rotina prevista'
      ? 'Histórico dentro da rotina prevista'
      : healthSummary;

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

  // E6: timeline de serviços com dot tonal por tipo — corretiva=danger,
  // preventiva=ok, inspeção=neutral. Dá hierarquia de leitura sem aumentar
  // densidade.
  const svcTimeline =
    regs.length === 0
      ? `<div class="eq-svc-empty">Nenhum serviço registrado ainda.</div>`
      : `<div class="eq-svc-timeline">
        ${regs
          .slice(0, 5)
          .map((r) => {
            const tone = _svcTypeTone(r.tipo);
            return `
          <div class="eq-svc-item">
            <div class="eq-svc-item__dot eq-svc-item__dot--${tone}"></div>
            <div class="eq-svc-item__content">
              <span class="eq-svc-item__tipo">${Utils.escapeHtml(r.tipo)}</span>
              <span class="eq-svc-item__data">${Utils.formatDatetime(r.data)}</span>
            </div>
          </div>`;
          })
          .join('')}
        ${regs.length > 5 ? `<div class="eq-svc-more">+${regs.length - 5} serviços anteriores</div>` : ''}
      </div>`;

  Utils.getEl('eq-det-corpo').innerHTML = `
    <div class="eq-detail-view">

      ${avatarBlock}

      <div class="modal__title" id="eq-det-title">${Utils.escapeHtml(eq.nome)}</div>

      <!-- ── Hero V3 · T2 (PR3): caption / headline / summary ── -->
      <!--
        PR3 §12.1: tone-pill removida do hero. Agora a tripla caption/
        headline/summary comunica estado sem duplicar o ring. Headline
        nomeia o fator dominante ("Preventiva vencida", "Parado", etc) —
        pro técnico, responde _por que_ olhar, não _que cor_ tem.
      -->
      <div class="eq-detail-hero eq-detail-hero--${cls}">
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
            <div class="eq-hero-score__caption">Saúde operacional · agora</div>
            <div class="eq-hero-score__headline">${Utils.escapeHtml(heroHeadline)}</div>
            <div class="eq-hero-score__summary">${heroSummary}</div>
          </div>
        </div>
        <dl class="equip-hero-meta">
          <div class="equip-hero-meta__item">
            <dt class="equip-hero-meta__label">Operação</dt>
            <dd class="equip-hero-meta__value${opStatCls}">${Utils.escapeHtml(fatorOperacao)}</dd>
          </div>
          <div class="equip-hero-meta__item">
            <dt class="equip-hero-meta__label">Preventiva</dt>
            <dd class="equip-hero-meta__value${prevStatCls}">${Utils.escapeHtml(fatorPreventiva)}</dd>
          </div>
          <div class="equip-hero-meta__item">
            <dt class="equip-hero-meta__label">Criticidade</dt>
            <dd class="equip-hero-meta__value">${Utils.escapeHtml(prioridadeLabel)}</dd>
          </div>
        </dl>
      </div>

      <!-- ── Painel de risco · T2 (PR3) ──
        Header passa a ter só label + __score ("acumulado 30d · baixo · 2").
        Badge redundante com o label tonal cai fora; o __summary migra pro
        disclosure __analysis (risk.explanation) — o header fica leitura de
        2 segundos. Painel herda --tone/--tone-soft/--tone-edge (PR3 CSS)
        pra border-left + wash consistentes com o hero. -->
      <div class="eq-risk-panel eq-risk-panel--${risk.classification}">
        <div class="eq-risk-panel__header">
          <div class="eq-risk-panel__label">Fatores de risco</div>
          <div class="eq-risk-panel__score">acumulado 30d · <b>${Utils.escapeHtml(risk.classificationLabel.toLowerCase())} · ${risk.score}</b></div>
        </div>
        <div class="eq-risk-panel__factors">
          ${(risk.factors.length ? risk.factors : ['rotina estável'])
            .map(
              (f) =>
                `<span class="eq-risk-panel__factor eq-risk-panel__factor--${_classifyFactor(f)}">${Utils.escapeHtml(f)}</span>`,
            )
            .join('')}
        </div>
        <details class="eq-risk-panel__analysis">
          <summary>Ver análise detalhada</summary>
          <div class="eq-risk-panel__analysis-body">
            <p class="eq-risk-panel__analysis-intro">${Utils.escapeHtml(risk.explanation)}</p>
            <ul class="eq-risk-panel__analysis-list">
              ${risk.details
                .map(
                  (d) =>
                    `<li><strong>${Utils.escapeHtml(d.label)}</strong>: ${Utils.escapeHtml(d.detail)}</li>`,
                )
                .join('')}
            </ul>
            <p class="eq-risk-panel__note">Este score orienta a priorização e não substitui a decisão técnica em campo.</p>
          </div>
        </details>
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
            <div class="info-row"><span class="info-row__label">Estado operacional</span><span class="info-row__value">${Utils.escapeHtml(statusOperacional)}</span></div>
            <div class="info-row"><span class="info-row__label">Condição observada</span><span class="info-row__value">${Utils.escapeHtml(condicaoObservada)}</span></div>
            <div class="info-row"><span class="info-row__label">Prioridade</span><span class="info-row__value">${Utils.escapeHtml(prioridadeLabel)}</span></div>
            <div class="info-row"><span class="info-row__label">Rotina preventiva</span><span class="info-row__value">${Utils.escapeHtml(`${context?.periodicidadeDias || eq.periodicidadePreventivaDias} dias`)}</span></div>
            <div class="info-row"><span class="info-row__label">Próxima preventiva</span><span class="info-row__value">${Utils.escapeHtml(proximaPreventiva)}</span></div>
          </div>
        </div>
      </div>

      <!-- ── Histórico de serviços ── -->
      <div class="eq-svc-section">
        <div class="eq-svc-section__header">
          <span class="eq-svc-section__title">Histórico de serviços</span>
          <button class="btn btn--primary btn--sm" data-action="go-register-equip" data-id="${safeId}">
            + Registrar serviço
          </button>
        </div>
        ${svcTimeline}
      </div>

      <!-- ── Footer ── -->
      <div class="eq-modal-footer">
        <button class="eq-edit-link" data-action="edit-equip" data-id="${safeId}">
          ✏️ Editar identificação
        </button>
        <button class="eq-delete-link" data-action="delete-equip" data-id="${safeId}">
          <svg class="eq-delete-link__icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
          </svg>
          Excluir equipamento
        </button>
      </div>

    </div>`;

  // Listener para troca de setor inline
  const setorSel = document.getElementById(`eq-det-setor-${safeId}`);
  if (setorSel) {
    setorSel.addEventListener('change', (e) => {
      _onSetorChange(id, e.target.value || null);
    });
  }

  // Fallback de foto quebrada: se a URL da primeira foto falhar (link expirado,
  // offline, 404), aplica a classe `--fallback` no avatar pra mostrar o emoji
  // do tipo em vez de um placeholder quebrado. Anexado via addEventListener
  // em vez de `onerror=` inline por causa do CSP `script-src 'self'`.
  const avatarImg = document.querySelector('.eq-detail-avatar__img');
  if (avatarImg instanceof HTMLImageElement) {
    avatarImg.addEventListener(
      'error',
      () => {
        avatarImg.closest('.eq-detail-avatar')?.classList.add('eq-detail-avatar--fallback');
        avatarImg.remove();
      },
      { once: true },
    );
  }

  try {
    const { Modal: M } = await import('../../../core/modal.js');
    M.open('modal-eq-det');
  } catch (error) {
    handleError(error, {
      code: ErrorCodes.NETWORK_ERROR,
      message: 'Não foi possível abrir os detalhes do equipamento.',
      context: { action: 'equipamentos.viewEquip.openModal', id },
    });
  }
}
