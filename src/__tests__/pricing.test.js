import { beforeEach, describe, expect, it, vi } from 'vitest';

async function loadPricingModule({ user = null, profile = null } = {}) {
  vi.resetModules();

  const getUser = vi.fn().mockResolvedValue(user);
  const fetchMyProfileBilling = vi.fn().mockResolvedValue({ profile });

  vi.doMock('../core/auth.js', () => ({
    Auth: { getUser },
  }));

  vi.doMock('../core/plans/monetization.js', () => ({
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

  it('renders free plan for guest users without checkout CTA for free card', async () => {
    localStorage.setItem('cooltrack-guest-mode', '1');
    const { renderPricing, mocks } = await loadPricingModule();

    await renderPricing();

    const html = document.getElementById('view-pricing').innerHTML;
    expect(html).toContain('Plano Gratuito');
    expect(html).toContain('Assinar Pro');
    expect(html).toContain('data-action="start-checkout"');
    expect(mocks.getUser).not.toHaveBeenCalled();
  });

  it('renders pro plan as current with cancel button and no checkout CTA', async () => {
    const { renderPricing } = await loadPricingModule({
      user: { id: 'user-1' },
      profile: { plan: 'pro', subscription_status: 'active', is_dev: false },
    });

    await renderPricing();

    const html = document.getElementById('view-pricing').innerHTML;
    expect(html).toContain('Plano Pro ativo');
    expect(html).toContain('Plano atual');
    expect(html).not.toContain('data-action="start-checkout"');
    // Cancel / manage buttons
    expect(html).toContain('data-action="manage-subscription"');
    expect(html).toContain('Gerenciar / cancelar assinatura');
    expect(html).toContain('Abrir portal');
    // Management section visible
    expect(html).toContain('pricing-manage-section');
  });

  it('keeps pro checkout CTA for free users', async () => {
    const { renderPricing } = await loadPricingModule({
      user: { id: 'user-1' },
      profile: { plan: 'free', subscription_status: 'inactive', is_dev: false },
    });

    await renderPricing({ highlightPlan: 'pro' });

    const html = document.getElementById('view-pricing').innerHTML;
    expect(html).toContain('Assinar Pro');
    expect(html).toContain('data-action="start-checkout"');
    expect(html).not.toContain('data-action="manage-subscription"');
    expect(html).not.toContain('pricing-manage-section');
  });

  it('shows limit reached message when redirected from blocked free action', async () => {
    const { renderPricing } = await loadPricingModule({
      user: { id: 'user-1' },
      profile: { plan: 'free', subscription_status: 'inactive', is_dev: false },
    });

    await renderPricing({ highlightPlan: 'pro', reason: 'limit_reached' });

    const html = document.getElementById('view-pricing').innerHTML;
    expect(html).toContain('atingiu o limite do plano');
    expect(html).toContain('data-action="start-checkout"');
  });

  it('cancel button is not shown for free plan users', async () => {
    const { renderPricing } = await loadPricingModule({
      user: { id: 'user-1' },
      profile: { plan: 'free', subscription_status: 'inactive', is_dev: false },
    });

    await renderPricing();

    const html = document.getElementById('view-pricing').innerHTML;
    expect(html).not.toContain('pricing-cancel-btn');
    expect(html).not.toContain('Cancelar assinatura');
  });
});
