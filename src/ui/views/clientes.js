/**
 * CoolTrack Pro - View Clientes (Fase 2 PMOC, abr/2026)
 *
 * Lista os clientes do técnico em cards. Busca por nome/CNPJ. Empty state
 * com CTA pra cadastrar primeiro. CRUD via ClienteModal.
 *
 * Padrão visual: similar ao setor-card mas mais informativo (mostra CNPJ
 * + endereço + contagem de equipamentos vinculados).
 */

import { Utils } from '../../core/utils.js';
import { getState } from '../../core/state.js';
import { loadClientes, deleteCliente, formatCnpjOrCpf } from '../../core/clientes.js';
import { ClienteModal } from '../components/clienteModal.js';
import { Toast } from '../../core/toast.js';
import { CustomConfirm } from '../../core/modal.js';
import { handleError, ErrorCodes } from '../../core/errors.js';

let _searchTerm = '';
let _hydrated = false;

function clienteCardHtml(cliente, equipsCount) {
  const safeId = Utils.escapeAttr(cliente.id);
  const nome = Utils.escapeHtml(cliente.nome);
  const subParts = [];
  if (cliente.razaoSocial) subParts.push(Utils.escapeHtml(cliente.razaoSocial));
  if (cliente.cnpj) subParts.push(Utils.escapeHtml(formatCnpjOrCpf(cliente.cnpj)));
  const sub = subParts.join('  ·  ');

  const enderecoHtml = cliente.endereco
    ? `<div class="cliente-card__row">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
        <span>${Utils.escapeHtml(cliente.endereco)}</span>
      </div>`
    : '';

  const contatoHtml = cliente.contato
    ? `<div class="cliente-card__row">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
        </svg>
        <span>${Utils.escapeHtml(cliente.contato)}</span>
      </div>`
    : '';

  const equipsLabel =
    equipsCount === 0
      ? 'Nenhum equipamento vinculado'
      : `${equipsCount} equipamento${equipsCount !== 1 ? 's' : ''} vinculado${equipsCount !== 1 ? 's' : ''}`;

  // PMOC Fase 6: CTA discreto pra gerar PMOC anual, surge quando o cliente
  // tem ≥3 equipamentos (volume mínimo onde PMOC formal faz sentido).
  // Pre-popula o cliente via data-cliente-id (handler open-pmoc-modal lê).
  const pmocCtaHtml =
    equipsCount >= 3
      ? `<button type="button" class="cliente-card__pmoc-cta"
                  data-action="open-pmoc-modal" data-cliente-id="${safeId}"
                  title="Gerar PMOC formal anual deste cliente (Pro)">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            Gerar PMOC
          </button>`
      : '';

  return `
    <article class="cliente-card" data-id="${safeId}" role="listitem"
             tabindex="0" aria-label="Cliente ${nome}">
      <header class="cliente-card__head">
        <div class="cliente-card__title">
          <h3 class="cliente-card__name">${nome}</h3>
          ${sub ? `<div class="cliente-card__sub">${sub}</div>` : ''}
        </div>
        <button type="button" class="cliente-card__menu-btn"
                data-action="cliente-card-menu" data-id="${safeId}"
                aria-label="Mais ações para ${nome}" title="Mais ações">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
          </svg>
        </button>
      </header>

      ${enderecoHtml}
      ${contatoHtml}

      <footer class="cliente-card__foot">
        <span class="cliente-card__equips-count">${equipsLabel}</span>
        <div class="cliente-card__foot-actions">
          ${pmocCtaHtml}
          <button type="button" class="cliente-card__edit"
                  data-action="edit-cliente" data-id="${safeId}">
            Editar
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="9 6 15 12 9 18"/>
            </svg>
          </button>
        </div>
      </footer>
    </article>`;
}

function emptyStateHtml() {
  return `
    <section class="clientes-empty" aria-label="Nenhum cliente">
      <div class="clientes-empty__art" aria-hidden="true">
        <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2"/>
          <circle cx="10" cy="7" r="4"/>
          <path d="M19 8v6M22 11h-6"/>
        </svg>
      </div>
      <h3 class="clientes-empty__title">Nenhum cliente cadastrado</h3>
      <p class="clientes-empty__sub">
        Cadastre clientes pra organizar os equipamentos por carteira e gerar
        relatórios PMOC formais.
      </p>
      <button type="button" class="btn btn--primary clientes-empty__cta"
              data-action="open-cliente-modal" data-mode="create">
        + Cadastrar primeiro cliente
      </button>
    </section>`;
}

export async function renderClientes() {
  const container = Utils.getEl('lista-clientes');
  if (!container) return;

  // Hidrata na primeira render. Subsequentes usam state local (atualizado
  // por upsert/delete em core/clientes.js).
  if (!_hydrated) {
    _hydrated = true;
    try {
      await loadClientes();
    } catch (err) {
      console.warn('[clientes] hydrate falhou:', err?.message);
    }
  }

  const { clientes = [], equipamentos = [] } = getState();
  const term = _searchTerm.trim().toLowerCase();
  const filtered = !term
    ? clientes
    : clientes.filter((c) => {
        const haystack = [c.nome, c.razaoSocial, c.cnpj, c.endereco, c.contato]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(term);
      });

  if (!filtered.length) {
    container.innerHTML = !clientes.length
      ? emptyStateHtml()
      : `<div class="clientes-empty clientes-empty--filter">
          <p class="clientes-empty__sub">
            Nenhum cliente encontrado para "${Utils.escapeHtml(_searchTerm)}".
          </p>
        </div>`;
    return;
  }

  // Mapa equipId → clienteId pra contar vinculados sem query extra
  const countByCliente = new Map();
  equipamentos.forEach((eq) => {
    if (!eq.clienteId) return;
    countByCliente.set(eq.clienteId, (countByCliente.get(eq.clienteId) || 0) + 1);
  });

  container.innerHTML = filtered
    .map((c) => clienteCardHtml(c, countByCliente.get(c.id) || 0))
    .join('');
}

export function setClientesSearch(term) {
  _searchTerm = String(term || '');
  renderClientes();
}

/**
 * Confirm + delete cliente. Mostra contagem de equips vinculados pra
 * o user saber o impacto (eles ficam órfãos, não são deletados).
 */
export async function confirmDeleteCliente(id) {
  const cliente = (getState().clientes || []).find((c) => c.id === id);
  if (!cliente) return;
  const equipsCount = (getState().equipamentos || []).filter((e) => e.clienteId === id).length;

  const message = equipsCount
    ? `${equipsCount} equipamento${equipsCount !== 1 ? 's' : ''} vinculado${equipsCount !== 1 ? 's' : ''} a este cliente ficará${equipsCount !== 1 ? 'ão' : ''} sem cliente (não serão apagados). Continuar?`
    : 'Apagar este cliente? Esta ação não pode ser desfeita.';

  const ok = await CustomConfirm.show('Apagar cliente', message, {
    confirmLabel: 'Apagar',
    cancelLabel: 'Cancelar',
    tone: 'danger',
    focus: 'cancel',
  });
  if (!ok) return;

  try {
    await deleteCliente(id);
    Toast.success('Cliente apagado.');
    renderClientes();
  } catch (error) {
    handleError(error, {
      code: ErrorCodes.SYNC_FAILED,
      message: 'Não foi possível apagar o cliente.',
      context: { action: 'clientes.confirmDeleteCliente', id },
    });
  }
}

/**
 * Popula o select #eq-cliente do modal-add-eq. Esconde o wrapper inteiro
 * quando não há clientes cadastrados — assim equipamentos próprios não
 * vêem um campo vazio.
 *
 * Pre-condição: state.clientes já hidratado (loadClientes chamado em algum
 * ponto). Como modal-add-eq é o entry point de Fase 2, fazemos lazy-hydrate
 * aqui se ainda não rodou.
 */
export async function populateClienteSelect() {
  const wrapper = Utils.getEl('eq-cliente-wrapper');
  const select = Utils.getEl('eq-cliente');
  if (!wrapper || !select) return;

  // Lazy hydrate na primeira vez
  if (!_hydrated) {
    _hydrated = true;
    try {
      await loadClientes();
    } catch (err) {
      console.warn('[clientes] populateClienteSelect hydrate falhou:', err?.message);
    }
  }

  const { clientes = [] } = getState();
  if (!clientes.length) {
    wrapper.style.display = 'none';
    return;
  }

  wrapper.style.display = '';
  select.innerHTML = '<option value="">Sem cliente</option>';
  clientes.forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.nome;
    select.appendChild(opt);
  });
}

/**
 * Atalho usado pelos handlers globais (open-cliente-modal etc).
 */
export function openClienteModalForId(id) {
  if (!id) {
    ClienteModal.openCreate({ onSaved: () => renderClientes() });
    return;
  }
  const cliente = (getState().clientes || []).find((c) => c.id === id);
  if (!cliente) {
    Toast.warning('Cliente não encontrado.');
    return;
  }
  ClienteModal.openEdit(cliente, { onSaved: () => renderClientes() });
}
