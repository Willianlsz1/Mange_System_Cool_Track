-- ============================================================
-- DB-level enforcement: limites de equipamentos e registros mensais
-- Date: 2026-04-20
--
-- Contexto:
--   Depois de fechar o gate de fotos (migration 20260420130000) e setores
--   (20260420140000), os últimos buracos de bypass via SDK direto são:
--     1. Criação de equipamentos acima do limite do plano (Free=3, Plus=15).
--     2. Criação de registros acima do limite mensal do Free (5/mês).
--
--   Ambos hoje são bloqueados só client-side (canCreateEquipment no
--   equipamentos.js, checkLimits no registro.js). Usuário com dev tools
--   consegue:
--     supabase.from('equipamentos').insert({ ...payload })  -- N vezes
--     supabase.from('registros').insert({ ...payload })     -- N vezes
--
--   Esta migration fecha os dois buracos com triggers BEFORE INSERT.
--
-- Manutenção:
--   Os limites estão hardcoded em SQL (get_plan_equipamentos_limit + 5 no
--   trigger de registros). IMPORTANTE: se mudar PLAN_CATALOG em
--   src/core/subscriptionPlans.js, atualizar também essa função. Grep por
--   "PLAN_CATALOG LIMITS MIRROR" pra achar os dois pontos.
--
-- Escopo:
--   - INSERT equipamentos → conta rows do user, compara com limite do plano
--   - INSERT registros → se Free, conta rows criados no mês, compara com 5
--   - service_role → bypassa
--   - is_dev=true → bypassa (coerente com getEffectivePlan client-side)
--
-- Idempotente: CREATE OR REPLACE + DROP trigger antes de CREATE.
-- Defensive: migration adiciona coluna created_at em registros se não
-- existir (necessária pro filtro mensal).
-- ============================================================

-- ── Helper: limite de equipamentos pro usuário ──────────────────────────
-- PLAN_CATALOG LIMITS MIRROR — fonte: src/core/subscriptionPlans.js
--   Free = 3, Plus = 15, Pro = unlimited (2^31-1 aqui por praticidade).
create or replace function public.get_plan_equipamentos_limit(p_user_id uuid)
returns integer
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
    return 0;
  end if;

  select plan_code, subscription_status, coalesce(is_dev, false)
    into v_plan_code, v_status, v_is_dev
  from public.profiles
  where id = p_user_id;

  -- Dev bypass: sem limite.
  if v_is_dev then
    return 2147483647;
  end if;

  -- Subscription precisa estar ativa pra valer Plus/Pro. Caso contrário
  -- trata como Free (consistente com getEffectivePlan client-side).
  if v_status is null or v_status not in ('active', 'trialing') then
    return 3; -- Free
  end if;

  if v_plan_code = 'pro' then
    return 2147483647;
  end if;

  if v_plan_code = 'plus' then
    return 15;
  end if;

  return 3; -- Free fallback
end;
$$;

comment on function public.get_plan_equipamentos_limit(uuid) is
  'Retorna o limite de equipamentos do usuário (Free=3, Plus=15, Pro/dev=unlimited). Espelha PLAN_CATALOG em subscriptionPlans.js.';

-- ── Trigger: equipamentos INSERT count ──────────────────────────────────
create or replace function public.enforce_equipamentos_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_count integer;
  v_limit integer;
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

  v_limit := public.get_plan_equipamentos_limit(new.user_id);

  -- Count rows atuais do usuário (excluindo o que está sendo inserido).
  select count(*) into v_count
  from public.equipamentos
  where user_id = new.user_id;

  if v_count >= v_limit then
    raise exception 'equipamentos limit reached for your plan (used=%, limit=%)',
      v_count, v_limit
      using errcode = '42501';
  end if;

  return new;
end;
$$;

comment on function public.enforce_equipamentos_limit() is
  'Bloqueia INSERT em equipamentos quando o user já atingiu o limite do plano.';

-- ── Trigger: registros monthly limit (só Free) ──────────────────────────
-- Conta registros criados no mês corrente (timezone UTC) e bloqueia se
-- Free atingiu 5. Plus/Pro/dev passam direto.
create or replace function public.enforce_registros_monthly_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_plan_code text;
  v_status text;
  v_is_dev boolean;
  v_count integer;
  v_limit constant integer := 5; -- Free limit (PLAN_CATALOG LIMITS MIRROR)
begin
  -- service_role bypassa.
  begin
    v_role := coalesce(auth.role(), '');
  exception when others then
    v_role := '';
  end;

  if v_role = 'service_role' then
    return new;
  end if;

  -- Lê plano do user.
  select plan_code, subscription_status, coalesce(is_dev, false)
    into v_plan_code, v_status, v_is_dev
  from public.profiles
  where id = new.user_id;

  -- Dev / Plus / Pro → unlimited.
  if v_is_dev then
    return new;
  end if;

  if v_plan_code in ('plus', 'pro')
     and v_status in ('active', 'trialing') then
    return new;
  end if;

  -- Free: count rows criados nesse mês (UTC).
  select count(*) into v_count
  from public.registros
  where user_id = new.user_id
    and created_at >= date_trunc('month', timezone('utc', now()));

  if v_count >= v_limit then
    raise exception 'monthly registros limit reached for Free plan (used=%, limit=%)',
      v_count, v_limit
      using errcode = '42501';
  end if;

  return new;
end;
$$;

comment on function public.enforce_registros_monthly_limit() is
  'Bloqueia INSERT em registros quando Free atingiu 5/mês. Plus/Pro/dev passam.';

-- ── Attach triggers (se tabelas existem) ────────────────────────────────
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'equipamentos'
  ) then
    drop trigger if exists enforce_equipamentos_limit_trigger on public.equipamentos;
    create trigger enforce_equipamentos_limit_trigger
      before insert on public.equipamentos
      for each row execute function public.enforce_equipamentos_limit();
  else
    raise notice 'Tabela public.equipamentos não existe — pulando trigger (esperado em shadow DB).';
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'registros'
  ) then
    -- Defensivo: garante que a coluna created_at existe no registros.
    -- Se a tabela foi criada out-of-band sem created_at, o filtro do trigger
    -- quebraria. ALTER ... ADD COLUMN IF NOT EXISTS é idempotente.
    alter table public.registros
      add column if not exists created_at timestamptz not null default timezone('utc', now());

    drop trigger if exists enforce_registros_monthly_limit_trigger on public.registros;
    create trigger enforce_registros_monthly_limit_trigger
      before insert on public.registros
      for each row execute function public.enforce_registros_monthly_limit();
  else
    raise notice 'Tabela public.registros não existe — pulando trigger (esperado em shadow DB).';
  end if;
end $$;
