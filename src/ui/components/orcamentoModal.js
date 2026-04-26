/**
 * CoolTrack Pro - Orcamento Modal (Fase de instalação, abr/2026)
 *
 * Modal de criação/edição de orçamento. Auto-popula com template padrão
 * de instalação split residencial (6 linhas), tudo editável.
 *
 * Cliente AVULSO: nome obrigatório, telefone e endereço opcionais.
 * Itens: lista dinâmica, totais auto-calculados.
 */

import { Utils } from '../../core/utils.js';
import { Toast } from '../../core/toast.js';
import { CustomConfirm, attachDialogA11y } from '../../core/modal.js';
import {
  upsertOrcamento,
  findOrcamento,
  TEMPLATE_INSTALACAO_SPLIT,
} from '../../core/orcamentos.js';
import { Profile } from '../../features/profile.js';
import { renderOrcamentos } from '../views/orcamentos.js';
import { bindPhoneMaskInput } from '../../core/phoneMask.js';

const OVERLAY_ID = 'orcamento-modal-overlay';
let _a11yCleanup = null;

function brl(n) {
  return Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function parseNumber(value) {
  if (!value) return 0;
  // Aceita "1.500,50" ou "1500.50" ou "1500,50"
  const cleaned = String(value).replace(/\./g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function renderItemRow(item, idx) {
  return `
    <div class="orc-item-row" data-idx="${idx}">
      <input type="text" class="orc-item__descricao form-control" placeholder="Descrição do item"
        value="${Utils.escapeAttr(item.descricao || '')}" data-field="descricao" />
      <input type="number" class="orc-item__qty form-control" placeholder="Qtd" min="0" step="0.5"
        value="${item.qty || ''}" data-field="qty" />
      <input type="text" class="orc-item__valor form-control" placeholder="0,00"
        inputmode="decimal" value="${item.valorUnitario || ''}" data-field="valorUnitario" />
      <span class="orc-item__total" data-total>${brl((item.qty || 0) * (item.valorUnitario || 0))}</span>
      <button type="button" class="orc-item__remove" data-action="orc-item-remove"
        aria-label="Remover item" title="Remover">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>`;
}

function buildHtml(orcamento, isEdit) {
  const o = orcamento || {};
  const itens = o.itens && o.itens.length ? o.itens : [...TEMPLATE_INSTALACAO_SPLIT];

  return `
    <div class="modal orcamento-modal">
      <header class="orcamento-modal__head">
        <div class="orcamento-modal__head-icon" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
        </div>
        <div class="orcamento-modal__head-text">
          <h2 class="orcamento-modal__title" id="orcamento-modal-title">
            ${isEdit ? `Orçamento ${Utils.escapeHtml(o.numero || '')}` : 'Novo orçamento'}
          </h2>
          <p class="orcamento-modal__sub">
            ${isEdit ? 'Edite os dados e salve as alterações.' : 'Pré-preenchemos um modelo de instalação split — edite o que precisar.'}
          </p>
        </div>
        <button type="button" class="orcamento-modal__close" id="orc-close" aria-label="Fechar">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </header>

      <div class="orcamento-modal__body">
        <!-- Bloco Cliente -->
        <section class="orcamento-modal__section">
          <h3>Cliente</h3>
          <div class="orcamento-modal__field">
            <label for="orc-cliente-nome">Nome do cliente <span class="req">*</span></label>
            <input type="text" id="orc-cliente-nome" class="form-control"
              placeholder="Ex: Maria Silva"
              value="${Utils.escapeAttr(o.clienteNome || '')}" />
          </div>
          <div class="orcamento-modal__row orcamento-modal__row--two">
            <div class="orcamento-modal__field">
              <label for="orc-cliente-tel">Telefone / WhatsApp</label>
              <input type="text" id="orc-cliente-tel" class="form-control"
                placeholder="(31) 99999-0000"
                value="${Utils.escapeAttr(o.clienteTelefone || '')}" />
            </div>
            <div class="orcamento-modal__field">
              <label for="orc-cliente-end">Endereço da instalação</label>
              <input type="text" id="orc-cliente-end" class="form-control"
                placeholder="Rua, nº, bairro, cidade"
                value="${Utils.escapeAttr(o.clienteEndereco || '')}" />
            </div>
          </div>
        </section>

        <!-- Bloco Serviço -->
        <section class="orcamento-modal__section">
          <h3>Descrição do serviço</h3>
          <div class="orcamento-modal__field">
            <label for="orc-titulo">Título <span class="req">*</span></label>
            <input type="text" id="orc-titulo" class="form-control"
              placeholder="Ex: Instalação Split 12.000 BTU - Sala"
              value="${Utils.escapeAttr(o.titulo || '')}" />
          </div>
          <div class="orcamento-modal__field">
            <label for="orc-descricao">Detalhes (opcional)</label>
            <textarea id="orc-descricao" class="form-control" rows="2"
              placeholder="Informações adicionais sobre a instalação...">${Utils.escapeHtml(o.descricao || '')}</textarea>
          </div>
        </section>

        <!-- Bloco Itens -->
        <section class="orcamento-modal__section">
          <div class="orcamento-modal__section-head">
            <h3>Itens</h3>
            <button type="button" class="btn btn--ghost btn--sm" data-action="orc-item-add">
              + Adicionar item
            </button>
          </div>
          <div class="orc-items-header">
            <span>Descrição</span>
            <span>Qtd</span>
            <span>Valor unit.</span>
            <span>Total</span>
            <span></span>
          </div>
          <div id="orc-items-list">
            ${itens.map(renderItemRow).join('')}
          </div>

          <div class="orc-totals">
            <div class="orc-totals__row">
              <span>Subtotal</span>
              <strong id="orc-subtotal">${brl(o.subtotal || 0)}</strong>
            </div>
            <div class="orc-totals__row">
              <span>Desconto</span>
              <input type="text" id="orc-desconto" class="form-control orc-totals__input"
                placeholder="0,00" inputmode="decimal"
                value="${o.desconto || ''}" />
            </div>
            <div class="orc-totals__row orc-totals__row--total">
              <span>Total</span>
              <strong id="orc-total">${brl(o.total || 0)}</strong>
            </div>
          </div>
        </section>

        <!-- Bloco Comerciais -->
        <section class="orcamento-modal__section">
          <h3>Condições</h3>
          <div class="orcamento-modal__row orcamento-modal__row--two">
            <div class="orcamento-modal__field">
              <label for="orc-validade">Validade (dias)</label>
              <input type="number" id="orc-validade" class="form-control" min="1" max="90"
                value="${o.validadeDias || 7}" />
            </div>
            <div class="orcamento-modal__field">
              <label for="orc-pagamento">Forma de pagamento</label>
              <input type="text" id="orc-pagamento" class="form-control"
                placeholder="Ex: 50% entrada, 50% na conclusão"
                value="${Utils.escapeAttr(o.formaPagamento || '')}" />
            </div>
          </div>
          <div class="orcamento-modal__field">
            <label for="orc-obs">Observações</label>
            <textarea id="orc-obs" class="form-control" rows="2"
              placeholder="Garantia, prazo, condições especiais...">${Utils.escapeHtml(o.observacoes || '')}</textarea>
          </div>
        </section>
      </div>

      <footer class="orcamento-modal__actions">
        <button type="button" class="btn btn--ghost" id="orc-cancel">Cancelar</button>
        <button type="button" class="btn btn--outline" id="orc-save-draft">Salvar rascunho</button>
        <button type="button" class="btn btn--outline" id="orc-save-pdf"
          title="Salva o orçamento e baixa o PDF localmente">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Baixar PDF
        </button>
        <button type="button" class="btn btn--primary" id="orc-save-send">
          ${isEdit ? 'Salvar' : 'Salvar e enviar'}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M5 12h14"/><polyline points="12 5 19 12 12 19"/>
          </svg>
        </button>
      </footer>
    </div>
  `;
}

function collectItems(overlay) {
  const rows = overlay.querySelectorAll('.orc-item-row');
  return Array.from(rows).map((row) => {
    const descricao = row.querySelector('[data-field="descricao"]')?.value.trim() || '';
    const qty = parseNumber(row.querySelector('[data-field="qty"]')?.value);
    const valorUnitario = parseNumber(row.querySelector('[data-field="valorUnitario"]')?.value);
    return {
      descricao,
      qty,
      valorUnitario,
      total: qty * valorUnitario,
    };
  });
}

function recomputeTotals(overlay) {
  const items = collectItems(overlay);
  const subtotal = items.reduce((sum, i) => sum + i.total, 0);
  const desconto = parseNumber(overlay.querySelector('#orc-desconto')?.value);
  const total = Math.max(0, subtotal - desconto);

  // Atualiza totais por linha
  overlay.querySelectorAll('.orc-item-row').forEach((row, idx) => {
    const totalEl = row.querySelector('[data-total]');
    if (totalEl) totalEl.textContent = brl(items[idx]?.total || 0);
  });

  const subEl = overlay.querySelector('#orc-subtotal');
  const totEl = overlay.querySelector('#orc-total');
  if (subEl) subEl.textContent = brl(subtotal);
  if (totEl) totEl.textContent = brl(total);

  return { items, subtotal, desconto, total };
}

function bindEvents(overlay, orcamento, isEdit) {
  const hardClose = () => {
    if (typeof _a11yCleanup === 'function') {
      _a11yCleanup();
      _a11yCleanup = null;
    }
    overlay.remove();
  };

  // Máscara de telefone (XX) XXXXX-XXXX no campo do cliente
  bindPhoneMaskInput(overlay.querySelector('#orc-cliente-tel'));

  // Recompute totals on any input change
  overlay.addEventListener('input', (e) => {
    if (e.target.matches('[data-field], #orc-desconto')) {
      recomputeTotals(overlay);
    }
  });

  // Add item
  overlay.querySelector('[data-action="orc-item-add"]')?.addEventListener('click', () => {
    const list = overlay.querySelector('#orc-items-list');
    const idx = list.querySelectorAll('.orc-item-row').length;
    list.insertAdjacentHTML(
      'beforeend',
      renderItemRow({ descricao: '', qty: 1, valorUnitario: 0 }, idx),
    );
    recomputeTotals(overlay);
  });

  // Remove item (delegação)
  overlay.querySelector('#orc-items-list')?.addEventListener('click', (e) => {
    const removeBtn = e.target.closest('[data-action="orc-item-remove"]');
    if (!removeBtn) return;
    const row = removeBtn.closest('.orc-item-row');
    if (row) {
      row.remove();
      recomputeTotals(overlay);
    }
  });

  // Close handlers
  overlay.querySelector('#orc-close')?.addEventListener('click', hardClose);
  overlay.querySelector('#orc-cancel')?.addEventListener('click', hardClose);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) hardClose();
  });

  // Save handlers
  const saveOrc = async (sendMode) => {
    const clienteNome = overlay.querySelector('#orc-cliente-nome')?.value.trim();
    const titulo = overlay.querySelector('#orc-titulo')?.value.trim();
    if (!clienteNome) {
      Toast.warning('Informe o nome do cliente.');
      overlay.querySelector('#orc-cliente-nome')?.focus();
      return;
    }
    if (!titulo) {
      Toast.warning('Informe o título do orçamento.');
      overlay.querySelector('#orc-titulo')?.focus();
      return;
    }

    const totals = recomputeTotals(overlay);
    const items = totals.items.filter((i) => i.descricao || i.qty > 0 || i.valorUnitario > 0);
    if (!items.length) {
      Toast.warning('Adicione pelo menos um item ao orçamento.');
      return;
    }

    const profile = Profile.get() || {};
    const payload = {
      ...(orcamento || {}),
      clienteNome,
      clienteTelefone: overlay.querySelector('#orc-cliente-tel')?.value.trim() || '',
      clienteEndereco: overlay.querySelector('#orc-cliente-end')?.value.trim() || '',
      titulo,
      descricao: overlay.querySelector('#orc-descricao')?.value.trim() || '',
      itens: items,
      subtotal: totals.subtotal,
      desconto: totals.desconto,
      total: totals.total,
      validadeDias: parseInt(overlay.querySelector('#orc-validade')?.value, 10) || 7,
      formaPagamento: overlay.querySelector('#orc-pagamento')?.value.trim() || '',
      observacoes: overlay.querySelector('#orc-obs')?.value.trim() || '',
    };

    // Modos: 'draft' (só salva), 'pdf' (salva + baixa PDF), 'send' (salva + WhatsApp)
    if (sendMode === 'draft') {
      payload.status = isEdit ? payload.status || 'rascunho' : 'rascunho';
    } else {
      payload.status = 'enviado';
      if (!payload.enviadoEm) payload.enviadoEm = new Date().toISOString();
    }

    try {
      const saved = await upsertOrcamento(payload, { profile });
      Toast.success(
        sendMode === 'draft'
          ? `Rascunho ${saved.numero} salvo.`
          : `Orçamento ${saved.numero} salvo.`,
      );
      hardClose();
      renderOrcamentos();

      // Pos-save: WhatsApp share OU download PDF, conforme o modo.
      if (sendMode === 'send') {
        const { shareOrcamentoWhatsApp } =
          await import('../controller/handlers/orcamentoHandlers.js');
        await shareOrcamentoWhatsApp(saved);
      } else if (sendMode === 'pdf') {
        const { downloadOrcamentoPdf } =
          await import('../controller/handlers/orcamentoHandlers.js');
        await downloadOrcamentoPdf(saved);
      }
    } catch (error) {
      Toast.error(error?.message || 'Falha ao salvar orçamento.');
    }
  };

  overlay.querySelector('#orc-save-draft')?.addEventListener('click', () => saveOrc('draft'));
  overlay.querySelector('#orc-save-pdf')?.addEventListener('click', () => saveOrc('pdf'));
  overlay.querySelector('#orc-save-send')?.addEventListener('click', () => saveOrc('send'));

  _a11yCleanup = attachDialogA11y(overlay, { onDismiss: hardClose });
}

export const OrcamentoModal = {
  openCreate() {
    document.getElementById(OVERLAY_ID)?.remove();
    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.className = 'modal-overlay is-open orcamento-modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'orcamento-modal-title');
    overlay.innerHTML = buildHtml(null, false);
    document.body.appendChild(overlay);
    bindEvents(overlay, null, false);
    requestAnimationFrame(() => {
      overlay.querySelector('#orc-cliente-nome')?.focus();
    });
  },

  openEdit(id) {
    const orcamento = findOrcamento(id);
    if (!orcamento) {
      Toast.error('Orçamento não encontrado.');
      return;
    }
    document.getElementById(OVERLAY_ID)?.remove();
    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.className = 'modal-overlay is-open orcamento-modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'orcamento-modal-title');
    overlay.innerHTML = buildHtml(orcamento, true);
    document.body.appendChild(overlay);
    bindEvents(overlay, orcamento, true);
    requestAnimationFrame(() => {
      overlay.querySelector('#orc-cliente-nome')?.focus();
    });
  },
};
