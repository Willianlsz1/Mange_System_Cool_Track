import { on } from '../../../core/events.js';
import { Modal } from '../../../core/modal.js';
import { goTo } from '../../../core/router.js';
import { Photos } from '../../components/photos.js';

export function bindNavigationHandlers() {
  on('open-modal', (el) => Modal.open(el.dataset.id));
  on('close-modal', (el) => Modal.close(el.dataset.id));

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
