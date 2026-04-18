import { UpgradeNudge } from '../ui/components/upgradeNudge.js';

describe('UpgradeNudge', () => {
  describe('renderDashboardCard', () => {
    it('renderiza upsell para Plus quando usuário está no Free', () => {
      const html = UpgradeNudge.renderDashboardCard({ planCode: 'free' });

      expect(html).toContain('Turbine com o CoolTrack Plus');
      expect(html).toContain('POPULAR');
      expect(html).toContain('Até 25 equipamentos cadastrados');
      expect(html).toContain('Registros e histórico ilimitados');
      expect(html).toContain('PDFs sem marca');
      expect(html).toContain('assinatura do cliente');
      expect(html).toContain('50 envios de WhatsApp/mês');
      expect(html).toContain('Ver planos &rarr;');
      expect(html).toContain('data-highlight-plan="plus"');
      // Menciona Pro como caminho futuro
      expect(html).toContain('Pro');
    });

    it('renderiza upsell para Pro quando usuário já está no Plus', () => {
      const html = UpgradeNudge.renderDashboardCard({ planCode: 'plus' });

      expect(html).toContain('Quer escalar? Conheça o Pro');
      expect(html).toContain('ESCALA');
      expect(html).toContain('Equipamentos ilimitados');
      expect(html).toContain('PDF e WhatsApp ilimitados');
      expect(html).toContain('Agrupamento por setores');
      expect(html).toContain('Suporte prioritário');
      expect(html).toContain('Fazer upgrade para Pro &rarr;');
      expect(html).toContain('data-highlight-plan="pro"');
    });

    it('não renderiza nada quando usuário já está no Pro', () => {
      const html = UpgradeNudge.renderDashboardCard({ planCode: 'pro' });

      expect(html).toBe('');
    });

    it('default (sem planCode) trata como Free e destaca Plus', () => {
      const html = UpgradeNudge.renderDashboardCard();

      expect(html).toContain('Turbine com o CoolTrack Plus');
      expect(html).toContain('data-highlight-plan="plus"');
    });
  });

  describe('renderInlineHint', () => {
    it('escapa feature no hint inline', () => {
      const html = UpgradeNudge.renderInlineHint('<img src=x onerror=alert(1)>');

      expect(html).toContain(
        '&lt;img src=x onerror=alert(1)&gt; disponível a partir do plano Plus',
      );
      expect(html).toContain('Conhecer &rarr;');
    });

    it('usa plano Pro quando requiredPlan é pro', () => {
      const html = UpgradeNudge.renderInlineHint('Setores', { requiredPlan: 'pro' });

      expect(html).toContain('Setores disponível a partir do plano Pro');
    });

    it('default é plano Plus', () => {
      const html = UpgradeNudge.renderInlineHint('PDF em lote');

      expect(html).toContain('PDF em lote disponível a partir do plano Plus');
    });
  });
});
