/**
 * CoolTrack Tour — redesigned as a slide-modal walkthrough.
 * No more "tap this button" instructions — each step is a self-contained
 * slide with icon, title, description and optional tip.
 */

import { attachDialogA11y } from '../../core/modal.js';

const TOUR_DONE_KEY = 'cooltrack-tour-done';

function renderDescriptionWithAllowedMarkup(target, rawDescription) {
  if (!target) return;
  target.textContent = '';
  const input = String(rawDescription || '');
  const strongPattern = /<strong>(.*?)<\/strong>/gis;
  let cursor = 0;
  let match = strongPattern.exec(input);

  while (match) {
    const [fullMatch, strongText = ''] = match;
    const matchIndex = match.index ?? cursor;
    if (matchIndex > cursor) {
      target.appendChild(document.createTextNode(input.slice(cursor, matchIndex)));
    }
    const strongEl = document.createElement('strong');
    strongEl.textContent = strongText;
    target.appendChild(strongEl);
    cursor = matchIndex + fullMatch.length;
    match = strongPattern.exec(input);
  }

  if (cursor < input.length) {
    target.appendChild(document.createTextNode(input.slice(cursor)));
  }
}

const STEPS = [
  {
    icon: '🧊',
    title: 'Bem-vindo ao CoolTrack',
    description:
      'Este é o seu controle de manutenções de climatização, pensado pra quem vive no campo. ' +
      'Funciona <strong>online e offline</strong>, então dá pra registrar serviços no meio de uma casa de máquinas ' +
      'sem sinal — tudo sincroniza quando você voltar pra uma área com internet. ' +
      'Em menos de 1 minuto, você vai conhecer os 5 recursos principais do app.',
    tip: null,
    color: '#00c8e8',
  },
  {
    icon: '📋',
    title: 'Registre cada atendimento',
    description:
      'Use o botão <strong>+ Registrar</strong> (na barra inferior) sempre que terminar um serviço — ' +
      'seja uma <strong>corretiva</strong>, uma <strong>preventiva</strong> ou só uma visita técnica. ' +
      'Você anexa fotos, lista as peças usadas e colhe a assinatura do cliente ali mesmo, no celular.',
    tip: '💡 Depois de salvar, gere um PDF do registro com um toque e mande pelo WhatsApp — o cliente recebe tudo formatado, com logo, fotos e assinatura.',
    color: '#00c8e8',
  },
  {
    icon: '⚙️',
    title: 'Organize os equipamentos',
    description:
      'Na aba <strong>Equip.</strong>, cadastre splits, chillers, câmaras frias e VRFs de cada cliente. ' +
      'Cada equipamento acumula seu <strong>histórico completo</strong> e permite configurar a ' +
      '<strong>periodicidade preventiva</strong> (ex: a cada 90 dias), pra o app te avisar antes de vencer.',
    tip: '💡 Marca, modelo e número de série ficam a um clique — útil quando o cliente liga perguntando qual peça de reposição pedir.',
    color: '#f59e0b',
  },
  {
    icon: '🎯',
    title: 'Entenda o Score de Risco',
    description:
      'Cada equipamento recebe uma nota de <strong>0 a 100</strong> — quanto <strong>maior, pior</strong>. ' +
      'O score sobe com anomalias recentes, preventivas vencidas e tempo sem manutenção. ' +
      'Ele cai com um <strong>bônus de histórico bom</strong> (até −18 pts por constância) e vem acompanhado da ' +
      'tendência dos últimos 30 dias: <strong>↓</strong> melhorando, <strong>→</strong> estável, <strong>↑</strong> piorando.',
    tip: '💡 Comece pelos equipamentos em vermelho — o app já mostra os fatores que mais pesaram no cálculo, então você sabe onde agir primeiro.',
    color: '#ef4444',
  },
  {
    icon: '🚨',
    title: 'Não perca prazos com os Alertas',
    description:
      'A aba <strong>Alertas</strong> reúne tudo que precisa da sua atenção: preventivas perto de vencer, ' +
      'equipamentos com falhas recentes e clientes há muito tempo sem atendimento. ' +
      'O painel abre com os casos mais urgentes em destaque e sugere a <strong>próxima ação</strong> recomendada.',
    tip: '💡 Abra o CoolTrack no começo da semana — os alertas viram sua agenda de visitas de forma natural.',
    color: '#ef4444',
  },
  {
    icon: '🚀',
    title: 'Tudo pronto pra começar',
    description:
      'Você entra no plano <strong>Free</strong> já com o essencial pra rodar o dia a dia. ' +
      'Quando precisar de relatórios avançados, múltiplos técnicos ou exportação em massa, dá pra subir pra ' +
      '<strong>Plus</strong> ou <strong>Pro</strong> direto no seu perfil — e voltar atrás a qualquer momento. ' +
      'Se quiser rever este tour depois, ele fica disponível na tela de ajuda.',
    tip: null,
    color: '#10b981',
  },
];

export const Tour = {
  stepIndex: 0,
  active: false,
  modalEl: null,
  _a11yCleanup: null,

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
    if (this._a11yCleanup) {
      this._a11yCleanup();
      this._a11yCleanup = null;
    }
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
          background: transparent; color: var(--muted);
        }
        .tour-btn--ghost:hover { color: var(--text-2); }
        .tour-btn--outline {
          background: transparent;
          border: 1px solid rgba(255,255,255,0.1);
          color: var(--text-2);
        }
        .tour-btn--outline:hover { border-color: rgba(255,255,255,0.2); color: var(--text); }
        .tour-btn--primary {
          background: linear-gradient(135deg, var(--tour-color, var(--primary)), var(--primary-strong));
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

    // A11y: Escape fecha o tour (equivale a "Pular"), e Tab fica preso no modal.
    // Tem tabindex="-1" no el pra aceitar foco programático se nada mais for focável.
    el.tabIndex = -1;
    this._a11yCleanup = attachDialogA11y(el, { onDismiss: () => this.finish() });
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
    renderDescriptionWithAllowedMarkup(this.modalEl.querySelector('#tour-desc'), step.description);

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
