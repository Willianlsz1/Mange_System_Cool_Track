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

function logWebhook(eventType: string, payload: Record<string, unknown>) {
  console.log(`[stripe-webhook] ${eventType}`, payload);
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

        await updateProfileByUserId(supabase, userId, {
          plan_code: 'pro',
          plan: 'pro',
          subscription_status: 'active',
          billing_provider: 'stripe',
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
        });

        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId =
          typeof invoice.subscription === 'string' ? invoice.subscription : null;
        const customerId = typeof invoice.customer === 'string' ? invoice.customer : null;

        logWebhook(event.type, { subscriptionId, customerId });

        if (!subscriptionId) break;

        const result = await supabase
          .from('profiles')
          .update({ subscription_status: 'active' })
          .eq('stripe_subscription_id', subscriptionId)
          .select('id,subscription_status');

        logWebhook('profile_update_result', {
          eventType: event.type,
          subscriptionId,
          customerId,
          data: result.data,
          error: result.error,
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

        const result = await supabase
          .from('profiles')
          .update({ subscription_status: 'past_due' })
          .eq('stripe_subscription_id', subscriptionId)
          .select('id,subscription_status');

        logWebhook('profile_update_result', {
          eventType: event.type,
          subscriptionId,
          customerId,
          data: result.data,
          error: result.error,
        });

        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const subscriptionId = subscription.id;
        const customerId = typeof subscription.customer === 'string' ? subscription.customer : null;

        logWebhook(event.type, { subscriptionId, customerId });

        const result = await supabase
          .from('profiles')
          .update({
            plan_code: 'free',
            plan: 'free',
            subscription_status: 'canceled',
          })
          .eq('stripe_subscription_id', subscriptionId)
          .select('id,plan,plan_code,subscription_status');

        logWebhook('profile_update_result', {
          eventType: event.type,
          subscriptionId,
          customerId,
          data: result.data,
          error: result.error,
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
