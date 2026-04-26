/**
 * CoolTrack Tour — redesigned as a slide-modal walkthrough.
 * No more "tap this button" instructions — each step is a self-contained
 * slide with icon, title, description and optional tip.
 */

import { attachDialogA11y } from '../../core/modal.js';

const TOUR_DONE_KEY = 'cooltrack-tour-done';
const TOUR_DONE_KEY_PREFIX = 'ct-tour-done:';

function resolveTourDoneKey(userId) {
  const normalizedUserId = String(userId || '').trim();
  if (!normalizedUserId) return TOUR_DONE_KEY;
  return `${TOUR_DONE_KEY_PREFIX}${normalizedUserId}`;
}

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
    icon: '👋',
    title: 'Bem-vindo ao CoolTrack',
    description:
      'Seu controle de manutenções de climatização — pensado pra quem trabalha em campo. ' +
      'Funciona <strong>online e offline</strong>, então registra serviço sem sinal e ' +
      'sincroniza quando voltar pra área com internet. ' +
      'Em 1 minuto você conhece os recursos principais.',
    tip: null,
  },
  {
    icon: '📋',
    title: 'Registre cada atendimento',
    description:
      'No botão <strong>+ Registrar</strong> da barra inferior, registre cada visita — ' +
      'preventiva, corretiva ou inspeção. Adiciona fotos, lista de peças e assinatura ' +
      'do cliente direto no celular.',
    tip: '💡 Depois de salvar, gere o PDF com 1 toque e envie pelo WhatsApp. O cliente recebe tudo formatado, com fotos e assinatura.',
  },
  {
    icon: '⚙️',
    title: 'Equipamentos com histórico',
    description:
      'Em <strong>Equipamentos</strong>, cadastre splits, chillers e câmaras frias dos clientes. ' +
      'Cada equipamento acumula <strong>histórico completo</strong> de manutenções e a ' +
      '<strong>periodicidade preventiva</strong> avisa antes de vencer.',
    tip: '💡 Marca, modelo e número de série ficam à mão — útil quando o cliente liga perguntando peça de reposição.',
  },
  {
    icon: '🚨',
    title: 'Alertas viram sua agenda',
    description:
      'A aba <strong>Alertas</strong> mostra preventivas perto de vencer e equipamentos ' +
      'com falhas recentes. Abra o app no começo da semana e os alertas viram ' +
      'sua <strong>agenda de visitas</strong> de forma natural.',
    tip: null,
  },
];

export const Tour = {
  stepIndex: 0,
  active: false,
  modalEl: null,
  _a11yCleanup: null,
  _doneKey: TOUR_DONE_KEY,

  initIfFirstVisit({ userId = null } = {}) {
    const doneKey = resolveTourDoneKey(userId);
    this._doneKey = doneKey;

    // Migração legado: se a flag antiga global existia, carrega para a chave
    // por usuário no primeiro boot após hardening.
    if (doneKey !== TOUR_DONE_KEY && localStorage.getItem(TOUR_DONE_KEY) === '1') {
      localStorage.setItem(doneKey, '1');
      localStorage.removeItem(TOUR_DONE_KEY);
    }

    if (localStorage.getItem(doneKey) === '1') return;
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
      localStorage.setItem(this._doneKey || TOUR_DONE_KEY, '1');
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
