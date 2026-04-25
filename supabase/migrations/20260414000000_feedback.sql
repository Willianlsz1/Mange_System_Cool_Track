-- ============================================================
-- feedback — Avaliações e sugestões enviadas pelos usuários
-- Date: 2026-04-14
-- ============================================================

create table if not exists public.feedback (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        references auth.users(id) on delete set null,
  user_email   text,
  rating       int         not null check (rating between 1 and 5),
  message      text,
  created_at   timestamptz not null default timezone('utc', now())
);

alter table public.feedback enable row level security;

-- Qualquer visitante (autenticado ou anônimo) pode inserir feedback
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'feedback'
      and policyname = 'feedback_insert_any'
  ) then
    create policy feedback_insert_any
      on public.feedback for insert
      with check (true);
  end if;
end $$;

-- Usuário autenticado só lê os próprios feedbacks
-- (o dono do app lê tudo pelo Supabase Dashboard com a service_role)
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'feedback'
      and policyname = 'feedback_select_own'
  ) then
    create policy feedback_select_own
      on public.feedback for select
      to authenticated
      using (auth.uid() = user_id);
  end if;
end $$;

-- Índice para consultas ordenadas por data no Dashboard
create index if not exists feedback_created_at_idx
  on public.feedback (created_at desc);
