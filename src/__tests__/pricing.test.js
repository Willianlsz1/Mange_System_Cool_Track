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

  it('mostra linha "Cadastro por foto (IA)" com cotas reais na tabela comparativa', async () => {
    // Motivação: antes a IA sumia da tabela comparativa, dando a falsa
    // impressão de que era Pro-only ou ilimitado. Agora ela aparece no topo
    // com Free=1/mês (teste), Plus=30/mês, Pro=200/mês.
    const { renderPricing } = await loadPricingModule({
      user: { id: 'user-1' },
      profile: { plan: 'free', subscription_status: 'inactive', is_dev: false },
    });

    await renderPricing();

    const html = document.getElementById('view-pricing').innerHTML;
    expect(html).toContain('Cadastro por foto (IA)');
    expect(html).toContain('1 / mês');
    expect(html).toContain('30 / mês');
    expect(html).toContain('200 / mês');
    // Sanity: não deve mais dizer "ilimitado" pra cadastro por foto
    // (o regex garante que a string "200" aparece como cota do Pro)
    expect(html).toMatch(/Cadastro por foto \(IA\)[\s\S]*200/);
  });

  it('Pro subtítulo referencia equipe/15+, não "pequena empresa"', async () => {
    // Sincroniza com a landing (L-D). "Pequena empresa" soa vago; "equipe ou
    // 15+ equipamentos" é concreto e casa com o break-even de mudar de Plus.
    const { renderPricing } = await loadPricingModule({
      user: { id: 'user-1' },
      profile: { plan: 'pro', subscription_status: 'active', is_dev: false },
    });

    await renderPricing();

    const html = document.getElementById('view-pricing').innerHTML;
    expect(html).toContain('Pra equipe ou 15+ equipamentos');
    expect(html).not.toContain('Pra pequena empresa');
  });

  it('heroSubtitle do Pro não mostra emoji 🙌', async () => {
    // Regressão: o glyph renderizava "👀" em alguns user-agents mobile. Copy
    // sem emoji é neutra e evita esse tipo de bug por plataforma.
    const { renderPricing } = await loadPricingModule({
      user: { id: 'user-1' },
      profile: { plan: 'pro', subscription_status: 'active', is_dev: false },
    });

    await renderPricing();

    const html = document.getElementById('view-pricing').innerHTML;
    expect(html).not.toContain('🙌');
    expect(html).toContain('Obrigado por confiar no CoolTrack');
  });

  it('Plus badge usa "TÉCNICO AUTÔNOMO" (sincroniza com landing)', async () => {
    const { renderPricing } = await loadPricingModule({
      user: { id: 'user-1' },
      profile: { plan: 'free', subscription_status: 'inactive', is_dev: false },
    });

    await renderPricing();

    const html = document.getElementById('view-pricing').innerHTML;
    expect(html).toContain('TÉCNICO AUTÔNOMO');
    expect(html).not.toContain('INTERMEDIÁRIO');
  });
});
