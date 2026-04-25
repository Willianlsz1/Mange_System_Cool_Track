import { describe, expect, it } from 'vitest';

import {
  STUCK_THRESHOLD_MS,
  isClaimStuck,
} from '../../supabase/functions/stripe-webhook/idempotency.ts';

describe('stripe-webhook idempotency — isClaimStuck', () => {
  const NOW = new Date('2026-04-25T12:00:00.000Z');

  it('returns true para claim antigo (> threshold padrão de 5 min)', () => {
    const claimedAt = new Date(NOW.getTime() - 10 * 60 * 1000).toISOString();
    expect(isClaimStuck(claimedAt, NOW)).toBe(true);
  });

  it('returns false para claim recente (< threshold)', () => {
    const claimedAt = new Date(NOW.getTime() - 30 * 1000).toISOString();
    expect(isClaimStuck(claimedAt, NOW)).toBe(false);
  });

  it('returns false exatamente no threshold (boundary é "não-stuck")', () => {
    const claimedAt = new Date(NOW.getTime() - STUCK_THRESHOLD_MS).toISOString();
    // STUCK_THRESHOLD_MS == diff: now - claimed > threshold é false
    expect(isClaimStuck(claimedAt, NOW)).toBe(false);
  });

  it('returns true 1ms acima do threshold', () => {
    const claimedAt = new Date(NOW.getTime() - STUCK_THRESHOLD_MS - 1).toISOString();
    expect(isClaimStuck(claimedAt, NOW)).toBe(true);
  });

  it('respeita threshold customizado', () => {
    const claimedAt = new Date(NOW.getTime() - 2 * 60 * 1000).toISOString();
    // 2 minutos atrás. Default (5min) → false. Custom 1min → true.
    expect(isClaimStuck(claimedAt, NOW)).toBe(false);
    expect(isClaimStuck(claimedAt, NOW, 60 * 1000)).toBe(true);
  });

  it('returns false para null (sem registro de claim)', () => {
    expect(isClaimStuck(null, NOW)).toBe(false);
  });

  it('returns false para undefined', () => {
    expect(isClaimStuck(undefined, NOW)).toBe(false);
  });

  it('returns false para string vazia', () => {
    expect(isClaimStuck('', NOW)).toBe(false);
  });

  it('returns false para ISO mal-formado (fail-safe)', () => {
    expect(isClaimStuck('not-a-date', NOW)).toBe(false);
    expect(isClaimStuck('2026-13-99T99:99:99Z', NOW)).toBe(false);
  });

  it('STUCK_THRESHOLD_MS é 5 minutos', () => {
    expect(STUCK_THRESHOLD_MS).toBe(5 * 60 * 1000);
  });
});
