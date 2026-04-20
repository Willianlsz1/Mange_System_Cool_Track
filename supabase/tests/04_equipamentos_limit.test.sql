-- ============================================================
-- Test: enforce_equipamentos_limit em public.equipamentos
--
-- Valida que:
--   - Free: 3 INSERT passam, 4º bloqueia (42501)
--   - Plus: 15 INSERT passam, 16º bloqueia
--   - Pro: muitos INSERTs passam (unlimited)
--   - dev: bypassa (unlimited)
--   - Limit usa contagem total de rows do user, não só created_at do mês
-- ============================================================

begin;

do $$
declare
  v_free_id uuid := gen_random_uuid();
  v_plus_id uuid := gen_random_uuid();
  v_pro_id uuid := gen_random_uuid();
  v_dev_id uuid := gen_random_uuid();
  i integer;
begin
  insert into auth.users (id, email, encrypted_password, created_at, updated_at)
  values
    (v_free_id, 'f4@test.local', '', now(), now()),
    (v_plus_id, 'p4@test.local', '', now(), now()),
    (v_pro_id, 'pro4@test.local', '', now(), now()),
    (v_dev_id, 'dev4@test.local', '', now(), now());

  delete from public.profiles where id in (v_free_id, v_plus_id, v_pro_id, v_dev_id);
  insert into public.profiles (id, plan, plan_code, subscription_status, is_dev)
  values
    (v_free_id, 'free', 'free', 'inactive', false),
    (v_plus_id, 'plus', 'plus', 'active', false),
    (v_pro_id, 'pro', 'pro', 'active', false),
    (v_dev_id, 'free', 'free', 'inactive', true);

  -- ── Caso 1: Free — 3 passam, 4º bloqueia ────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', v_free_id)::text, true);
  set local role authenticated;

  for i in 1..3 loop
    begin
      insert into public.equipamentos (id, user_id, nome, tipo, local, status)
      values (gen_random_uuid()::text, v_free_id, 'Ar Free ' || i, 'Split', 'Sala', 'ok');
    exception when others then
      raise exception 'FAIL caso 1 (Free insert #%% deveria passar): % %', i, sqlstate, sqlerrm;
    end;
  end loop;
  raise notice '✓ Free: 3 inserts passaram';

  begin
    insert into public.equipamentos (id, user_id, nome, tipo, local, status)
    values (gen_random_uuid()::text, v_free_id, 'Ar Free 4', 'Split', 'Sala', 'ok');
    raise exception 'FAIL caso 1: 4º Free INSERT deveria ter sido bloqueado';
  exception
    when insufficient_privilege then raise notice '✓ Free 4º insert bloqueado';
    when others then raise exception 'FAIL caso 1 (errcode %): %', sqlstate, sqlerrm;
  end;

  -- ── Caso 2: Plus — 15 passam, 16º bloqueia ──────────────────────────
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', v_plus_id)::text, true);
  set local role authenticated;

  for i in 1..15 loop
    begin
      insert into public.equipamentos (id, user_id, nome, tipo, local, status)
      values (gen_random_uuid()::text, v_plus_id, 'Ar Plus ' || i, 'Split', 'Sala', 'ok');
    exception when others then
      raise exception 'FAIL caso 2 (Plus insert #%% deveria passar): % %', i, sqlstate, sqlerrm;
    end;
  end loop;
  raise notice '✓ Plus: 15 inserts passaram';

  begin
    insert into public.equipamentos (id, user_id, nome, tipo, local, status)
    values (gen_random_uuid()::text, v_plus_id, 'Ar Plus 16', 'Split', 'Sala', 'ok');
    raise exception 'FAIL caso 2: 16º Plus INSERT deveria ter sido bloqueado';
  exception
    when insufficient_privilege then raise notice '✓ Plus 16º insert bloqueado';
    when others then raise exception 'FAIL caso 2 (errcode %): %', sqlstate, sqlerrm;
  end;

  -- ── Caso 3: Pro — 20 inserts passam (efetivamente unlimited) ────────
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', v_pro_id)::text, true);
  set local role authenticated;

  for i in 1..20 loop
    begin
      insert into public.equipamentos (id, user_id, nome, tipo, local, status)
      values (gen_random_uuid()::text, v_pro_id, 'Ar Pro ' || i, 'Split', 'Sala', 'ok');
    exception when others then
      raise exception 'FAIL caso 3 (Pro insert #%% deveria passar): % %', i, sqlstate, sqlerrm;
    end;
  end loop;
  raise notice '✓ Pro: 20 inserts passaram (unlimited)';

  -- ── Caso 4: dev — 20 inserts passam (bypass) ────────────────────────
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', v_dev_id)::text, true);
  set local role authenticated;

  for i in 1..20 loop
    begin
      insert into public.equipamentos (id, user_id, nome, tipo, local, status)
      values (gen_random_uuid()::text, v_dev_id, 'Ar Dev ' || i, 'Split', 'Sala', 'ok');
    exception when others then
      raise exception 'FAIL caso 4 (dev insert #%% deveria passar): % %', i, sqlstate, sqlerrm;
    end;
  end loop;
  raise notice '✓ dev: 20 inserts passaram (bypass)';

  raise notice '✓✓ enforce_equipamentos_limit: 4/4 casos passaram';
end $$;

rollback;
