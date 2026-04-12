-- Security hardening for subscription plan and monthly usage limits.
-- Date: 2026-04-11

alter table public.profiles
  add column if not exists plan_code text not null default 'free';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_plan_code_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_plan_code_check
      check (plan_code in ('free', 'pro'));
  end if;
end $$;

create table if not exists public.usage_monthly (
  user_id uuid not null references auth.users (id) on delete cascade,
  month_start date not null,
  resource text not null,
  used_count integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint usage_monthly_resource_check check (resource in ('pdf_export', 'whatsapp_share')),
  constraint usage_monthly_used_count_check check (used_count >= 0)
);

create unique index if not exists usage_monthly_user_month_resource_uk
  on public.usage_monthly (user_id, month_start, resource);

alter table public.usage_monthly enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'usage_monthly'
      and policyname = 'usage_monthly_select_own'
  ) then
    create policy usage_monthly_select_own
      on public.usage_monthly
      for select
      to authenticated
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'usage_monthly'
      and policyname = 'usage_monthly_insert_own'
  ) then
    create policy usage_monthly_insert_own
      on public.usage_monthly
      for insert
      to authenticated
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'usage_monthly'
      and policyname = 'usage_monthly_update_own'
  ) then
    create policy usage_monthly_update_own
      on public.usage_monthly
      for update
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

create or replace function public.increment_monthly_usage(
  p_user_id uuid,
  p_resource text,
  p_month_start date default null,
  p_delta integer default 1
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_used integer;
  v_month_start date;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_resource not in ('pdf_export', 'whatsapp_share') then
    raise exception 'invalid resource';
  end if;

  if p_delta is null or p_delta < 1 then
    raise exception 'delta must be >= 1';
  end if;

  v_month_start := coalesce(p_month_start, date_trunc('month', timezone('utc', now()))::date);
  if v_month_start <> date_trunc('month', v_month_start)::date then
    raise exception 'month_start must be first day of month';
  end if;

  insert into public.usage_monthly (user_id, month_start, resource, used_count, updated_at)
  values (p_user_id, v_month_start, p_resource, p_delta, timezone('utc', now()))
  on conflict (user_id, month_start, resource)
  do update set
    used_count = public.usage_monthly.used_count + excluded.used_count,
    updated_at = timezone('utc', now())
  returning used_count into v_used;

  return v_used;
end;
$$;

grant execute on function public.increment_monthly_usage(uuid, text, date, integer) to authenticated;
