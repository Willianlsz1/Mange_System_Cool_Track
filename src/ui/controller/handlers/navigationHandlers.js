import { on } from '../../../core/events.js';
import { Modal } from '../../../core/modal.js';
import { goTo } from '../../../core/router.js';
import { Photos } from '../../components/photos.js';
import { Toast } from '../../../core/toast.js';
import { Tour } from '../../components/tour.js';

function setHelpMenuState(open) {
  const menu = document.getElementById('header-help-menu');
  const trigger = document.getElementById('header-help-btn');
  if (!menu || !trigger) return;
  menu.hidden = !open;
  trigger.setAttribute('aria-expanded', String(open));
  trigger.classList.toggle('is-active', open);
}

export function bindNavigationHandlers() {
  if (!document.body.dataset.helpMenuBound) {
    document.body.dataset.helpMenuBound = '1';
    document.addEventListener('click', (event) => {
      const insideHelp = event.target.closest('.header-help');
      if (!insideHelp) setHelpMenuState(false);
    });
  }

  on('open-modal', (el) => Modal.open(el.dataset.id));
  on('close-modal', (el) => Modal.close(el.dataset.id));
  on('toggle-help-menu', () => {
    const menu = document.getElementById('header-help-menu');
    if (!menu) return;
    setHelpMenuState(menu.hidden);
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

  on('print', () => window.print());
  on('close-lightbox', () => Photos.closeLightbox());
}
