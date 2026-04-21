-- ============================================================
-- Test: public.stripe_webhook_events (idempotency ledger)
--
-- O handler stripe-webhook insere cada event.id nessa tabela antes de
-- processar. A PK em event_id serializa retries concorrentes e o handler
-- usa o erro 23505 pra detectar duplicates.
--
-- Valida:
--   - INSERT fresh event_id funciona
--   - INSERT do mesmo event_id levanta unique_violation (SQLSTATE 23505)
--   - UPDATE processed_at em linha existente funciona
--   - error_message aceita strings longas (truncado pra 500 no handler,
--     mas a coluna em si não tem limite)
-- ============================================================

begin;

do $$
declare
  v_fresh_id text := 'evt_test_fresh_' || gen_random_uuid()::text;
  v_dup_id text := 'evt_test_dup_' || gen_random_uuid()::text;
  v_caught_sqlstate text := null;
  v_processed timestamptz;
  v_err_msg text;
begin
  -- ── 1. Fresh INSERT ───────────────────────────────────────────────
  insert into public.stripe_webhook_events (event_id, event_type)
  values (v_fresh_id, 'checkout.session.completed');

  if not exists (
    select 1 from public.stripe_webhook_events where event_id = v_fresh_id
  ) then
    raise exception 'FAIL: fresh INSERT não persistiu a linha';
  end if;

  -- ── 2. Duplicate INSERT deve falhar com 23505 ─────────────────────
  insert into public.stripe_webhook_events (event_id, event_type)
  values (v_dup_id, 'invoice.paid');

  begin
    insert into public.stripe_webhook_events (event_id, event_type)
    values (v_dup_id, 'invoice.paid');
    raise exception 'FAIL: duplicate INSERT deveria ter falhado';
  exception
    when unique_violation then
      v_caught_sqlstate := SQLSTATE;
  end;

  if v_caught_sqlstate is null or v_caught_sqlstate <> '23505' then
    raise exception 'FAIL: esperava SQLSTATE 23505, peguei: %', v_caught_sqlstate;
  end if;

  -- Confirma que ainda há só 1 linha pro event_id duplicado
  if (select count(*) from public.stripe_webhook_events where event_id = v_dup_id) <> 1 then
    raise exception 'FAIL: deveria ter exatamente 1 linha pro dup_id';
  end if;

  -- ── 3. UPDATE processed_at ───────────────────────────────────────
  update public.stripe_webhook_events
    set processed_at = now(),
        subscription_id = 'sub_test_123',
        customer_id = 'cus_test_123',
        user_id = gen_random_uuid()
    where event_id = v_fresh_id;

  select processed_at into v_processed
  from public.stripe_webhook_events where event_id = v_fresh_id;

  if v_processed is null then
    raise exception 'FAIL: processed_at deveria estar preenchido após UPDATE';
  end if;

  -- ── 4. UPDATE error_message ──────────────────────────────────────
  update public.stripe_webhook_events
    set error_message = repeat('x', 500)
    where event_id = v_dup_id;

  select error_message into v_err_msg
  from public.stripe_webhook_events where event_id = v_dup_id;

  if v_err_msg is null or length(v_err_msg) <> 500 then
    raise exception 'FAIL: error_message não persistiu corretamente (got length %)',
      coalesce(length(v_err_msg), 0);
  end if;

  raise notice '✓ stripe_webhook_events: dedup + update funcionam';
end $$;

rollback;
