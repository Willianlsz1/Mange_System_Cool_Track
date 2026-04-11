const GUEST_MODE_KEY = 'cooltrack-guest-mode';
const GUEST_ACTIONS_KEY = 'cooltrack-guest-actions';
const CTA_MILESTONES = new Set([3, 7, 12, 20]);

function parseCount(rawValue) {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.floor(parsed);
}

export const GuestTracker = {
  increment() {
    const next = this.getCount() + 1;
    localStorage.setItem(GUEST_ACTIONS_KEY, String(next));
    return next;
  },

  getCount() {
    return parseCount(localStorage.getItem(GUEST_ACTIONS_KEY));
  },

  shouldShowCta() {
    return CTA_MILESTONES.has(this.getCount());
  },

  isGuest() {
    return localStorage.getItem(GUEST_MODE_KEY) === '1';
  },
};
