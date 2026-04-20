-- ============================================================
-- Test: enforce_setores_pro_gate em public.setores
--
-- Valida que:
--   - Free INSERT setor → bloqueia (42501)
--   - Plus INSERT setor → bloqueia (setor é Pro-only, não Plus)
--   - Pro INSERT setor → passa
--   - Pro UPDATE setor → passa
--   - Pro past_due INSERT → bloqueia (assinatura inativa)
--   - dev INSERT → passa
-- ============================================================

begin;

do $$
declare
  v_free_id uuid := gen_random_uuid();
  v_plus_id uuid := gen_random_uuid();
  v_pro_id uuid := gen_random_uuid();
  v_pro_past_due_id uuid := gen_random_uuid();
  v_dev_id uuid := gen_random_uuid();
  v_setor_pro_id text;
begin
  insert into auth.users (id, email, encrypted_password, created_at, updated_at)
  values
    (v_free_id, 'f3@test.local', '', now(), now()),
    (v_plus_id, 'p3@test.local', '', now(), now()),
    (v_pro_id, 'pro3@test.local', '', now(), now()),
    (v_pro_past_due_id, 'pd3@test.local', '', now(), now()),
    (v_dev_id, 'dev3@test.local', '', now(), now());

  delete from public.profiles where id in (v_free_id, v_plus_id, v_pro_id, v_pro_past_due_id, v_dev_id);
  insert into public.profiles (id, plan, plan_code, subscription_status, is_dev)
  values
    (v_free_id, 'free', 'free', 'inactive', false),
    (v_plus_id, 'plus', 'plus', 'active', false),
    (v_pro_id, 'pro', 'pro', 'active', false),
    (v_pro_past_due_id, 'pro', 'pro', 'past_due', false),
    (v_dev_id, 'free', 'free', 'inactive', true);

  -- Caso 1: Free → bloqueia
  perform set_config('request.jwt.claims', json_build_object('sub', v_free_id)::text, true);
  set local role authenticated;
  begin
    insert into public.setores (id, user_id, nome, cor)
    values (gen_random_uuid()::text, v_free_id, 'Sala 1', '#00c8e8');
    raise exception 'FAIL caso 1: Free deveria ter sido bloqueado';
  exception
    when insufficient_privilege then raise notice '✓ Free bloqueado';
    when others then raise exception 'FAIL caso 1 (errcode %): %', sqlstate, sqlerrm;
  end;

  -- Caso 2: Plus → bloqueia (setor é Pro-only)
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', v_plus_id)::text, true);
  set local role authenticated;
  begin
    insert into public.setores (id, user_id, nome, cor)
    values (gen_random_uuid()::text, v_plus_id, 'Sala 2', '#00c8e8');
    raise exception 'FAIL caso 2: Plus deveria ter sido bloqueado';
  exception
    when insufficient_privilege then raise notice '✓ Plus bloqueado';
    when others then raise exception 'FAIL caso 2 (errcode %): %', sqlstate, sqlerrm;
  end;

  -- Caso 3: Pro → passa
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', v_pro_id)::text, true);
  set local role authenticated;
  v_setor_pro_id := gen_random_uuid()::text;
  begin
    insert into public.setores (id, user_id, nome, cor)
    values (v_setor_pro_id, v_pro_id, 'Sala Pro', '#00c8e8');
    raise notice '✓ Pro INSERT passou';
  exception when others then
    raise exception 'FAIL caso 3 (Pro INSERT deveria passar): % %', sqlstate, sqlerrm;
  end;

  -- Caso 4: Pro UPDATE → passa
  begin
    update public.setores set nome = 'Sala Pro Edit' where id = v_setor_pro_id;
    raise notice '✓ Pro UPDATE passou';
  exception when others then
    raise exception 'FAIL caso 4 (Pro UPDATE deveria passar): % %', sqlstate, sqlerrm;
  end;

  -- Caso 5: Pro past_due → bloqueia
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', v_pro_past_due_id)::text, true);
  set local role authenticated;
  begin
    insert into public.setores (id, user_id, nome, cor)
    values (gen_random_uuid()::text, v_pro_past_due_id, 'Sala PastDue', '#00c8e8');
    raise exception 'FAIL caso 5: Pro past_due deveria ter sido bloqueado';
  exception
    when insufficient_privilege then raise notice '✓ Pro past_due bloqueado';
    when others then raise exception 'FAIL caso 5 (errcode %): %', sqlstate, sqlerrm;
  end;

  -- Caso 6: dev → passa
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', v_dev_id)::text, true);
  set local role authenticated;
  begin
    insert into public.setores (id, user_id, nome, cor)
    values (gen_random_uuid()::text, v_dev_id, 'Sala Dev', '#00c8e8');
    raise notice '✓ dev passou';
  exception when others then
    raise exception 'FAIL caso 6 (dev deveria passar): % %', sqlstate, sqlerrm;
  end;

  raise notice '✓✓ enforce_setores_pro_gate: 6/6 casos passaram';
end $$;

rollback;
