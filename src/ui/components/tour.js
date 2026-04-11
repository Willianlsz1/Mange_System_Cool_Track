import { goTo } from '../../core/router.js';

const TOUR_DONE_KEY = 'cooltrack-tour-done';

const STEPS = [
  {
    selector: '#nav-registro',
    text: 'Toque aqui para registrar um serviço',
  },
  {
    selector: '#nav-equipamentos',
    text: 'Cadastre e gerencie equipamentos',
  },
  {
    selector: '#nav-alertas',
    text: 'Veja o que precisa de atenção',
  },
  {
    selector: '#lista-equip .equip-card, #dash-criticos .equip-card',
    route: 'equipamentos',
    text: 'O score indica o risco operacional',
  },
];

function waitFrames(total = 1) {
  return new Promise((resolve) => {
    const tick = (remaining) => {
      if (remaining <= 0) {
        resolve();
        return;
      }
      requestAnimationFrame(() => tick(remaining - 1));
    };
    tick(total);
  });
}

export const Tour = {
  stepIndex: 0,
  active: false,
  overlayEl: null,
  tooltipEl: null,
  currentTarget: null,

  initIfFirstVisit() {
    this.bindHelpButton();

    if (localStorage.getItem(TOUR_DONE_KEY) === '1') return;

    waitFrames(2).then(() => this.start());
  },

  bindHelpButton() {
    // O tour é iniciado pelo handler 'help-open-tutorial' em navigationHandlers.js.
    // Este método é mantido apenas por compatibilidade de chamada.
  },

  restart() {
    this.stop({ keepDoneFlag: true });
    this.start();
  },

  start() {
    if (this.active) return;
    this.active = true;
    this.stepIndex = 0;
    this.createUI();
    this.renderStep();
  },

  stop({ keepDoneFlag = false } = {}) {
    this.active = false;
    this.unhighlightCurrent();
    this.overlayEl?.remove();
    this.overlayEl = null;
    this.tooltipEl = null;

    if (!keepDoneFlag) {
      localStorage.setItem(TOUR_DONE_KEY, '1');
    }
  },

  createUI() {
    this.overlayEl?.remove();

    const overlay = document.createElement('div');
    overlay.className = 'tour-overlay';

    const tooltip = document.createElement('div');
    tooltip.className = 'tour-tooltip';
    tooltip.innerHTML = `
      <div class="tour-tooltip__arrow" aria-hidden="true"></div>
      <div class="tour-tooltip__progress"></div>
      <div class="tour-tooltip__text"></div>
      <div class="tour-tooltip__actions">
        <button type="button" class="btn btn--outline btn--sm" data-tour="prev">Anterior</button>
        <button type="button" class="btn btn--outline btn--sm" data-tour="skip">Pular tour</button>
        <button type="button" class="btn btn--primary btn--sm" data-tour="next">Próximo</button>
      </div>
    `;

    overlay.appendChild(tooltip);
    document.body.appendChild(overlay);

    tooltip.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-tour]');
      if (!btn) return;

      const action = btn.dataset.tour;
      if (action === 'prev') this.prev();
      if (action === 'next') this.next();
      if (action === 'skip') this.finish();
    });

    this.overlayEl = overlay;
    this.tooltipEl = tooltip;
  },

  async renderStep() {
    if (!this.active) return;

    const step = STEPS[this.stepIndex];
    if (!step) {
      this.finish();
      return;
    }

    if (step.route) {
      goTo(step.route);
      await waitFrames(2);
    }

    const target = document.querySelector(step.selector);
    if (!target) {
      this.next(true);
      return;
    }

    this.unhighlightCurrent();
    this.currentTarget = target;
    target.classList.add('tour-highlight');
    target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });

    const progress = this.tooltipEl.querySelector('.tour-tooltip__progress');
    const text = this.tooltipEl.querySelector('.tour-tooltip__text');
    const nextBtn = this.tooltipEl.querySelector('[data-tour="next"]');
    const prevBtn = this.tooltipEl.querySelector('[data-tour="prev"]');

    progress.textContent = `Passo ${this.stepIndex + 1} de ${STEPS.length}`;
    text.textContent = step.text;
    prevBtn.disabled = this.stepIndex === 0;
    nextBtn.textContent = this.stepIndex === STEPS.length - 1 ? 'Finalizar' : 'Próximo';

    this.positionTooltip(target);
  },

  positionTooltip(target) {
    const rect = target.getBoundingClientRect();
    const tooltip = this.tooltipEl;
    const arrow = tooltip.querySelector('.tour-tooltip__arrow');

    tooltip.classList.remove('tour-tooltip--top', 'tour-tooltip--bottom');

    const spacing = 14;
    const topSpace = rect.top;
    const bottomSpace = window.innerHeight - rect.bottom;
    const placeBottom = bottomSpace >= topSpace;

    requestAnimationFrame(() => {
      const ttRect = tooltip.getBoundingClientRect();

      let top = placeBottom ? rect.bottom + spacing : rect.top - ttRect.height - spacing;

      let left = rect.left + rect.width / 2 - ttRect.width / 2;
      left = Math.max(12, Math.min(left, window.innerWidth - ttRect.width - 12));
      top = Math.max(12, Math.min(top, window.innerHeight - ttRect.height - 12));

      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;

      const arrowLeft = Math.max(
        18,
        Math.min(rect.left + rect.width / 2 - left, ttRect.width - 18),
      );
      arrow.style.left = `${arrowLeft}px`;

      tooltip.classList.add(placeBottom ? 'tour-tooltip--bottom' : 'tour-tooltip--top');
    });
  },

  unhighlightCurrent() {
    if (!this.currentTarget) return;
    this.currentTarget.classList.remove('tour-highlight');
    this.currentTarget = null;
  },

  next(isInternalSkip = false) {
    if (!isInternalSkip && this.stepIndex >= STEPS.length - 1) {
      this.finish();
      return;
    }

    this.stepIndex += 1;
    this.renderStep();
  },

  prev() {
    if (this.stepIndex === 0) return;
    this.stepIndex -= 1;
    this.renderStep();
  },

  finish() {
    this.stop();
  },
};
