-- ============================================================
-- Test: stuck claim recovery em public.stripe_webhook_events
--
-- Migration 20260425150000 adicionou a coluna claimed_at + índice parcial
-- pra detectar reservas abandonadas (claim sem processed_at nem
-- error_message, idade > 5 min). O handler stripe-webhook usa essa coluna
-- para re-reivindicar o evento em vez de retornar 500.
--
-- Valida:
--   - INSERT default popula claimed_at automaticamente
--   - claim antigo (>5min) sem processed_at/error_message é detectado pela
--     query do índice parcial
--   - claim recente (<5min) sem processed_at/error_message NÃO é detectado
--   - claim antigo MAS com error_message NÃO aparece (retry_failed flow)
--   - claim antigo MAS com processed_at NÃO aparece (sucesso)
--   - re-reclaim (UPDATE) atualiza claimed_at e limpa error_message
-- ============================================================

begin;

do $$
declare
  v_stuck_id text := 'evt_test_stuck_' || gen_random_uuid()::text;
  v_recent_id text := 'evt_test_recent_' || gen_random_uuid()::text;
  v_failed_id text := 'evt_test_failed_' || gen_random_uuid()::text;
  v_processed_id text := 'evt_test_processed_' || gen_random_uuid()::text;
  v_count int;
  v_new_claimed timestamptz;
begin
  -- ── 1. INSERT default popula claimed_at ─────────────────────────
  insert into public.stripe_webhook_events (event_id, event_type)
  values (v_recent_id, 'invoice.paid');

  if (
    select claimed_at from public.stripe_webhook_events where event_id = v_recent_id
  ) is null then
    raise exception 'FAIL: claimed_at default deveria popular automaticamente';
  end if;

  -- ── 2. Stuck event (claimed há 10 min, sem progresso) ──────────
  insert into public.stripe_webhook_events (event_id, event_type, claimed_at)
  values (v_stuck_id, 'checkout.session.completed', now() - interval '10 minutes');

  -- Query do índice parcial: pega claims abandonados há mais de 5 minutos
  select count(*) into v_count
  from public.stripe_webhook_events
  where processed_at is null
    and error_message is null
    and claimed_at < now() - interval '5 minutes'
    and event_id = v_stuck_id;

  if v_count <> 1 then
    raise exception 'FAIL: stuck event deveria ser detectado (got count=%)', v_count;
  end if;

  -- ── 3. Recent event (claimed agora) NÃO é detectado ────────────
  select count(*) into v_count
  from public.stripe_webhook_events
  where processed_at is null
    and error_message is null
    and claimed_at < now() - interval '5 minutes'
    and event_id = v_recent_id;

  if v_count <> 0 then
    raise exception 'FAIL: recent event não deveria aparecer como stuck (got count=%)', v_count;
  end if;

  -- ── 4. Old + error_message (retry_failed) NÃO aparece ──────────
  insert into public.stripe_webhook_events (event_id, event_type, claimed_at, error_message)
  values (v_failed_id, 'invoice.paid', now() - interval '10 minutes', 'simulated failure');

  select count(*) into v_count
  from public.stripe_webhook_events
  where processed_at is null
    and error_message is null
    and claimed_at < now() - interval '5 minutes'
    and event_id = v_failed_id;

  if v_count <> 0 then
    raise exception 'FAIL: failed event (com error_message) não deveria contar como stuck';
  end if;

  -- ── 5. Old + processed_at (sucesso) NÃO aparece ───────────────
  insert into public.stripe_webhook_events (event_id, event_type, claimed_at, processed_at)
  values (v_processed_id, 'invoice.paid', now() - interval '10 minutes', now() - interval '5 minutes');

  select count(*) into v_count
  from public.stripe_webhook_events
  where processed_at is null
    and error_message is null
    and claimed_at < now() - interval '5 minutes'
    and event_id = v_processed_id;

  if v_count <> 0 then
    raise exception 'FAIL: processed event não deveria contar como stuck';
  end if;

  -- ── 6. Re-reclaim do stuck event ──────────────────────────────
  update public.stripe_webhook_events
    set claimed_at = now(),
        error_message = null
    where event_id = v_stuck_id
      and processed_at is null;

  select claimed_at into v_new_claimed
  from public.stripe_webhook_events where event_id = v_stuck_id;

  if v_new_claimed < now() - interval '1 minute' then
    raise exception 'FAIL: re-reclaim deveria ter atualizado claimed_at pro agora';
  end if;

  raise notice '✓ stripe_webhook_events stuck recovery funciona';
end $$;

rollback;
