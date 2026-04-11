import { Utils } from '../../core/utils.js';

export function renderPricing() {
  const view = Utils.getEl('view-pricing');
  if (!view) return;

  view.innerHTML = `
    <section class="pricing-view" aria-labelledby="pricing-title">
      <header class="pricing-hero">
        <h1 class="pricing-hero__title" id="pricing-title">Escolha o plano certo para o seu negócio</h1>
        <p class="pricing-hero__subtitle">Comece grátis. Faça upgrade quando precisar.</p>
      </header>

      <div class="pricing-grid" role="list" aria-label="Planos disponíveis">
        <article class="pricing-card" role="listitem" aria-label="Plano Gratuito">
          <span class="pricing-badge pricing-badge--current">ATUAL</span>
          <h2 class="pricing-card__title">Gratuito</h2>
          <p class="pricing-card__price">R$ 0 / sempre</p>
          <ul class="pricing-features">
            <li>✓ Até 5 equipamentos</li>
            <li>✓ 10 registros por mês</li>
            <li>✓ Relatório PDF básico</li>
            <li>✓ Alertas de preventiva</li>
            <li>✓ Funciona offline</li>
          </ul>
          <button class="btn btn--outline pricing-card__cta" type="button" disabled aria-disabled="true">Plano atual</button>
        </article>

        <article class="pricing-card pricing-card--pro" role="listitem" aria-label="Plano Pro">
          <span class="pricing-badge pricing-badge--popular">MAIS POPULAR</span>
          <h2 class="pricing-card__title">Pro</h2>
          <p class="pricing-card__price pricing-card__price--pro">R$ 29 / mês</p>
          <p class="pricing-card__annual">ou R$ 249/ano (economize 28%)</p>
          <ul class="pricing-features">
            <li>✓ Equipamentos ilimitados</li>
            <li>✓ Registros ilimitados</li>
            <li>✓ Relatório PDF com sua logo</li>
            <li>✓ Compartilhamento WhatsApp</li>
            <li>✓ Histórico completo</li>
            <li>✓ Exportação de dados</li>
            <li>✓ Suporte prioritário</li>
          </ul>
          <button class="btn pricing-card__cta pricing-card__cta--pro" type="button" data-action="open-upgrade" data-upgrade-source="dashboard">Assinar Pro →</button>
          <p class="pricing-card__microcopy">Cancele quando quiser • Sem fidelidade</p>
        </article>
      </div>

      <section class="pricing-faq" aria-label="Perguntas frequentes">
        <h3 class="pricing-faq__title">FAQ</h3>
        <details class="pricing-faq__item">
          <summary>Posso cancelar a qualquer momento?</summary>
          <p>Sim. Sem multa, sem burocracia.</p>
        </details>
        <details class="pricing-faq__item">
          <summary>O que acontece com meus dados se cancelar?</summary>
          <p>Seus dados ficam salvos. Você volta ao plano grátis com acesso aos dados já registrados.</p>
        </details>
        <details class="pricing-faq__item">
          <summary>Aceita PIX ou boleto?</summary>
          <p>Sim! PIX, cartão de crédito e boleto bancário.</p>
        </details>
      </section>
    </section>
  `;
}
