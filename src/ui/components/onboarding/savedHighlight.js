const HIGHLIGHT_KEY = 'cooltrack-highlight-id';

export const SavedHighlight = {
  markForHighlight(id) {
    sessionStorage.setItem(HIGHLIGHT_KEY, id);
  },
  applyIfPending() {
    const id = sessionStorage.getItem(HIGHLIGHT_KEY);
    if (!id) return;
    sessionStorage.removeItem(HIGHLIGHT_KEY);
    requestAnimationFrame(() => {
      const el = Array.from(document.querySelectorAll('[data-reg-id]')).find(
        (node) => node.getAttribute('data-reg-id') === id,
      );
      if (!el) return;
      el.classList.add('timeline__item--saved');
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => el.classList.remove('timeline__item--saved'), 3000);
    });
  },
};
