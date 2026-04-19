-- CoolTrack Pro — Tabela `setores` + coluna `setor_id` em `equipamentos`.
--
-- Contexto:
--   A feature "setores" (agrupar equipamentos por local/área) é exclusiva do
--   plano Pro. Hoje ela existe só em memória/localStorage; equipamentos
--   perdem o `setorId` no reload e ninguém vai pro Supabase. Essa migration
--   materializa a feature no schema remoto e garante que os setores sigam o
--   usuário entre dispositivos.
--
-- Escopo:
--   1. Cria `public.setores` (id text PK, user_id FK, nome, cor, timestamps)
--   2. Habilita RLS com policies owner-scoped (select/insert/update/delete)
--   3. Adiciona `setor_id` em `public.equipamentos` com FK opcional
--      (ON DELETE SET NULL — deletar setor não apaga os equipamentos).
--
-- Nota sobre shadow DB / CI:
--   Como em migrations anteriores, `public.equipamentos` foi criada
--   out-of-band. Envolvemos o ALTER na mesma guarda defensiva; em produção
--   roda normal, em CI vira no-op se a tabela ainda não existir.
--
-- Idempotente: CREATE ... IF NOT EXISTS + DO blocks com EXISTS checks.
-- ============================================================

-- ── Tabela setores ──────────────────────────────────────────────────────
create table if not exists public.setores (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  nome text not null,
  cor text not null default '#00bcd4',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint setores_pkey primary key (id),
  constraint setores_nome_not_empty check (length(btrim(nome)) > 0),
  constraint setores_cor_format check (cor ~* '^#[0-9a-f]{3,8}$')
);

create index if not exists setores_user_id_idx on public.setores (user_id);

alter table public.setores enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'setores'
      and policyname = 'setores_select_own'
  ) then
    create policy setores_select_own
      on public.setores for select
      to authenticated
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'setores'
      and policyname = 'setores_insert_own'
  ) then
    create policy setores_insert_own
      on public.setores for insert
      to authenticated
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'setores'
      and policyname = 'setores_update_own'
  ) then
    create policy setores_update_own
      on public.setores for update
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'setores'
      and policyname = 'setores_delete_own'
  ) then
    create policy setores_delete_own
      on public.setores for delete
      to authenticated
      using (auth.uid() = user_id);
  end if;
end $$;

comment on table public.setores is
  'Agrupamento de equipamentos por local/área (feature exclusiva do plano Pro).';
comment on column public.setores.cor is
  'Hex color (ex.: #00bcd4) usada pra pintar o card do setor na UI.';

-- ── Coluna setor_id em equipamentos ─────────────────────────────────────
do $$
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'equipamentos'
  ) then
    raise notice 'Tabela public.equipamentos não existe — pulando ALTER (esperado em shadow DB do CI).';
    return;
  end if;

  alter table public.equipamentos
    add column if not exists setor_id text;

  -- FK idempotente: só cria se não houver constraint com o mesmo nome
  if not exists (
    select 1
    from pg_constraint
    where conname = 'equipamentos_setor_id_fkey'
      and conrelid = 'public.equipamentos'::regclass
  ) then
    alter table public.equipamentos
      add constraint equipamentos_setor_id_fkey
      foreign key (setor_id) references public.setores (id)
      on delete set null;
  end if;

  create index if not exists equipamentos_setor_id_idx
    on public.equipamentos (setor_id);

  comment on column public.equipamentos.setor_id is
    'FK opcional para public.setores. NULL = equipamento sem setor.';
end $$;
