const { trackEvent, authShow } = vi.hoisted(() => ({
  trackEvent: vi.fn(),
  authShow: vi.fn(),
}));

vi.mock('../core/telemetry.js', () => ({ trackEvent }));
vi.mock('../ui/components/authscreen.js', () => ({
  AuthScreen: {
    show: (...args) => authShow(...args),
  },
}));

import { GuestConversionModal } from '../ui/components/guestConversionModal.js';

describe('GuestConversionModal', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    trackEvent.mockReset();
    authShow.mockReset();
  });

  it('rastreia abandono ao fechar pelo overlay', () => {
    GuestConversionModal.open({ source: 'save-equip' });

    const overlay = document.getElementById('guest-conversion-modal');
    overlay.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(trackEvent).toHaveBeenCalledWith('guest_conversion_open', {
      reason: 'save_attempt',
      source: 'save-equip',
    });
    expect(trackEvent).toHaveBeenCalledWith('guest_modal_abandoned', {
      trigger: 'save-equip',
    });
  });

  it('nao rastreia abandono quando usuário escolhe converter', () => {
    GuestConversionModal.open({ source: 'save-registro' });

    document.querySelector('[data-action="google"]')?.click();

    expect(authShow).toHaveBeenCalled();
    expect(trackEvent).not.toHaveBeenCalledWith('guest_modal_abandoned', expect.any(Object));
  });
});
