import { Utils } from '../../../core/utils.js';
import { Toast } from '../../../core/toast.js';
import { Profile } from '../../../features/profile.js';
import { GuestCtaModal } from './guestCtaModal.js';

export const ProfileModal = {
  open() {
    document.getElementById('modal-profile-overlay')?.remove();

    const isGuest = localStorage.getItem('cooltrack-guest-mode') === '1';
    if (isGuest) {
      GuestCtaModal.open();
      return;
    }

    const profile = Profile.get() || {};
    const overlay = document.createElement('div');
    overlay.id = 'modal-profile-overlay';
    overlay.className = 'modal-overlay is-open';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'profile-title');

    overlay.innerHTML = `
  <div class="modal" style="align-self:center;padding:0;overflow:hidden;max-width:420px;width:100%">

    <!-- Header -->
    <div style="
      background:linear-gradient(135deg,rgba(0,212,255,0.12),rgba(0,212,255,0.03));
      border-bottom:1px solid rgba(255,255,255,0.07);
      padding:28px 28px 24px;
      display:flex;align-items:center;gap:14px
    ">
      <div style="
        width:48px;height:48px;border-radius:50%;
        background:rgba(0,212,255,0.15);
        border:1.5px solid rgba(0,212,255,0.3);
        display:flex;align-items:center;justify-content:center;
        font-size:17px;font-weight:700;color:#00D4FF;flex-shrink:0
      ">
        ${Utils.escapeHtml(
          (profile.nome || 'T')
            .split(' ')
            .map((n) => n[0])
            .slice(0, 2)
            .join('')
            .toUpperCase(),
        )}
      </div>
      <div>
        <div style="font-size:16px;font-weight:600;color:#E8F2FA;margin-bottom:2px">Meu Perfil</div>
        <div style="font-size:12px;color:#4A6880">Seus dados aparecem nos relatórios PDF</div>
      </div>
    </div>

    <!-- Formulário -->
    <div style="padding:20px 28px 24px">
      <div class="form-group">
        <label class="form-label" for="prof-nome">Seu nome *</label>
        <input id="prof-nome" class="form-control" type="text"
          value="${Utils.escapeAttr(profile.nome || '')}"
          placeholder="Ex: Carlos Figueiredo" />
      </div>
      <div class="form-group">
        <label class="form-label" for="prof-empresa">Empresa / CNPJ</label>
        <input id="prof-empresa" class="form-control" type="text"
          value="${Utils.escapeAttr(profile.empresa || '')}"
          placeholder="Ex: Frio Total Refrigeração" />
      </div>
      <div class="form-group">
        <label class="form-label" for="prof-telefone">Telefone / WhatsApp</label>
        <input id="prof-telefone" class="form-control" type="text"
          value="${Utils.escapeAttr(profile.telefone || '')}"
          placeholder="(31) 99999-0000" />
      </div>
      <div class="btn-group" style="margin-top:8px">
        <button class="btn btn--outline" id="prof-cancel">Cancelar</button>
        <button class="btn btn--primary" id="prof-save">Salvar perfil</button>
      </div>
    </div>
  </div>`;

    document.body.appendChild(overlay);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });

    document.getElementById('prof-cancel')?.addEventListener('click', () => overlay.remove());
    document.getElementById('prof-save')?.addEventListener('click', () => {
      const nome = document.getElementById('prof-nome')?.value.trim();
      if (!nome) {
        Toast.warning('Digite seu nome para continuar.');
        return;
      }
      Profile.save({
        nome,
        empresa: document.getElementById('prof-empresa')?.value.trim(),
        telefone: document.getElementById('prof-telefone')?.value.trim(),
      });
      overlay.remove();
      Toast.success('Perfil salvo.');
    });
  },
};
