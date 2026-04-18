import { Utils } from '../../../core/utils.js';
import { Toast } from '../../../core/toast.js';
import { Profile } from '../../../features/profile.js';
import { GuestCtaModal } from './guestCtaModal.js';

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
    overlay.className = 'modal-overlay is-open';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'profile-title');

    overlay.innerHTML = `
      <div class="modal pm-modal">

        <!-- Header com avatar -->
        <div class="pm-header">
          <div class="pm-avatar" style="color:${color};background:${bg};border-color:${color}40">
            ${Utils.escapeHtml(initials)}
          </div>
          <div class="pm-header__info">
            <div class="pm-header__title" id="profile-title">Meu Perfil</div>
            <div class="pm-header__sub">Seus dados aparecem nos relatórios PDF</div>
          </div>
          <button type="button" class="pm-close" aria-label="Fechar">✕</button>
        </div>

        <!-- Campos -->
        <div class="pm-body">

          <div class="pm-section-label">Identificação</div>

          <div class="pm-field">
            <label class="pm-label" for="prof-nome">
              Nome completo <span class="pm-required">*</span>
            </label>
            <input id="prof-nome" class="form-control" type="text"
              value="${Utils.escapeAttr(profile.nome || '')}"
              placeholder="Ex: Carlos Figueiredo"
              autocomplete="name" />
          </div>

          <div class="pm-field">
            <label class="pm-label" for="prof-crea">
              CREA / Registro profissional
            </label>
            <input id="prof-crea" class="form-control" type="text"
              value="${Utils.escapeAttr(profile.crea || '')}"
              placeholder="Ex: CREA-MG 123456/D"
              autocomplete="off" />
          </div>

          <div class="pm-section-label" style="margin-top:16px">Empresa</div>

          <div class="pm-field">
            <label class="pm-label" for="prof-empresa">Empresa / CNPJ</label>
            <input id="prof-empresa" class="form-control" type="text"
              value="${Utils.escapeAttr(profile.empresa || '')}"
              placeholder="Ex: Frio Total Refrigeração"
              autocomplete="organization" />
          </div>

          <div class="pm-field">
            <label class="pm-label" for="prof-telefone">Telefone / WhatsApp</label>
            <div class="pm-input-icon">
              <span class="pm-input-icon__icon">📱</span>
              <input id="prof-telefone" class="form-control pm-input-icon__input" type="tel"
                value="${Utils.escapeAttr(profile.telefone || '')}"
                placeholder="(31) 99999-0000"
                autocomplete="tel" />
            </div>
          </div>

          <!-- Ações -->
          <div class="pm-actions">
            <button class="btn btn--outline" id="prof-cancel" type="button">Cancelar</button>
            <button class="btn btn--primary" id="prof-save" type="button">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" style="flex-shrink:0">
                <path d="M2 7l4 4 6-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              Salvar perfil
            </button>
          </div>
        </div>

      </div>
    `;

    document.body.appendChild(overlay);

    // Auto-update avatar preview ao digitar o nome
    const nomeInput = overlay.querySelector('#prof-nome');
    const avatarEl = overlay.querySelector('.pm-avatar');
    nomeInput?.addEventListener('input', () => {
      const v = nomeInput.value.trim();
      avatarEl.textContent = getInitials(v);
      const [c, b] = getAvatarColor(v);
      avatarEl.style.color = c;
      avatarEl.style.background = b;
      avatarEl.style.borderColor = c + '40';
    });

    // Formata telefone ao sair do campo
    const telInput = overlay.querySelector('#prof-telefone');
    telInput?.addEventListener('blur', () => {
      if (telInput.value) telInput.value = formatPhone(telInput.value);
    });

    const close = () => overlay.remove();
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
    overlay.querySelector('#prof-cancel')?.addEventListener('click', close);
    overlay.querySelector('.pm-close')?.addEventListener('click', close);

    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') {
        close();
        document.removeEventListener('keydown', esc);
      }
    });

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
      close();
      Toast.success('Perfil salvo com sucesso.');
    });

    nomeInput?.focus();
  },
};
