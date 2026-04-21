/**
 * Post-Save Registro Toast — feedback rico que substitui o `Toast.success`
 * genérico pós-`saveRegistro()` e a dica viral "a cada 3 registros".
 *
 * Intenção (Opção A do roteiro #8): não gera PDF nem dispara WhatsApp aqui.
 * Os dois CTAs apenas NAVEGAM pra view de relatório pré-filtrada pelo
 * equipamento em que o serviço foi feito. O consumo de quota (Free: 2 PDFs,
 * 3 WhatsApps/mês) continua acontecendo no momento do export real, onde o
 * gate atual já vive — isso evita consumir cota silenciosamente no save.
 *
 * Telemetria: `post_save_export_cta_clicked` com `destination=pdf|whatsapp`
 * pra medir se esse toast realmente move uso (hipótese: sim, especialmente
 * no Free, porque hoje o técnico salva e nunca entra em relatório).
 *
 * Visual: reutiliza `.share-success-toast` (verde #00c870, posicionamento e
 * animação idênticos) e adiciona `--with-actions` + `__actions` pra abrigar
 * os dois botões. Dismissa em 8s (mais que os 6s default porque agora há
 * uma decisão a tomar).
 */

import { goTo } from '../../core/router.js';
import { trackEvent } from '../../core/telemetry.js';

let activeToast = null;

function removeToast(toast) {
  if (!(toast instanceof HTMLElement) || !toast.parentNode) return;
  const timeoutId = Number.parseInt(toast.dataset.timeoutId || '', 10);
  if (Number.isFinite(timeoutId)) clearTimeout(timeoutId);

  toast.classList.remove('share-success-toast--visible');
  toast.classList.add('share-success-toast--hiding');

  const onTransitionEnd = () => {
    toast.removeEventListener('transitionend', onTransitionEnd);
    if (toast.parentNode) toast.parentNode.removeChild(toast);
    if (activeToast === toast) activeToast = null;
  };

  toast.addEventListener('transitionend', onTransitionEnd);
}

function createActionButton({ label, destination, equipId, toast }) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `share-success-toast__action share-success-toast__action--${destination}`;
  btn.textContent = label;
  btn.setAttribute('data-destination', destination);

  btn.addEventListener('click', () => {
    trackEvent('post_save_export_cta_clicked', { destination });
    // Navega pra relatório pré-filtrado. A gate de plano vive dentro dos
    // handlers export-pdf / whatsapp-export — aqui só leva o usuário até lá.
    goTo('relatorio', { equipId, intent: destination });
    removeToast(toast);
  });

  return btn;
}

function createToast({ equipName, equipId }) {
  const toast = document.createElement('div');
  toast.className = 'share-success-toast share-success-toast--with-actions';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.setAttribute('aria-atomic', 'true');
  toast.dataset.testid = 'post-save-registro-toast';

  const icon = document.createElement('span');
  icon.className = 'share-success-toast__icon';
  icon.textContent = '✔️';
  icon.setAttribute('aria-hidden', 'true');

  const content = document.createElement('div');
  content.className = 'share-success-toast__content';

  const title = document.createElement('p');
  title.className = 'share-success-toast__title';
  // Se não temos o nome do equipamento (edge case: state desatualizado),
  // caímos num título genérico ao invés de "Serviço registrado em —".
  title.textContent = equipName
    ? `Serviço registrado em ${equipName}`
    : 'Serviço registrado com sucesso.';

  const subtitle = document.createElement('p');
  subtitle.className = 'share-success-toast__subtitle';
  subtitle.textContent = 'Mandar o relatório pro cliente?';

  const actions = document.createElement('div');
  actions.className = 'share-success-toast__actions';

  const pdfBtn = createActionButton({
    label: 'Gerar PDF',
    destination: 'pdf',
    equipId,
    toast,
  });
  const whatsBtn = createActionButton({
    label: 'WhatsApp',
    destination: 'whatsapp',
    equipId,
    toast,
  });
  actions.append(pdfBtn, whatsBtn);

  content.append(title, subtitle, actions);
  toast.append(icon, content);

  return toast;
}

export const PostSaveRegistroToast = {
  /**
   * @param {{ equipId?: string|null, equipName?: string|null, dismissMs?: number }} opts
   */
  show({ equipId = null, equipName = null, dismissMs = 8000 } = {}) {
    // Sem equipId não dá pra pré-filtrar o relatório — cai num toast sem
    // CTAs pra não prometer algo que não vai funcionar direito.
    if (!equipId) {
      return null;
    }

    if (activeToast) removeToast(activeToast);

    const toast = createToast({ equipName, equipId });
    document.body.appendChild(toast);
    activeToast = toast;

    requestAnimationFrame(() => {
      toast.classList.add('share-success-toast--visible');
    });

    const timeoutId = window.setTimeout(() => removeToast(toast), dismissMs);
    toast.dataset.timeoutId = String(timeoutId);

    return toast;
  },
};

export default PostSaveRegistroToast;
