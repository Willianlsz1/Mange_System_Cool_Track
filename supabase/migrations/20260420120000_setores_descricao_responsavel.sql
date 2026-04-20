-- CoolTrack Pro — Campos extras em `setores`: `descricao` + `responsavel`.
--
-- Contexto:
--   O modal "Criar/Editar Setor" premium (P1) adicionou dois campos
--   opcionais: uma descrição curta do setor (até ~120 chars) e um
--   responsável em texto livre (não é FK). Essa migration materializa
--   esses campos no Supabase pra bater com o state local.
--
-- Idempotente: ALTER TABLE ... ADD COLUMN IF NOT EXISTS.
-- Nota sobre shadow DB / CI: envolvido no mesmo guard usado em migrations
--   anteriores; vira no-op se a tabela ainda não existir.
-- ============================================================

do $$
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'setores'
  ) then
    raise notice 'Tabela public.setores não existe — pulando ALTER (esperado em shadow DB do CI).';
    return;
  end if;

  alter table public.setores
    add column if not exists descricao text,
    add column if not exists responsavel text;

  -- Limita tamanho pra evitar abuso (match do front: 120 chars desc, 60 resp).
  -- Usamos CHECK não-bloqueante (só valida novos inserts/updates).
  if not exists (
    select 1
    from pg_constraint
    where conname = 'setores_descricao_max_length'
      and conrelid = 'public.setores'::regclass
  ) then
    alter table public.setores
      add constraint setores_descricao_max_length
      check (descricao is null or length(descricao) <= 240);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'setores_responsavel_max_length'
      and conrelid = 'public.setores'::regclass
  ) then
    alter table public.setores
      add constraint setores_responsavel_max_length
      check (responsavel is null or length(responsavel) <= 120);
  end if;

  comment on column public.setores.descricao is
    'Descrição curta do setor (opcional). Até ~120 chars no front, teto de 240 no schema.';
  comment on column public.setores.responsavel is
    'Nome do responsável pelo setor em texto livre (opcional). NÃO é FK a usuário/técnico.';
end $$;
