-- push_subscriptions — Armazena as Web Push subscriptions dos usuários
create table if not exists public.push_subscriptions (
  user_id    uuid        primary key references auth.users(id) on delete cascade,
  subscription text      not null,
  user_agent text,
  updated_at  timestamptz not null default timezone('utc', now()),
  created_at  timestamptz not null default timezone('utc', now())
);

alter table public.push_subscriptions enable row level security;

-- Usuário só acessa sua própria subscription
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='push_subscriptions' and policyname='push_sub_own') then
    create policy push_sub_own on public.push_subscriptions
      for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;
