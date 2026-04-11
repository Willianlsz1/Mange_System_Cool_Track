import { on } from '../../../core/events.js';
import { Modal } from '../../../core/modal.js';
import { goTo } from '../../../core/router.js';
import { trackEvent } from '../../../core/telemetry.js';
import { Photos } from '../../components/photos.js';
import { Toast } from '../../../core/toast.js';
import { Tour } from '../../components/tour.js';

let isHelpOpen = false;

function setHelpMenuState(open) {
  const menu = document.getElementById('header-help-menu');
  const trigger = document.getElementById('header-help-btn');
  if (!menu || !trigger) return;
  isHelpOpen = Boolean(open);
  menu.hidden = !isHelpOpen;
  trigger.setAttribute('aria-expanded', String(isHelpOpen));
  trigger.classList.toggle('is-active', isHelpOpen);
}

export function bindNavigationHandlers() {
  if (!document.body.dataset.helpMenuBound) {
    document.body.dataset.helpMenuBound = '1';
    document.addEventListener('click', (event) => {
      const insideHelp = event.target.closest('.header-help');
      if (!insideHelp && isHelpOpen) setHelpMenuState(false);
    });

    document.addEventListener('app:route-changed', () => {
      if (isHelpOpen) setHelpMenuState(false);
    });
  }

  on('open-modal', (el) => Modal.open(el.dataset.id));
  on('close-modal', (el) => Modal.close(el.dataset.id));
  on('toggle-help-menu', () => {
    setHelpMenuState(!isHelpOpen);
  });
  on('help-open-tutorial', () => {
    setHelpMenuState(false);
    Tour.restart();
  });
  on('help-score-info', () => {
    setHelpMenuState(false);
    Toast.info('O score combina criticidade, histórico e recorrência para priorizar o risco.');
  });
  on('help-support', () => {
    setHelpMenuState(false);
    Toast.info('Suporte em breve. Use este canal para dúvidas operacionais.');
  });

  on('go-register-equip', (el) => {
    Modal.close('modal-eq-det');
    goTo('registro', { equipId: el.dataset.id });
  });

  on('edit-reg', (el) => {
    goTo('registro', { editRegistroId: el.dataset.id });
  });

  on('go-alertas', () => {
    goTo('alertas');
  });

  on('go-equipamentos-preventiva-7d', () => {
    goTo('equipamentos', { statusFilter: 'preventiva-7d' });
  });

  on('print', () => window.print());
  on('close-lightbox', () => Photos.closeLightbox());
  on('open-upgrade', async (el, event) => {
    event?.preventDefault?.();
    const source = ['usage_meter', 'upgrade_nudge', 'dashboard'].includes(
      el?.dataset?.upgradeSource,
    )
      ? el.dataset.upgradeSource
      : 'dashboard';
    trackEvent('upgrade_cta_clicked', { source });
    const { goTo: dynamicGoTo } = await import('../../../core/router.js');
    dynamicGoTo('pricing', { highlightPlan: 'pro' });
  });
}
