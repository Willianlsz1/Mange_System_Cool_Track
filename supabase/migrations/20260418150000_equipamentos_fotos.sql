-- CoolTrack Pro — Coluna `fotos` em `public.equipamentos`.
--
-- Contexto:
--   Feature "foto real do equipamento" (plano Plus+): técnicos em campo
--   identificam o equipamento por foto mais rápido do que por TAG/nome.
--   O app já armazena fotos de REGISTROS via Supabase Storage no bucket
--   `registro-fotos`. Aqui a gente apenas estende o schema do equipamento
--   pra guardar a lista normalizada de referências de foto, seguindo o
--   mesmo padrão `jsonb` usado em `public.registros.fotos`.
--
-- Shape esperado (normalizePhotoEntry):
--   [
--     { version:1, provider:'supabase-storage', bucket:'registro-fotos',
--       path:'<userId>/equipamentos/<equipId>/<uuid>.jpg',
--       url:'<signed>', urlExpiresAt:'2026-04-19T...',
--       mimeType:'image/jpeg', size:12345, uploadedAt:'2026-04-18T...' },
--     ...
--   ]
--
-- Nota sobre shadow DB / CI:
--   Seguindo o mesmo padrão das migrations anteriores
--   (20260418140000_setores.sql etc), envolvemos o ALTER numa guarda
--   defensiva contra `information_schema.tables` pra não quebrar o shadow
--   DB do CI caso `public.equipamentos` ainda não exista.
--
-- Idempotente: ADD COLUMN IF NOT EXISTS dentro de DO block.
-- ============================================================

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
    add column if not exists fotos jsonb not null default '[]'::jsonb;

  -- Sanidade: garante que a default está em vigor em linhas antigas que
  -- possam ter ficado com NULL se uma versão prévia da coluna existiu
  -- sem default.
  update public.equipamentos
    set fotos = '[]'::jsonb
    where fotos is null;

  comment on column public.equipamentos.fotos is
    'Lista de referências de foto (bucket/path/signed URL). Mesmo shape de public.registros.fotos. Feature Plus+.';
end $$;
