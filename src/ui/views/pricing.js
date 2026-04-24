import { Auth } from '../../core/auth.js';
import { fetchMyProfileBilling } from '../../core/plans/monetization.js';
import {
  PLAN_CODE_FREE,
  PLAN_CODE_PLUS,
  PLAN_CODE_PRO,
  getEffectivePlan,
} from '../../core/plans/subscriptionPlans.js';
import { Utils } from '../../core/utils.js';

const PRICING_REASON_LIMIT_REACHED = 'limit_reached';

function normalizeHighlightPlan(highlightPlan) {
  const lower = String(highlightPlan || '').toLowerCase();
  if (lower === PLAN_CODE_PRO) return PLAN_CODE_PRO;
  if (lower === PLAN_CODE_PLUS) return PLAN_CODE_PLUS;
  return null;
}

function normalizePricingReason(reason) {
  return String(reason || '').toLowerCase() === PRICING_REASON_LIMIT_REACHED
    ? PRICING_REASON_LIMIT_REACHED
    : null;
}

async function resolveCurrentPlanCode() {
  const user = await Auth.getUser();
  if (!user?.id) return PLAN_CODE_FREE;

  try {
    const { profile } = await fetchMyProfileBilling();
    return getEffectivePlan(profile);
  } catch {
    return getEffectivePlan(null);
  }
}

// ── Ícones SVG: apenas pra tabela comparativa ────────────────────────────
const ICON_CHECK = `<svg class="pricing-features__icon pricing-features__icon--yes" width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 8.5l3 3 7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICON_X = `<svg class="pricing-features__icon pricing-features__icon--no" width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;

// ──────────────────────────────────────────────────────────────────────────
// Feature lists por tier — seguem o padrão "Tudo do X, mais:" pra evitar
// repetir features entre tiers. Free mostra tudo; Plus mostra o delta sobre
// Free; Pro mostra o delta sobre Plus.
// ──────────────────────────────────────────────────────────────────────────
const FREE_FEATURES = [
  'Até 3 equipamentos cadastrados',
  'Registros de serviço ilimitados',
  'Histórico dos últimos 15 dias',
  "Relatórios com marca d'água",
  '5 envios via WhatsApp/mês',
  'Cadastro por foto (IA): 1 análise/mês',
  'Fotos nos registros de serviço',
  'Alertas de manutenção preventiva',
  'Funciona offline',
];

const PLUS_DELTA_FEATURES = [
  'Até <strong>15 equipamentos</strong> cadastrados',
  '<strong>Registros de serviço ilimitados</strong> para rotina em campo',
  '<strong>Todo o histórico</strong> de manutenções',
  "<strong>Relatórios profissionais</strong> sem marca d'água",
  '60 envios via WhatsApp/mês',
  '<strong>Cadastro por foto (IA)</strong> — até 30 análises/mês',
  '<strong>Assinatura digital</strong> do cliente no PDF',
  '<strong>Fotos dos equipamentos</strong> (até 3 por equip.)',
];

const PRO_DELTA_FEATURES = [
  '<strong>Equipamentos ilimitados</strong>',
  '<strong>PDFs ilimitados</strong>',
  '<strong>WhatsApp ilimitado</strong>',
  '<strong>Cadastro por foto (IA)</strong> — até 200 análises/mês',
  '<strong>Agrupamento por setores</strong>',
  'Suporte prioritário',
];

function renderFeaturesList(features) {
  const items = features.map((f) => `<li>${f}</li>`).join('');
  return `<ul class="pricing-features" role="list">${items}</ul>`;
}

function getPricingMarkup(planCode, { highlightPlan = null, reason = null } = {}) {
  const isPro = planCode === PLAN_CODE_PRO;
  const isPlus = planCode === PLAN_CODE_PLUS;
  const isFree = !isPro && !isPlus;
  const showLimitMessage = reason === PRICING_REASON_LIMIT_REACHED && isFree;

  const highlight = highlightPlan || (isPro ? null : PLAN_CODE_PRO);

  // ── Tab ativa no mobile ────────────────────────────────────────────────
  // Prioriza highlightPlan (quando vem de um CTA de upgrade). Caso contrário,
  // abre no plano atual do usuário — assim ele vê primeiro o que já tem.
  const mobileActiveTab = highlightPlan || planCode;
  const isFreeActive = mobileActiveTab === PLAN_CODE_FREE;
  const isPlusActive = mobileActiveTab === PLAN_CODE_PLUS;
  const isProActive = mobileActiveTab === PLAN_CODE_PRO;
  const freeMobileCls = isFreeActive ? ' pricing-card--mobile-active' : '';
  const plusMobileCls = isPlusActive ? ' pricing-card--mobile-active' : '';
  const proMobileCls = isProActive ? ' pricing-card--mobile-active' : '';

  // Regra: só mostra botão de checkout pra planos ACIMA do atual. Downgrade é feito
  // via portal (data-action="manage-subscription"), não criando nova assinatura.
  const showPlusCheckout = isFree; // Free → Plus (upgrade)
  const showProCheckout = isFree || isPlus; // Free/Plus → Pro (upgrade)

  const heroSubtitle = isPro
    ? 'Você está no plano Pro. Obrigado por confiar no CoolTrack.'
    : isPlus
      ? 'Você está no Plus. Faça upgrade pra Pro quando precisar de mais.'
      : 'Comece grátis. Faça upgrade quando precisar.';

  const indicator = isPro
    ? '<svg width="12" height="12" fill="none" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" stroke="#e8b94a" stroke-width="1.5"/><path d="M5 8l2 2 4-4" stroke="#e8b94a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg> Plano Pro ativo'
    : isPlus
      ? '<svg width="12" height="12" fill="none" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" stroke="#3a8ee6" stroke-width="1.5"/><path d="M5 8l2 2 4-4" stroke="#3a8ee6" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg> Plano Plus ativo'
      : '⬡ Plano Gratuito';

  return `
    <section class="pricing-view" aria-labelledby="pricing-title">

      <!-- ── Header ── -->
      <header class="pricing-hero">
        <h1 class="pricing-hero__title" id="pricing-title">Planos e assinatura</h1>
        <p class="pricing-hero__subtitle">${heroSubtitle}</p>
        <span class="pricing-plan-indicator pricing-plan-indicator--${planCode}">
          ${indicator}
        </span>
        ${
          showLimitMessage
            ? '<p class="pricing-upgrade-reason">⚠ Você atingiu o limite do plano Gratuito. Faça upgrade pra Plus ou Pro pra continuar sem bloqueios.</p>'
            : ''
        }
      </header>

      <!-- ── Management section (Plus ou Pro) — topo pra ficar sempre visível,
             inclusive no mobile onde só 1 card aparece por vez ── -->
      ${
        isPro || isPlus
          ? `
      <div class="pricing-manage-section">
        <div class="pricing-manage-section__icon" aria-hidden="true">⚙️</div>
        <div class="pricing-manage-section__body">
          <p class="pricing-manage-section__title">Gerenciar assinatura</p>
          <p class="pricing-manage-section__desc">
            Atualize o método de pagamento, troque de plano (Plus ↔ Pro), veja histórico de cobranças ou cancele a qualquer momento.
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

      <!-- ── Toggle mensal / anual (só quando há checkout pra tomar ação) ── -->
      ${
        showPlusCheckout || showProCheckout
          ? `<div class="pricing-billing-toggle pricing-billing-toggle--global" role="group" aria-label="Ciclo de cobrança">
              <button class="pricing-billing-toggle__btn pricing-billing-toggle__btn--active" data-billing="monthly" type="button">Mensal</button>
              <button class="pricing-billing-toggle__btn" data-billing="annual" type="button">
                Anual <span class="pricing-billing-toggle__save">-28%</span>
              </button>
            </div>`
          : ''
      }

      <!-- ── Seletor de plano (mobile only) ── -->
      <nav class="pricing-plan-tabs" role="tablist" aria-label="Escolher plano para ver detalhes">
        <button
          type="button"
          class="pricing-plan-tabs__btn${isFreeActive ? ' pricing-plan-tabs__btn--active' : ''}"
          data-plan-tab="${PLAN_CODE_FREE}"
          role="tab"
          aria-selected="${isFreeActive ? 'true' : 'false'}"
          aria-controls="pricing-card-free"
        >Gratuito</button>
        <button
          type="button"
          class="pricing-plan-tabs__btn pricing-plan-tabs__btn--plus${isPlusActive ? ' pricing-plan-tabs__btn--active' : ''}"
          data-plan-tab="${PLAN_CODE_PLUS}"
          role="tab"
          aria-selected="${isPlusActive ? 'true' : 'false'}"
          aria-controls="pricing-card-plus"
        >Plus</button>
        <button
          type="button"
          class="pricing-plan-tabs__btn pricing-plan-tabs__btn--pro${isProActive ? ' pricing-plan-tabs__btn--active' : ''}"
          data-plan-tab="${PLAN_CODE_PRO}"
          role="tab"
          aria-selected="${isProActive ? 'true' : 'false'}"
          aria-controls="pricing-card-pro"
        >Pro</button>
      </nav>

      <!-- ── Cards ── -->
      <div class="pricing-grid pricing-grid--three-col" role="list" aria-label="Planos disponíveis">

        <!-- ═══════ FREE ═══════ -->
        <article
          id="pricing-card-free"
          class="pricing-card ${isFree ? 'pricing-card--active' : ''}${freeMobileCls}"
          data-plan-card="${PLAN_CODE_FREE}"
          role="listitem"
          aria-label="Plano Gratuito"
        >
          <span class="pricing-badge ${isFree ? 'pricing-badge--current' : 'pricing-badge--neutral'}">
            ${isFree ? 'PLANO ATUAL' : 'BASE'}
          </span>
          <h2 class="pricing-card__title">Gratuito</h2>
          <p class="pricing-card__subtitle">Pra começar sem compromisso</p>

          <div class="pricing-card__price-group">
            <p class="pricing-card__price">R$ 0</p>
            <p class="pricing-card__price-desc">Grátis para sempre</p>
          </div>

          <div class="pricing-card__cta-group">
            <button class="btn btn--outline pricing-card__cta" type="button" disabled aria-disabled="true">
              ${isFree ? 'Plano atual' : 'Downgrade disponível no portal'}
            </button>
          </div>

          <hr class="pricing-card__divider" aria-hidden="true" />

          ${renderFeaturesList(FREE_FEATURES)}
        </article>

        <!-- ═══════ PLUS ═══════ -->
        <article
          id="pricing-card-plus"
          class="pricing-card pricing-card--plus ${isPlus ? 'pricing-card--active' : ''} ${highlight === PLAN_CODE_PLUS ? 'pricing-card--highlight' : ''}${plusMobileCls}"
          data-plan-card="${PLAN_CODE_PLUS}"
          role="listitem"
          aria-label="Plano Plus"
        >
          <span class="pricing-badge ${isPlus ? 'pricing-badge--current' : 'pricing-badge--plus'}">
            ${isPlus ? 'PLANO ATUAL' : 'TÉCNICO AUTÔNOMO'}
          </span>
          <h2 class="pricing-card__title">Plus</h2>
          <p class="pricing-card__subtitle">Pra quem atende sozinho</p>

          <div class="pricing-card__price-group">
            <p class="pricing-card__price pricing-card__price--plus" id="plus-price-monthly">
              R$ 29 <span class="pricing-card__price-period">/ mês</span>
            </p>
            <p class="pricing-card__price-desc" id="plus-price-desc-monthly">
              Cobrado mensalmente. Cancele quando quiser.
            </p>
            <div id="plus-price-annual" style="display:none">
              <p class="pricing-card__price pricing-card__price--plus">
                R$ 20<span class="pricing-card__price-cents">,75</span> <span class="pricing-card__price-period">/ mês</span>
              </p>
              <p class="pricing-card__price-desc">
                Cobrado como R$ 249/ano &nbsp;<span class="pricing-card__annual-save">economiza R$ 99</span>
              </p>
            </div>
          </div>

          <div class="pricing-card__cta-group">
            ${
              isPlus
                ? `<button class="btn btn--outline pricing-card__cta" type="button" disabled aria-disabled="true">Plano atual</button>
                   <button
                     class="pricing-cancel-btn"
                     type="button"
                     data-action="manage-subscription"
                     aria-label="Gerenciar ou cancelar assinatura Plus"
                   >Gerenciar / cancelar</button>`
                : showPlusCheckout
                  ? `<button
                       class="btn pricing-card__cta pricing-card__cta--plus"
                       id="btn-checkout-plus"
                       type="button"
                       data-action="start-checkout"
                       data-plan="plus"
                       data-upgrade-source="pricing"
                     >
                       Assinar Plus &rarr;
                     </button>`
                  : `<button class="btn btn--outline pricing-card__cta" type="button" disabled aria-disabled="true">
                       Downgrade via portal
                     </button>`
            }
          </div>

          <hr class="pricing-card__divider" aria-hidden="true" />

          <p class="pricing-card__includes">Tudo do <strong>Gratuito</strong>, mais:</p>
          ${renderFeaturesList(PLUS_DELTA_FEATURES)}
        </article>

        <!-- ═══════ PRO ═══════ -->
        <article
          id="pricing-card-pro"
          class="pricing-card pricing-card--pro ${isPro ? 'pricing-card--active' : ''} ${highlight === PLAN_CODE_PRO && !isPro ? 'pricing-card--highlight' : ''}${proMobileCls}"
          data-plan-card="${PLAN_CODE_PRO}"
          role="listitem"
          aria-label="Plano Pro"
        >
          <span class="pricing-badge ${isPro ? 'pricing-badge--current' : 'pricing-badge--popular'}">
            ${isPro ? 'PLANO ATUAL' : 'RECOMENDADO PRA EMPRESA'}
          </span>
          <h2 class="pricing-card__title">Pro</h2>
          <p class="pricing-card__subtitle">Pra equipe ou 15+ equipamentos</p>

          <div class="pricing-card__price-group">
            <p class="pricing-card__price pricing-card__price--pro" id="pro-price-monthly">
              R$ 49 <span class="pricing-card__price-period">/ mês</span>
            </p>
            <p class="pricing-card__price-desc" id="pro-price-desc-monthly">
              Cobrado mensalmente. Cancele quando quiser.
            </p>
            <div id="pro-price-annual" style="display:none">
              <p class="pricing-card__price pricing-card__price--pro">
                R$ 34<span class="pricing-card__price-cents">,92</span> <span class="pricing-card__price-period">/ mês</span>
              </p>
              <p class="pricing-card__price-desc">
                Cobrado como R$ 419/ano &nbsp;<span class="pricing-card__annual-save">economiza R$ 169</span>
              </p>
            </div>
          </div>

          <div class="pricing-card__cta-group">
            ${
              isPro
                ? `<button class="btn btn--outline pricing-card__cta" type="button" disabled aria-disabled="true">Plano atual</button>
                   <button
                     class="pricing-cancel-btn"
                     type="button"
                     data-action="manage-subscription"
                     aria-label="Gerenciar ou cancelar assinatura Pro"
                   >Gerenciar / cancelar assinatura</button>`
                : showProCheckout
                  ? `<button
                       class="btn pricing-card__cta pricing-card__cta--pro"
                       id="btn-checkout-pro"
                       type="button"
                       data-action="start-checkout"
                       data-plan="pro"
                       data-upgrade-source="pricing"
                     >
                       Assinar Pro &rarr;
                     </button>`
                  : `<button class="btn btn--outline pricing-card__cta" type="button" disabled aria-disabled="true">
                       Plano atual ou inferior
                     </button>`
            }
          </div>

          <hr class="pricing-card__divider" aria-hidden="true" />

          <p class="pricing-card__includes">Tudo do <strong>Plus</strong>, mais:</p>
          ${renderFeaturesList(PRO_DELTA_FEATURES)}
        </article>

      </div>

      <!-- ── Tabela comparativa ── -->
      <section class="pricing-compare" aria-label="Comparativo detalhado dos planos">
        <h3 class="pricing-compare__title">Compare os planos lado a lado</h3>
        <div class="pricing-compare__scroll">
          <table class="pricing-compare__table">
            <thead>
              <tr>
                <th scope="col" class="pricing-compare__feature-col">Recurso</th>
                <th scope="col">Gratuito</th>
                <th scope="col" class="pricing-compare__col--plus">Plus</th>
                <th scope="col" class="pricing-compare__col--pro">Pro</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Cadastro por foto (IA)</th>
                <td>1 / mês <small>(teste grátis)</small></td>
                <td>30 / mês</td>
                <td>200 / mês</td>
              </tr>
              <tr>
                <th scope="row">Equipamentos cadastrados</th>
                <td>3</td>
                <td>15</td>
                <td>Ilimitado</td>
              </tr>
              <tr>
                <th scope="row">Registros de serviço</th>
                <td>Ilimitado</td>
                <td>Ilimitado</td>
                <td>Ilimitado</td>
              </tr>
              <tr>
                <th scope="row">Histórico</th>
                <td>15 dias</td>
                <td>Completo</td>
                <td>Completo</td>
              </tr>
              <tr>
                <th scope="row">Relatórios PDF</th>
                <td>Com marca d'água</td>
                <td>Sem marca d'água <small>(120 / mês)</small></td>
                <td>Ilimitado</td>
              </tr>
              <tr>
                <th scope="row">Envios por WhatsApp</th>
                <td>5 / mês</td>
                <td>60 / mês</td>
                <td>Ilimitado</td>
              </tr>
              <tr>
                <th scope="row">Assinatura digital no PDF</th>
                <td>${ICON_X}</td>
                <td>${ICON_CHECK}</td>
                <td>${ICON_CHECK}</td>
              </tr>
              <tr>
                <th scope="row">Fotos no cadastro de equipamentos</th>
                <td>${ICON_X}</td>
                <td>${ICON_CHECK}</td>
                <td>${ICON_CHECK}</td>
              </tr>
              <tr>
                <th scope="row">Fotos nos registros de serviço</th>
                <td>${ICON_CHECK}</td>
                <td>${ICON_CHECK}</td>
                <td>${ICON_CHECK}</td>
              </tr>
              <tr>
                <th scope="row">Alertas de manutenção preventiva</th>
                <td>${ICON_CHECK}</td>
                <td>${ICON_CHECK}</td>
                <td>${ICON_CHECK}</td>
              </tr>
              <tr>
                <th scope="row">Agrupamento por setores</th>
                <td>${ICON_X}</td>
                <td>${ICON_X}</td>
                <td>${ICON_CHECK}</td>
              </tr>
              <tr>
                <th scope="row">Suporte prioritário</th>
                <td>${ICON_X}</td>
                <td>${ICON_X}</td>
                <td>${ICON_CHECK}</td>
              </tr>
              <tr>
                <th scope="row">Funciona offline</th>
                <td>${ICON_CHECK}</td>
                <td>${ICON_CHECK}</td>
                <td>${ICON_CHECK}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- ── FAQ ── -->
      <section class="pricing-faq" aria-label="Perguntas frequentes">
        <h3 class="pricing-faq__title">FAQ</h3>

        <details class="pricing-faq__item">
          <summary>Qual a diferença entre Plus e Pro?</summary>
          <p>
            <strong>Plus</strong> é pensado pra <strong>técnico autônomo</strong>: até 15 equipamentos, relatórios sem marca d'água (120/mês), assinatura digital do cliente, 60 envios de WhatsApp/mês e <strong>30 cadastros por foto (IA) por mês</strong>.
            <strong>Pro</strong> é pra <strong>equipe ou operação maior</strong>: equipamentos, PDFs e WhatsApp ilimitados, <strong>200 cadastros por foto (IA) por mês</strong>, agrupamento por setores e suporte prioritário.
          </p>
        </details>

        <details class="pricing-faq__item">
          <summary>Por que o cadastro por foto (IA) tem limite mensal?</summary>
          <p>
            Cada análise de placa usa uma IA que tem custo real por uso (pago em dólar, por token). Os limites (30/mês no Plus, 200/mês no Pro) cobrem com folga o uso de um técnico autônomo (Plus) ou de uma equipe pequena (Pro) sem inflacionar o preço do plano. Se você costuma cadastrar mais que isso por mês, fala com a gente — conseguimos ajustar.
          </p>
        </details>

        <details class="pricing-faq__item">
          <summary>Posso trocar de Plus pra Pro (ou vice-versa) depois?</summary>
          <p>Pode sim, a qualquer momento pelo portal de assinatura. A cobrança é ajustada proporcionalmente pelo Stripe — você paga/recebe a diferença.</p>
        </details>

        <details class="pricing-faq__item">
          <summary>Posso cancelar a qualquer momento?</summary>
          <p>Sim. Sem multa, sem burocracia. Clique em <strong>Gerenciar / cancelar</strong> e siga o fluxo no portal. O acesso pago fica ativo até o fim do período já pago.</p>
        </details>

        <details class="pricing-faq__item">
          <summary>O que acontece com meus dados se cancelar?</summary>
          <p>Seus dados ficam salvos. Você volta ao plano Gratuito com acesso a tudo que já foi registrado — apenas novos cadastros de equipamentos ficam limitados (máx. 3).</p>
        </details>

        <details class="pricing-faq__item">
          <summary>PIX e boleto estão disponíveis?</summary>
          <p>Ainda não. No momento o pagamento é feito apenas via <strong>cartão de crédito</strong>. PIX e boleto bancário estão previstos.</p>
        </details>

        <details class="pricing-faq__item">
          <summary>Posso usar em mais de um dispositivo?</summary>
          <p>Sim. Seu plano está vinculado à sua conta. Acesse de qualquer dispositivo com o mesmo login.</p>
        </details>

        <details class="pricing-faq__item">
          <summary>Como funciona o plano anual?</summary>
          <p>Você paga o valor anual de uma vez (Plus R$ 249, Pro R$ 419) e economiza ~28% em relação ao mensal. Pode cancelar a qualquer momento — o reembolso proporcional é feito conforme a política do Stripe.</p>
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
  const reason = normalizePricingReason(params?.reason);
  view.innerHTML = getPricingMarkup(currentPlanCode, { highlightPlan, reason });

  // ── Toggle mensal/anual (afeta Plus e Pro simultaneamente) ─────────────
  const toggleBtns = view.querySelectorAll(
    '.pricing-billing-toggle--global .pricing-billing-toggle__btn',
  );
  const plusMonthly = view.querySelector('#plus-price-monthly');
  const plusMonthlyDesc = view.querySelector('#plus-price-desc-monthly');
  const plusAnnual = view.querySelector('#plus-price-annual');
  const proMonthly = view.querySelector('#pro-price-monthly');
  const proMonthlyDesc = view.querySelector('#pro-price-desc-monthly');
  const proAnnual = view.querySelector('#pro-price-annual');
  const plusCheckoutBtn = view.querySelector('#btn-checkout-plus');
  const proCheckoutBtn = view.querySelector('#btn-checkout-pro');

  toggleBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const billing = btn.dataset.billing;
      toggleBtns.forEach((b) => b.classList.remove('pricing-billing-toggle__btn--active'));
      btn.classList.add('pricing-billing-toggle__btn--active');

      const showAnnual = billing === 'annual';

      if (plusMonthly) plusMonthly.style.display = showAnnual ? 'none' : '';
      if (plusMonthlyDesc) plusMonthlyDesc.style.display = showAnnual ? 'none' : '';
      if (plusAnnual) plusAnnual.style.display = showAnnual ? '' : 'none';
      if (proMonthly) proMonthly.style.display = showAnnual ? 'none' : '';
      if (proMonthlyDesc) proMonthlyDesc.style.display = showAnnual ? 'none' : '';
      if (proAnnual) proAnnual.style.display = showAnnual ? '' : 'none';

      if (plusCheckoutBtn) {
        plusCheckoutBtn.dataset.plan = showAnnual ? 'plus_annual' : 'plus';
        plusCheckoutBtn.textContent = showAnnual ? 'Assinar Plus anual →' : 'Assinar Plus →';
      }
      if (proCheckoutBtn) {
        proCheckoutBtn.dataset.plan = showAnnual ? 'pro_annual' : 'pro';
        proCheckoutBtn.textContent = showAnnual ? 'Assinar Pro anual →' : 'Assinar Pro →';
      }
    });
  });

  // ── Tabs segmentadas (mobile only — controladas por CSS @media) ──────────
  // A CSS esconde os cards sem .pricing-card--mobile-active abaixo de 720px.
  // Em desktop, todas as cards ficam visíveis e as tabs são display:none.
  const planTabs = view.querySelectorAll('.pricing-plan-tabs__btn');
  const planCards = view.querySelectorAll('.pricing-card[data-plan-card]');
  planTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.planTab;
      planTabs.forEach((b) => {
        const active = b === tab;
        b.classList.toggle('pricing-plan-tabs__btn--active', active);
        b.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      planCards.forEach((card) => {
        card.classList.toggle('pricing-card--mobile-active', card.dataset.planCard === target);
      });
      // Scroll suave pro topo do card escolhido (mantém contexto no mobile)
      const activeCard = view.querySelector(`.pricing-card[data-plan-card="${target}"]`);
      if (activeCard && window.innerWidth <= 720) {
        activeCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}
