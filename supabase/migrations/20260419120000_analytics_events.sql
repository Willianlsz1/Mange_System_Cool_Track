-- ============================================================
-- analytics_events — Eventos de telemetria (funil landing → trial → conversão)
-- Date: 2026-04-19
--
-- Design:
--   - insert-only: cliente anônimo ou autenticado pode gravar, mas nunca lê/edita/deleta.
--   - payload jsonb: flexível pra adicionar novos campos sem migrations.
--   - session_id: correlaciona eventos do mesmo usuário anônimo (funnel landing).
--   - user_id: opcional; preenchido quando o evento acontece pós-login (upgrade/feature usage).
--
-- Leitura: service_role via Dashboard (análise de funil, retenção, conversão).
-- LGPD: não coletamos PII (email, IP, geolocalização, device id). session_id é
-- gerado client-side e expira com sessionStorage — não cross-session.
-- ============================================================

create table if not exists public.analytics_events (
  id           uuid        primary key default gen_random_uuid(),
  name         text        not null check (length(name) > 0 and length(name) <= 64),
  payload      jsonb       not null default '{}'::jsonb,
  session_id   text        not null check (length(session_id) between 1 and 64),
  user_id      uuid        references auth.users(id) on delete set null,
  created_at   timestamptz not null default timezone('utc', now())
);

alter table public.analytics_events enable row level security;

-- Qualquer visitante (anônimo ou autenticado) pode inserir eventos.
-- with check (true) — validação de conteúdo é feita pelos CHECKs de coluna.
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'analytics_events'
      and policyname = 'analytics_events_insert_any'
  ) then
    create policy analytics_events_insert_any
      on public.analytics_events for insert
      with check (true);
  end if;
end $$;

-- Nenhuma policy de SELECT/UPDATE/DELETE: o cliente NÃO lê telemetria.
-- Owner consulta via service_role no Dashboard — bypass de RLS.

-- Índices para queries analíticas típicas:
--   1. funil por evento ordenado por tempo (cohort analysis)
create index if not exists analytics_events_name_created_at_idx
  on public.analytics_events (name, created_at desc);

--   2. todos os eventos de uma mesma sessão (reconstruir jornada)
create index if not exists analytics_events_session_idx
  on public.analytics_events (session_id, created_at);

--   3. eventos de um usuário autenticado (uso por conta)
create index if not exists analytics_events_user_idx
  on public.analytics_events (user_id, created_at desc)
  where user_id is not null;
