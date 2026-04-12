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
    return getEffectivePlan(null);
  }
}

function getPricingMarkup(planCode, { _highlightPlan = null, reason = null } = {}) {
  const isPro = planCode === PLAN_CODE_PRO;
  const isFree = !isPro;
  const showLimitMessage = reason === PRICING_REASON_LIMIT_REACHED && isFree;

  return `
    <section class="pricing-view" aria-labelledby="pricing-title">

      <!-- ── Header ── -->
      <header class="pricing-hero">
        <h1 class="pricing-hero__title" id="pricing-title">Planos e assinatura</h1>
        <p class="pricing-hero__subtitle">
          ${isPro ? 'Você está no plano Pro. Obrigado pelo apoio! 🙌' : 'Comece grátis. Faça upgrade quando precisar.'}
        </p>
        <span class="pricing-plan-indicator pricing-plan-indicator--${planCode}">
          ${
            isPro
              ? '<svg width="12" height="12" fill="none" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" stroke="#00c870" stroke-width="1.5"/><path d="M5 8l2 2 4-4" stroke="#00c870" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg> Plano Pro ativo'
              : '⬡ Plano Gratuito'
          }
        </span>
        ${
          showLimitMessage
            ? '<p class="pricing-upgrade-reason">⚠ Você atingiu o limite do plano Gratuito. Assine o Pro para continuar sem bloqueios.</p>'
            : ''
        }
      </header>

      <!-- ── Cards ── -->
      <div class="pricing-grid" role="list" aria-label="Planos disponíveis">

        <!-- FREE -->
        <article class="pricing-card ${isFree ? 'pricing-card--active' : ''}" role="listitem" aria-label="Plano Gratuito">
          <span class="pricing-badge ${isFree ? 'pricing-badge--current' : 'pricing-badge--neutral'}">
            ${isFree ? 'PLANO ATUAL' : 'BASE'}
          </span>
          <h2 class="pricing-card__title">Gratuito</h2>
          <p class="pricing-card__price">R$ 0 <span class="pricing-card__price-period">/ sempre</span></p>
          <ul class="pricing-features" aria-label="Recursos do plano gratuito">
            <li>Até 3 equipamentos cadastrados</li>
            <li>10 registros de serviço por mês</li>
            <li>Histórico dos últimos 30 dias de serviços</li>
            <li>10 envios de relatório via WhatsApp/mês</li>
            <li>Alertas de manutenção preventiva</li>
            <li>Funciona offline</li>
          </ul>
          <div class="pricing-card__footer">
            <button class="btn btn--outline pricing-card__cta" type="button" disabled aria-disabled="true">
              ${isFree ? 'Plano atual' : 'Você está no Pro'}
            </button>
          </div>
        </article>

        <!-- PRO -->
        <article class="pricing-card pricing-card--pro ${isPro ? 'pricing-card--active' : ''}" role="listitem" aria-label="Plano Pro">
          <span class="pricing-badge ${isPro ? 'pricing-badge--current' : 'pricing-badge--popular'}">
            ${isPro ? 'PLANO ATUAL' : 'MAIS POPULAR'}
          </span>
          <h2 class="pricing-card__title">Pro</h2>
          <div class="pricing-card__price-group">
            <p class="pricing-card__price pricing-card__price--pro">R$ 29 <span class="pricing-card__price-period">/ mês</span></p>
            <p class="pricing-card__annual">ou R$ 249/ano <span class="pricing-card__annual-save">economize 28%</span></p>
          </div>
          <ul class="pricing-features" aria-label="Recursos do plano Pro">
            <li>Até 30 equipamentos cadastrados</li>
            <li>Registros de serviço ilimitados</li>
            <li>Todo o histórico de manutenções sem limite de data</li>
            <li>Relatórios PDF de serviços realizados</li>
            <li>Envios ilimitados de relatório via WhatsApp</li>
            <li>Agrupamento de equipamentos por setores</li>
            <li>Suporte prioritário</li>
          </ul>
          <div class="pricing-card__footer">
            ${
              isPro
                ? `<button class="btn btn--outline pricing-card__cta" type="button" disabled aria-disabled="true">Plano atual</button>
                 <p class="pricing-card__microcopy">Cancele quando quiser &bull; Sem fidelidade</p>
                 <button
                   class="pricing-cancel-btn"
                   type="button"
                   data-action="manage-subscription"
                   aria-label="Gerenciar ou cancelar assinatura Pro"
                 >Gerenciar / cancelar assinatura</button>`
                : `<button class="btn pricing-card__cta pricing-card__cta--pro" type="button" data-action="start-checkout" data-plan="pro" data-upgrade-source="pricing">
                   Assinar Pro &rarr;
                 </button>
                 <p class="pricing-card__microcopy">Cancele quando quiser &bull; Sem fidelidade</p>`
            }
          </div>
        </article>

      </div>

      <!-- ── Management section (Pro only) ── -->
      ${
        isPro
          ? `
      <div class="pricing-manage-section">
        <div class="pricing-manage-section__icon">⚙️</div>
        <div class="pricing-manage-section__body">
          <p class="pricing-manage-section__title">Gerenciar assinatura</p>
          <p class="pricing-manage-section__desc">
            Atualize o método de pagamento, veja histórico de cobranças ou cancele sua assinatura a qualquer momento.
            Seus dados ficam salvos mesmo após o cancelamento.
          </p>
        </div>
        <button
          class="btn btn--outline pricing-manage-section__btn"
          type="button"
          data-action="manage-subscription"
        >
          Abrir portal &rarr;
        </button>
      </div>
      `
          : ''
      }

      <!-- ── FAQ ── -->
      <section class="pricing-faq" aria-label="Perguntas frequentes">
        <h3 class="pricing-faq__title">FAQ</h3>

        <details class="pricing-faq__item">
          <summary>Posso cancelar a qualquer momento?</summary>
          <p>Sim. Sem multa, sem burocracia. Clique em <strong>Gerenciar / cancelar assinatura</strong> acima e siga o fluxo no portal de pagamento. O acesso Pro fica ativo até o fim do período já pago.</p>
        </details>

        <details class="pricing-faq__item">
          <summary>O que acontece com meus dados se cancelar?</summary>
          <p>Seus dados ficam salvos. Você volta ao plano Gratuito com acesso a tudo que já foi registrado — apenas novos cadastros ficam limitados (máx. 3 equipamentos e 10 registros de serviço por mês).</p>
        </details>

        <details class="pricing-faq__item">
          <summary>Aceita PIX ou boleto?</summary>
          <p>Sim! PIX, cartão de crédito e boleto bancário são aceitos no checkout.</p>
        </details>

        <details class="pricing-faq__item">
          <summary>Posso usar em mais de um dispositivo?</summary>
          <p>Sim. Seu plano está vinculado à sua conta. Acesse de qualquer dispositivo com o mesmo login.</p>
        </details>

        <details class="pricing-faq__item">
          <summary>Como funciona o plano anual?</summary>
          <p>Você paga R$ 249 uma vez ao ano e economiza 28% em relação ao mensal. Pode cancelar a qualquer momento — o reembolso proporcional é feito conforme a política do Stripe.</p>
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
        <h1 class="pricing-hero__title" id="pricing-title">Planos e assinatura</h1>
        <p class="pricing-hero__subtitle" style="color:var(--text-2);font-size:14px">Carregando...</p>
      </header>
    </section>
  `;

  const currentPlanCode = await resolveCurrentPlanCode();
  const highlightPlan = normalizeHighlightPlan(params?.highlightPlan);
  const reason = normalizePricingReason(para