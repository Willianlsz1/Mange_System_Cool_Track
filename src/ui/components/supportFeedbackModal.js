/**
 * SupportFeedbackModal — Modal de suporte e feedback do usuário.
 * Acessível via menu de ajuda (?) no header.
 *
 * Aba Suporte: link direto para o e-mail do CoolTrack (mailto:).
 * Aba Feedback — fluxo de envio:
 *  1. Salva no localStorage (histórico local, fallback offline)
 *  2. Insere na tabela `feedback` do Supabase (owner lê no Dashboard)
 *  3. Envia via EmailJS para o e-mail do CoolTrack (automático, silencioso)
 *  4. Se EmailJS não estiver configurado ou falhar, abre `mailto:` com a
 *     mensagem pré-preenchida — garante que o feedback chegue ao time.
 */

import { Toast } from '../../core/toast.js';
import { supabase } from '../../core/supabase.js';
import { buildFeedbackMailtoUrl, sendFeedbackEmail } from '../../core/emailNotification.js';

const MODAL_ID = 'support-feedback-modal-overlay';
const LS_KEY = 'cooltrack-feedback-history';

const SUPPORT_EMAIL = 'suporte@cooltrackpro.com.br';

function saveToLocalStorage(rating, message) {
  try {
    const history = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
    history.push({ rating, message, date: new Date().toISOString() });
    localStorage.setItem(LS_KEY, JSON.stringify(history.slice(-50)));
  } catch (_) {
    /* ignora */
  }
}

async function saveToSupabase(rating, message) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from('feedback').insert({
    user_id: user?.id ?? null,
    user_email: user?.email ?? null,
    rating,
    message: message || null,
  });
  if (error) {
    console.warn('[Feedback] Supabase insert error:', error.message);
  }
  return user?.email ?? null;
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
    submitBtn.addEventListener('click', async () => {
      const message = overlay.querySelector('#sfm-message').value.trim();

      // Feedback visual imediato — não espera as chamadas assíncronas
      submitBtn.disabled = true;
      submitBtn.textContent = 'Enviando…';

      // 1. Salva localmente (síncrono, nunca falha)
      saveToLocalStorage(selectedRating, message);

      // 2. Persiste em Supabase e tenta enviar via EmailJS. Se EmailJS estiver
      //    configurado, chega automaticamente no e-mail do CoolTrack.
      //    Se não estiver, caímos para o fallback `mailto:` — abre o cliente
      //    de e-mail do usuário já com assunto e corpo preenchidos, garantindo
      //    que a mensagem chegue ao time mesmo sem backend de e-mail.
      let userEmail = 'anônimo';
      try {
        userEmail = (await saveToSupabase(selectedRating, message)) || 'anônimo';
      } catch (_err) {
        /* Supabase offline ou sem sessão — segue o fluxo */
      }

      let delivered = false;
      try {
        delivered = await sendFeedbackEmail({
          rating: selectedRating,
          message,
          userEmail,
        });
      } catch (_err) {
        // `delivered` já é `false` — cai no fallback mailto
      }

      closeModal();

      if (delivered) {
        Toast.success('Obrigado pelo feedback! 🙏 Sua opinião é muito valiosa.');
      } else {
        // Fallback: abre o cliente de e-mail do usuário pra enviar direto ao CoolTrack
        const mailtoUrl = buildFeedbackMailtoUrl({
          rating: selectedRating,
          message,
          userEmail,
        });
        Toast.info('Abrindo seu e-mail para concluir o envio ao CoolTrack…');
        // Pequeno delay para o Toast renderizar antes do navegador focar o cliente de e-mail
        setTimeout(() => {
          window.location.href = mailtoUrl;
        }, 150);
      }
    });

    document.body.appendChild(overlay);
  },
};
