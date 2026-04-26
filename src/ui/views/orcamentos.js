/**
 * CoolTrack Pro - View Orçamentos (Fase de instalação, abr/2026)
 *
 * Lista cronológica de orçamentos com filtros por status. Cards mostram
 * número, cliente, título, total, status pill e ações.
 *
 * Estado interno: filtro de status (default 'todos') + busca textual.
 */

import { Utils } from '../../core/utils.js';
import { getState } from '../../core/state.js';
import { Toast } from '../../core/toast.js';
import {
  loadOrcamentos,
  deleteOrcamento,
  upsertOrcamento,
  markExpiredLocally,
} from '../../core/orcamentos.js';
import { CustomConfirm } from '../../core/modal.js';

let _statusFilter = 'todos';
let _busca = '';

const STATUS_META = {
  rascunho: { label: 'Rascunho', color: '#8aaac8', bg: 'rgba(255,255,255,0.06)' },
  enviado: { label: 'Enviado', color: '#51a3ff', bg: 'rgba(81,163,255,0.12)' },
  // Fase 2: orçamento aguardando assinatura digital do cliente
  aguardando_assinatura: {
    label: 'Aguardando assinatura',
    color: '#06b6d4',
    bg: 'rgba(6,182,212,0.14)',
  },
  aprovado: { label: 'Aprovado', color: '#10b981', bg: 'rgba(16,185,129,0.14)' },
  recusado: { label: 'Recusado', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  expirado: { label: 'Expirado', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
};

function brl(n) {
  return Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function statusPillHtml(status) {
  const meta = STATUS_META[status] || STATUS_META.rascunho;
  return `
    <span class="orc-status-pill" style="color:${meta.color};background:${meta.bg};border:1px solid ${meta.color}33">
      ${Utils.escapeHtml(meta.label)}
    </span>`;
}

function buildKpis(orcamentos) {
  const totalAtivos = orcamentos.filter((o) => ['rascunho', 'enviado'].includes(o.status)).length;
  const totalAprovados = orcamentos.filter((o) => o.status === 'aprovado').length;
  const valorPipeline = orcamentos
    .filter((o) => ['enviado', 'aprovado'].includes(o.status))
    .reduce((sum, o) => sum + Number(o.total || 0), 0);
  return { totalAtivos, totalAprovados, valorPipeline };
}

function emptyStateHtml() {
  return `
    <div class="orc-empty">
      <div class="orc-empty__art" aria-hidden="true">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="9" y1="13" x2="15" y2="13"/>
          <line x1="9" y1="17" x2="15" y2="17"/>
        </svg>
      </div>
      <h2 class="orc-empty__title">Nenhum orçamento ainda</h2>
      <p class="orc-empty__sub">
        Crie orçamentos profissionais de instalação e envie pelo WhatsApp em segundos.
      </p>
      <button type="button" class="btn btn--primary orc-empty__cta" data-action="open-orcamento-modal" data-mode="create">
        + Novo orçamento
      </button>
    </div>`;
}

function renderHeader(orcamentos) {
  const kpis = buildKpis(orcamentos);
  return `
    <div class="orc-header">
      <div class="orc-header__title-row">
        <h1 class="orc-header__title">Orçamentos</h1>
        <button type="button" class="btn btn--primary btn--sm" data-action="open-orcamento-modal" data-mode="create">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Novo orçamento
        </button>
      </div>
      <div class="orc-kpis">
        <div class="orc-kpi">
          <div class="orc-kpi__value">${kpis.totalAtivos}</div>
          <div class="orc-kpi__label">Em aberto</div>
        </div>
        <div class="orc-kpi">
          <div class="orc-kpi__value" style="color:#10b981">${kpis.totalAprovados}</div>
          <div class="orc-kpi__label">Aprovados</div>
        </div>
        <div class="orc-kpi">
          <div class="orc-kpi__value" style="color:#00c8e8">${brl(kpis.valorPipeline)}</div>
          <div class="orc-kpi__label">Pipeline</div>
        </div>
      </div>
    </div>`;
}

function renderFilters() {
  const statuses = [
    { id: 'todos', label: 'Todos' },
    { id: 'rascunho', label: 'Rascunho' },
    { id: 'enviado', label: 'Enviado' },
    { id: 'aprovado', label: 'Aprovado' },
    { id: 'recusado', label: 'Recusado' },
    { id: 'expirado', label: 'Expirado' },
  ];
  return `
    <div class="orc-toolbar">
      <div class="orc-search">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input type="search" id="orc-busca" class="orc-search__input"
          placeholder="Buscar por cliente, número ou título..."
          value="${Utils.escapeAttr(_busca)}" />
      </div>
      <div class="orc-filter-chips" role="group" aria-label="Filtrar por status">
        ${statuses
          .map(
            (s) => `
          <button type="button" class="orc-chip${_statusFilter === s.id ? ' is-active' : ''}"
            data-action="orc-set-status-filter" data-status="${s.id}">
            ${s.label}
          </button>`,
          )
          .join('')}
      </div>
    </div>`;
}

function renderCard(o) {
  const validUntil = o.enviadoEm
    ? new Date(new Date(o.enviadoEm).getTime() + o.validadeDias * 24 * 60 * 60 * 1000)
    : null;
  const validityHtml = validUntil
    ? `<span class="orc-card__validity">Vale até ${formatDate(validUntil.toISOString())}</span>`
    : '';
  return `
    <article class="orc-card" data-id="${Utils.escapeAttr(o.id)}">
      <header class="orc-card__head">
        <div>
          <span class="orc-card__numero">${Utils.escapeHtml(o.numero)}</span>
          ${statusPillHtml(o.status)}
        </div>
        <div class="orc-card__total">${brl(o.total)}</div>
      </header>
      <div class="orc-card__body">
        <h3 class="orc-card__title">${Utils.escapeHtml(o.titulo || 'Sem título')}</h3>
        <div class="orc-card__cliente">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
          </svg>
          ${Utils.escapeHtml(o.clienteNome)}${o.clienteTelefone ? ` · ${Utils.escapeHtml(o.clienteTelefone)}` : ''}
        </div>
        <div class="orc-card__meta">
          <span>Criado ${formatDate(o.createdAt)}</span>
          ${validityHtml}
        </div>
        ${
          o.assinadoEm
            ? `<div class="orc-card__signed">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Assinado digitalmente por <strong>${Utils.escapeHtml(o.assinadoNome || 'cliente')}</strong>
                em ${formatDate(o.assinadoEm)}
              </div>`
            : ''
        }
      </div>
      <footer class="orc-card__actions">
        <button type="button" class="btn btn--ghost btn--sm" data-action="open-orcamento-modal"
          data-mode="edit" data-id="${Utils.escapeAttr(o.id)}">
          Ver / editar
        </button>
        ${
          // Fase 2: assinatura digital — botão primário enquanto não assinado.
          // Substitui o "Enviar pelo WhatsApp" tradicional como ação principal
          // pra orçamentos em rascunho/enviado/aguardando_assinatura.
          !o.assinadoEm && ['rascunho', 'enviado', 'aguardando_assinatura'].includes(o.status)
            ? `<button type="button" class="btn btn--primary btn--sm" data-action="orc-send-signature"
                data-id="${Utils.escapeAttr(o.id)}"
                title="Gera link único de assinatura e envia pelo WhatsApp">
                ${o.shareToken ? '↻ Reenviar assinatura' : '✍️ Enviar p/ assinatura'}
              </button>`
            : ''
        }
        ${
          // WhatsApp tradicional (PDF) fica como secundário pra quem prefere
          // o fluxo antigo. Sempre disponível.
          o.status === 'rascunho' || o.status === 'enviado' || o.status === 'aguardando_assinatura'
            ? `<button type="button" class="btn btn--outline btn--sm" data-action="orc-share"
                data-id="${Utils.escapeAttr(o.id)}">
                WhatsApp (PDF)
              </button>`
            : ''
        }
        <button type="button" class="btn btn--outline btn--sm orc-card__download"
          data-action="orc-download" data-id="${Utils.escapeAttr(o.id)}"
          title="Baixar PDF do orçamento">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Baixar PDF
        </button>
        ${
          // "Marcar aprovado" só faz sentido se NÃO assinado digitalmente
          // (assinatura digital aprova automático via RPC).
          o.status === 'enviado' && !o.assinadoEm
            ? `<button type="button" class="btn btn--outline btn--sm" data-action="orc-mark-approved"
                data-id="${Utils.escapeAttr(o.id)}">
                Marcar aprovado
              </button>`
            : ''
        }
        <button type="button" class="orc-card__kebab" data-action="orc-delete"
          data-id="${Utils.escapeAttr(o.id)}" aria-label="Apagar orçamento" title="Apagar">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6m5 0V4a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </footer>
    </article>`;
}

function applyFilters(orcamentos) {
  let list = orcamentos.slice();
  if (_statusFilter !== 'todos') {
    list = list.filter((o) => o.status === _statusFilter);
  }
  if (_busca) {
    const q = _busca.toLowerCase();
    list = list.filter(
      (o) =>
        String(o.numero).toLowerCase().includes(q) ||
        String(o.clienteNome).toLowerCase().includes(q) ||
        String(o.titulo).toLowerCase().includes(q),
    );
  }
  return list;
}

/**
 * Renderiza a view inteira de orçamentos no container #view-orcamentos.
 * Idempotente — chamado por loadAndRenderOrcamentos (cold start) e por
 * setters de filtro / handlers que mudam o state.
 */
export function renderOrcamentos() {
  const container = document.getElementById('view-orcamentos');
  if (!container) return;

  const all = markExpiredLocally(getState().orcamentos || []);
  const filtered = applyFilters(all);

  if (all.length === 0) {
    container.innerHTML = `<div class="orc-page">${renderHeader([])}${emptyStateHtml()}</div>`;
    return;
  }

  container.innerHTML = `
    <div class="orc-page">
      ${renderHeader(all)}
      ${renderFilters()}
      <div class="orc-cards">
        ${
          filtered.length === 0
            ? '<div class="orc-empty-filter">Nenhum orçamento corresponde ao filtro.</div>'
            : filtered.map(renderCard).join('')
        }
      </div>
    </div>`;

  // Bind do search input (delegação não cobre input event)
  const buscaInput = container.querySelector('#orc-busca');
  if (buscaInput && !buscaInput.dataset.bound) {
    buscaInput.dataset.bound = '1';
    let timer;
    buscaInput.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        setOrcBusca(buscaInput.value);
      }, 200);
    });
  }
}

export function setOrcStatusFilter(status) {
  _statusFilter = status || 'todos';
  renderOrcamentos();
}

export function setOrcBusca(value) {
  _busca = String(value || '').trim();
  renderOrcamentos();
}

export async function deleteOrcamentoFlow(id) {
  const o = (getState().orcamentos || []).find((x) => x.id === id);
  if (!o) return;
  const ok = await CustomConfirm.show(
    `Apagar orçamento ${o.numero}?`,
    `Esta ação não pode ser desfeita. O orçamento de "${o.clienteNome}" será removido permanentemente.`,
    {
      confirmLabel: 'Apagar',
      cancelLabel: 'Cancelar',
      tone: 'danger',
      focus: 'cancel',
    },
  );
  if (!ok) return;
  try {
    await deleteOrcamento(id);
    Toast.success('Orçamento apagado.');
    renderOrcamentos();
  } catch (error) {
    Toast.error(error?.message || 'Falha ao apagar orçamento.');
  }
}

export async function markOrcamentoApproved(id) {
  const o = (getState().orcamentos || []).find((x) => x.id === id);
  if (!o) return;
  try {
    await upsertOrcamento({
      ...o,
      status: 'aprovado',
      aprovadoEm: new Date().toISOString(),
    });
    Toast.success(`Orçamento ${o.numero} marcado como aprovado.`);
    renderOrcamentos();
  } catch (error) {
    Toast.error(error?.message || 'Falha ao atualizar status.');
  }
}

export async function loadAndRenderOrcamentos() {
  await loadOrcamentos();
  renderOrcamentos();
}
