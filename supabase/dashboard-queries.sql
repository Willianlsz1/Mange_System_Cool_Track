-- ============================================================
-- DASHBOARD SAVED QUERIES — fonte única de verdade
-- ============================================================
-- Estas são as queries master pra colar no SQL Editor do
-- Supabase Dashboard (Saved Queries). Cada bloco substitui
-- várias queries antigas que estavam duplicadas/redundantes.
--
-- Organize no dashboard em 4 queries salvas com estes nomes:
--   [Users] Gerenciar plano
--   [Users] Ver assinaturas e billing
--   [Analytics] Funil e eventos
--   [Schema] Inspeção do banco
--
-- Queries de DDL (create table / alter / policies) NÃO vão
-- aqui — elas vivem em supabase/migrations/ com timestamp.
-- ============================================================


-- ============================================================
-- [Users] Gerenciar plano
-- ============================================================
-- Substitui: Set User Plan to Free, Activate Plus/Pro,
-- Update User Plan to Pro, Mark User as Developer.
-- Troque EMAIL_AQUI e descomente a ação desejada.
--
-- IMPORTANTE: desde 2026-04-19 existe o trigger
-- `protect_profile_fields_trigger` que bloqueia UPDATE em
-- plan/plan_code/subscription_status/is_dev/stripe_* quando a
-- sessão não é service_role. No SQL Editor do Dashboard não há
-- JWT de service_role, então os UPDATEs abaixo usam
-- `set local session_replication_role = 'replica'` pra desligar
-- os triggers SÓ dentro da transação (volta ao normal no commit).
-- NUNCA faça `alter table ... disable trigger` solto — isso
-- afeta todas as sessões, inclusive o webhook do Kiwify.

-- -------- VER PLANO ATUAL --------
select u.email, p.plan_code, p.plan, p.subscription_status, p.is_dev,
       p.stripe_customer_id, p.trial_ends_at, p.billing_provider
from public.profiles p
join auth.users u on u.id = p.id
where u.email = 'EMAIL_AQUI@exemplo.com';

-- -------- PROMOVER PARA PRO --------
-- begin;
--   set local session_replication_role = 'replica';
--   update public.profiles
--   set plan_code = 'pro', plan = 'pro', subscription_status = 'active'
--   where id = (select id from auth.users where email = 'EMAIL_AQUI@exemplo.com');
-- commit;

-- -------- PROMOVER PARA PLUS --------
-- begin;
--   set local session_replication_role = 'replica';
--   update public.profiles
--   set plan_code = 'plus', plan = 'plus', subscription_status = 'active'
--   where id = (select id from auth.users where email = 'EMAIL_AQUI@exemplo.com');
-- commit;

-- -------- REVERTER PARA FREE --------
-- begin;
--   set local session_replication_role = 'replica';
--   update public.profiles
--   set plan_code = 'free', plan = 'free', subscription_status = 'inactive'
--   where id = (select id from auth.users where email = 'EMAIL_AQUI@exemplo.com');
-- commit;

-- -------- LIGAR / DESLIGAR DEV --------
-- begin;
--   set local session_replication_role = 'replica';
--   update public.profiles set is_dev = true
--     where id = (select id from auth.users where email = 'EMAIL_AQUI@exemplo.com');
-- commit;
--
-- begin;
--   set local session_replication_role = 'replica';
--   update public.profiles set is_dev = false
--     where id = (select id from auth.users where email = 'EMAIL_AQUI@exemplo.com');
-- commit;


-- ============================================================
-- [Users] Ver assinaturas e billing
-- ============================================================
-- Substitui: Fetch Active Plus/Pro, Detalhes da Subscription,
-- Fetch User Subscription Details, Fetch User Billing Profile,
-- Subscription Status Counts by Plan.

-- -------- DETALHE DE 1 USUÁRIO --------
select u.email, p.plan_code, p.subscription_status, p.billing_provider,
       p.stripe_customer_id, p.stripe_subscription_id, p.trial_ends_at, p.created_at
from public.profiles p
join auth.users u on u.id = p.id
where u.email = 'EMAIL_AQUI@exemplo.com';

-- -------- TODOS OS PAGANTES ATIVOS --------
-- select u.email, p.plan_code, p.subscription_status, p.billing_provider,
--        p.stripe_customer_id, p.created_at
-- from public.profiles p
-- join auth.users u on u.id = p.id
-- where p.plan_code in ('plus', 'pro')
--   and p.subscription_status = 'active'
-- order by p.created_at desc;

-- -------- CONTAGEM POR PLANO E STATUS --------
-- select plan_code, subscription_status, count(*) as usuarios
-- from public.profiles
-- group by plan_code, subscription_status
-- order by plan_code, subscription_status;

-- -------- USUÁRIOS COM STRIPE MAS SEM ACESSO (debug) --------
-- select u.email, p.plan_code, p.subscription_status, p.stripe_customer_id
-- from public.profiles p
-- join auth.users u on u.id = p.id
-- where p.stripe_customer_id is not null
--   and (p.subscription_status != 'active' or p.plan_code = 'free');


-- ============================================================
-- [Analytics] Funil e eventos
-- ============================================================
-- Substitui: Cohort Funnel by Week, Cohort Funil Semanal,
-- Recent Analytics Events, Telemetry events funnel tracking.

-- -------- EVENTOS ÚLTIMOS 7 DIAS --------
select name, count(*) as ocorrencias
from public.analytics_events
where created_at > now() - interval '7 days'
group by name
order by ocorrencias desc;

-- -------- FUNIL SEMANAL (últimos 90 dias) --------
-- select date_trunc('week', created_at)::date as semana,
--        count(*) filter (where name = 'lp_view') as views,
--        count(*) filter (where name = 'lp_cta_click') as ctas,
--        count(*) filter (where name = 'signup_completed') as signups,
--        count(*) filter (where name = 'first_equipment_added') as ativados,
--        count(*) filter (where name = 'upgrade_completed') as pagantes
-- from public.analytics_events
-- where created_at > now() - interval '90 days'
-- group by 1
-- order by 1 desc;

-- -------- EVENTOS DE 1 USUÁRIO (debug) --------
-- select created_at, name, payload
-- from public.analytics_events
-- where user_id = (select id from auth.users where email = 'EMAIL_AQUI@exemplo.com')
-- order by created_at desc
-- limit 100;

-- -------- TOP EVENTOS POR DIA (últimos 30 dias) --------
-- select date(created_at) as dia, name, count(*) as n
-- from public.analytics_events
-- where created_at > now() - interval '30 days'
-- group by 1, 2
-- order by 1 desc, 3 desc;


-- ============================================================
-- [Schema] Inspeção do banco
-- ============================================================
-- Substitui: List Profiles Table Columns, Latest Migration
-- History, List Public Tables with Row-Level Security.

-- -------- COLUNAS DE UMA TABELA --------
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'profiles'  -- troque pela tabela desejada
order by ordinal_position;

-- -------- TAMANHO DAS TABELAS --------
-- select schemaname || '.' || relname as tabela,
--        pg_size_pretty(pg_total_relation_size(relid)) as tamanho,
--        n_live_tup as linhas
-- from pg_stat_user_tables
-- where schemaname = 'public'
-- order by pg_total_relation_size(relid) desc;

-- -------- TABELAS COM RLS ATIVO --------
-- select schemaname, tablename, rowsecurity
-- from pg_tables
-- where schemaname = 'public'
-- order by tablename;

-- -------- POLICIES DE UMA TABELA --------
-- select policyname, cmd, roles, qual, with_check
-- from pg_policies
-- where schemaname = 'public' and tablename = 'profiles';

-- -------- CONSTRAINTS DE UMA TABELA --------
-- select conname, pg_get_constraintdef(oid)
-- from pg_constraint
-- where conrelid = 'public.profiles'::regclass;

-- -------- HISTÓRICO DE MIGRATIONS APLICADAS --------
-- select version, name, executed_at
-- from supabase_migrations.schema_migrations
-- order by version desc
-- limit 20;
