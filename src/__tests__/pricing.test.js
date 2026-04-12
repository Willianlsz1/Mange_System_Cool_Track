import { beforeEach, describe, expect, it, vi } from 'vitest';

async function loadPricingModule({ user = null, profile = null } = {}) {
  vi.resetModules();

  const getUser = vi.fn().mockResolvedValue(user);
  const fetchMyProfileBilling = vi.fn().mockResolvedValue({ profile });

  vi.doMock('../core/auth.js', () => ({
    Auth: { getUser },
  }));

  vi.doMock('../core/monetization.js', () => ({
    fetchMyProfileBilling,
  }));

  const module = await import('../ui/views/pricing.js');
  return { ...module, mocks: { getUser, fetchMyProfileBilling } };
}

describe('pricing view', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    document.body.innerHTML = '<div id="view-pricing"></div>';
  });

  it('renders free plan as current for guest users', async () => {
    localStorage.setItem('cooltrack-guest-mode', '1');
    const { renderPricing, mocks } = await loadPricingModule();

    await renderPricing();

    const html = document.getElementById('view-pricing').innerHTML;
    expect(html).toContain('Seu plano atual: <strong>Free</strong>');
    expect(html).toContain('Ate 3 equipamentos');
    expect(html).toContain('Plano atual');
    expect(html).toContain('Assinar Pro');
    expect(mocks.getUser).not.toHaveBeenCalled();
  });

  it('renders pro plan as current and removes upgrade CTA priority', async () => {
    const { renderPricing } = await loadPricingModule({
      user: { id: 'user-1' },
      profile: { plan: 'pro', subscription_status: 'active', is_dev: false },
    });

    await renderPricing({ highlightPlan: 'pro' });

    const html = document.getElementById('view-pricing').innerHTML;
    expect(html).toContain('Seu plano atual: <strong>Pro</strong>');
    expect(html).toContain('Voce esta no Pro');
    expect(html).toContain('Plano atual');
    expect(html).toContain(
      'pricing-card pricing-card--pro pricing-card--active pricing-card--highlighted',
    );
    expect(html).not.toContain('data-action="start-checkout"');
  });

  it('keeps pro checkout CTA for free users and applies highlight parameter', async () => {
    const { renderPricing } = await loadPricingModule({
      user: { id: 'user-1' },
      profile: { plan: 'free', subscription_status: 'inactive', is_dev: false },
    });

    await renderPricing({ highlightPlan: 'pro' });

    const html = document.getElementById('view-pricing').innerHTML;
    expect(html).toContain('Seu plano atual: <strong>Free</strong>');
    expect(html).toContain('Assinar Pro →');
    expect(html).toContain('data-action="start-checkout"');
    expect(html).toContain('pricing-card pricing-card--pro pricing-card--highlighted');
  });

  it('shows limit reached reason when redirected from blocked free action', async () => {
    const { renderPricing } = await loadPricingModule({
      user: { id: 'user-1' },
      profile: { plan: 'free', subscription_status: 'inactive', is_dev: false },
    });

    await renderPricing({ highlightPlan: 'pro', reason: 'limit_reached' });

    const html = document.getElementById('view-pricing').innerHTML;
    expect(html).toContain('Voce atingiu o limite do plano Free.');
    expect(html).toContain('pricing-card pricing-card--pro pricing-card--highlighted');
  });
});
