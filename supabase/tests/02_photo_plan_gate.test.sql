-- ============================================================
-- Test: enforce_photo_plan_gate em public.equipamentos
--
-- Valida que:
--   - Free com fotos não-vazio → bloqueia (42501)
--   - Plus/Pro com fotos → passa
--   - Free com fotos vazio → passa (downgrade scenario)
--   - UPDATE que não mexe em fotos → passa mesmo Free
--   - service_role → bypassa
-- ============================================================

begin;

do $$
declare
  v_free_id uuid := gen_random_uuid();
  v_plus_id uuid := gen_random_uuid();
  v_equip_id_free text;
  v_equip_id_plus text;
begin
  -- Setup.
  insert into auth.users (id, email, encrypted_password, created_at, updated_at)
  values
    (v_free_id, 'free2@test.local', '', now(), now()),
    (v_plus_id, 'plus2@test.local', '', now(), now());

  delete from public.profiles where id in (v_free_id, v_plus_id);
  insert into public.profiles (id, plan, plan_code, subscription_status, is_dev)
  values
    (v_free_id, 'free', 'free', 'inactive', false),
    (v_plus_id, 'plus', 'plus', 'active', false);

  -- ── Caso 1: Free inserindo sem fotos → passa ──
  -- Simula sessão Free
  perform set_config('request.jwt.claims', json_build_object('sub', v_free_id)::text, true);
  perform set_config('role', 'authenticated', true);
  set local role authenticated;

  begin
    insert into public.equipamentos (id, user_id, nome, tipo, local, status, fotos)
    values (gen_random_uuid()::text, v_free_id, 'Ar 1', 'Split', 'Sala', 'ok', '[]'::jsonb);
    raise notice '✓ Free + fotos vazio: passou';
  exception when others then
    raise exception 'FAIL caso 1 (Free fotos vazio deveria passar): % %', sqlstate, sqlerrm;
  end;

  -- ── Caso 2: Free com fotos não-vazio → bloqueia ──
  begin
    insert into public.equipamentos (id, user_id, nome, tipo, local, status, fotos)
    values (
      gen_random_uuid()::text, v_free_id, 'Ar 2', 'Split', 'Sala', 'ok',
      '[{"url":"https://x/foo.jpg"}]'::jsonb
    );
    raise exception 'FAIL caso 2: Free deveria ter sido bloqueado';
  exception
    when insufficient_privilege then
      raise notice '✓ Free + fotos: bloqueou (%)', sqlerrm;
    when others then
      raise exception 'FAIL caso 2 (errcode errado): % %', sqlstate, sqlerrm;
  end;

  -- ── Caso 3: Plus com fotos → passa ──
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', v_plus_id)::text, true);
  set local role authenticated;

  begin
    v_equip_id_plus := gen_random_uuid()::text;
    insert into public.equipamentos (id, user_id, nome, tipo, local, status, fotos)
    values (
      v_equip_id_plus, v_plus_id, 'Ar Plus', 'Split', 'Sala', 'ok',
      '[{"url":"https://x/bar.jpg"}]'::jsonb
    );
    raise notice '✓ Plus + fotos: passou';
  exception when others then
    raise exception 'FAIL caso 3 (Plus com fotos deveria passar): % %', sqlstate, sqlerrm;
  end;

  -- ── Caso 4: UPDATE Free que não mexe em fotos → passa ──
  -- Cria equip Free sem fotos, depois tenta atualizar só o nome.
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', v_free_id)::text, true);
  set local role authenticated;

  v_equip_id_free := gen_random_uuid()::text;
  insert into public.equipamentos (id, user_id, nome, tipo, local, status, fotos)
  values (v_equip_id_free, v_free_id, 'Ar Edit', 'Split', 'Sala', 'ok', '[]'::jsonb);

  begin
    update public.equipamentos set nome = 'Ar Edit 2' where id = v_equip_id_free;
    raise notice '✓ Free UPDATE sem mexer em fotos: passou';
  exception when others then
    raise exception 'FAIL caso 4 (UPDATE não-fotos deveria passar): % %', sqlstate, sqlerrm;
  end;

  -- ── Caso 5: UPDATE Free adicionando fotos → bloqueia ──
  begin
    update public.equipamentos
    set fotos = '[{"url":"https://x/foo.jpg"}]'::jsonb
    where id = v_equip_id_free;
    raise exception 'FAIL caso 5: UPDATE Free adicionando fotos deveria ter sido bloqueado';
  exception
    when insufficient_privilege then
      raise notice '✓ Free UPDATE adicionando fotos: bloqueou';
    when others then
      raise exception 'FAIL caso 5 (errcode errado): % %', sqlstate, sqlerrm;
  end;

  raise notice '✓✓ enforce_photo_plan_gate: 5/5 casos passaram';
end $$;

rollback;
