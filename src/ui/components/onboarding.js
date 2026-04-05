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


// ════════════════════════════════════════════════════════
// FIRST-TIME EXPERIENCE — elimina paralisia de escolha
// Aparece apenas na primeira visita, se nunca houve equip real
// ════════════════════════════════════════════════════════
const FTX_KEY = 'cooltrack-ftx-done';

export const FirstTimeExperience = {

  isDone() {
    return localStorage.getItem(FTX_KEY) === '1';
  },

  markDone() {
    localStorage.setItem(FTX_KEY, '1');
  },

  /**
   * Retorna true se deve mostrar o FTX:
   * - primeira visita (nunca marcou FTX como done)
   * - E o app ainda tem só dados seed (nenhum equip com tag própria real)
   */
  shouldShow(equipamentos) {
    if (this.isDone()) return false;
    // Considera "real" se o usuário já dispensou o banner OU já tem mais de 7 equip (seed tem 7)
    // Critério simples: se já teve interação registrada pelo profile ou dismiss
    const hasDismissed  = localStorage.getItem('cooltrack-dismissed-seed-banner') === '1';
    const hasProfile    = !!localStorage.getItem('cooltrack-profile');
    const hasLastTec    = !!localStorage.getItem('cooltrack-last-tecnico');
    if (hasDismissed || hasProfile || hasLastTec) { this.markDone(); return false; }
    return true;
  },

  show(equipamentos) {
    if (!this.shouldShow(equipamentos)) return;

    // Overlay de boas-vindas — modal não intrusivo na primeira visita
    const overlay = document.createElement('div');
    overlay.id = 'ftx-overlay';
    overlay.className = 'ftx-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'ftx-title');
    overlay.innerHTML = `
      <div class="ftx-modal">
        <div class="ftx-header">
          <div class="ftx-logo" aria-hidden="true">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect x="2" y="2" width="28" height="28" rx="6" stroke="#00C8E8" stroke-width="1.8"/>
              <circle cx="16" cy="16" r="5" stroke="#00C8E8" stroke-width="1.8"/>
              <path d="M16 2v6M16 24v6M2 16h6M24 16h6" stroke="#00C8E8" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
          </div>
          <div>
            <div class="ftx-title" id="ftx-title">Bem-vindo ao CoolTrack Pro</div>
            <div class="ftx-subtitle">Gestão de manutenção para técnicos de refrigeração</div>
          </div>
        </div>

        <p class="ftx-desc">
          Você está vendo dados de demonstração. Para começar, escolha o que faz mais sentido agora:
        </p>

        <!-- Caminhos — máx. 2 opções para evitar paralisia -->
        <div class="ftx-paths">
          <button class="ftx-path ftx-path--primary" id="ftx-add-equip">
            <div class="ftx-path__icon" aria-hidden="true">❄️</div>
            <div class="ftx-path__body">
              <div class="ftx-path__title">Cadastrar meu primeiro equipamento</div>
              <div class="ftx-path__desc">Leva 2 minutos. Você terá controle total do histórico e alertas de manutenção.</div>
            </div>
            <div class="ftx-path__arrow" aria-hidden="true">→</div>
          </button>

          <button class="ftx-path ftx-path--secondary" id="ftx-explore">
            <div class="ftx-path__icon" aria-hidden="true">👁</div>
            <div class="ftx-path__body">
              <div class="ftx-path__title">Explorar com dados de demonstração</div>
              <div class="ftx-path__desc">Veja como o sistema funciona antes de adicionar seus dados.</div>
            </div>
            <div class="ftx-path__arrow" aria-hidden="true">→</div>
          </button>
        </div>

        <!-- Prova social mínima -->
        <div class="ftx-social">
          <div class="ftx-social__avatars" aria-hidden="true">
            <span class="ftx-avatar">C</span>
            <span class="ftx-avatar">R</span>
            <span class="ftx-avatar">J</span>
          </div>
          <span class="ftx-social__text">Técnicos autônomos usam para comprovar serviços e renovar contratos</span>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    // Caminho 1: cadastrar equipamento
    document.getElementById('ftx-add-equip')?.addEventListener('click', () => {
      this._close();
      // Abrir modal de cadastro diretamente
      setTimeout(() => {
        document.querySelector('[data-action="open-modal"][data-id="modal-add-eq"]')?.click();
      }, 100);
    });

    // Caminho 2: explorar — apenas fecha
    document.getElementById('ftx-explore')?.addEventListener('click', () => {
      this._close();
    });

    // Animação de entrada
    requestAnimationFrame(() => overlay.classList.add('is-visible'));
  },

  _close() {
    this.markDone();
    OnboardingBanner.dismiss(); // se explorar, dispensar banner também
    const overlay = document.getElementById('ftx-overlay');
    if (!overlay) return;
    overlay.classList.remove('is-visible');
    document.body.style.overflow = '';
    setTimeout(() => overlay.remove(), 250);
  },
};