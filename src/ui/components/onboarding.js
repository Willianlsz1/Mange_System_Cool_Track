/**
 * CoolTrack Pro - Onboarding v2.0
 * Fluxo de 3 passos que coleta dado real antes de mostrar qualquer dashboard.
 * Substitui o FirstTimeExperience baseado em seedIfEmpty.
 *
 * Exports:
 *   FirstTimeExperience   — entry point chamado em app.js
 *   OnboardingBanner      — banner inline após cadastro do 1º equip (mantido)
 *   SavedHighlight        — highlight de item recém-salvo (mantido)
 *   ProfileModal          — modal de perfil do técnico (mantido)
 *   Profile               — utilitário de perfil (mantido)
 */

import { Utils, TIPO_ICON }  from '../../core/utils.js';
import { getState, setState } from '../../core/state.js';
import { Toast }             from '../../core/toast.js';
import { goTo }              from '../../core/router.js';

/* ─────────────────────────────────────────────────────
   PROFILE — persistência simples do perfil do técnico
───────────────────────────────────────────────────── */
const PROFILE_KEY  = 'cooltrack-profile';
const LAST_TEC_KEY = 'cooltrack-last-tecnico';

export const Profile = {
  get() {
    try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null'); }
    catch (_) { return null; }
  },
  save(data) { localStorage.setItem(PROFILE_KEY, JSON.stringify(data)); },
  getDefaultTecnico() {
    return this.get()?.nome || localStorage.getItem(LAST_TEC_KEY) || '';
  },
  saveLastTecnico(nome) {
    if (nome) localStorage.setItem(LAST_TEC_KEY, nome);
  },
};

/* ─────────────────────────────────────────────────────
   SAVED HIGHLIGHT — marca o item recém-salvo no histórico
───────────────────────────────────────────────────── */
const HIGHLIGHT_KEY = 'cooltrack-highlight-id';

export const SavedHighlight = {
  markForHighlight(id) { sessionStorage.setItem(HIGHLIGHT_KEY, id); },
  applyIfPending() {
    const id = sessionStorage.getItem(HIGHLIGHT_KEY);
    if (!id) return;
    sessionStorage.removeItem(HIGHLIGHT_KEY);
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-reg-id="${id}"]`);
      if (!el) return;
      el.classList.add('timeline__item--saved');
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => el.classList.remove('timeline__item--saved'), 3000);
    });
  },
};

/* ─────────────────────────────────────────────────────
   ONBOARDING BANNER — banner inline na view de equip
───────────────────────────────────────────────────── */
const BANNER_KEY = 'cooltrack-banner-dismissed';

export const OnboardingBanner = {
  render() {
    const { equipamentos } = getState();
    const bannerEl = document.getElementById('onboarding-banner');
    if (equipamentos.length || localStorage.getItem(BANNER_KEY)) {
      if (bannerEl) bannerEl.remove();
      return;
    }
    if (bannerEl) return;
    const el = document.createElement('div');
    el.id = 'onboarding-banner';
    el.className = 'onboarding-banner';
    el.innerHTML = `
      <div class="onboarding-banner__icon">🚀</div>
      <div>
        <div class="onboarding-banner__title">Cadastre seu primeiro equipamento</div>
        <div class="onboarding-banner__desc">Adicione um equipamento para começar a registrar serviços e gerar relatórios.</div>
      </div>
      <button class="btn btn--primary btn--sm" data-action="open-modal" data-id="modal-add-eq">Cadastrar agora</button>
    `;
    document.getElementById('lista-equip')?.before(el);
  },
  dismiss() { localStorage.setItem(BANNER_KEY, '1'); },
  remove()  { document.getElementById('onboarding-banner')?.remove(); },
};

/* ─────────────────────────────────────────────────────
   PROFILE MODAL — modal de perfil do técnico
───────────────────────────────────────────────────── */
export const ProfileModal = {
  open() {
    document.getElementById('modal-profile-overlay')?.remove();

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
        ${(profile.nome || 'T').split(' ').map(n => n[0]).slice(0,2).join('').toUpperCase()}
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
          value="${Utils.escapeHtml(profile.nome || '')}"
          placeholder="Ex: Carlos Figueiredo" />
      </div>
      <div class="form-group">
        <label class="form-label" for="prof-empresa">Empresa / CNPJ</label>
        <input id="prof-empresa" class="form-control" type="text"
          value="${Utils.escapeHtml(profile.empresa || '')}"
          placeholder="Ex: Frio Total Refrigeração" />
      </div>
      <div class="form-group">
        <label class="form-label" for="prof-telefone">Telefone / WhatsApp</label>
        <input id="prof-telefone" class="form-control" type="text"
          value="${Utils.escapeHtml(profile.telefone || '')}"
          placeholder="(31) 99999-0000" />
      </div>
      <div class="btn-group" style="margin-top:8px">
        <button class="btn btn--outline" id="prof-cancel">Cancelar</button>
        <button class="btn btn--primary" id="prof-save">Salvar perfil</button>
      </div>
    </div>
  </div>`;

    document.body.appendChild(overlay);

    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

    document.getElementById('prof-cancel')?.addEventListener('click', () => overlay.remove());
    document.getElementById('prof-save')?.addEventListener('click', () => {
      const nome = document.getElementById('prof-nome')?.value.trim();
      if (!nome) { Toast.warning('Digite seu nome para continuar.'); return; }
      Profile.save({
        nome,
        empresa:  document.getElementById('prof-empresa')?.value.trim(),
        telefone: document.getElementById('prof-telefone')?.value.trim(),
      });
      overlay.remove();
      Toast.success('Perfil salvo.');
    });
  },
};

/* ─────────────────────────────────────────────────────
   FIRST TIME EXPERIENCE — onboarding de 3 passos
   
   Fluxo:
     Passo 1 — Apresentação + nome do técnico
     Passo 2 — Cadastro do primeiro equipamento
     Passo 3 — Confirmação + ação imediata

   Regras:
     • Só aparece se equipamentos.length === 0
     • Coleta dado real (não seed fake)
     • Fecha ao concluir e navega para Registrar
     • Pode ser dispensado (link "Pular")
───────────────────────────────────────────────────── */
const FTX_KEY = 'cooltrack-ftx-done';

export const FirstTimeExperience = {

  show(equipamentos) {
    /* Já tem equipamento ou já fez onboarding → não mostrar */
    if (equipamentos.length || localStorage.getItem(FTX_KEY)) return;

    document.getElementById('ftx-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'ftx-overlay';
    overlay.style.cssText = `
      position:fixed;inset:0;z-index:200;
      background:rgba(7,17,31,0.92);
      display:flex;align-items:center;justify-content:center;
      padding:16px;
      animation:ftx-fade-in .25s ease;
    `;

    overlay.innerHTML = `
      <style>
        @keyframes ftx-fade-in{from{opacity:0}to{opacity:1}}
        @keyframes ftx-slide-up{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes ftx-step-in{from{opacity:0;transform:translateX(24px)}to{opacity:1;transform:translateX(0)}}

        #ftx-card{
          background:#0C1929;
          border:1px solid rgba(0,200,232,0.15);
          border-radius:16px;
          width:100%;max-width:480px;
          padding:32px;
          animation:ftx-slide-up .3s ease;
          position:relative;
        }

        .ftx-skip{
          position:absolute;top:16px;right:16px;
          background:none;border:none;cursor:pointer;
          font-size:12px;color:rgba(138,170,200,0.5);
          font-family:inherit;padding:4px 8px;
          transition:color .15s;
        }
        .ftx-skip:hover{color:rgba(138,170,200,0.9)}

        .ftx-steps{
          display:flex;align-items:center;gap:6px;
          margin-bottom:28px;
        }
        .ftx-step-dot{
          width:6px;height:6px;border-radius:50%;
          background:rgba(0,200,232,0.2);
          transition:all .2s;
        }
        .ftx-step-dot.active{
          background:#00C8E8;width:20px;border-radius:3px;
        }
        .ftx-step-dot.done{background:rgba(0,200,112,0.6)}

        .ftx-step{animation:ftx-step-in .25s ease}

        .ftx-logo{
          display:flex;align-items:center;gap:10px;
          margin-bottom:24px;
        }
        .ftx-logo-icon{
          width:40px;height:40px;
          background:rgba(0,200,232,0.1);
          border:1px solid rgba(0,200,232,0.2);
          border-radius:10px;
          display:flex;align-items:center;justify-content:center;
        }
        .ftx-logo-text{font-size:18px;font-weight:600;color:#E8F2FA;letter-spacing:.02em}
        .ftx-logo-sub{
          font-size:9px;font-weight:600;letter-spacing:.1em;
          color:#00C8E8;background:rgba(0,200,232,0.1);
          border:1px solid rgba(0,200,232,0.2);
          padding:2px 6px;border-radius:4px;
        }

        .ftx-eyebrow{
          font-size:11px;font-weight:600;letter-spacing:.1em;
          color:#00C8E8;margin-bottom:8px;
        }
        .ftx-title{
          font-size:22px;font-weight:700;color:#E8F2FA;
          line-height:1.25;margin-bottom:10px;
        }
        .ftx-desc{
          font-size:14px;color:#8AAAC8;line-height:1.6;
          margin-bottom:24px;
        }

        .ftx-form-label{
          font-size:11px;font-weight:600;color:#6A8BA8;
          letter-spacing:.06em;margin-bottom:6px;display:block;
        }
        .ftx-input{
          width:100%;background:rgba(255,255,255,0.05);
          border:1px solid rgba(255,255,255,0.1);
          border-radius:8px;padding:12px 14px;
          font-size:15px;color:#E8F2FA;
          font-family:inherit;outline:none;
          transition:border-color .15s;
          margin-bottom:14px;
        }
        .ftx-input:focus{border-color:rgba(0,200,232,0.5)}
        .ftx-input::placeholder{color:rgba(138,170,200,0.4)}
        .ftx-select{
          width:100%;background:rgba(255,255,255,0.05);
          border:1px solid rgba(255,255,255,0.1);
          border-radius:8px;padding:12px 14px;
          font-size:15px;color:#E8F2FA;
          font-family:inherit;outline:none;
          transition:border-color .15s;
          margin-bottom:14px;
          cursor:pointer;
        }
        .ftx-select:focus{border-color:rgba(0,200,232,0.5)}
        .ftx-select option{background:#0C1929;color:#E8F2FA}

        .ftx-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}

        .ftx-btn-primary{
          width:100%;background:#00C8E8;color:#07111F;
          border:none;border-radius:10px;
          padding:14px;font-size:15px;font-weight:600;
          font-family:inherit;cursor:pointer;
          transition:opacity .15s,transform .1s;
        }
        .ftx-btn-primary:hover{opacity:.92}
        .ftx-btn-primary:active{transform:scale(.99)}
        .ftx-btn-primary:disabled{opacity:.4;cursor:not-allowed}

        .ftx-hint{
          font-size:12px;color:rgba(138,170,200,0.5);
          text-align:center;margin-top:12px;
        }

        .ftx-success-icon{
          width:56px;height:56px;border-radius:50%;
          background:rgba(0,200,112,0.15);
          border:1px solid rgba(0,200,112,0.3);
          display:flex;align-items:center;justify-content:center;
          margin:0 auto 20px;
          font-size:24px;
        }
        .ftx-actions{display:flex;flex-direction:column;gap:10px;margin-top:20px}
        .ftx-btn-sec{
          width:100%;background:transparent;
          border:1px solid rgba(255,255,255,0.1);
          border-radius:10px;padding:13px;
          font-size:14px;color:#8AAAC8;
          font-family:inherit;cursor:pointer;
          transition:border-color .15s,color .15s;
        }
        .ftx-btn-sec:hover{border-color:rgba(255,255,255,0.2);color:#E8F2FA}

        .ftx-value-props{
          display:flex;flex-direction:column;gap:8px;
          margin-bottom:24px;
        }
        .ftx-prop{
          display:flex;align-items:center;gap:10px;
          font-size:13px;color:#8AAAC8;
        }
        .ftx-prop-icon{
          width:28px;height:28px;border-radius:6px;
          background:rgba(0,200,232,0.08);
          border:1px solid rgba(0,200,232,0.15);
          display:flex;align-items:center;justify-content:center;
          font-size:13px;flex-shrink:0;
        }
      </style>

      <div id="ftx-card">
        <button class="ftx-skip" id="ftx-skip-btn">Pular →</button>
        <div class="ftx-steps">
          <div class="ftx-step-dot active" id="ftx-dot-0"></div>
          <div class="ftx-step-dot" id="ftx-dot-1"></div>
          <div class="ftx-step-dot" id="ftx-dot-2"></div>
        </div>
        <div id="ftx-content"></div>
      </div>
    `;

    document.body.appendChild(overlay);

    /* Estado do wizard */
    let step = 0;
    let techName = Profile.get()?.nome || '';
    let equipData = {};

    const contentEl = overlay.querySelector('#ftx-content');

    const setDots = (current) => {
      [0,1,2].forEach(i => {
        const dot = overlay.querySelector(`#ftx-dot-${i}`);
        dot.className = 'ftx-step-dot' +
          (i === current ? ' active' : i < current ? ' done' : '');
      });
    };

    /* ── Passo 0: Apresentação ── */
    const renderStep0 = () => {
      setDots(0);
      contentEl.innerHTML = `
        <div class="ftx-step">
          <div class="ftx-logo">
            <div class="ftx-logo-icon">
              <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
                <rect x="1" y="1" width="14" height="14" rx="2" stroke="#00C8E8" stroke-width="1.2"/>
                <circle cx="8" cy="8" r="2.5" stroke="#00C8E8" stroke-width="1.2"/>
                <path d="M8 1v2.5M8 12.5V15M1 8h2.5M12.5 8H15" stroke="#00C8E8" stroke-width="1.2" stroke-linecap="round"/>
              </svg>
            </div>
            <span class="ftx-logo-text">CoolTrack</span>
            <span class="ftx-logo-sub">PRO</span>
          </div>

          <div class="ftx-eyebrow">BEM-VINDO</div>
          <div class="ftx-title">Gestão de manutenção para quem trabalha de verdade.</div>

          <div class="ftx-value-props">
            <div class="ftx-prop">
              <div class="ftx-prop-icon">📄</div>
              Gere relatórios PDF com assinatura do cliente em segundos
            </div>
            <div class="ftx-prop">
              <div class="ftx-prop-icon">🔔</div>
              Nunca mais perca uma preventiva — alertas automáticos
            </div>
            <div class="ftx-prop">
              <div class="ftx-prop-icon">📱</div>
              Registre serviços em campo, funciona sem internet
            </div>
          </div>

          <label class="ftx-form-label">COMO VOCÊ SE CHAMA?</label>
          <input class="ftx-input" id="ftx-nome" type="text"
            placeholder="Seu nome completo..."
            value="${Utils.escapeHtml(techName)}"
            autocomplete="name" />

          <button class="ftx-btn-primary" id="ftx-next-0">
            Continuar →
          </button>
          <div class="ftx-hint">2 minutos para configurar · Sem cartão de crédito</div>
        </div>`;

      const input = overlay.querySelector('#ftx-nome');
      const btn   = overlay.querySelector('#ftx-next-0');

      /* Foco automático */
      setTimeout(() => input?.focus(), 100);

      /* Enter avança */
      input?.addEventListener('keydown', e => { if (e.key === 'Enter') btn.click(); });

      btn.addEventListener('click', () => {
        const nome = input.value.trim();
        if (!nome) {
          input.style.borderColor = 'rgba(224,48,64,0.6)';
          input.placeholder = 'Digite seu nome para continuar';
          input.focus();
          return;
        }
        techName = nome;
        Profile.save({ ...Profile.get(), nome });
        Profile.saveLastTecnico(nome);
        step = 1;
        renderStep1();
      });
    };

    /* ── Passo 1: Cadastrar 1º equipamento ── */
    const renderStep1 = () => {
      setDots(1);
      const firstName = techName.split(' ')[0];

      contentEl.innerHTML = `
        <div class="ftx-step">
          <div class="ftx-eyebrow">PASSO 1 DE 2</div>
          <div class="ftx-title">Qual equipamento você quer monitorar, ${Utils.escapeHtml(firstName)}?</div>
          <div class="ftx-desc">Comece com o mais importante — você pode adicionar mais depois.</div>

          <label class="ftx-form-label">NOME DO EQUIPAMENTO *</label>
          <input class="ftx-input" id="ftx-eq-nome" type="text"
            placeholder="Ex: Split da recepção, Câmara do estoque..."
            autocomplete="off" />

          <label class="ftx-form-label">ONDE ELE FICA? *</label>
          <input class="ftx-input" id="ftx-eq-local" type="text"
            placeholder="Ex: Sala dos fundos, Galpão A, 2º andar..."
            autocomplete="off" />

          <div class="ftx-row">
            <div>
              <label class="ftx-form-label">TIPO</label>
              <select class="ftx-select" id="ftx-eq-tipo">
                <option>Split Hi-Wall</option>
                <option>Split Cassette</option>
                <option>Split Piso Teto</option>
                <option>VRF / VRV</option>
                <option>Chiller</option>
                <option>Fan Coil</option>
                <option>Self Contained</option>
                <option>Roof Top</option>
                <option>Câmara Fria</option>
                <option>Outro</option>
              </select>
            </div>
            <div>
              <label class="ftx-form-label">FLUIDO</label>
              <select class="ftx-select" id="ftx-eq-fluido">
                <option>R-410A</option>
                <option>R-22</option>
                <option>R-32</option>
                <option>R-407C</option>
                <option>R-134A</option>
                <option>R-404A</option>
                <option>Outro</option>
              </select>
            </div>
          </div>

          <button class="ftx-btn-primary" id="ftx-next-1">
            Cadastrar equipamento →
          </button>
          <div class="ftx-hint">Você edita ou exclui a qualquer momento</div>
        </div>`;

      const nomeInput  = overlay.querySelector('#ftx-eq-nome');
      const localInput = overlay.querySelector('#ftx-eq-local');
      const btn        = overlay.querySelector('#ftx-next-1');

      setTimeout(() => nomeInput?.focus(), 100);

      btn.addEventListener('click', () => {
        const nome  = nomeInput.value.trim();
        const local = localInput.value.trim();

        if (!nome) {
          nomeInput.style.borderColor = 'rgba(224,48,64,0.6)';
          nomeInput.focus();
          return;
        }
        if (!local) {
          localInput.style.borderColor = 'rgba(224,48,64,0.6)';
          localInput.focus();
          return;
        }

        equipData = {
          id:     Utils.uid(),
          nome,
          local,
          status: 'ok',
          tag:    '',
          tipo:   overlay.querySelector('#ftx-eq-tipo').value,
          fluido: overlay.querySelector('#ftx-eq-fluido').value,
          modelo: '',
        };

        /* Salva no estado global */
        setState(prev => ({
          ...prev,
          equipamentos: [...prev.equipamentos, equipData],
          tecnicos: prev.tecnicos.includes(techName)
            ? prev.tecnicos
            : [...prev.tecnicos, techName],
        }));

        step = 2;
        renderStep2();
      });
    };

    /* ── Passo 2: Sucesso + ação imediata ── */
    const renderStep2 = () => {
      setDots(2);
      const icon = TIPO_ICON[equipData.tipo] ?? '⚙️';
      const firstName = techName.split(' ')[0];

      contentEl.innerHTML = `
        <div class="ftx-step">
          <div class="ftx-success-icon">✅</div>
          <div class="ftx-eyebrow" style="text-align:center;color:#00C870">TUDO PRONTO</div>
          <div class="ftx-title" style="text-align:center">
            ${icon} ${Utils.escapeHtml(equipData.nome)} cadastrado!
          </div>
          <div class="ftx-desc" style="text-align:center">
            Agora registre o primeiro serviço, ${Utils.escapeHtml(firstName)}.<br>
            O histórico começa aqui.
          </div>

          <div class="ftx-actions">
            <button class="ftx-btn-primary" id="ftx-go-registro">
              Registrar primeiro serviço →
            </button>
            <button class="ftx-btn-sec" id="ftx-go-dashboard">
              Ver o painel primeiro
            </button>
          </div>

          <div class="ftx-hint" style="margin-top:16px">
            Dica: quanto mais você registra, mais preciso fica o score de eficiência
          </div>
        </div>`;

      overlay.querySelector('#ftx-go-registro').addEventListener('click', () => {
        _dismiss(overlay);
        /* Pré-seleciona o equipamento recém-criado */
        requestAnimationFrame(() => {
          goTo('registro');
          setTimeout(() => {
            const sel = document.getElementById('r-equip');
            if (sel) sel.value = equipData.id;
            const tecInput = document.getElementById('r-tecnico');
            if (tecInput && !tecInput.value) tecInput.value = techName;
          }, 150);
        });
      });

      overlay.querySelector('#ftx-go-dashboard').addEventListener('click', () => {
        _dismiss(overlay);
        goTo('inicio');
        setTimeout(() => {
          import('../views/dashboard.js').then(({ renderDashboard, updateHeader }) => {
            updateHeader();
            renderDashboard();
          });
        }, 250);
      });
    }; // ← fecha o renderStep2 que estava faltando

    /* Skip */
    overlay.querySelector('#ftx-skip-btn').addEventListener('click', () => {
      _dismiss(overlay);
    });

    /* Render inicial */
    renderStep0();
  },

};

/* ── Fechar overlay ── */
function _dismiss(overlay) {
  localStorage.setItem(FTX_KEY, '1');
  overlay.style.animation = 'ftx-fade-in .2s ease reverse';
  setTimeout(() => overlay.remove(), 200);
}