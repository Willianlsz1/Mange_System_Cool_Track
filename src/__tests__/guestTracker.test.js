import { GuestTracker } from '../core/guestTracker.js';

describe('GuestTracker', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('incrementa e retorna contagem', () => {
    expect(GuestTracker.getCount()).toBe(0);
    expect(GuestTracker.increment()).toBe(1);
    expect(GuestTracker.increment()).toBe(2);
    expect(GuestTracker.getCount()).toBe(2);
  });

  it('exibe CTA nos marcos 3, 7, 12 e 20', () => {
    [3, 7, 12, 20].forEach((count) => {
      localStorage.setItem('cooltrack-guest-actions', String(count));
      expect(GuestTracker.shouldShowCta()).toBe(true);
    });

    [1, 2, 4, 8, 13, 21].forEach((count) => {
      localStorage.setItem('cooltrack-guest-actions', String(count));
      expect(GuestTracker.shouldShowCta()).toBe(false);
    });
  });

  it('detecta modo guest pela flag', () => {
    expect(GuestTracker.isGuest()).toBe(false);
    localStorage.setItem('cooltrack-guest-mode', '1');
    expect(GuestTracker.isGuest()).toBe(true);
  });
});
