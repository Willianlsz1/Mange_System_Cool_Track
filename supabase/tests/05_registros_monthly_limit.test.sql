-- ============================================================
-- Test: enforce_registros_monthly_limit em public.registros
--
-- Valida que:
--   - Free: 5 INSERT no mês passam, 6º bloqueia (42501)
--   - Free: registro com created_at no mês anterior NÃO conta (reset mensal)
--   - Plus: muitos INSERTs passam (unlimited)
--   - Pro: muitos INSERTs passam (unlimited)
--   - dev: bypassa
--   - UPDATE em registro Free não aciona limit (trigger é BEFORE INSERT only)
-- ============================================================

begin;

do $$
declare
  v_free_id uuid := gen_random_uuid();
  v_plus_id uuid := gen_random_uuid();
  v_pro_id uuid := gen_random_uuid();
  v_dev_id uuid := gen_random_uuid();
  v_equip_free text := gen_random_uuid()::text;
  v_equip_plus text := gen_random_uuid()::text;
  v_equip_pro text := gen_random_uuid()::text;
  v_equip_dev text := gen_random_uuid()::text;
  v_first_reg_id text;
  i integer;
begin
  insert into auth.users (id, email, encrypted_password, created_at, updated_at)
  values
    (v_free_id, 'f5@test.local', '', now(), now()),
    (v_plus_id, 'p5@test.local', '', now(), now()),
    (v_pro_id, 'pro5@test.local', '', now(), now()),
    (v_dev_id, 'dev5@test.local', '', now(), now());

  delete from public.profiles where id in (v_free_id, v_plus_id, v_pro_id, v_dev_id);
  insert into public.profiles (id, plan, plan_code, subscription_status, is_dev)
  values
    (v_free_id, 'free', 'free', 'inactive', false),
    (v_plus_id, 'plus', 'plus', 'active', false),
    (v_pro_id, 'pro', 'pro', 'active', false),
    (v_dev_id, 'free', 'free', 'inactive', true);

  -- Setup: cria 1 equipamento pra cada user (service_role-ish via DO block).
  -- Como o trigger de equipamentos_limit também roda, fazemos antes de trocar
  -- de role pra authenticated. O DO block aqui roda como postgres (owner)
  -- então auth.role() é null, o que já bate o fallback "não é service_role"
  -- mas equipamentos_limit com Free vai deixar porque só temos 1.
  perform set_config('request.jwt.claims', json_build_object('sub', v_free_id)::text, true);
  set local role authenticated;
  insert into public.equipamentos (id, user_id, nome, tipo, local, status)
  values (v_equip_free, v_free_id, 'Eq Free', 'Split', 'Sala', 'ok');

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', v_plus_id)::text, true);
  set local role authenticated;
  insert into public.equipamentos (id, user_id, nome, tipo, local, status)
  values (v_equip_plus, v_plus_id, 'Eq Plus', 'Split', 'Sala', 'ok');

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', v_pro_id)::text, true);
  set local role authenticated;
  insert into public.equipamentos (id, user_id, nome, tipo, local, status)
  values (v_equip_pro, v_pro_id, 'Eq Pro', 'Split', 'Sala', 'ok');

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', v_dev_id)::text, true);
  set local role authenticated;
  insert into public.equipamentos (id, user_id, nome, tipo, local, status)
  values (v_equip_dev, v_dev_id, 'Eq Dev', 'Split', 'Sala', 'ok');

  -- ── Caso 1: Free — 5 inserts passam, 6º bloqueia ────────────────────
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', v_free_id)::text, true);
  set local role authenticated;

  for i in 1..5 loop
    begin
      insert into public.registros (id, user_id, equip_id, data, tipo, obs, status)
      values (
        gen_random_uuid()::text, v_free_id, v_equip_free,
        to_char(now(), 'YYYY-MM-DD'), 'manutencao', 'Obs ' || i, 'ok'
      );
    exception when others then
      raise exception 'FAIL caso 1 (Free registro #%% deveria passar): % %', i, sqlstate, sqlerrm;
    end;
  end loop;
  raise notice '✓ Free: 5 registros no mês passaram';

  begin
    insert into public.registros (id, user_id, equip_id, data, tipo, obs, status)
    values (
      gen_random_uuid()::text, v_free_id, v_equip_free,
      to_char(now(), 'YYYY-MM-DD'), 'manutencao', 'Obs 6', 'ok'
    );
    raise exception 'FAIL caso 1: 6º registro Free deveria ter sido bloqueado';
  exception
    when insufficient_privilege then raise notice '✓ Free 6º registro bloqueado';
    when others then raise exception 'FAIL caso 1 (errcode %): %', sqlstate, sqlerrm;
  end;

  -- ── Caso 2: Free — mover created_at dos 5 registros pro mês anterior
  --          libera novos 5 inserts nesse mês (reset mensal). ──────────
  reset role;
  update public.registros
    set created_at = date_trunc('month', timezone('utc', now())) - interval '10 days'
    where user_id = v_free_id;

  perform set_config('request.jwt.claims', json_build_object('sub', v_free_id)::text, true);
  set local role authenticated;
  begin
    insert into public.registros (id, user_id, equip_id, data, tipo, obs, status)
    values (
      gen_random_uuid()::text, v_free_id, v_equip_free,
      to_char(now(), 'YYYY-MM-DD'), 'manutencao', 'New month', 'ok'
    );
    raise notice '✓ Free: registro em novo mês passou (reset mensal)';
  exception when others then
    raise exception 'FAIL caso 2 (reset mensal deveria permitir): % %', sqlstate, sqlerrm;
  end;

  -- ── Caso 3: Plus — 10 registros no mesmo mês passam ─────────────────
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', v_plus_id)::text, true);
  set local role authenticated;

  for i in 1..10 loop
    begin
      insert into public.registros (id, user_id, equip_id, data, tipo, obs, status)
      values (
        gen_random_uuid()::text, v_plus_id, v_equip_plus,
        to_char(now(), 'YYYY-MM-DD'), 'manutencao', 'Plus ' || i, 'ok'
      );
    exception when others then
      raise exception 'FAIL caso 3 (Plus insert #%% deveria passar): % %', i, sqlstate, sqlerrm;
    end;
  end loop;
  raise notice '✓ Plus: 10 registros passaram (unlimited)';

  -- ── Caso 4: Pro — 10 registros passam ───────────────────────────────
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', v_pro_id)::text, true);
  set local role authenticated;

  for i in 1..10 loop
    begin
      insert into public.registros (id, user_id, equip_id, data, tipo, obs, status)
      values (
        gen_random_uuid()::text, v_pro_id, v_equip_pro,
        to_char(now(), 'YYYY-MM-DD'), 'manutencao', 'Pro ' || i, 'ok'
      );
    exception when others then
      raise exception 'FAIL caso 4 (Pro insert #%% deveria passar): % %', i, sqlstate, sqlerrm;
    end;
  end loop;
  raise notice '✓ Pro: 10 registros passaram (unlimited)';

  -- ── Caso 5: dev — 10 registros passam ───────────────────────────────
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', v_dev_id)::text, true);
  set local role authenticated;

  for i in 1..10 loop
    begin
      insert into public.registros (id, user_id, equip_id, data, tipo, obs, status)
      values (
        gen_random_uuid()::text, v_dev_id, v_equip_dev,
        to_char(now(), 'YYYY-MM-DD'), 'manutencao', 'Dev ' || i, 'ok'
      );
    exception when others then
      raise exception 'FAIL caso 5 (dev insert #%% deveria passar): % %', i, sqlstate, sqlerrm;
    end;
  end loop;
  raise notice '✓ dev: 10 registros passaram (bypass)';

  -- ── Caso 6: UPDATE em registro Free não aciona trigger ──────────────
  -- (trigger é BEFORE INSERT, então UPDATE nunca conta)
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', v_free_id)::text, true);
  set local role authenticated;

  select id into v_first_reg_id
    from public.registros
    where user_id = v_free_id
    limit 1;

  if v_first_reg_id is not null then
    begin
      update public.registros set obs = 'Edited obs' where id = v_first_reg_id;
      raise notice '✓ Free UPDATE em registro existente: passou (trigger ignora UPDATE)';
    exception when others then
      raise exception 'FAIL caso 6 (UPDATE deveria passar): % %', sqlstate, sqlerrm;
    end;
  end if;

  raise notice '✓✓ enforce_registros_monthly_limit: 6/6 casos passaram';
end $$;

rollback;
