-- CoolTrack Pro — Adiciona coluna `finalidade` em `clientes`.
--
-- Contexto:
--   PMOC formal (NBR 13971) exige no bloco "Informações do Sistema" o
--   tipo de ambiente: Hospitalar, Comercial, Industrial, Educacional,
--   Residencial coletivo, Hotelaria. Isso ajuda fiscalização a entender
--   o contexto do parque (hospital tem regras mais rigidas que escritorio).
--
--   Adicionado dropdown no clienteModal V2 que coleta esse valor; agora
--   o schema precisa suportar pra sincronizar entre dispositivos.
--
-- Idempotente: ADD COLUMN IF NOT EXISTS. Pode rodar varias vezes.
-- Seguro: NULL permitido (clientes legados ficam sem finalidade —
-- aparece como "—" no PMOC ate o user editar e selecionar).
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'clientes'
  ) THEN
    RAISE NOTICE 'Tabela public.clientes não existe — pulando ALTER (esperado em shadow DB do CI).';
    RETURN;
  END IF;

  -- finalidade — categoria NBR 13971 do ambiente atendido pelo cliente
  -- Sem CHECK constraint pra permitir extensoes futuras (ex.: "Comercial - Shopping")
  -- O frontend faz a validacao via dropdown com options fixas.
  ALTER TABLE public.clientes
    ADD COLUMN IF NOT EXISTS finalidade text;

  COMMENT ON COLUMN public.clientes.finalidade IS
    'Finalidade do ambiente do cliente para PMOC formal (NBR 13971): Hospitalar, Comercial, Industrial, Educacional, Residencial coletivo, Hotelaria, Outro.';
END $$;
