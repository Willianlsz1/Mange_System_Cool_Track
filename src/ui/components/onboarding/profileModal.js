import { Utils } from '../../../core/utils.js';
import { Toast } from '../../../core/toast.js';
import { Profile } from '../../../features/profile.js';
import { attachDialogA11y, CustomConfirm } from '../../../core/modal.js';
import { GuestCtaModal } from './guestCtaModal.js';

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

// Snapshot dos valores do form — usado pelo dirty-check. Compara os 4 campos
// pós-trim. Retornamos um objeto plano pra facilitar shallow equal.
function captureFormSnapshot(overlay) {
  const get = (id) => overlay.querySelector(`#${id}`)?.value.trim() || '';
  return {
    nome: get('prof-nome'),
    crea: get('prof-crea'),
    empresa: get('prof-empresa'),
    telefone: get('prof-telefone'),
  };
}

function isDirty(initial, current) {
  return (
    initial.nome !== current.nome ||
    initial.crea !== current.crea ||
    initial.empresa !== current.empresa ||
    initial.telefone !== current.telefone
  );
}

export const ProfileModal = {
  open() {
    document.getElementById('modal-profile-overlay')?.remove();

    const isGuest = localStorage.getItem('cooltrack-guest-mode') === '1';
    if (isGuest) {
      GuestCtaModal.open();
      return;
    }

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

        <!-- Hero header: avatar + título + subtítulo + close. Mesmo padrão
             visual do account-modal (orbs radial + gradient sutil). -->
        <section class="profile-modal__hero">
          <span class="profile-modal__hero-orb profile-modal__hero-orb--a" aria-hidden="true"></span>
          <span class="profile-modal__hero-orb profile-modal__hero-orb--b" aria-hidden="true"></span>

          <div class="profile-modal__hero-top">
            <div class="profile-modal__avatar"
              style="color:${color};background:${bg};border-color:${color}40">
              ${Utils.escapeHtml(initials)}
            </div>
            <div class="profile-modal__hero-info">
              <h2 class="profile-modal__title" id="profile-title">Meu Perfil</h2>
              <p class="profile-modal__sub">Seus dados aparecem no cabeçalho dos relatórios PDF</p>
            </div>
            <button type="button" class="profile-modal__close" id="prof-close"
              aria-label="Fechar">
              ${ICON_CLOSE}
            </button>
          </div>
        </section>

        <!-- Body com as duas seções de campos -->
        <div class="profile-modal__body">

          <div class="profile-modal__section">
            <div class="profile-modal__section-label">Identificação</div>

            <div class="profile-modal__field">
              <label class="profile-modal__label" for="prof-nome">
                Nome completo <span class="profile-modal__required" aria-hidden="true">*</span>
              </label>
              <input id="prof-nome" class="form-control profile-modal__input" type="text"
                value="${Utils.escapeAttr(profile.nome || '')}"
                placeholder="Ex: Carlos Figueiredo"
                autocomplete="name" required />
            </div>

            <div class="profile-modal__field">
              <label class="profile-modal__label" for="prof-crea">
                CREA / Registro profissional
              </label>
              <input id="prof-crea" class="form-control profile-modal__input" type="text"
                value="${Utils.escapeAttr(profile.crea || '')}"
                placeholder="Ex: CREA-MG 123456/D"
                autocomplete="off" />
            </div>
          </div>

          <div class="profile-modal__section">
            <div class="profile-modal__section-label">Empresa</div>

            <div class="profile-modal__field">
              <label class="profile-modal__label" for="prof-empresa">
                Empresa / CNPJ
              </label>
              <input id="prof-empresa" class="form-control profile-modal__input" type="text"
                value="${Utils.escapeAttr(profile.empresa || '')}"
                placeholder="Ex: Frio Total Refrigeração"
                autocomplete="organization" />
            </div>

            <div class="profile-modal__field">
              <label class="profile-modal__label" for="prof-telefone">
                Telefone / WhatsApp
              </label>
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

          <!-- Ações -->
          <div class="profile-modal__actions">
            <button class="btn btn--outline profile-modal__btn" id="prof-cancel" type="button">
              Cancelar
            </button>
            <button class="btn btn--primary profile-modal__btn" id="prof-save" type="button">
              ${ICON_CHECK}
              Salvar perfil
            </button>
          </div>
        </div>

      </div>
    `;

    document.body.appendChild(overlay);

    const nomeInput = overlay.querySelector('#prof-nome');
    const avatarEl = overlay.querySelector('.profile-modal__avatar');
    const telInput = overlay.querySelector('#prof-telefone');

    // Auto-update avatar preview ao digitar o nome.
    nomeInput?.addEventListener('input', () => {
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
