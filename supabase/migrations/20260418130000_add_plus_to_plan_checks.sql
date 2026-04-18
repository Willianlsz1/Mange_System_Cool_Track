-- Atualiza as CHECK constraints em profiles para aceitar o tier 'plus'.
-- Antes só existiam 'free' e 'pro', o que impede o webhook do Stripe de
-- gravar compras do Plus (erro 23514 violates check constraint).
--
-- Cobre tanto profiles_plan_code_check (nova, em plan_code) quanto
-- profiles_plan_check (legada, em plan), já que existem as duas colunas.

do $$
begin
  -- Remove constraint antiga de plan_code se existir (aceita só free/pro)
  if exists (
    select 1 from pg_constraint
    where conname = 'profiles_plan_code_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles drop constraint profiles_plan_code_check;
  end if;

  -- Recria aceitando os 3 tiers
  alter table public.profiles
    add constraint profiles_plan_code_check
    check (plan_code in ('free', 'plus', 'pro'));
end $$;

do $$
begin
  -- Remove constraint legada de plan se existir
  if exists (
    select 1 from pg_constraint
    where conname = 'profiles_plan_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles drop constraint profiles_plan_check;
  end if;

  -- Recria aceitando os 3 tiers (só se a coluna plan existir)
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'plan'
  ) then
    alter table public.profiles
      add constraint profiles_plan_check
      check (plan in ('free', 'plus', 'pro'));
  end if;
end $$;
