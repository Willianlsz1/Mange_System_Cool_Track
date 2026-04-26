/**
 * CoolTrack Pro - ClienteModal (Fase 2 PMOC, abr/2026)
 *
 * Modal de cadastro/edição de cliente. Padrão similar ao setorModal mas
 * com mais campos (PMOC exige razão social, CNPJ, IE, IM, endereço, contato,
 * URL chamados). Validação CNPJ permissiva — warning amarelo, não bloqueia.
 *
 * Uso:
 *   import { ClienteModal } from './ui/components/clienteModal.js';
 *   ClienteModal.openCreate({ onSaved: (cliente) => ... });
 *   ClienteModal.openEdit(clienteExistente, { onSaved: ... });
 */

import { Utils } from '../../core/utils.js';
import { Toast } from '../../core/toast.js';
import {
  upsertCliente,
  validateCnpjOrCpf,
  formatCnpjOrCpf,
  maskCnpjOrCpfInput,
} from '../../core/clientes.js';
import { attachDialogA11y, CustomConfirm } from '../../core/modal.js';

const OVERLAY_ID = 'cliente-modal-overlay';
let _a11yCleanup = null;

function captureFormSnapshot(overlay) {
  const get = (id) => overlay.querySelector(`#${id}`)?.value.trim() || '';
  return {
    nome: get('cli-nome'),
    razaoSocial: get('cli-razao-social'),
    cnpj: get('cli-cnpj'),
    inscricaoEstadual: get('cli-ie'),
    inscricaoMunicipal: get('cli-im'),
    endereco: get('cli-endereco'),
    contato: get('cli-contato'),
    urlChamados: get('cli-url-chamados'),
    observacoes: get('cli-observacoes'),
  };
}

function isDirty(initial, current) {
  return Object.keys(current).some((k) => initial[k] !== current[k]);
}

function buildOverlayHtml(cliente) {
  const c = cliente || {};
  const isEdit = Boolean(c.id);
  return `
    <div class="modal cliente-modal">
      <header class="cliente-modal__head">
        <div class="cliente-modal__head-text">
          <h2 class="cliente-modal__title" id="cliente-modal-title">
            ${isEdit ? 'Editar cliente' : 'Novo cliente'}
          </h2>
          <p class="cliente-modal__sub">
            Dados aparecem no cabeçalho do PDF e em relatórios PMOC formais.
          </p>
        </div>
        <button type="button" class="cliente-modal__close" id="cli-close" aria-label="Fechar">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </header>

      <div class="cliente-modal__body">

        <section class="cliente-modal__section">
          <div class="cliente-modal__section-label">Identificação</div>

          <div class="cliente-modal__field">
            <label class="cliente-modal__label" for="cli-nome">
              Nome do cliente <span class="cliente-modal__required" aria-hidden="true">*</span>
            </label>
            <input id="cli-nome" class="form-control cliente-modal__input" type="text"
              value="${Utils.escapeAttr(c.nome || '')}"
              placeholder="Ex: Edifício Dallas, Cliente João Silva"
              maxlength="120"
              required autocomplete="organization" />
            <div class="cliente-modal__hint">Como você reconhece esse cliente no dia a dia.</div>
          </div>

          <div class="cliente-modal__field">
            <label class="cliente-modal__label" for="cli-razao-social">
              Razão social
            </label>
            <input id="cli-razao-social" class="form-control cliente-modal__input" type="text"
              value="${Utils.escapeAttr(c.razaoSocial || '')}"
              placeholder="Ex: Condomínio Dallas LTDA"
              maxlength="200" autocomplete="organization" />
          </div>

          <div class="cliente-modal__field">
            <label class="cliente-modal__label" for="cli-cnpj">
              CNPJ ou CPF
            </label>
            <input id="cli-cnpj" class="form-control cliente-modal__input" type="text"
              value="${Utils.escapeAttr(c.cnpj || '')}"
              placeholder="00.000.000/0001-00 ou 000.000.000-00"
              inputmode="numeric" autocomplete="off" />
            <div class="cliente-modal__warn" id="cli-cnpj-warn" hidden></div>
          </div>

          <div class="form-row">
            <div class="cliente-modal__field">
              <label class="cliente-modal__label" for="cli-ie">Inscrição estadual</label>
              <input id="cli-ie" class="form-control cliente-modal__input" type="text"
                value="${Utils.escapeAttr(c.inscricaoEstadual || '')}"
                placeholder="Isento ou número" autocomplete="off" />
            </div>
            <div class="cliente-modal__field">
              <label class="cliente-modal__label" for="cli-im">Inscrição municipal</label>
              <input id="cli-im" class="form-control cliente-modal__input" type="text"
                value="${Utils.escapeAttr(c.inscricaoMunicipal || '')}"
                placeholder="Conforme prefeitura" autocomplete="off" />
            </div>
          </div>
        </section>

        <section class="cliente-modal__section">
          <div class="cliente-modal__section-label">Localização e contato</div>

          <div class="cliente-modal__field">
            <label class="cliente-modal__label" for="cli-endereco">Endereço</label>
            <input id="cli-endereco" class="form-control cliente-modal__input" type="text"
              value="${Utils.escapeAttr(c.endereco || '')}"
              placeholder="Ex: Rua da Paz, Alto da XV, Curitiba - PR"
              maxlength="240" autocomplete="street-address" />
          </div>

          <div class="cliente-modal__field">
            <label class="cliente-modal__label" for="cli-contato">Telefone / WhatsApp / e-mail</label>
            <input id="cli-contato" class="form-control cliente-modal__input" type="text"
              value="${Utils.escapeAttr(c.contato || '')}"
              placeholder="Ex: (41) 99999-0000 ou contato@dallas.com"
              maxlength="120" autocomplete="off" />
          </div>

          <div class="cliente-modal__field">
            <label class="cliente-modal__label" for="cli-url-chamados">Canal de chamados do cliente</label>
            <input id="cli-url-chamados" class="form-control cliente-modal__input" type="url"
              value="${Utils.escapeAttr(c.urlChamados || '')}"
              placeholder="https://wa.me/5511999999999 ou portal do cliente"
              maxlength="240" autocomplete="off" />
            <div class="cliente-modal__hint">
              Link onde o cliente abre chamado quando algo quebra — WhatsApp,
              portal próprio, Google Form, e-mail (mailto:). Aparece clicável
              na capa do PMOC. Exigido pela NBR 13971.
            </div>
          </div>
        </section>

        <section class="cliente-modal__section">
          <div class="cliente-modal__section-label">Notas internas</div>

          <div class="cliente-modal__field">
            <label class="cliente-modal__label" for="cli-observacoes">Observações</label>
            <textarea id="cli-observacoes" class="form-control cliente-modal__input cliente-modal__textarea"
              rows="3" maxlength="500"
              placeholder="Notas privadas (não vão pro PDF do cliente)">${Utils.escapeHtml(c.observacoes || '')}</textarea>
          </div>
        </section>

        <div class="cliente-modal__actions">
          <button type="button" class="btn btn--outline cliente-modal__btn" id="cli-cancel">
            Cancelar
          </button>
          <button type="button" class="btn btn--primary cliente-modal__btn" id="cli-save">
            ${isEdit ? 'Salvar alterações' : 'Cadastrar cliente'}
          </button>
        </div>
      </div>
    </div>
  `;
}

function bindCnpjValidation(overlay) {
  const input = overlay.querySelector('#cli-cnpj');
  const warn = overlay.querySelector('#cli-cnpj-warn');
  if (!input || !warn) return;

  const validate = () => {
    const result = validateCnpjOrCpf(input.value);
    if (!input.value.trim() || result.ok) {
      warn.hidden = true;
      warn.textContent = '';
      input.classList.remove('cliente-modal__input--warn');
      return;
    }
    warn.hidden = false;
    warn.textContent =
      result.message ||
      `${result.kind === 'cpf' ? 'CPF' : 'CNPJ'} não passa na validação. Você pode salvar mesmo assim.`;
    input.classList.add('cliente-modal__input--warn');
  };

  // Mascara em tempo real: a cada digitacao reformata pra X.X.X-X (CPF) ate 11
  // digitos OU XX.X.X/X-X (CNPJ) de 12-14. Cap automatico em 14 digitos.
  // Cursor vai pro final apos reformat — pattern simples e funcional pro 99%
  // dos casos onde usuario digita lineamente.
  input.addEventListener('input', () => {
    const masked = maskCnpjOrCpfInput(input.value);
    if (masked !== input.value) {
      input.value = masked;
      // Posiciona cursor no fim — usuario tipico digita linearmente.
      try {
        input.setSelectionRange(masked.length, masked.length);
      } catch (_e) {
        /* alguns input types nao suportam setSelectionRange — ignora */
      }
    }
    validate();
  });
  input.addEventListener('blur', () => {
    validate();
    // Auto-format final ao sair se valido (mantido como salvaguarda).
    const result = validateCnpjOrCpf(input.value);
    if (result.ok && input.value.trim()) {
      input.value = formatCnpjOrCpf(input.value);
    }
  });
}

async function handleSave(overlay, cliente, onSaved, hardClose) {
  const snapshot = captureFormSnapshot(overlay);
  if (!snapshot.nome) {
    Toast.warning('Nome do cliente é obrigatório.');
    overlay.querySelector('#cli-nome')?.focus();
    return;
  }

  const saveBtn = overlay.querySelector('#cli-save');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.dataset.originalLabel = saveBtn.textContent;
    saveBtn.textContent = 'Salvando...';
  }

  try {
    const saved = await upsertCliente({ id: cliente?.id, ...snapshot });
    Toast.success(cliente?.id ? 'Cliente atualizado.' : 'Cliente cadastrado.');
    hardClose();
    if (typeof onSaved === 'function') onSaved(saved);
  } catch (error) {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = saveBtn.dataset.originalLabel || 'Cadastrar cliente';
    }
    // upsertCliente já loga via handleError; só reverte UI
    Toast.error(error?.message || 'Não foi possível salvar o cliente.');
  }
}

async function open(cliente, opts = {}) {
  document.getElementById(OVERLAY_ID)?.remove();

  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.className = 'modal-overlay is-open cliente-modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'cliente-modal-title');
  overlay.innerHTML = buildOverlayHtml(cliente);
  document.body.appendChild(overlay);

  const initialSnapshot = captureFormSnapshot(overlay);

  const hardClose = () => {
    if (typeof _a11yCleanup === 'function') {
      _a11yCleanup();
      _a11yCleanup = null;
    }
    overlay.remove();
  };

  const requestClose = async () => {
    const current = captureFormSnapshot(overlay);
    if (!isDirty(initialSnapshot, current)) {
      hardClose();
      return true;
    }
    const discard = await CustomConfirm.show(
      'Descartar alterações?',
      'Você tem alterações não salvas. Se fechar agora, elas serão perdidas.',
      {
        confirmLabel: 'Descartar',
        cancelLabel: 'Continuar editando',
        tone: 'danger',
        focus: 'cancel',
      },
    );
    if (!discard) return false;
    hardClose();
    return true;
  };

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) requestClose();
  });
  overlay.querySelector('#cli-cancel')?.addEventListener('click', () => requestClose());
  overlay.querySelector('#cli-close')?.addEventListener('click', () => requestClose());

  _a11yCleanup = attachDialogA11y(overlay, { onDismiss: () => requestClose() });

  bindCnpjValidation(overlay);

  overlay.querySelector('#cli-save')?.addEventListener('click', () => {
    handleSave(overlay, cliente, opts.onSaved, hardClose);
  });

  // Foco no primeiro campo após paint (evita conflito com a11y default)
  requestAnimationFrame(() => {
    requestAnimationFrame(() => overlay.querySelector('#cli-nome')?.focus());
  });
}

export const ClienteModal = {
  /**
   * Abre o modal pra criar cliente novo.
   * @param {object} [opts]
   * @param {(cliente) => void} [opts.onSaved] - callback após save bem-sucedido
   */
  openCreate(opts) {
    return open(null, opts);
  },
  /**
   * Abre o modal pra editar cliente existente.
   */
  openEdit(cliente, opts) {
    return open(cliente, opts);
  },
};
