-- Allow "nameplate_analysis" as a tracked monthly resource so we can give Free
-- plan users a single free AI nameplate scan per month (sales trial). Plus and
-- Pro remain unmetered on this resource (enforced at the edge function layer).

-- 1. Relax the check constraint on public.usage_monthly to accept the new resource.
do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'usage_monthly_resource_check'
      and conrelid = 'public.usage_monthly'::regclass
  ) then
    alter table public.usage_monthly
      drop constraint usage_monthly_resource_check;
  end if;

  alter table public.usage_monthly
    add constraint usage_monthly_resource_check
    check (resource in ('pdf_export', 'whatsapp_share', 'nameplate_analysis'));
end $$;

-- 2. Update the RPC so it also accepts the new resource. Keep security definer
--    + auth.uid() check + month_start validation + delta >= 1 guard intact.
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

  if p_resource not in ('pdf_export', 'whatsapp_share', 'nameplate_analysis') then
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
