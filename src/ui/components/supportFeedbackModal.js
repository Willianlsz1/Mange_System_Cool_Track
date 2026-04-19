/**
 * SupportFeedbackModal — Modal de suporte e feedback do usuário.
 * Acessível via menu de ajuda (?) no header.
 *
 * Aba Suporte: múltiplas formas de contatar o time — copiar e-mail,
 * abrir no Gmail web, no Outlook web, ou no cliente padrão (mailto:).
 * O fallback "copiar" é o mais robusto: funciona mesmo para usuários
 * que não têm nenhum cliente de e-mail configurado no sistema.
 *
 * Aba Feedback — fluxo de envio:
 *  1. Salva no localStorage (histórico local, fallback offline)
 *  2. Insere na tabela `feedback` do Supabase (owner lê no Dashboard)
 *  3. Envia via EmailJS para o e-mail do CoolTrack (automático, silencioso)
 *  4. Se EmailJS não estiver configurado ou falhar, abre `mailto:` com a
 *     mensagem pré-preenchida — garante que o feedback chegue ao time.
 */

import { Toast } from '../../core/toast.js';
import { supabase } from '../../core/supabase.js';
import { buildFeedbackEmailBody, sendFeedbackEmail } from '../../core/emailNotification.js';
import { attachDialogA11y } from '../../core/modal.js';

const MODAL_ID = 'support-feedback-modal-overlay';
const LS_KEY = 'cooltrack-feedback-history';
// Handle do cleanup do focus trap / Escape do overlay atual.
let _a11yCleanup = null;

const SUPPORT_EMAIL = 'suporte@cooltrackpro.com.br';
const SUPPORT_SUBJECT = 'Suporte CoolTrack Pro';
const SUPPORT_BODY =
  'Olá, equipe CoolTrack!\n\n' +
  'Descreva aqui sua dúvida ou problema com detalhes.\n' +
  'Inclua, se possível: e-mail cadastrado, dispositivo (PC/Android/iPhone) e o que estava fazendo.\n\n' +
  '— Enviado pelo CoolTrack Pro';

function buildGmailUrl() {
  const params = new URLSearchParams({
    view: 'cm',
    fs: '1',
    to: SUPPORT_EMAIL,
    su: SUPPORT_SUBJECT,
    body: SUPPORT_BODY,
  });
  return `https://mail.google.com/mail/?${params.toString()}`;
}

function buildOutlookUrl() {
  const params = new URLSearchParams({
    path: '/mail/action/compose',
    to: SUPPORT_EMAIL,
    subject: SUPPORT_SUBJECT,
    body: SUPPORT_BODY,
  });
  return `https://outlook.live.com/mail/0/deeplink/compose?${params.toString()}`;
}

function buildMailtoUrl() {
  const params = new URLSearchParams({
    subject: SUPPORT_SUBJECT,
    body: SUPPORT_BODY,
  });
  return `mailto:${SUPPORT_EMAIL}?${params.toString()}`;
}

/**
 * Copia uma string para o clipboard. Usa navigator.clipboard quando
 * disponível (HTTPS) e fallback para document.execCommand em contextos
 * inseguros ou navegadores antigos.
 */
async function copyTextToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_err) {
      /* segue pro fallback */
    }
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch (_err) {
    return false;
  }
}

// Açúcar sintático pro caso mais comum — copiar o e-mail de suporte.
function copyEmailToClipboard() {
  return copyTextToClipboard(SUPPORT_EMAIL);
}

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
    return { ok: false, userEmail: user?.email ?? null };
  }
  return { ok: true, userEmail: user?.email ?? null };
}

function closeModal() {
  if (_a11yCleanup) {
    _a11yCleanup();
    _a11yCleanup = null;
  }
  document.getElementById(MODAL_ID)?.remove();
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
            <button type="button" class="sfm-contact-card sfm-contact-card--email" data-action="copy-email">
              <span class="sfm-contact-card__icon">✉️</span>
              <div>
                <div class="sfm-contact-card__title">E-mail de suporte</div>
                <div class="sfm-contact-card__desc">${SUPPORT_EMAIL}</div>
              </div>
              <span class="sfm-contact-card__arrow" aria-hidden="true">📋</span>
            </button>
          </div>

          <div class="sfm-support-actions" role="group" aria-label="Abrir composição de e-mail">
            <button type="button" class="sfm-support-btn" data-action="open-gmail">
              <span aria-hidden="true">📧</span> Gmail
            </button>
            <button type="button" class="sfm-support-btn" data-action="open-outlook">
              <span aria-hidden="true">📨</span> Outlook
            </button>
            <button type="button" class="sfm-support-btn" data-action="open-mailto">
              <span aria-hidden="true">💻</span> App padrão
            </button>
          </div>

          <div class="sfm-faq-hint">
            <span>💡</span>
            <span>Clique no card acima para copiar o e-mail. Depois cole no seu app/webmail preferido. Ao escrever, informe seu e-mail cadastrado e descreva o problema com detalhes.</span>
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

    // Ações do painel de Suporte — copiar e-mail / abrir Gmail / Outlook / mailto
    overlay.querySelector('[data-action="copy-email"]')?.addEventListener('click', async () => {
      const copied = await copyEmailToClipboard();
      if (copied) {
        Toast.success(`E-mail copiado: ${SUPPORT_EMAIL}`);
      } else {
        // Último recurso: mostra o e-mail no toast pra o usuário selecionar/anotar
        Toast.info(`Copie este e-mail: ${SUPPORT_EMAIL}`);
      }
    });

    overlay.querySelector('[data-action="open-gmail"]')?.addEventListener('click', () => {
      window.open(buildGmailUrl(), '_blank', 'noopener');
    });

    overlay.querySelector('[data-action="open-outlook"]')?.addEventListener('click', () => {
      window.open(buildOutlookUrl(), '_blank', 'noopener');
    });

    overlay.querySelector('[data-action="open-mailto"]')?.addEventListener('click', () => {
      // Copia em paralelo — se o mailto falhar (sem cliente configurado),
      // o usuário ainda tem o e-mail no clipboard.
      copyEmailToClipboard();
      window.location.href = buildMailtoUrl();
    });

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

      // 2. Persiste em Supabase — principal canal de entrega pro time. O owner
      //    lê os feedbacks no Dashboard do Supabase, então basta o insert
      //    ter sucesso pra considerar entregue.
      let userEmail = 'anônimo';
      let savedToSupabase = false;
      try {
        const result = await saveToSupabase(selectedRating, message);
        savedToSupabase = !!result?.ok;
        userEmail = result?.userEmail || 'anônimo';
      } catch (_err) {
        /* Supabase offline ou sem sessão — segue o fluxo */
      }

      // 3. Canal adicional: EmailJS (se configurado). Nunca abre cliente de
      //    e-mail do usuário — o usuário pediu pra só escrever e enviar.
      let deliveredByEmail = false;
      try {
        deliveredByEmail = await sendFeedbackEmail({
          rating: selectedRating,
          message,
          userEmail,
        });
      } catch (_err) {
        /* deliveredByEmail fica false */
      }

      closeModal();

      if (savedToSupabase || deliveredByEmail) {
        Toast.success('Obrigado pelo feedback! 🙏 Sua opinião é muito valiosa.');
        return;
      }

      // Tudo falhou (usuário sem internet E sem EmailJS): oferece copiar
      // o feedback formatado para o clipboard, pra o usuário colar depois
      // onde quiser. Sem abrir nenhum app.
      const body = buildFeedbackEmailBody({
        rating: selectedRating,
        message,
        userEmail,
      });
      const copied = await copyTextToClipboard(
        `Para: ${SUPPORT_EMAIL}\nAssunto: Feedback CoolTrack Pro — ${selectedRating}/5\n\n${body}`,
      );
      if (copied) {
        Toast.info(
          'Sem conexão agora. Seu feedback foi copiado — cole no Gmail/Outlook quando voltar a internet.',
        );
      } else {
        Toast.info(
          'Sem conexão. Seu feedback ficou salvo localmente e vamos reenviar automaticamente.',
        );
      }
    });

    document.body.appendChild(overlay);
    _a11yCleanup = attachDialogA11y(overlay, { onDismiss: closeModal });
  },
};
