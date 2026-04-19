/**
 * PDF Success Toast — espelha o ShareSuccessToast do WhatsApp.
 *
 * Mostrado após gerar um PDF com sucesso. Se o plano tem limite finito (Free/Plus),
 * inclui o contador "X/Y PDFs · restam Z este mês" pra evitar surpresa quando
 * o usuário bater o teto. No Pro (limite infinito) mostra só a mensagem de sucesso.
 */

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

function createToast() {
  const toast = document.createElement('div');
  // Reutilizamos classes do share-success-toast para o mesmo visual e animação.
  toast.className = 'share-success-toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.setAttribute('aria-atomic', 'true');

  const icon = document.createElement('span');
  icon.className = 'share-success-toast__icon';
  icon.textContent = '📄';
  icon.setAttribute('aria-hidden', 'true');

  const content = document.createElement('div');
  content.className = 'share-success-toast__content';

  const title = document.createElement('p');
  title.className = 'share-success-toast__title';
  title.textContent = 'PDF gerado com sucesso.';

  const subtitle = document.createElement('p');
  subtitle.className = 'share-success-toast__subtitle';
  subtitle.textContent = 'Pronto para enviar ao cliente.';

  content.append(title, subtitle);
  toast.append(icon, content);

  return toast;
}

export const PdfSuccessToast = {
  /**
   * @param {{ used?: number|null, limit?: number|null, fileName?: string|null }} opts
   */
  show({ used = null, limit = null, fileName = null } = {}) {
    if (activeToast) removeToast(activeToast);

    const toast = createToast();

    if (fileName) {
      const title = toast.querySelector('.share-success-toast__title');
      if (title) title.textContent = `PDF gerado: ${fileName}`;
    }

    // Contador só aparece quando há limite finito (Free/Plus). Pro fica com o
    // subtítulo default.
    if (Number.isFinite(limit) && used !== null) {
      const remaining = Math.max(0, limit - used);
      const subtitle = toast.querySelector('.share-success-toast__subtitle');
      if (subtitle) {
        subtitle.textContent =
          remaining > 0
            ? `Você usou ${used} de ${limit} PDFs este mês. Restam ${remaining}.`
            : `Você usou todos os ${limit} PDFs do mês. Faça upgrade para PDFs ilimitados.`;
      }
    }

    document.body.appendChild(toast);
    activeToast = toast;

    requestAnimationFrame(() => {
      toast.classList.add('share-success-toast--visible');
    });

    const timeoutId = window.setTimeout(() => removeToast(toast), 6000);
    toast.dataset.timeoutId = String(timeoutId);

    return toast;
  },
};

export default PdfSuccessToast;
