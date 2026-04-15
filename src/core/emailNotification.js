/**
 * emailNotification.js
 * Envia e-mail de notificação usando a API REST do EmailJS (sem biblioteca extra).
 *
 * Configuração necessária (cole no .env.local ou no painel do Netlify):
 *   VITE_EMAILJS_SERVICE_ID   → ID do serviço Gmail no EmailJS
 *   VITE_EMAILJS_TEMPLATE_ID  → ID do template de feedback no EmailJS
 *   VITE_EMAILJS_PUBLIC_KEY   → Chave pública do EmailJS (aba "Account")
 *
 * Variáveis disponíveis no template EmailJS:
 *   {{app_name}}    — "CoolTrack PRO"
 *   {{rating}}      — nota de 1 a 5
 *   {{stars}}       — estrelas visuais ex.: "★★★★☆"
 *   {{message}}     — texto do usuário (ou "(sem mensagem)")
 *   {{user_email}}  — e-mail do usuário autenticado (ou "anônimo")
 *   {{date}}        — data/hora do envio
 */

const EMAILJS_API = 'https://api.emailjs.com/api/v1.0/email/send';

function buildStars(rating) {
  return '★'.repeat(rating) + '☆'.repeat(5 - rating);
}

/**
 * @param {{ rating: number, message: string, userEmail?: string }} opts
 * @returns {Promise<void>}
 */
export async function sendFeedbackEmail({ rating, message, userEmail = 'anônimo' }) {
  const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
  const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
  const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

  if (!serviceId || !templateId || !publicKey) {
    // EmailJS ainda não configurado — apenas loga em desenvolvimento
    if (import.meta.env.DEV) {
      console.info('[EmailNotification] Variáveis EmailJS não configuradas. E-mail não enviado.', {
        rating,
        message,
        userEmail,
      });
    }
    return;
  }

  const body = {
    service_id: serviceId,
    template_id: templateId,
    user_id: publicKey,
    template_params: {
      app_name: 'CoolTrack PRO',
      rating: String(rating),
      stars: buildStars(rating),
      message: message || '(sem mensagem)',
      user_email: userEmail,
      date: new Date().toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    },
  };

  const res = await fetch(EMAILJS_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    // Não bloqueia o fluxo do usuário — apenas loga o erro
    console.warn(
      '[EmailNotification] Falha ao enviar e-mail via EmailJS:',
      res.status,
      await res.text(),
    );
  }
}
