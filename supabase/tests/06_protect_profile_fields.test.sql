-- ============================================================
-- Test: protect_profile_fields + protect_profile_insert em public.profiles
--
-- Valida que:
--   UPDATE (protect_profile_fields):
--     - User autenticado muda nome → passa
--     - User autenticado muda plan_code → bloqueia (42501)
--     - User autenticado muda plan → bloqueia
--     - User autenticado muda subscription_status → bloqueia
--     - User autenticado muda is_dev → bloqueia
--     - User autenticado muda stripe_customer_id → bloqueia
--     - User autenticado muda stripe_subscription_id → bloqueia
--
--   INSERT (protect_profile_insert):
--     - User autenticado insere profile com plan='free', plan_code='free',
--       subscription_status='inactive', is_dev=false → passa
--     - User autenticado insere com plan_code='pro' → bloqueia
--     - User autenticado insere com is_dev=true → bloqueia
-- ============================================================

begin;

do $$
declare
  v_user_id uuid := gen_random_uuid();
  v_insert_user_id uuid := gen_random_uuid();
begin
  -- Setup UPDATE test: cria user com profile já existente (free).
  insert into auth.users (id, email, encrypted_password, created_at, updated_at)
  values (v_user_id, 'pp@test.local', '', now(), now());

  -- handle_new_user trigger auto-cria o profile. Garante que ele está no
  -- estado esperado.
  update public.profiles
    set plan = 'free',
        plan_code = 'free',
        subscription_status = 'inactive',
        is_dev = false,
        stripe_customer_id = null,
        stripe_subscription_id = null,
        nome = 'Orig Name'
    where id = v_user_id;

  -- Se handle_new_user não criou (em ambientes sem trigger), insere manual
  -- via service_role path (antes de trocar role).
  insert into public.profiles (id, plan, plan_code, subscription_status, is_dev, nome)
  values (v_user_id, 'free', 'free', 'inactive', false, 'Orig Name')
  on conflict (id) do nothing;

  -- Simula sessão autenticada desse user.
  perform set_config('request.jwt.claims', json_build_object('sub', v_user_id)::text, true);
  set local role authenticated;

  -- ── Caso 1: UPDATE nome → passa ─────────────────────────────────────
  begin
    update public.profiles set nome = 'New Name' where id = v_user_id;
    raise notice '✓ UPDATE nome: passou';
  exception when others then
    raise exception 'FAIL caso 1 (UPDATE nome deveria passar): % %', sqlstate, sqlerrm;
  end;

  -- ── Caso 2: UPDATE plan_code → bloqueia ─────────────────────────────
  begin
    update public.profiles set plan_code = 'pro' where id = v_user_id;
    raise exception 'FAIL caso 2: UPDATE plan_code deveria ter sido bloqueado';
  exception
    when insufficient_privilege then raise notice '✓ UPDATE plan_code bloqueado';
    when others then raise exception 'FAIL caso 2 (errcode %): %', sqlstate, sqlerrm;
  end;

  -- ── Caso 3: UPDATE plan → bloqueia ──────────────────────────────────
  begin
    update public.profiles set plan = 'pro' where id = v_user_id;
    raise exception 'FAIL caso 3: UPDATE plan deveria ter sido bloqueado';
  exception
    when insufficient_privilege then raise notice '✓ UPDATE plan bloqueado';
    when others then raise exception 'FAIL caso 3 (errcode %): %', sqlstate, sqlerrm;
  end;

  -- ── Caso 4: UPDATE subscription_status → bloqueia ───────────────────
  begin
    update public.profiles set subscription_status = 'active' where id = v_user_id;
    raise exception 'FAIL caso 4: UPDATE subscription_status deveria ter sido bloqueado';
  exception
    when insufficient_privilege then raise notice '✓ UPDATE subscription_status bloqueado';
    when others then raise exception 'FAIL caso 4 (errcode %): %', sqlstate, sqlerrm;
  end;

  -- ── Caso 5: UPDATE is_dev → bloqueia ────────────────────────────────
  begin
    update public.profiles set is_dev = true where id = v_user_id;
    raise exception 'FAIL caso 5: UPDATE is_dev deveria ter sido bloqueado';
  exception
    when insufficient_privilege then raise notice '✓ UPDATE is_dev bloqueado';
    when others then raise exception 'FAIL caso 5 (errcode %): %', sqlstate, sqlerrm;
  end;

  -- ── Caso 6: UPDATE stripe_customer_id → bloqueia ────────────────────
  begin
    update public.profiles set stripe_customer_id = 'cus_xxx' where id = v_user_id;
    raise exception 'FAIL caso 6: UPDATE stripe_customer_id deveria ter sido bloqueado';
  exception
    when insufficient_privilege then raise notice '✓ UPDATE stripe_customer_id bloqueado';
    when others then raise exception 'FAIL caso 6 (errcode %): %', sqlstate, sqlerrm;
  end;

  -- ── Caso 7: UPDATE stripe_subscription_id → bloqueia ────────────────
  begin
    update public.profiles set stripe_subscription_id = 'sub_xxx' where id = v_user_id;
    raise exception 'FAIL caso 7: UPDATE stripe_subscription_id deveria ter sido bloqueado';
  exception
    when insufficient_privilege then raise notice '✓ UPDATE stripe_subscription_id bloqueado';
    when others then raise exception 'FAIL caso 7 (errcode %): %', sqlstate, sqlerrm;
  end;

  -- ── Setup INSERT test: cria um auth.user novo, mas delete o profile
  --    auto-criado pra poder testar o INSERT manual. ──────────────────
  reset role;
  insert into auth.users (id, email, encrypted_password, created_at, updated_at)
  values (v_insert_user_id, 'ppi@test.local', '', now(), now());
  delete from public.profiles where id = v_insert_user_id;

  -- Simula sessão autenticada desse novo user.
  perform set_config('request.jwt.claims', json_build_object('sub', v_insert_user_id)::text, true);
  set local role authenticated;

  -- ── Caso 8: INSERT profile free/inactive/not-dev → passa ────────────
  begin
    insert into public.profiles (id, plan, plan_code, subscription_status, is_dev)
    values (v_insert_user_id, 'free', 'free', 'inactive', false);
    raise notice '✓ INSERT profile Free legítimo: passou';
  exception when others then
    raise exception 'FAIL caso 8 (INSERT Free deveria passar): % %', sqlstate, sqlerrm;
  end;

  -- Cleanup pra próximo INSERT negativo.
  reset role;
  delete from public.profiles where id = v_insert_user_id;
  perform set_config('request.jwt.claims', json_build_object('sub', v_insert_user_id)::text, true);
  set local role authenticated;

  -- ── Caso 9: INSERT profile com plan_code='pro' → bloqueia ───────────
  begin
    insert into public.profiles (id, plan, plan_code, subscription_status, is_dev)
    values (v_insert_user_id, 'free', 'pro', 'inactive', false);
    raise exception 'FAIL caso 9: INSERT plan_code=pro deveria ter sido bloqueado';
  exception
    when insufficient_privilege then raise notice '✓ INSERT plan_code=pro bloqueado';
    when others then raise exception 'FAIL caso 9 (errcode %): %', sqlstate, sqlerrm;
  end;

  -- ── Caso 10: INSERT profile com is_dev=true → bloqueia ──────────────
  begin
    insert into public.profiles (id, plan, plan_code, subscription_status, is_dev)
    values (v_insert_user_id, 'free', 'free', 'inactive', true);
    raise exception 'FAIL caso 10: INSERT is_dev=true deveria ter sido bloqueado';
  exception
    when insufficient_privilege then raise notice '✓ INSERT is_dev=true bloqueado';
    when others then raise exception 'FAIL caso 10 (errcode %): %', sqlstate, sqlerrm;
  end;

  -- ── Caso 11: INSERT profile com subscription_status='active' → bloqueia
  begin
    insert into public.profiles (id, plan, plan_code, subscription_status, is_dev)
    values (v_insert_user_id, 'free', 'free', 'active', false);
    raise exception 'FAIL caso 11: INSERT subscription_status=active deveria ter sido bloqueado';
  exception
    when insufficient_privilege then raise notice '✓ INSERT subscription_status=active bloqueado';
    when others then raise exception 'FAIL caso 11 (errcode %): %', sqlstate, sqlerrm;
  end;

  raise notice '✓✓ protect_profile_fields + protect_profile_insert: 11/11 casos passaram';
end $$;

rollback;
