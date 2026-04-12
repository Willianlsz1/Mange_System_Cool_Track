import { Auth } from '../../core/auth.js';
import { fetchMyProfileBilling } from '../../core/monetization.js';
import { PLAN_CODE_FREE, PLAN_CODE_PRO, getEffectivePlan } from '../../core/subscriptionPlans.js';
import { Utils } from '../../core/utils.js';

const PRICING_REASON_LIMIT_REACHED = 'limit_reached';

function normalizeHighlightPlan(highlightPlan) {
  return String(highlightPlan || '').toLowerCase() === PLAN_CODE_PRO ? PLAN_CODE_PRO : null;
}

function normalizePricingReason(reason) {
  return String(reason || '').toLowerCase() === PRICING_REASON_LIMIT_REACHED
    ? PRICING_REASON_LIMIT_REACHED
    : null;
}

async function resolveCurrentPlanCode() {
  if (localStorage.getItem('cooltrack-guest-mode') === '1') return PLAN_CODE_FREE;

  const user = await Auth.getUser();
  if (!user?.id) return PLAN_CODE_FREE;

  try {
    const { profile } = await fetchMyProfileBilling();
    return getEffectivePlan(profile);
  } catch {
    return PLAN_CODE_FREE;
  }
}

function getPricingMarkup(planCode, { highlightPlan = null, reason = null } = {}) {
  const isPro = planCode === PLAN_CODE_PRO;
  const isFree = !isPro;
  const freeHighlighted = highlightPlan === PLAN_CODE_FREE;
  const proHighlighted = highlightPlan === PLAN_CODE_PRO;
  const showLimitMessage = reason === PRICING_REASON_LIMIT_REACHED && isFree;

  const freeCardClasses = [
    'pricing-card',
    isFree ? 'pricing-card--active' : '',
    freeHighlighted ? 'pricing-card--highlighted' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const proCardClasses = [
    'pricing-card',
    'pricing-card--pro',
    isPro ? 'pricing-card--active' : '',
    proHighlighted ? 'pricing-card--highlighted' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const planLabel = isPro ? 'Pro' : 'Free';

  return `
    <section class="pricing-view" aria-labelledby="pricing-title">
      <header class="pricing-hero">
        <h1 class="pricing-hero__title" id="pricing-title">Escolha o plano certo para o seu negocio</h1>
        <p class="pricing-hero__subtitle">Comece gratis. Faca upgrade quando precisar.</p>
        <p class="pricing-plan-indicator pricing-plan-indicator--${planCode}">
          Seu plano atual: <strong>${planLabel}</strong>
        </p>
        ${
          showLimitMessage
            ? '<p class="pricing-upgrade-reason">Voce atingiu o limite do plano Free. Assine o Pro para continuar sem bloqueios.</p>'
            : ''
        }
      </header>

      <div class="pricing-grid" role="list" aria-label="Planos disponiveis">
        <article class="${freeCardClasses}" role="listitem" aria-label="Plano Gratuito">
          ${
            isFree
              ? '<span class="pricing-badge pricing-badge--current">PLANO ATUAL</span>'
              : '<span class="pricing-badge pricing-badge--neutral">BASE</span>'
          }
          <h2 class="pricing-card__title">Gratuito</h2>
          <p class="pricing-card__price">R$ 0 / sempre</p>
          <ul class="pricing-features">
            <li>&#10003; Ate 3 equipamentos</li>
            <li>&#10003; 10 registros por mes</li>
            <li>&#10003; Alertas de preventiva</li>
            <li>&#10003; Funciona offline</li>
          </ul>
          ${
            isFree
              ? '<button class="btn btn--outline pricing-card__cta" type="button" disabled aria-disabled="true">Plano atual</button>'
              : '<button class="btn btn--outline pricing-card__cta" type="button" disabled aria-disabled="true">Voce esta no Pro</button>'
          }
        </article>

        <article class="${proCardClasses}" role="listitem" aria-label="Plano Pro">
          ${
            isPro
              ? '<span class="pricing-badge pricing-badge--current">PLANO ATUAL</span>'
              : '<span class="pricing-badge pricing-badge--popular">MAIS POPULAR</span>'
          }
          <h2 class="pricing-card__title">Pro</h2>
          <p class="pricing-card__price pricing-card__price--pro">R$ 29 / mes</p>
          <p class="pricing-card__annual">ou R$ 249/ano (economize 28%)</p>
          <ul class="pricing-features">
            <li>&#10003; Equipamentos ilimitados</li>
            <li>&#10003; Registros ilimitados</li>
            <li>&#10003; Exportacao PDF completa</li>
            <li>&#10003; Compartilhamento WhatsApp sem limite</li>
            <li>&#10003; Historico completo</li>
          </ul>
          ${
            isPro
              ? '<button class="btn btn--outline pricing-card__cta" type="button" disabled aria-disabled="true">Plano atual</button>'
              : '<button class="btn pricing-card__cta pricing-card__cta--pro" type="button" data-action="start-checkout" data-plan="pro" data-upgrade-source="pricing">Assinar Pro &rarr;</button>'
          }
          <p class="pricing-card__microcopy">Cancele quando quiser &bull; Sem fidelidade</p>
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
          <p>Seus dados ficam salvos. Voce volta ao plano gratis com acesso ao que ja foi registrado.</p>
        </details>
        <details class="pricing-faq__item">
          <summary>Aceita PIX ou boleto?</summary>
          <p>Sim! PIX, cartao de credito e boleto bancario.</p>
        </details>
      </section>
    </section>
  `;
}

export async function renderPricing(params = {}) {
  const view = Utils.getEl('view-pricing');
  if (!view) return;

  view.innerHTML = `
    <section class="pricing-view" aria-labelledby="pricing-title">
      <header class="pricing-hero">
        <h1 class="pricing-hero__title" id="pricing-title">Carregando planos...</h1>
      </header>
    </section>
  `;

  const currentPlanCode = await resolveCurrentPlanCode();
  const highlightPlan = normalizeHighlightPlan(params?.highlightPlan);
  const reason = normalizePricingReason(params?.reason);
  view.innerHTML = getPricingMarkup(currentPlanCode, { highlightPlan, reason });
}
