/**
 * CoolTrack Tour — redesigned as a slide-modal walkthrough.
 * No more "tap this button" instructions — each step is a self-contained
 * slide with icon, title, description and optional tip.
 */

const TOUR_DONE_KEY = 'cooltrack-tour-done';

const STEPS = [
  {
    icon: '🧊',
    title: 'Bem-vindo ao CoolTrack',
    description:
      'Seu sistema de gestão de manutenção para técnicos de climatização. ' +
      'Este tour rápido mostra as 3 funções principais do app.',
    tip: null,
    color: '#00c8e8',
  },
  {
    icon: '📋',
    title: 'Registre manutenções',
    description:
      'Toque em <strong>+ Registrar</strong> (barra inferior) para registrar qualquer serviço: ' +
      'corretiva, preventiva ou visita técnica. Adicione fotos, peças e assinatura do cliente.',
    tip: '💡 Você pode gerar um relatório PDF direto do registro, pronto para enviar pelo WhatsApp.',
    color: '#00c8e8',
  },
  {
    icon: '⚙️',
    title: 'Gerencie equipamentos',
    description:
      'Em <strong>Equip.</strong> você cadastra todos os equipamentos do seu cliente: splits, ' +
      'chillers, câmaras frias e mais. Cada equipamento tem histórico completo e score de risco.',
    tip: '💡 O score sobe quando há anomalias ou preventivas vencidas — assim você prioriza o que importa.',
    color: '#f59e0b',
  },
  {
    icon: '🚨',
    title: 'Fique de olho nos alertas',
    description:
      'A aba <strong>Alertas</strong> mostra equipamentos com falhas críticas ou preventivas ' +
      'próximas do vencimento. O painel já abre com os mais urgentes em destaque.',
    tip: '💡 Configure a periodicidade preventiva de cada equipamento para nunca perder um prazo.',
    color: '#ef4444',
  },
];

export const Tour = {
  stepIndex: 0,
  active: false,
  modalEl: null,

  initIfFirstVisit() {
    if (localStorage.getItem(TOUR_DONE_KEY) === '1') return;
    // Small delay so the dashboard renders first
    setTimeout(() => this.start(), 600);
  },

  // Kept as no-op for backward compatibility
  bindHelpButton() {},

  restart() {
    this.stop({ keepDoneFlag: true });
    this.start();
  },

  start() {
    if (this.active) return;
    this.active = true;
    this.stepIndex = 0;
    this._build();
    this._render();
  },

  stop({ keepDoneFlag = false } = {}) {
    this.active = false;
    this.modalEl?.remove();
    this.modalEl = null;
    if (!keepDoneFlag) {
      localStorage.setItem(TOUR_DONE_KEY, '1');
    }
  },

  finish() {
    this.stop();
  },

  _build() {
    this.modalEl?.remove();

    const el = document.createElement('div');
    el.id = 'tour-modal';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Tour de introdução');
    el.innerHTML = `
      <style>
        #tour-modal {
          position: fixed; inset: 0; z-index: 8000;
          display: flex; align-items: center; justify-content: center;
          padding: 16px;
          background: rgba(4, 9, 18, 0.82);
          backdrop-filter: blur(6px);
          animation: tour-fade-in .25s ease;
        }
        @keyframes tour-fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }

        .tour-card {
          width: 100%; max-width: 440px;
          background: #0d1e30;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 20px;
          box-shadow: 0 24px 64px rgba(0,0,0,0.6);
          overflow: hidden;
          animation: tour-slide-up .3s ease;
        }
        @keyframes tour-slide-up {
          from { transform: translateY(20px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }

        /* Top accent bar */
        .tour-card__bar {
          height: 3px;
          background: linear-gradient(90deg, var(--tour-color, #00c8e8), transparent);
          transition: background .4s;
        }

        /* Body */
        .tour-card__body {
          padding: 36px 32px 28px;
          text-align: center;
        }

        .tour-card__icon {
          font-size: 52px; line-height: 1;
          margin-bottom: 20px;
          display: block;
          filter: drop-shadow(0 0 18px var(--tour-color, #00c8e8));
          animation: tour-bounce .5s ease;
        }
        @keyframes tour-bounce {
          0%   { transform: scale(.7); opacity: 0; }
          60%  { transform: scale(1.08); }
          100% { transform: scale(1); opacity: 1; }
        }

        .tour-card__title {
          font-size: 20px; font-weight: 700;
          color: #e8f4fc; margin-bottom: 12px; letter-spacing: -.3px;
        }

        .tour-card__desc {
          font-size: 14px; color: #7a9bb8; line-height: 1.6;
          margin-bottom: 0;
        }
        .tour-card__desc strong { color: #c8dce8; font-weight: 600; }

        .tour-card__tip {
          margin-top: 16px; padding: 12px 14px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 10px;
          font-size: 12px; color: #5a8aaa; line-height: 1.5;
          text-align: left;
        }

        /* Progress dots */
        .tour-dots {
          display: flex; justify-content: center; gap: 7px;
          padding: 0 32px 4px;
        }
        .tour-dot {
          width: 7px; height: 7px; border-radius: 4px;
          background: rgba(255,255,255,0.12);
          transition: width .25s, background .25s;
        }
        .tour-dot.active {
          width: 22px;
          background: var(--tour-color, #00c8e8);
        }

        /* Footer actions */
        .tour-card__footer {
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 24px 24px; gap: 8px;
        }

        .tour-btn {
          padding: 10px 18px; border-radius: 9px; cursor: pointer;
          font-size: 14px; font-weight: 500; font-family: inherit;
          border: none; transition: all .18s;
        }
        .tour-btn--ghost {
          background: transparent; color: #3a5870;
        }
        .tour-btn--ghost:hover { color: #6a9ab8; }
        .tour-btn--outline {
          background: transparent;
          border: 1px solid rgba(255,255,255,0.1);
          color: #8aaac8;
        }
        .tour-btn--outline:hover { border-color: rgba(255,255,255,0.2); color: #c8dce8; }
        .tour-btn--primary {
          background: linear-gradient(135deg, var(--tour-color, #00c8e8), #0090c8);
          color: #06101e; font-weight: 600; padding: 10px 24px;
        }
        .tour-btn--primary:hover { opacity: .9; transform: translateY(-1px); }

        @media (max-width: 480px) {
          .tour-card__body { padding: 28px 22px 20px; }
          .tour-card__footer { padding: 12px 16px 20px; }
          .tour-btn { font-size: 13px; padding: 9px 14px; }
        }
      </style>

      <div class="tour-card" id="tour-card-inner">
        <div class="tour-card__bar" id="tour-bar"></div>
        <div class="tour-card__body">
          <span class="tour-card__icon" id="tour-icon"></span>
          <div class="tour-card__title" id="tour-title"></div>
          <div class="tour-card__desc" id="tour-desc"></div>
          <div class="tour-card__tip" id="tour-tip" hidden></div>
        </div>
        <div class="tour-dots" id="tour-dots"></div>
        <div class="tour-card__footer">
          <button class="tour-btn tour-btn--ghost" id="tour-skip">Pular tour</button>
          <div style="display:flex;gap:8px">
            <button class="tour-btn tour-btn--outline" id="tour-prev">Anterior</button>
            <button class="tour-btn tour-btn--primary" id="tour-next">Próximo</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(el);
    this.modalEl = el;

    el.querySelector('#tour-skip').addEventListener('click', () => this.finish());
    el.querySelector('#tour-prev').addEventListener('click', () => this._prev());
    el.querySelector('#tour-next').addEventListener('click', () => this._next());
  },

  _render() {
    if (!this.active || !this.modalEl) return;

    const step = STEPS[this.stepIndex];
    const isLast = this.stepIndex === STEPS.length - 1;
    const isFirst = this.stepIndex === 0;

    // Color var
    this.modalEl.style.setProperty('--tour-color', step.color);

    // Content
    this.modalEl.querySelector('#tour-icon').textContent = step.icon;
    this.modalEl.querySelector('#tour-title').textContent = step.title;
    this.modalEl.querySelector('#tour-desc').innerHTML = step.description;

    const tipEl = this.modalEl.querySelector('#tour-tip');
    if (step.tip) {
      tipEl.textContent = step.tip;
      tipEl.hidden = false;
    } else {
      tipEl.hidden = true;
    }

    // Progress dots
    const dotsEl = this.modalEl.querySelector('#tour-dots');
    dotsEl.innerHTML = '';
    STEPS.forEach((_, i) => {
      const d = document.createElement('div');
      d.className = 'tour-dot' + (i === this.stepIndex ? ' active' : '');
      dotsEl.appendChild(d);
    });

    // Buttons
    const prevBtn = this.modalEl.querySelector('#tour-prev');
    const nextBtn = this.modalEl.querySelector('#tour-next');
    prevBtn.disabled = isFirst;
    prevBtn.style.opacity = isFirst ? '0.3' : '1';
    nextBtn.textContent = isLast ? 'Começar a usar 🚀' : 'Próximo';

    // Animate icon on step change
    const iconEl = this.modalEl.querySelector('#tour-icon');
    iconEl.style.animation = 'none';
    void iconEl.offsetHeight; // reflow
    iconEl.style.animation = '';
  },

  _next() {
    if (this.stepIndex >= STEPS.length - 1) {
      this.finish();
      return;
    }
    this.stepIndex += 1;
    this._render();
  },

  _prev() {
    if (this.stepIndex === 0) return;
    this.stepIndex -= 1;
    this._render();
  },
};
