function freezeWidth(element) {
  if (!(element instanceof HTMLElement)) return;
  const width = Math.ceil(element.getBoundingClientRect().width);
  if (width > 0) element.style.minWidth = `${width}px`;
}

function unfreezeWidth(element) {
  if (!(element instanceof HTMLElement)) return;
  element.style.removeProperty('min-width');
}

export function setActionBusy(element, isBusy, options = {}) {
  if (!(element instanceof HTMLElement)) return () => {};

  if (isBusy) {
    if (element.dataset.busy === '1') return () => {};

    element.dataset.busy = '1';
    element.dataset.idleLabel = element.dataset.idleLabel || element.textContent || '';
    freezeWidth(element);
    element.disabled = true;
    element.setAttribute('aria-busy', 'true');
    element.classList.add('is-busy');

    if (options.loadingLabel) element.textContent = options.loadingLabel;
    return () => setActionBusy(element, false);
  }

  element.disabled = false;
  element.setAttribute('aria-busy', 'false');
  element.classList.remove('is-busy');

  if (Object.prototype.hasOwnProperty.call(element.dataset, 'idleLabel')) {
    element.textContent = element.dataset.idleLabel;
    delete element.dataset.idleLabel;
  }

  delete element.dataset.busy;
  unfreezeWidth(element);
  return () => {};
}

export async function runAsyncAction(element, options, action) {
  if (!(action instanceof Function)) return undefined;
  if (element?.dataset.busy === '1') return undefined;

  const restore = setActionBusy(element, true, options);
  try {
    return await action();
  } finally {
    restore();
  }
}
