// @ts-nocheck
import Stripe from 'https://esm.sh/stripe@14?target=denonext';
import { createClient } from 'npm:@supabase/supabase-js@2';

function getRequiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value || !value.trim()) {
    throw new Error(`MISSING_ENV_${name}`);
  }
  return value.trim();
}

function getOptionalEnv(name: string) {
  return Deno.env.get(name)?.trim() ?? null;
}

function logWebhook(eventType: string, payload: Record<string, unknown>) {
  console.log(`[stripe-webhook] ${eventType}`, payload);
}

// ── Mapeamento plano <-> metadata / price_id ──────────────────────────────
//
// O plan_code final que vai pra tabela profiles é um dos 3 códigos canônicos:
// 'free' | 'plus' | 'pro'. As variantes mensal/anual vivem só no Stripe —
// aqui a gente colapsa pra base.

const PLAN_VARIANTS: Record<string, 'plus' | 'pro'> = {
  plus: 'plus',
  plus_annual: 'plus',
  pro: 'pro',
  pro_annual: 'pro',
};

function normalizeMetadataPlan(raw: unknown): 'plus' | 'pro' | null {
  const lower = String(raw || '').toLowerCase();
  return PLAN_VARIANTS[lower] ?? null;
}

/**
 * Monta um mapa "price_id do Stripe → plano canônico".
 * Usa as mesmas envs que o create-checkout-session lê para emitir os checkouts.
 */
function buildPriceIdMap(): Map<string, 'plus' | 'pro'> {
  const map = new Map<string, 'plus' | 'pro'>();
  const proMonthly = getOptionalEnv('STRIPE_PRICE_PRO');
  const proAnnual = getOptionalEnv('STRIPE_PRICE_PRO_ANNUAL');
  const plusMonthly = getOptionalEnv('STRIPE_PRICE_PLUS');
  const plusAnnual = getOptionalEnv('STRIPE_PRICE_PLUS_ANNUAL');

  if (proMonthly) map.set(proMonthly, 'pro');
  if (proAnnual) map.set(proAnnual, 'pro');
  if (plusMonthly) map.set(plusMonthly, 'plus');
  if (plusAnnual) map.set(plusAnnual, 'plus');

  return map;
}

/**
 * Tenta extrair o plano canônico dos metadados (preferido) ou, em fallback,
 * dos price IDs presentes nos items da subscription. Retorna null se não der
 * pra determinar — aí o chamador decide se mantém o plano atual ou usa default.
 */
function resolvePlanFromEvent(params: {
  metadata: Stripe.Metadata | null | undefined;
  subscriptionItems?: Stripe.SubscriptionItem[] | null;
  priceIdMap: Map<string, 'plus' | 'pro'>;
}): 'plus' | 'pro' | null {
  const fromMeta =
    normalizeMetadataPlan(params.metadata?.resolved_plan) ??
    normalizeMetadataPlan(params.metadata?.requested_plan);
  if (fromMeta) return fromMeta;

  // Fallback: inspeciona os items da subscription para achar um price conhecido.
  for (const item of params.subscriptionItems ?? []) {
    const priceId = item?.price?.id;
    if (priceId && params.priceIdMap.has(priceId)) {
      return params.priceIdMap.get(priceId) ?? null;
    }
  }

  return null;
}

async function updateProfileByUserId(
  supabase: any,
  userId: string,
  patch: Record<string, unknown>,
) {
  const result = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', userId)
    .select('id,plan,plan_code,subscription_status')
    .maybeSingle();

  logWebhook('profile_update_result', {
    userId,
    patch,
    data: result.data,
    error: result.error,
  });

  return result;
}

async function updateProfileBySubscriptionId(
  supabase: any,
  subscriptionId: string,
  patch: Record<string, unknown>,
) {
  const result = await supabase
    .from('profiles')
    .update(patch)
    .eq('stripe_subscription_id', subscriptionId)
    .select('id,plan,plan_code,subscription_status');

  logWebhook('profile_update_result', {
    subscriptionId,
    patch,
    data: result.data,
    error: result.error,
  });

  return result;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const stripeSecretKey = getRequiredEnv('STRIPE_SECRET_KEY');
    const webhookSecret = getRequiredEnv('STRIPE_WEBHOOK_SIGNING_SECRET');
    const supabaseUrl = getRequiredEnv('SUPABASE_URL');
    const serviceRoleKey = getRequiredEnv('SERVICE_ROLE_KEY');

    const stripe = new Stripe(stripeSecretKey);
    const signature = req.headers.get('Stripe-Signature');

    if (!signature) {
      return new Response('Falta Stripe-Signature', { status: 400 });
    }

    const body = await req.text();

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (error) {
      console.error('[stripe-webhook] assinatura inválida', error);
      return new Response(
        `Webhook inválido: ${error instanceof Error ? error.message : 'erro desconhecido'}`,
        { status: 400 },
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const priceIdMap = buildPriceIdMap();

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.supabase_user_id || session.client_reference_id || null;
        const customerId = typeof session.customer === 'string' ? session.customer : null;
        const subscriptionId =
          typeof session.subscription === 'string' ? session.subscription : null;

        logWebhook(event.type, {
          userId,
          customerId,
          subscriptionId,
          metadata: session.metadata,
          clientReferenceId: session.client_reference_id,
        });

        if (!userId) {
          logWebhook(event.type, { skipped: true, reason: 'missing_user_id' });
          break;
        }

        // Se o metadata não for conclusivo, busca a subscription para ler o price_id.
        let subscriptionItems: Stripe.SubscriptionItem[] | null = null;
        if (subscriptionId) {
          try {
            const sub = await stripe.subscriptions.retrieve(subscriptionId);
            subscriptionItems = sub.items?.data ?? null;
          } catch (err) {
            logWebhook('subscription_fetch_failed', {
              subscriptionId,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }

        const resolvedPlan =
          resolvePlanFromEvent({
            metadata: session.metadata,
            subscriptionItems,
            priceIdMap,
          }) ?? 'pro'; // default defensivo: se nada bateu, mantém comportamento legado

        await updateProfileByUserId(supabase, userId, {
          plan_code: resolvedPlan,
          plan: resolvedPlan,
          subscription_status: 'active',
          billing_provider: 'stripe',
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
        });

        break;
      }

      case 'customer.subscription.updated': {
        // Disparado quando o usuário troca de tier pelo portal (upgrade Plus→Pro
        // ou downgrade Pro→Plus), reativa após cancelamento, etc.
        const subscription = event.data.object as Stripe.Subscription;
        const subscriptionId = subscription.id;
        const customerId = typeof subscription.customer === 'string' ? subscription.customer : null;
        const status = subscription.status; // active, past_due, canceled, trialing, ...

        logWebhook(event.type, {
          subscriptionId,
          customerId,
          status,
          metadata: subscription.metadata,
        });

        const resolvedPlan = resolvePlanFromEvent({
          metadata: subscription.metadata,
          subscriptionItems: subscription.items?.data ?? null,
          priceIdMap,
        });

        // Mapeia status do Stripe → status usado no app (subscription_status).
        let appStatus: string;
        if (status === 'active' || status === 'trialing') {
          appStatus = 'active';
        } else if (status === 'past_due' || status === 'unpaid') {
          appStatus = 'past_due';
        } else if (status === 'canceled' || status === 'incomplete_expired') {
          appStatus = 'canceled';
        } else {
          appStatus = 'inactive';
        }

        const patch: Record<string, unknown> = {
          subscription_status: appStatus,
        };
        // Só sobrescreve o plan_code se a gente tem certeza do tier.
        if (resolvedPlan) {
          patch.plan_code = resolvedPlan;
          patch.plan = resolvedPlan;
        }
        // Se foi cancelado, volta a Free.
        if (appStatus === 'canceled') {
          patch.plan_code = 'free';
          patch.plan = 'free';
        }

        await updateProfileBySubscriptionId(supabase, subscriptionId, patch);
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId =
          typeof invoice.subscription === 'string' ? invoice.subscription : null;
        const customerId = typeof invoice.customer === 'string' ? invoice.customer : null;

        logWebhook(event.type, { subscriptionId, customerId });

        if (!subscriptionId) break;

        await updateProfileBySubscriptionId(supabase, subscriptionId, {
          subscription_status: 'active',
        });

        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId =
          typeof invoice.subscription === 'string' ? invoice.subscription : null;
        const customerId = typeof invoice.customer === 'string' ? invoice.customer : null;

        logWebhook(event.type, { subscriptionId, customerId });

        if (!subscriptionId) break;

        await updateProfileBySubscriptionId(supabase, subscriptionId, {
          subscription_status: 'past_due',
        });

        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const subscriptionId = subscription.id;
        const customerId = typeof subscription.customer === 'string' ? subscription.customer : null;

        logWebhook(event.type, { subscriptionId, customerId });

        await updateProfileBySubscriptionId(supabase, subscriptionId, {
          plan_code: 'free',
          plan: 'free',
          subscription_status: 'canceled',
        });

        break;
      }

      default:
        logWebhook('ignored_event', { eventType: event.type });
        break;
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[stripe-webhook] erro interno', error);
    const message = error instanceof Error ? error.message : 'Erro interno';

    if (message.startsWith('MISSING_ENV_')) {
      return new Response(`Falta ${message.replace('MISSING_ENV_', '')}`, { status: 500 });
    }

    return new Response('Erro interno', { status: 500 });
  }
});
