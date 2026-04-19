-- ============================================================
-- Proteção de colunas sensíveis em public.profiles
-- Date: 2026-04-19
--
-- Problema (ALTO): a policy `profiles_update_own` libera UPDATE em
-- qualquer coluna do próprio row. Usuário autenticado conseguia fazer:
--   supabase.from('profiles').update({ plan_code: 'pro' }).eq('id', userId)
-- …e virar Pro no banco sem passar pelo webhook do Kiwify.
--
-- Fix: trigger BEFORE UPDATE que bloqueia mudanças em colunas de
-- monetização (plan, plan_code, subscription_status, is_dev, stripe_*)
-- quando a sessão não é service_role. O webhook do Kiwify roda com
-- service_role e segue fluindo normal.
--
-- Campos que o user pode editar livremente (sem restrição):
--   nome, updated_at  (via supabase SDK)
-- Campos bloqueados (só service_role):
--   plan, plan_code, subscription_status, is_dev,
--   stripe_customer_id, stripe_subscription_id
-- ============================================================

create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  -- Service_role bypassa: é o webhook do Kiwify atualizando plano.
  -- auth.role() retorna 'service_role' quando a request usa a chave service.
  begin
    v_role := coalesce(auth.role(), '');
  exception when others then
    v_role := '';
  end;

  if v_role = 'service_role' then
    return new;
  end if;

  -- Para usuários autenticados (auth.uid() = id), bloqueia alterações
  -- nas colunas de monetização. Qualquer tentativa retorna 42501
  -- (insufficient_privilege) que o supabase-js traduz pra erro RLS.
  if coalesce(new.plan_code, '') is distinct from coalesce(old.plan_code, '') then
    raise exception 'cannot modify plan_code' using errcode = '42501';
  end if;

  if coalesce(new.plan, '') is distinct from coalesce(old.plan, '') then
    raise exception 'cannot modify plan' using errcode = '42501';
  end if;

  if coalesce(new.subscription_status, '') is distinct from coalesce(old.subscription_status, '') then
    raise exception 'cannot modify subscription_status' using errcode = '42501';
  end if;

  if coalesce(new.is_dev, false) is distinct from coalesce(old.is_dev, false) then
    raise exception 'cannot modify is_dev' using errcode = '42501';
  end if;

  -- Colunas do Stripe/Kiwify: só o webhook deve mexer.
  if coalesce(new.stripe_customer_id, '') is distinct from coalesce(old.stripe_customer_id, '') then
    raise exception 'cannot modify stripe_customer_id' using errcode = '42501';
  end if;

  if coalesce(new.stripe_subscription_id, '') is distinct from coalesce(old.stripe_subscription_id, '') then
    raise exception 'cannot modify stripe_subscription_id' using errcode = '42501';
  end if;

  return new;
end;
$$;

-- Idempotente: dropa trigger antigo antes de criar
drop trigger if exists protect_profile_fields_trigger on public.profiles;

create trigger protect_profile_fields_trigger
  before update on public.profiles
  for each row execute function public.protect_profile_fields();

-- Também bloqueia INSERT com is_dev=true ou plan=pro pra cortar o caminho
-- óbvio do "insere perfil já premiado". Signup legítimo vai pelo trigger
-- handle_new_user (SECURITY DEFINER) que força plan='free', is_dev=false.
create or replace function public.protect_profile_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  begin
    v_role := coalesce(auth.role(), '');
  exception when others then
    v_role := '';
  end;

  if v_role = 'service_role' then
    return new;
  end if;

  -- Usuários autenticados só conseguem inserir profile como free/inactive.
  if coalesce(new.plan_code, 'free') <> 'free' then
    raise exception 'cannot create profile with non-free plan_code' using errcode = '42501';
  end if;

  if coalesce(new.plan, 'free') <> 'free' then
    raise exception 'cannot create profile with non-free plan' using errcode = '42501';
  end if;

  if coalesce(new.subscription_status, 'inactive') <> 'inactive' then
    raise exception 'cannot create profile with active subscription' using errcode = '42501';
  end if;

  if coalesce(new.is_dev, false) = true then
    raise exception 'cannot create profile with is_dev=true' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_profile_insert_trigger on public.profiles;

create trigger protect_profile_insert_trigger
  before insert on public.profiles
  for each row execute function public.protect_profile_insert();
