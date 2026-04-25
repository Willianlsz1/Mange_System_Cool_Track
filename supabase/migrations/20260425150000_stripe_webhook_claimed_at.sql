-- ============================================================
-- Stripe webhook ledger: claimed_at + stuck-claim recovery
-- Date: 2026-04-25
--
-- Contexto:
--   O ledger public.stripe_webhook_events serializa retries do Stripe via
--   PK em event_id. O fluxo no edge function é:
--     1. INSERT (claim)
--     2. Processa o evento (call Stripe API, UPDATE em profiles, etc)
--     3. UPDATE processed_at = now() (mark processed)
--   Se o passo 2 lançar exception controlada → catch grava error_message
--   pra próxima retry tentar de novo. Mas se a Edge Function MORRER entre
--   1 e 2/3 (OOM, timeout do edge runtime, redeploy mid-execution, crash
--   sem catch), a linha fica com processed_at=null E error_message=null —
--   o handler atual interpreta isso como "evento sendo processado por
--   outra instância" e retorna 500. Stripe retenta, vê o mesmo estado,
--   loop indefinido até desistir (~3 dias). Evento é perdido sem aviso.
--
-- Fix:
--   Adiciona coluna claimed_at preenchida no INSERT (via default da coluna).
--   No handler, quando o lookup retorna in_progress, calcula a idade do
--   claim. Se > 5 minutos, considera abandonada e re-reivindica (UPDATE
--   resetando claimed_at). Se < 5 minutos, comportamento atual (500).
--
-- Backfill:
--   Linhas existentes recebem claimed_at = received_at como aproximação.
--   Sem isso, primeiro retry pós-deploy de um evento legado já passaria
--   no threshold de 5min e re-reivindicaria — desejável, mas vamos
--   explicitar pra ficar auditável.
--
-- Idempotente: guarda contra information_schema.columns. Default só é
-- aplicado se a coluna foi adicionada agora; se já existia, não mexe.
-- ============================================================

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'stripe_webhook_events'
      and column_name = 'claimed_at'
  ) then
    alter table public.stripe_webhook_events
      add column claimed_at timestamptz;

    -- Backfill: legacy rows ficam com received_at como melhor aproximação.
    update public.stripe_webhook_events
      set claimed_at = received_at
      where claimed_at is null;

    -- Default só depois do backfill, pra não causar default-fill em rows
    -- legadas (queremos received_at, não now()).
    alter table public.stripe_webhook_events
      alter column claimed_at set default timezone('utc', now());
  end if;
end $$;

comment on column public.stripe_webhook_events.claimed_at is
  'Timestamp em que o handler reivindicou o evento (INSERT). Usado para detectar reservas stuck — se um retry vê claimed_at < now() - 5min sem processed_at nem error_message, considera abandonada e re-reivindica. Backfill: linhas pré-2026-04-25 receberam received_at.';

-- Índice pra queries de incident response (ex: "todos os eventos stuck há
-- mais de 5 minutos sem processar?").
create index if not exists stripe_webhook_events_stuck_lookup_idx
  on public.stripe_webhook_events (claimed_at)
  where processed_at is null and error_message is null;
