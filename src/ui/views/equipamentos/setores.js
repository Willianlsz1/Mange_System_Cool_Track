import { Utils } from '../../../core/utils.js';
import { regsForEquip } from '../../../core/state.js';

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
import('../../../domain/maintenance.js')
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
