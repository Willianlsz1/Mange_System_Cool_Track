-- ============================================================
-- Test: public.user_has_plus_plan(uuid) + public.user_has_pro_plan(uuid)
--
-- Helpers usados pelas triggers de plano. Valida que:
--   - Free → false
--   - Plus active → plus=true, pro=false
--   - Pro active → plus=true, pro=true
--   - Pro past_due → false (ambos)
--   - is_dev=true → true (ambos)
--   - null uuid → false
-- ============================================================

begin;

-- Fixtures: 4 usuários cobrindo as combinações.
-- IDs gerados com gen_random_uuid() pra não colidir com dados reais.
do $$
declare
  v_free_id uuid := gen_random_uuid();
  v_plus_id uuid := gen_random_uuid();
  v_pro_id uuid := gen_random_uuid();
  v_pro_past_due_id uuid := gen_random_uuid();
  v_dev_id uuid := gen_random_uuid();
begin
  -- Cria auth.users (mínimo pra satisfazer FK).
  insert into auth.users (id, email, encrypted_password, created_at, updated_at)
  values
    (v_free_id, 'free@test.local', '', now(), now()),
    (v_plus_id, 'plus@test.local', '', now(), now()),
    (v_pro_id, 'pro@test.local', '', now(), now()),
    (v_pro_past_due_id, 'pastdue@test.local', '', now(), now()),
    (v_dev_id, 'dev@test.local', '', now(), now());

  -- Remove auto-created profiles (handle_new_user trigger) pra poder inserir
  -- versões custom.
  delete from public.profiles where id in (v_free_id, v_plus_id, v_pro_id, v_pro_past_due_id, v_dev_id);

  -- Insere profiles via service_role path (bypass da protect_profile_insert).
  insert into public.profiles (id, plan, plan_code, subscription_status, is_dev)
  values
    (v_free_id, 'free', 'free', 'inactive', false),
    (v_plus_id, 'plus', 'plus', 'active', false),
    (v_pro_id, 'pro', 'pro', 'active', false),
    (v_pro_past_due_id, 'pro', 'pro', 'past_due', false),
    (v_dev_id, 'free', 'free', 'inactive', true);

  -- ── user_has_plus_plan ────────────────────────────────────────────
  if public.user_has_plus_plan(v_free_id) then
    raise exception 'FAIL: Free não deveria ter plus';
  end if;
  if not public.user_has_plus_plan(v_plus_id) then
    raise exception 'FAIL: Plus active deveria retornar true';
  end if;
  if not public.user_has_plus_plan(v_pro_id) then
    raise exception 'FAIL: Pro active deveria retornar true (plus+)';
  end if;
  if public.user_has_plus_plan(v_pro_past_due_id) then
    raise exception 'FAIL: Pro past_due não deveria ter plus';
  end if;
  if not public.user_has_plus_plan(v_dev_id) then
    raise exception 'FAIL: dev deveria retornar true';
  end if;
  if public.user_has_plus_plan(null) then
    raise exception 'FAIL: null deveria retornar false';
  end if;

  -- ── user_has_pro_plan ─────────────────────────────────────────────
  if public.user_has_pro_plan(v_free_id) then
    raise exception 'FAIL: Free não deveria ter pro';
  end if;
  if public.user_has_pro_plan(v_plus_id) then
    raise exception 'FAIL: Plus não deveria ter pro (é só plus)';
  end if;
  if not public.user_has_pro_plan(v_pro_id) then
    raise exception 'FAIL: Pro active deveria retornar true';
  end if;
  if public.user_has_pro_plan(v_pro_past_due_id) then
    raise exception 'FAIL: Pro past_due não deveria ter pro';
  end if;
  if not public.user_has_pro_plan(v_dev_id) then
    raise exception 'FAIL: dev deveria retornar true';
  end if;

  raise notice '✓ user_has_plus_plan + user_has_pro_plan: todos os casos passam';
end $$;

rollback;
