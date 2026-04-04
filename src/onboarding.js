/**
 * CoolTrack Pro - Onboarding Module v1.0
 * C1: Banner de boas-vindas com dados seed
 * C2: Empty state orientado
 * H1: Técnico padrão em memória
 * H2: Tagline no header
 */

import { Utils } from './utils.js';
import { Toast } from './toast.js';

const PROFILE_KEY  = 'cooltrack-profile';
const ONBOARDED_KEY = 'cooltrack-onboarded';

// ── Perfil do técnico ──────────────────────────────────
export const Profile = {
  get() {
    try {
      return JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null');
    } catch (_) { return null; }
  },

  save(data) {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(data));
  },

  getDefaultTecnico() {
    return this.get()?.nome || localStorage.getItem('cooltrack-last-tecnico') || '';
  },

  saveLastTecnico(nome) {
    if (nome) localStorage.setItem('cooltrack-last-tecnico', nome);
  },
};

// ── Banner de seed ─────────────────────────────────────
export const OnboardingBanner = {
  STORAGE_KEY: 'cooltrack-dismissed-seed-banner',

  isDismissed() {
    return localStorage.getItem(this.STORAGE_KEY) === '1';
  },

  dismiss() {
    localStorage.setItem(this.STORAGE_KEY, '1');
  },

  render() {
    // Só mostra se não foi dispensado
    if (this.isDismissed()) return;

    const existing = document.getElementById('onboarding-banner');
    if (existing) return;

    const banner = document.createElement('div');
    banner.id = 'onboarding-banner';
    banner.className = 'onboarding-banner';
    banner.innerHTML = `
      <div class="onboarding-banner__icon" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="8.5" stroke="var(--primary)" stroke-width="1.3"/>
          <path d="M10 6v4.5l3 1.8" stroke="var(--primary)" stroke-width="1.3" stroke-linecap="round"/>
        </svg>
      </div>
      <div class="onboarding-banner__body">
        <div class="onboarding-banner__title">Você está vendo dados de demonstração</div>
        <div class="onboarding-banner__desc">Cadastre seu primeiro equipamento para começar a usar o CoolTrack Pro com seus dados reais.</div>
      </div>
      <button class="btn btn--primary btn--sm onboarding-banner__cta"
        data-action="open-modal" data-id="modal-add-eq">
        Cadastrar Equipamento
      </button>
      <button class="onboarding-banner__close" aria-label="Dispensar aviso" id="dismiss-banner">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </button>
    `;

    // Inserir antes do dashboard
    const dashGreeting = document.getElementById('dash-greeting');
    if (dashGreeting?.parentNode) {
      dashGreeting.parentNode.insertBefore(banner, dashGreeting);
    }

    // Dispensar
    document.getElementById('dismiss-banner')?.addEventListener('click', () => {
      banner.style.opacity = '0';
      banner.style.transform = 'translateY(-8px)';
      banner.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
      setTimeout(() => {
        banner.remove();
        OnboardingBanner.dismiss();
      }, 200);
    });
  },

  remove() {
    document.getElementById('onboarding-banner')?.remove();
  },
};

// ── Modal de perfil do técnico ─────────────────────────
export const ProfileModal = {
  open() {
    const existing = document.getElementById('modal-profile-overlay');
    if (existing) { existing.classList.add('is-open'); return; }

    const profile = Profile.get() || {};
    const overlay = document.createElement('div');
    overlay.id = 'modal-profile-overlay';
    overlay.className = 'modal-overlay is-open';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'modal-profile-title');

    overlay.innerHTML = `
      <div class="modal modal--sm">
        <div class="modal__handle"></div>
        <div class="modal__title" id="modal-profile-title">Meu Perfil</div>
        <p style="font-size:12px;color:var(--text-2);margin-bottom:16px;line-height:1.5;">
          Preencha seu nome uma vez. O CoolTrack vai pré-preencher automaticamente em todos os registros.
        </p>
        <div class="form-group">
          <label class="form-label" for="profile-nome">Seu Nome *</label>
          <input id="profile-nome" class="form-control" type="text"
            placeholder="Ex: Carlos Figueiredo"
            value="${Utils.escapeHtml(profile.nome || '')}" />
        </div>
        <div class="form-group">
          <label class="form-label" for="profile-empresa">Empresa / Autônomo</label>
          <input id="profile-empresa" class="form-control" type="text"
            placeholder="Ex: CF Refrigeração"
            value="${Utils.escapeHtml(profile.empresa || '')}" />
        </div>
        <div class="form-group">
          <label class="form-label" for="profile-telefone">Telefone / WhatsApp</label>
          <input id="profile-telefone" class="form-control" type="tel"
            placeholder="Ex: (31) 99999-0000"
            value="${Utils.escapeHtml(profile.telefone || '')}" />
        </div>
        <div class="btn-group">
          <button class="btn btn--outline" id="profile-cancel">Cancelar</button>
          <button class="btn btn--primary" id="profile-save">Salvar Perfil</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Fechar no overlay
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.classList.remove('is-open');
    });

    document.getElementById('profile-cancel')?.addEventListener('click', () => {
      overlay.classList.remove('is-open');
    });

    document.getElementById('profile-save')?.addEventListener('click', () => {
      const nome     = document.getElementById('profile-nome')?.value.trim();
      const empresa  = document.getElementById('profile-empresa')?.value.trim();
      const telefone = document.getElementById('profile-telefone')?.value.trim();

      if (!nome) {
        Toast.warning('Digite seu nome para salvar o perfil.');
        return;
      }

      Profile.save({ nome, empresa, telefone });
      Profile.saveLastTecnico(nome);

      // Pré-preencher campo r-tecnico se estiver visível
      const rTecnico = Utils.getEl('r-tecnico');
      if (rTecnico && !rTecnico.value) rTecnico.value = nome;

      overlay.classList.remove('is-open');
      Toast.success(`Perfil salvo. "${nome}" será pré-preenchido nos registros.`);
    });

    // Focus no primeiro campo
    setTimeout(() => document.getElementById('profile-nome')?.focus(), 100);
  },
};

// ── Highlight do item recém-salvo no histórico ─────────
export const SavedHighlight = {
  KEY: 'cooltrack-last-saved-id',

  markForHighlight(id) {
    sessionStorage.setItem(this.KEY, id);
  },

  applyIfPending() {
    const id = sessionStorage.getItem(this.KEY);
    if (!id) return;
    sessionStorage.removeItem(this.KEY);

    setTimeout(() => {
      const items = document.querySelectorAll(`[data-action="delete-reg"]`);
      items.forEach(btn => {
        if (btn.dataset.id === id) {
          const item = btn.closest('.timeline__item');
          if (item) {
            item.classList.add('timeline__item--highlight');
            const msg = document.createElement('div');
            msg.className = 'timeline__saved-badge';
            msg.textContent = 'Registro salvo agora';
            item.prepend(msg);
            setTimeout(() => {
              item.classList.remove('timeline__item--highlight');
              msg.remove();
            }, 4000);
          }
        }
      });
    }, 200);
  },
};