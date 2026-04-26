-- CoolTrack Pro — Adiciona coluna `cliente_id` em `setores`.
--
-- Contexto:
--   PMOC Fase 2 (abr/2026) introduziu a hierarquia Cliente -> Setor ->
--   Equipamento. equipamentos.cliente_id ja foi migrado em
--   20260425120000_pmoc_clientes_empresa.sql, mas setores.cliente_id ficou
--   pra tras — o codigo (storage.js linhas 506-508 + isMissingSetorClienteSchemaError
--   linha 155) ja envia/espera essa coluna, mas como ela nao existe no schema
--   remoto o app cai num fallback silencioso que strip-a a coluna do payload.
--
--   Resultado pratico: setores sao salvos no Supabase mas SEM o vinculo
--   com cliente — a hierarquia so persiste no localStorage. Em outro
--   dispositivo o user perde o "este setor pertence ao Hotel X".
--
-- Comportamento:
--   - Coluna NULLABLE (setor pode existir sem cliente — backward compat
--     com setores criados antes da feature Cliente).
--   - FK pra public.clientes com ON DELETE SET NULL (deletar cliente nao
--     apaga setores; eles ficam orfaos e o user pode reatribuir).
--   - Index pra consultas por cliente (filtro frequente em /equipamentos
--     filtrado por cliente).
--
-- Idempotente: ADD COLUMN IF NOT EXISTS + DO block pra FK.
-- Seguro: NULL permitido, sem default, sem migracao de dados existentes.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'setores'
  ) THEN
    RAISE NOTICE 'Tabela public.setores não existe — pulando ALTER (esperado em shadow DB do CI).';
    RETURN;
  END IF;

  -- Adiciona a coluna se nao existir
  ALTER TABLE public.setores
    ADD COLUMN IF NOT EXISTS cliente_id uuid;

  -- FK idempotente: so cria se a tabela clientes existir E se a constraint
  -- ainda nao existir. Em shadow DB sem clientes (deveria existir após
  -- 20260425120000), pula gracefully.
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'clientes'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'setores_cliente_id_fkey'
      AND conrelid = 'public.setores'::regclass
  ) THEN
    ALTER TABLE public.setores
      ADD CONSTRAINT setores_cliente_id_fkey
      FOREIGN KEY (cliente_id) REFERENCES public.clientes (id)
      ON DELETE SET NULL;
  END IF;

  -- Index pra consultas frequentes filtrando por cliente
  CREATE INDEX IF NOT EXISTS setores_cliente_id_idx
    ON public.setores (cliente_id);

  COMMENT ON COLUMN public.setores.cliente_id IS
    'FK opcional pra public.clientes. NULL = setor nao vinculado a cliente especifico (backward compat com setores anteriores ao PMOC Fase 2).';
END $$;
