-- ============================================================
-- Stripe webhook idempotency ledger
-- Date: 2026-04-20
--
-- Contexto:
--   O handler stripe-webhook/index.ts hoje processa eventos sem dedup.
--   Stripe entrega o mesmo event.id várias vezes quando o endpoint responde
--   lento (>10s), dá 5xx, ou quando a gente redeploy a função durante um
--   retry em vôo. Sem idempotência, isso causa:
--
--     1. UPDATEs duplicados em profiles (inofensivo em prática, mas ruim
--        pra trilha de auditoria e analytics).
--     2. Race entre uma retry "stale" que chega DEPOIS de um evento mais
--        novo — ex: 'customer.subscription.updated' (plan_code=pro) chega,
--        processa, aí um retry atrasado de 'checkout.session.completed'
--        (plan_code=plus) chega e sobrescreve, fazendo downgrade silencioso.
--     3. Log poluído — dificulta incident response.
--
--   Esta migration cria a tabela de ledger que o handler vai consultar
--   antes de processar cada evento. A lógica fica no edge function:
--   INSERT com ON CONFLICT DO NOTHING + RETURNING; se nada foi inserido,
--   é duplicado → retorna 200 imediatamente.
--
-- Escopo:
--   - Tabela public.stripe_webhook_events (event_id PK)
--   - RLS: bloqueado para todo mundo exceto service_role (o próprio webhook)
--   - Sem auto-cleanup — em prod com 10-50 eventos/dia, 1M rows demora >50 anos
--     pra acumular. Se virar problema, cria job pg_cron depois.
--
-- Idempotente: CREATE TABLE IF NOT EXISTS.
-- ============================================================

create table if not exists public.stripe_webhook_events (
  event_id      text primary key,
  event_type    text not null,
  received_at   timestamptz not null default timezone('utc', now()),
  processed_at  timestamptz,
  -- Metadata opcional pra debug. NÃO guardamos o payload inteiro (já está no
  -- Stripe dashboard); só o que é útil pra correlacionar.
  subscription_id text,
  customer_id     text,
  user_id         uuid,
  -- Se o processamento falhar, a gente grava o erro aqui pra auditoria.
  -- Null = sucesso OR ainda não processado.
  error_message text
);

comment on table public.stripe_webhook_events is
  'Ledger de eventos do Stripe já recebidos. Usado pelo edge function stripe-webhook pra idempotência: INSERT com ON CONFLICT DO NOTHING antes de processar. Se conflita, é retry — responde 200 e não processa de novo.';

comment on column public.stripe_webhook_events.event_id is
  'event.id do Stripe (ex: evt_1NqG2M2eZvKYlo2C8xDoEf5K). PK garante dedup.';

comment on column public.stripe_webhook_events.processed_at is
  'Null enquanto o handler está processando. Setado após sucesso. Se ficar null por muito tempo com error_message populado, é evento morto que precisa de retry manual.';

-- Índices pra queries de incident response (ex: "quais webhooks falharam
-- pro customer X nas últimas 24h?").
create index if not exists stripe_webhook_events_received_at_idx
  on public.stripe_webhook_events (received_at desc);

create index if not exists stripe_webhook_events_customer_id_idx
  on public.stripe_webhook_events (customer_id)
  where customer_id is not null;

create index if not exists stripe_webhook_events_user_id_idx
  on public.stripe_webhook_events (user_id)
  where user_id is not null;

-- ── RLS ──────────────────────────────────────────────────────────────────
-- Nenhum usuário autenticado deve poder ler esse ledger (contém customer_id
-- do Stripe que pode cruzar contas). Só service_role acessa.
alter table public.stripe_webhook_events enable row level security;

-- Drop any existing policies to keep migration idempotent.
do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'stripe_webhook_events'
  ) then
    execute (
      select string_agg(
        format('drop policy %I on public.stripe_webhook_events;', policyname),
        ' '
      )
      from pg_policies
      where schemaname = 'public' and tablename = 'stripe_webhook_events'
    );
  end if;
end $$;

-- Nenhuma policy = ninguém acessa via PostgREST. service_role bypassa RLS
-- por default no Supabase, então o edge function (que usa SERVICE_ROLE_KEY)
-- continua funcionando.
--
-- Documentação defensiva do porquê NÃO criar policies:
-- Ao não criar nenhuma policy, qualquer SELECT/INSERT via authenticated ou
-- anon falha com "permission denied". Só o service_role passa.
