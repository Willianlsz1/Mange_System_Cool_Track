/**
 * CoolTrack Pro - Toast Notification System v1.0
 * Sistema de notificações slide-in com auto-dismiss
 */

const TOAST_CONFIG = {
  duration: 3000,
  position: 'top-right',
  maxVisible: 5
};

let toastContainer = null;
let activeToasts = [];

function getContainer() {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

function createToast(message, type = 'info') {
  const container = getContainer();
  
  if (activeToasts.length >= TOAST_CONFIG.maxVisible) {
    const oldestToast = activeToasts.shift();
    if (oldestToast) removeToast(oldestToast);
  }

  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.innerHTML = `
    <span class="toast__icon">${icons[type] || icons.info}</span>
    <span class="toast__message">${escapeHtml(message)}</span>
    <button class="toast__close" aria-label="Fechar notificação">✕</button>
  `;

  const closeBtn = toast.querySelector('.toast__close');
  closeBtn.addEventListener('click', () => removeToast(toast));

  container.appendChild(toast);
  activeToasts.push(toast);

  requestAnimationFrame(() => toast.classList.add('is-visible'));

  const timeoutId = setTimeout(() => removeToast(toast), TOAST_CONFIG.duration);
  toast.dataset.timeoutId = timeoutId;

  return toast;
}

function removeToast(toast) {
  if (!toast || !toast.parentNode) return;
  if (toast.dataset.timeoutId) clearTimeout(parseInt(toast.dataset.timeoutId));
  
  toast.classList.remove('is-visible');
  toast.classList.add('is-hiding');

  setTimeout(() => {
    if (toast.parentNode) toast.parentNode.removeChild(toast);
    const index = activeToasts.indexOf(toast);
    if (index > -1) activeToasts.splice(index, 1);
  }, 300);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export const Toast = {
  success(message) { return createToast(message, 'success'); },
  error(message) { return createToast(message, 'error'); },
  warning(message) { return createToast(message, 'warning'); },
  info(message) { return createToast(message, 'info'); },
  clearAll() { [...activeToasts].forEach(toast => removeToast(toast)); },
  configure(options = {}) { Object.assign(TOAST_CONFIG, options); }
};

export default Toast;