import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockState = { equipamentos: [], registros: [], tecnicos: [] };

vi.mock('../core/state.js', () => ({
  getState: vi.fn(() => mockState),
}));

describe('guestLimits', () => {
  beforeEach(() => {
    localStorage.clear();
    mockState.equipamentos = [];
    mockState.registros = [];
  });

  it('does not block logged users', async () => {
    const { checkGuestLimit } = await import('../core/guestLimits.js');
    expect(checkGuestLimit('equipamentos').blocked).toBe(false);
  });

  it('blocks guest when equipamentos reaches free limit', async () => {
    localStorage.setItem('cooltrack-guest-mode', '1');
    mockState.equipamentos = Array.from({ length: 5 }, (_, i) => ({ id: `e-${i}` }));

    const { checkGuestLimit } = await import('../core/guestLimits.js');
    const result = checkGuestLimit('equipamentos');

    expect(result.blocked).toBe(true);
    expect(result.limit).toBe(5);
    expect(result.current).toBe(5);
  });

  it('blocks guest when registros reaches free limit', async () => {
    localStorage.setItem('cooltrack-guest-mode', '1');
    mockState.registros = Array.from({ length: 10 }, (_, i) => ({ id: `r-${i}` }));

    const { checkGuestLimit } = await import('../core/guestLimits.js');
    const result = checkGuestLimit('registros');

    expect(result.blocked).toBe(true);
    expect(result.limit).toBe(10);
    expect(result.current).toBe(10);
  });
});
