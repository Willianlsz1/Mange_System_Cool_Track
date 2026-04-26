-- CoolTrack Pro — Adiciona campos PMOC formal em `profiles`.
--
-- Contexto:
--   O PMOC formal (NBR 13971/Lei 13.589) exige no termo de RT:
--     - Nome do responsavel tecnico (separado do nome do titular da conta)
--     - Numero ART/RRT
--     - Cidade pra "Local, data" no rodape
--   Esses campos estavam usados no codigo (PMOC termo + profileModal V2)
--   mas nao existiam no schema remoto, entao eram salvos so em
--   localStorage e nunca sincronizavam.
--
-- Idempotente: ADD COLUMN IF NOT EXISTS. Pode rodar varias vezes.
-- Seguro: todos NULL permitido (campos opcionais — apenas obrigatorios
-- pra geracao de PMOC formal completo, nao bloqueia uso normal do app).
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
  ) THEN
    RAISE NOTICE 'Tabela public.profiles não existe — pulando ALTER (esperado em shadow DB do CI).';
    RETURN;
  END IF;

  -- responsavel_tecnico — nome do RT (pode ser diferente do titular da conta)
  ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS responsavel_tecnico text;

  -- art_rrt — Anotação de Responsabilidade Técnica numero
  ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS art_rrt text;

  -- crea_cft — registro CREA/CFT separado do campo legado `crea`
  -- (mantemos o `crea` antigo intact pra retrocompat com perfis ja salvos)
  ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS crea_cft text;

  -- cidade — pra "Cidade, 26 de abril de 2026" no termo de RT
  ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS cidade text;

  COMMENT ON COLUMN public.profiles.responsavel_tecnico IS
    'Nome do Responsável Técnico (NBR 13971). Pode ser diferente do titular da conta quando empresa terceiriza o RT.';
  COMMENT ON COLUMN public.profiles.art_rrt IS
    'Anotação de Responsabilidade Técnica (ART para CREA, RRT para CAU/CFT). Obrigatório para PMOC formal.';
  COMMENT ON COLUMN public.profiles.crea_cft IS
    'Registro CREA ou CFT do Responsável Técnico. Substitui o campo legado `crea` (mantido por retrocompat).';
  COMMENT ON COLUMN public.profiles.cidade IS
    'Cidade do prestador, usada no termo de responsabilidade técnica do PMOC formal.';
END $$;
