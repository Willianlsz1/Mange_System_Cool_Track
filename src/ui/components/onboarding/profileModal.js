import { Utils } from '../../../core/utils.js';
import { Toast } from '../../../core/toast.js';
import { Profile } from '../../../features/profile.js';
import { attachDialogA11y, CustomConfirm } from '../../../core/modal.js';

// Handle do cleanup do focus trap / Escape para o overlay atual.
let _a11yCleanup = null;

const AVATAR_COLORS = [
  ['#0096b4', 'rgba(0,150,180,0.15)'],
  ['#00c870', 'rgba(0,200,112,0.15)'],
  ['#e8a020', 'rgba(232,160,32,0.15)'],
  ['#a855f7', 'rgba(168,85,247,0.15)'],
  ['#e03040', 'rgba(224,48,64,0.12)'],
];

function getAvatarColor(name) {
  const idx =
    Math.abs([...String(name || 'T')].reduce((a, c) => a + c.charCodeAt(0), 0)) %
    AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

function getInitials(name) {
  return String(name || 'T')
    .split(' ')
    .map((n) => n[0] || '')
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function formatPhone(raw) {
  const d = raw.replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return raw;
}

// Ícones SVG stroke — casam com o design do accountModal (Inter 1.6–1.8 weight).
const ICON_CLOSE = `
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>`;
const ICON_CHECK = `
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12"/>
  </svg>`;
const ICON_PHONE = `
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
  </svg>`;
const ICON_USER = `
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>`;
const ICON_BUILDING = `
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <rect x="4" y="2" width="16" height="20" rx="2"/>
    <path d="M9 22v-4h6v4"/>
    <path d="M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01"/>
  </svg>`;
const ICON_SHIELD = `
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    <polyline points="9 12 11 14 15 10"/>
  </svg>`;
const ICON_LOCK = `
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <rect x="3" y="11" width="18" height="11" rx="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>`;
const ICON_INFO = `
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="16" x2="12" y2="12"/>
    <line x1="12" y1="8" x2="12.01" y2="8"/>
  </svg>`;
const ICON_ID = `
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <rect x="3" y="5" width="18" height="14" rx="2"/>
    <circle cx="9" cy="12" r="2"/>
    <line x1="14" y1="10" x2="18" y2="10"/>
    <line x1="14" y1="14" x2="18" y2="14"/>
  </svg>`;
const ICON_DOC = `
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
  </svg>`;
const ICON_SAVE = `
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
    <polyline points="17 21 17 13 7 13 7 21"/>
    <polyline points="7 3 7 8 15 8"/>
  </svg>`;

// Snapshot dos valores do form — usado pelo dirty-check. Compara os 8 campos
// pós-trim (4 originais + 4 PMOC adicionados em abr/2026). Retornamos um
// objeto plano pra facilitar shallow equal.
function captureFormSnapshot(overlay) {
  const get = (id) => overlay.querySelector(`#${id}`)?.value.trim() || '';
  return {
    nome: get('prof-nome'),
    crea: get('prof-crea'),
    empresa: get('prof-empresa'),
    telefone: get('prof-telefone'),
    razao_social: get('prof-razao-social'),
    cnpj: get('prof-cnpj'),
    inscricao_estadual: get('prof-ie'),
    inscricao_municipal: get('prof-im'),
  };
}

function isDirty(initial, current) {
  return (
    initial.nome !== current.nome ||
    initial.crea !== current.crea ||
    initial.empresa !== current.empresa ||
    initial.telefone !== current.telefone ||
    initial.razao_social !== current.razao_social ||
    initial.cnpj !== current.cnpj ||
    initial.inscricao_estadual !== current.inscricao_estadual ||
    initial.inscricao_municipal !== current.inscricao_municipal
  );
}

export const ProfileModal = {
  open() {
    document.getElementById('modal-profile-overlay')?.remove();

    const profile = Profile.get() || {};
    const initials = getInitials(profile.nome);
    const [color, bg] = getAvatarColor(profile.nome);

    const overlay = document.createElement('div');
    overlay.id = 'modal-profile-overlay';
    overlay.className = 'modal-overlay is-open profile-modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'profile-title');

    overlay.innerHTML = `
      <div class="modal profile-modal">

        <!-- V10: hero removido inteiramente — usuario reportou que o hero
             (avatar + close) era redundante porque o footer ja tem botoes
             "Cancelar" e "Salvar perfil" + ESC tambem fecha. Mantemos apenas
             o h2 sr-only pra screen readers e preservar aria-labelledby. -->
        <h2 class="profile-modal__title--sr-only" id="profile-title">Meu Perfil</h2>

        <!-- Body V6: cards de secao com icone + header + hints sob labels.
             Hierarquia visual: hero -> 3 cards (Identificacao / Empresa /
             Dados legais) -> footer com seguranca e Salvar. -->
        <div class="profile-modal__body">

          <!-- ── Card 1: Identificação ── -->
          <div class="profile-modal__section profile-modal__section--card">
            <header class="profile-modal__section-head">
              <span class="profile-modal__section-icon" aria-hidden="true">${ICON_USER}</span>
              <div class="profile-modal__section-text">
                <h3 class="profile-modal__section-title">Identificação</h3>
                <p class="profile-modal__section-sub">Como você será identificado nos relatórios</p>
              </div>
            </header>

            <div class="profile-modal__field">
              <label class="profile-modal__label" for="prof-nome">
                Nome completo <span class="profile-modal__required" aria-hidden="true">*</span>
              </label>
              <span class="profile-modal__field-hint">Aparece no cabeçalho dos PDFs</span>
              <input id="prof-nome" class="form-control profile-modal__input" type="text"
                value="${Utils.escapeAttr(profile.nome || '')}"
                placeholder="Ex: Carlos Figueiredo"
                autocomplete="name" required />
            </div>

            <div class="profile-modal__field">
              <label class="profile-modal__label" for="prof-crea">CREA / Registro profissional</label>
              <span class="profile-modal__field-hint">Seu registro no conselho profissional</span>
              <div class="profile-modal__input-wrap">
                <input id="prof-crea"
                  class="form-control profile-modal__input profile-modal__input--has-trailing-icon"
                  type="text"
                  value="${Utils.escapeAttr(profile.crea || '')}"
                  placeholder="Ex: CREA-MG 123456/D"
                  autocomplete="off" />
                <span class="profile-modal__input-trailing-icon" aria-hidden="true">${ICON_ID}</span>
              </div>
            </div>
          </div>

          <!-- ── Card 2: Empresa ── -->
          <div class="profile-modal__section profile-modal__section--card">
            <header class="profile-modal__section-head">
              <span class="profile-modal__section-icon" aria-hidden="true">${ICON_BUILDING}</span>
              <div class="profile-modal__section-text">
                <h3 class="profile-modal__section-title">Empresa</h3>
                <p class="profile-modal__section-sub">Dados da sua empresa</p>
              </div>
            </header>

            <div class="profile-modal__field">
              <label class="profile-modal__label" for="prof-empresa">Nome / Razão fantasia</label>
              <span class="profile-modal__field-hint">Aparece nos relatórios</span>
              <div class="profile-modal__input-wrap">
                <input id="prof-empresa"
                  class="form-control profile-modal__input profile-modal__input--has-trailing-icon"
                  type="text"
                  value="${Utils.escapeAttr(profile.empresa || '')}"
                  placeholder="Ex: Frio Total Refrigeração"
                  autocomplete="organization" />
                <span class="profile-modal__input-trailing-icon" aria-hidden="true">${ICON_BUILDING}</span>
              </div>
            </div>

            <div class="profile-modal__field">
              <label class="profile-modal__label" for="prof-telefone">Telefone / WhatsApp</label>
              <span class="profile-modal__field-hint">Para contato rápido</span>
              <div class="profile-modal__input-wrap">
                <span class="profile-modal__input-icon" aria-hidden="true">${ICON_PHONE}</span>
                <input id="prof-telefone"
                  class="form-control profile-modal__input profile-modal__input--has-icon"
                  type="tel"
                  value="${Utils.escapeAttr(profile.telefone || '')}"
                  placeholder="(31) 99999-0000"
                  autocomplete="tel" />
              </div>
            </div>
          </div>

          <!-- ── Card 3: Dados legais (opcional) ── -->
          <div class="profile-modal__section profile-modal__section--card">
            <header class="profile-modal__section-head">
              <span class="profile-modal__section-icon" aria-hidden="true">${ICON_SHIELD}</span>
              <div class="profile-modal__section-text">
                <h3 class="profile-modal__section-title">
                  Dados legais <span class="profile-modal__section-tag">(opcional)</span>
                </h3>
                <p class="profile-modal__section-sub">Necessário para emitir relatórios PMOC formais</p>
              </div>
            </header>

            <div class="profile-modal__field">
              <label class="profile-modal__label" for="prof-razao-social">Razão social completa</label>
              <span class="profile-modal__field-hint">Conforme contrato social</span>
              <div class="profile-modal__input-wrap">
                <input id="prof-razao-social"
                  class="form-control profile-modal__input profile-modal__input--has-trailing-icon"
                  type="text"
                  value="${Utils.escapeAttr(profile.razao_social || '')}"
                  placeholder="Ex: Frio Total Refrigeração Ltda"
                  autocomplete="organization" />
                <span class="profile-modal__input-trailing-icon" aria-hidden="true">${ICON_DOC}</span>
              </div>
            </div>

            <!-- Linha CNPJ + Inscricao estadual em 2 colunas (mobile cai pra 1) -->
            <div class="profile-modal__row-2col">
              <div class="profile-modal__field">
                <label class="profile-modal__label" for="prof-cnpj">CNPJ / CPF</label>
                <span class="profile-modal__field-hint">Somente números</span>
                <div class="profile-modal__input-wrap">
                  <input id="prof-cnpj"
                    class="form-control profile-modal__input profile-modal__input--has-trailing-icon"
                    type="text"
                    value="${Utils.escapeAttr(profile.cnpj || '')}"
                    placeholder="00.000.000/0001-00"
                    inputmode="numeric"
                    autocomplete="off" />
                  <span class="profile-modal__input-trailing-icon" aria-hidden="true">${ICON_ID}</span>
                </div>
              </div>

              <div class="profile-modal__field">
                <label class="profile-modal__label" for="prof-ie">Inscrição estadual</label>
                <span class="profile-modal__field-hint">Isento ou número</span>
                <div class="profile-modal__input-wrap">
                  <input id="prof-ie"
                    class="form-control profile-modal__input profile-modal__input--has-trailing-icon"
                    type="text"
                    value="${Utils.escapeAttr(profile.inscricao_estadual || '')}"
                    placeholder="Isento ou número"
                    autocomplete="off" />
                  <span class="profile-modal__input-trailing-icon" aria-hidden="true">${ICON_ID}</span>
                </div>
              </div>
            </div>

            <!-- Inscricao municipal pode ficar abaixo (linha unica) -->
            <div class="profile-modal__field">
              <label class="profile-modal__label" for="prof-im">Inscrição municipal</label>
              <span class="profile-modal__field-hint">Número conforme prefeitura</span>
              <input id="prof-im" class="form-control profile-modal__input" type="text"
                value="${Utils.escapeAttr(profile.inscricao_municipal || '')}"
                placeholder="Número conforme prefeitura"
                autocomplete="off" />
            </div>

            <!-- Info banner explicando o opcional -->
            <div class="profile-modal__info-banner" role="note">
              <span class="profile-modal__info-banner-icon" aria-hidden="true">${ICON_INFO}</span>
              <span>Essas informações são opcionais, mas recomendadas para relatórios formais e notas técnicas.</span>
            </div>
          </div>

          <!-- ── Footer: seguranca + autosave + salvar ── -->
          <div class="profile-modal__footer">
            <div class="profile-modal__footer-meta">
              <span class="profile-modal__footer-secure" title="Dados criptografados">
                ${ICON_LOCK} Seus dados são salvos com segurança
              </span>
              <span class="profile-modal__footer-autosave" id="prof-autosave-pill">
                <span class="profile-modal__footer-autosave-text">Salvo automaticamente</span>
                ${ICON_CHECK}
              </span>
            </div>
            <div class="profile-modal__actions">
              <button class="btn btn--outline profile-modal__btn" id="prof-cancel" type="button">
                Cancelar
              </button>
              <button class="btn btn--primary profile-modal__btn profile-modal__btn--save"
                id="prof-save" type="button">
                ${ICON_SAVE}
                Salvar perfil
              </button>
            </div>
          </div>
        </div>

      </div>
    `;

    document.body.appendChild(overlay);

    const nomeInput = overlay.querySelector('#prof-nome');
    const avatarEl = overlay.querySelector('.profile-modal__avatar');
    const telInput = overlay.querySelector('#prof-telefone');

    // Auto-update avatar preview ao digitar o nome.
    // V10: avatarEl pode ser null (avatar foi removido do hero). Guard com
    // optional chaining + early return pra nao quebrar.
    nomeInput?.addEventListener('input', () => {
      if (!avatarEl) return;
      const v = nomeInput.value.trim();
      avatarEl.textContent = getInitials(v);
      const [c, b] = getAvatarColor(v);
      avatarEl.style.color = c;
      avatarEl.style.background = b;
      avatarEl.style.borderColor = c + '40';
    });

    // Formata telefone ao sair do campo.
    telInput?.addEventListener('blur', () => {
      if (telInput.value) telInput.value = formatPhone(telInput.value);
    });

    // Snapshot dos valores carregados. É usado pelo dirty-check quando o
    // usuário tenta fechar via Cancel/X/Escape/backdrop — evita o bug
    // histórico de "digitei tudo, cliquei Cancelar, perdi sem aviso".
    const initialSnapshot = captureFormSnapshot(overlay);

    const hardClose = () => {
      if (typeof _a11yCleanup === 'function') {
        _a11yCleanup();
        _a11yCleanup = null;
      }
      overlay.remove();
    };

    // Fechamento gateado: se tiver alterações pendentes, pergunta antes de
    // descartar. Volta `true` se fechou (após confirmação ou sem dirty),
    // `false` se o usuário cancelou o descarte e queremos manter o modal
    // aberto — usado pelo attachDialogA11y pra bloquear o dismiss Escape.
    const requestClose = async () => {
      const current = captureFormSnapshot(overlay);
      if (!isDirty(initialSnapshot, current)) {
        hardClose();
        return true;
      }
      const discard = await CustomConfirm.show(
        'Descartar alterações?',
        'Você tem alterações no perfil que ainda não foram salvas. Se fechar agora, elas serão perdidas.',
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
    overlay.querySelector('#prof-cancel')?.addEventListener('click', () => requestClose());
    overlay.querySelector('#prof-close')?.addEventListener('click', () => requestClose());

    _a11yCleanup = attachDialogA11y(overlay, { onDismiss: () => requestClose() });

    overlay.querySelector('#prof-save')?.addEventListener('click', () => {
      const nome = nomeInput?.value.trim();
      if (!nome) {
        Toast.warning('Digite seu nome para continuar.');
        nomeInput?.focus();
        return;
      }
      Profile.save({
        nome,
        crea: overlay.querySelector('#prof-crea')?.value.trim(),
        empresa: overlay.querySelector('#prof-empresa')?.value.trim(),
        telefone: overlay.querySelector('#prof-telefone')?.value.trim(),
      });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('cooltrack:profile-updated'));
      }
      // Salvou → não há o que descartar, fecha direto.
      hardClose();
      Toast.success('Perfil salvo com sucesso.');
    });

    // attachDialogA11y foca o primeiro elemento focável (.profile-modal__close)
    // no próximo frame — sobrescrevemos aqui para priorizar o input principal.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => nomeInput?.focus());
    });
  },
};
