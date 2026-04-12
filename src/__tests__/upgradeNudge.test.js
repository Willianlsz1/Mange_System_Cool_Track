import { UpgradeNudge } from '../ui/components/upgradeNudge.js';

describe('UpgradeNudge', () => {
  it('renderiza card do dashboard com badge, bullets e CTA', () => {
    const html = UpgradeNudge.renderDashboardCard();

    expect(html).toContain('Desbloqueie o CoolTrack Pro completo');
    expect(html).toContain('POPULAR');
    expect(html).toContain('Equipamentos ilimitados');
    expect(html).toContain('Relatórios PDF ilimitados');
    expect(html).toContain('Compartilhamento WhatsApp direto');
    expect(html).toContain('Ver planos &rarr;');
  });

  it('escapa feature no hint inline', () => {
    const html = UpgradeNudge.renderInlineHint('<img src=x onerror=alert(1)>');

    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt; disponível no plano Pro');
    expect(html).toContain('Conhecer &rarr;');
  });
});
