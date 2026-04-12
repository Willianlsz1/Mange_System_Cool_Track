/**
 * SupportFeedbackModal — Modal de suporte e feedback do usuário.
 * Acessível via menu de ajuda (?) no header.
 */

import { Toast } from '../../core/toast.js';

const MODAL_ID = 'support-feedback-modal-overlay';
const LS_KEY = 'cooltrack-feedback-history';

const SUPPORT_EMAIL = 'suporte@cooltrackpro.com.br';
const SUPPORT_WHATSAPP = '5531999999999'; // substitua pelo número real

function saveFeedback(rating, message) {
  try {
    const history = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
    history.push({ rating, message, date: new Date().toISOString() });
    localStorage.setItem(LS_KEY, JSON.stringify(history.slice(-50)));
  } catch (_) {
    /* ignora */
  }
}

function closeModal() {
  document.getElementById(MODAL_ID)?.remove();
  document.removeEventListener('keydown', _escHandler);
}

function _escHandler(e) {
  if (e.key === 'Escape') closeModal();
}

export const SupportFeedbackModal = {
  open(tab = 'suporte') {
    document.getElementById(MODAL_ID)?.remove();

    const overlay = document.createElement('div');
    overlay.id = MODAL_ID;
    overlay.className = 'modal-overlay is-open sfm-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Suporte e Feedback');

    overlay.innerHTML = `
      <div class="modal sfm-modal">

        <!-- Tabs -->
        <div class="sfm-tabs">
          <button type="button" class="sfm-tab ${tab === 'suporte' ? 'is-active' : ''}"
            data-tab="suporte">💬 Suporte</button>
          <button type="button" class="sfm-tab ${tab === 'feedback' ? 'is-active' : ''}"
            data-tab="feedback">⭐ Feedback</button>
          <button type="button" class="sfm-close" aria-label="Fechar">✕</button>
        </div>

        <!-- Painel Suporte -->
        <div class="sfm-panel ${tab === 'suporte' ? 'is-active' : ''}" data-panel="suporte">
          <div class="sfm-support-header">
            <div class="sfm-support-icon">🛠️</div>
            <div>
              <div class="sfm-support-title">Central de Suporte</div>
              <div class="sfm-support-sub">Nossa equipe responde em até 24h úteis</div>
            </div>
          </div>

          <div class="sfm-contact-cards">
            <a class="sfm-contact-card sfm-contact-card--whatsapp"
               href="https://wa.me/${SUPPORT_WHATSAPP}?text=Ol%C3%A1%2C+preciso+de+ajuda+com+o+CoolTrack+Pro"
               target="_blank" rel="noopener">
              <span class="sfm-contact-card__icon">📱</span>
              <div>
                <div class="sfm-contact-card__title">WhatsApp</div>
                <div class="sfm-contact-card__desc">Resposta mais rápida</div>
              </div>
              <span class="sfm-contact-card__arrow">→</span>
            </a>
            <a class="sfm-contact-card sfm-contact-card--email"
               href="mailto:${SUPPORT_EMAIL}?subject=Suporte%20CoolTrack%20Pro"
               target="_blank" rel="noopener">
              <span class="sfm-contact-card__icon">✉️</span>
              <div>
                <div class="sfm-contact-card__title">E-mail</div>
                <div class="sfm-contact-card__desc">${SUPPORT_EMAIL}</div>
              </div>
              <span class="sfm-contact-card__arrow">→</span>
            </a>
          </div>

          <div class="sfm-faq-hint">
            <span>💡</span>
            <span>Ao entrar em contato, informe seu e-mail cadastrado e descreva o problema com detalhes.</span>
          </div>
        </div>

        <!-- Painel Feedback -->
        <div class="sfm-panel ${tab === 'feedback' ? 'is-active' : ''}" data-panel="feedback">
          <div class="sfm-feedback-header">
            <div class="sfm-support-title">O que você acha do CoolTrack?</div>
            <div class="sfm-support-sub">Sua opinião nos ajuda a melhorar</div>
          </div>

          <div class="sfm-stars" role="group" aria-label="Avaliação de 1 a 5 estrelas">
            ${[1, 2, 3, 4, 5]
              .map(
                (n) => `
              <button type="button" class="sfm-star" data-value="${n}" aria-label="${n} estrela${n > 1 ? 's' : ''}">★</button>
            `,
              )
              .join('')}
          </div>
          <div class="sfm-rating-label" id="sfm-rating-label"></div>

          <textarea class="sfm-textarea" id="sfm-message" rows="4"
            placeholder="Conte o que está funcionando bem, o que pode melhorar, ou sugira uma funcionalidade…"></textarea>

          <button type="button" class="btn btn--primary sfm-submit" id="sfm-submit-btn" disabled>
            Enviar feedback
          </button>
        </div>

      </div>
    `;

    // Tab switching
    overlay.querySelectorAll('.sfm-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.tab;
        overlay
          .querySelectorAll('.sfm-tab')
          .forEach((t) => t.classList.toggle('is-active', t.dataset.tab === target));
        overlay
          .querySelectorAll('.sfm-panel')
          .forEach((p) => p.classList.toggle('is-active', p.dataset.panel === target));
      });
    });

    // Close
    overlay.querySelector('.sfm-close').addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });
    document.addEventListener('keydown', _escHandler);

    // Stars
    const LABELS = ['', 'Muito ruim 😞', 'Ruim 😕', 'Regular 😐', 'Bom 😊', 'Excelente! 🤩'];
    let selectedRating = 0;
    const stars = overlay.querySelectorAll('.sfm-star');
    const ratingLabel = overlay.querySelector('#sfm-rating-label');
    const submitBtn = overlay.querySelector('#sfm-submit-btn');

    const updateStars = (val) => {
      stars.forEach((s) => {
        const v = Number(s.dataset.value);
        s.classList.toggle('is-active', v <= val);
        s.classList.toggle('is-hover', false);
      });
      ratingLabel.textContent = LABELS[val] || '';
    };

    stars.forEach((star) => {
      const val = Number(star.dataset.value);
      star.addEventListener('mouseenter', () => {
        stars.forEach((s) => s.classList.toggle('is-hover', Number(s.dataset.value) <= val));
      });
      star.addEventListener('mouseleave', () => {
        stars.forEach((s) => s.classList.remove('is-hover'));
      });
      star.addEventListener('click', () => {
        selectedRating = val;
        updateStars(val);
        submitBtn.disabled = false;
      });
    });

    // Submit
    submitBtn.addEventListener('click', () => {
      const message = overlay.querySelector('#sfm-message').value.trim();
      saveFeedback(selectedRating, message);
      closeModal();
      Toast.success('Obrigado pelo feedback! 🙏 Sua opinião é muito valiosa.');
    });

    document.body.appendChild(overlay);
  },
};
