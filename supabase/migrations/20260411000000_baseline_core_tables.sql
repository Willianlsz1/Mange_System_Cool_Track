-- ============================================================
-- Baseline: tabelas core do produto (equipamentos, registros, tecnicos)
-- Date: 2026-04-11 (timestamp 000000 pra rodar antes de todas as
-- migrations existentes — alfabeticamente, '20260411000000_baseline_'
-- < '20260411_security_subscription_usage' por causa do '0' < '_').
--
-- Contexto:
--   Estas três tabelas foram criadas out-of-band via SQL Editor antes
--   de existirem migrations versionadas, conforme reconhecido em
--   20260417_equipamentos_manutencao_fields.sql:9-14:
--     "A tabela `public.equipamentos` foi criada out-of-band (SQL
--      Editor), antes de existirem migrations versionadas nesse repo."
--
--   Em produção elas já existem; esta migration é no-op (CREATE TABLE
--   IF NOT EXISTS). Em CI shadow DB, staging fresh e clones do repo,
--   ela cria do zero pra que o stack inteiro suba reproduzível.
--
--   RLS é habilitada em migration separada (20260425140000_baseline_core_rls.sql,
--   no PR #153) — esta migration só cria as tabelas + indexes + FKs
--   + checks que existiam no estado out-of-band original.
--
-- Decisão de escopo:
--   Esta baseline cria APENAS as colunas que existiam antes das
--   migrations posteriores serem introduzidas. Colunas adicionadas
--   por migrations já versionadas e idempotentes ficam por elas:
--     - equipamentos.{criticidade, prioridade_operacional,
--       periodicidade_preventiva_dias} → 20260417_equipamentos_manutencao_fields
--     - equipamentos.setor_id + FK + idx → 20260418140000_setores
--     - equipamentos.fotos → 20260418150000_equipamentos_fotos
--     - equipamentos.dados_placa + check → 20260421120000_equipamentos_dados_placa
--     - equipamentos.{cliente_id, patrimonio} + FK + idx → 20260425120000_pmoc_clientes_empresa
--     - registros.checklist + check + idx GIN → 20260425130000_pmoc_checklist_registros
--
--   Net effect após TODAS as migrations rodarem em fresh: schema
--   bate exatamente com produção descrita em fix/baseline-core-tables.
--
-- Idempotente: create table if not exists + create index if not exists
-- + add constraint if not exists em pg_constraint.
-- ============================================================

-- ─── 1. equipamentos ──────────────────────────────────────────────
create table if not exists public.equipamentos (
  id          text primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  nome        text not null,
  local       text not null,
  status      text default 'ok',
  tag         text default '',
  tipo        text default 'Outro',
  modelo      text default '',
  fluido      text default '',
  created_at  timestamptz default now()
);

create index if not exists equipamentos_user_id_idx on public.equipamentos (user_id);


-- ─── 2. registros ─────────────────────────────────────────────────
create table if not exists public.registros (
  id              text primary key,
  user_id         uuid not null references auth.users (id) on delete cascade,
  equip_id        text not null references public.equipamentos (id) on delete cascade,
  data            text not null,
  tipo            text not null,
  obs             text default '',
  status          text default 'ok',
  pecas           text default '',
  proxima         text default '',
  tecnico         text default '',
  custo_pecas     numeric default 0,
  custo_mao_obra  numeric default 0,
  assinatura      boolean default false,
  fotos           jsonb default '[]'::jsonb,
  created_at      timestamptz default now()
);

create index if not exists registros_user_id_idx on public.registros (user_id);
create index if not exists registros_equip_id_idx on public.registros (equip_id);
create index if not exists registros_data_idx on public.registros (data desc);


-- ─── 3. tecnicos ──────────────────────────────────────────────────
create table if not exists public.tecnicos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  nome        text not null,
  created_at  timestamptz default now()
);

-- UNIQUE composto idempotente — nome explícito pra bater com o índice
-- existente em produção.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tecnicos_user_id_nome_unique'
      and conrelid = 'public.tecnicos'::regclass
  ) then
    alter table public.tecnicos
      add constraint tecnicos_user_id_nome_unique unique (user_id, nome);
  end if;
end $$;

create index if not exists tecnicos_user_id_idx on public.tecnicos (user_id);


-- ─── Comentários ──────────────────────────────────────────────────
comment on table public.equipamentos is
  'Equipamentos cadastrados pelo técnico (multi-tenant via user_id). Schema completo após todas as migrations.';
comment on table public.registros is
  'Registros de manutenção (corretiva, preventiva, visita técnica) por equipamento. Multi-tenant via user_id.';
comment on table public.tecnicos is
  'Lista de técnicos (auxiliares) que o usuário cadastra para atribuir registros. Multi-tenant via user_id; UNIQUE evita duplicatas dentro do mesmo tenant.';
