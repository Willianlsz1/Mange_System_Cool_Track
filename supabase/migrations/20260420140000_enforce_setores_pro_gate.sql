-- ============================================================
-- DB-level enforcement: setores são feature exclusiva do plano Pro
-- Date: 2026-04-20
--
-- Contexto:
--   Hoje o gate "setores" é 100% client-side (hasProAccess em setorModal e
--   equipamentos.js:1709). A RLS `setores_insert_own` só valida ownership
--   (auth.uid() = user_id), permitindo que qualquer usuário Free faça:
--     supabase.from('setores').insert({ user_id, nome: 'X', cor: '#fff' })
--   …e use a feature premium sem pagar.
--
--   Esta migration fecha o bypass com trigger BEFORE INSERT/UPDATE em
--   public.setores que exige plano Pro (ou dev/service_role).
--
-- Escopo:
--   - INSERT em setores → precisa Pro
--   - UPDATE em setores (editar nome/cor) → precisa Pro
--   - service_role → bypassa (para backfills e admin)
--   - is_dev=true → bypassa (coerente com getEffectivePlan client-side)
--
-- Nota sobre equipamentos.setor_id:
--   Não precisa de trigger extra porque a FK só aceita setor_id que exista
--   em public.setores. Se o user Free não consegue criar setores, não
--   consegue assignar setor_id a um equipamento. Grandfathered users
--   (downgraded de Pro) mantêm seus setores antigos — a RLS de delete
--   continua owner-scoped, então podem limpar se quiserem.
--
-- Idempotente: CREATE OR REPLACE + DROP trigger antes de CREATE.
-- ============================================================

-- Helper: retorna true se o user_id tem plano Pro ativo.
-- Paralelo a user_has_plus_plan() (migration 20260420130000), mas mais estrito.
-- Usa SECURITY DEFINER pra ler profiles sem passar pelas RLS daquela tabela.
create or replace function public.user_has_pro_plan(p_user_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_plan_code text;
  v_status text;
  v_is_dev boolean;
begin
  if p_user_id is null then
    return false;
  end if;

  select plan_code, subscription_status, coalesce(is_dev, false)
    into v_plan_code, v_status, v_is_dev
  from public.profiles
  where id = p_user_id;

  -- Dev bypass: casa com getEffectivePlan() client-side.
  if v_is_dev then
    return true;
  end if;

  -- Apenas Pro com assinatura ativa/trialing (diferente de Plus).
  if v_plan_code = 'pro'
     and v_status in ('active', 'trialing') then
    return true;
  end if;

  return false;
end;
$$;

comment on function public.user_has_pro_plan(uuid) is
  'True se o usuário tem plano Pro com assinatura ativa (ou é dev). Usado por triggers de gate de features Pro-exclusivas (setores, suporte prioritário, etc).';

-- ── Trigger em public.setores ───────────────────────────────────────────
create or replace function public.enforce_setores_pro_gate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  -- service_role (webhooks, admin) bypassa.
  begin
    v_role := coalesce(auth.role(), '');
  exception when others then
    v_role := '';
  end;

  if v_role = 'service_role' then
    return new;
  end if;

  if not public.user_has_pro_plan(auth.uid()) then
    raise exception 'setores require Pro plan' using errcode = '42501';
  end if;

  return new;
end;
$$;

comment on function public.enforce_setores_pro_gate() is
  'Bloqueia INSERT/UPDATE em public.setores para usuários fora do plano Pro.';

-- Só cria o trigger se a tabela existe (evita quebrar shadow DB do CI).
do $$
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'setores'
  ) then
    raise notice 'Tabela public.setores não existe — pulando trigger (esperado em shadow DB).';
    return;
  end if;

  drop trigger if exists enforce_setores_pro_gate_trigger on public.setores;

  create trigger enforce_setores_pro_gate_trigger
    before insert or update on public.setores
    for each row execute function public.enforce_setores_pro_gate();
end $$;
