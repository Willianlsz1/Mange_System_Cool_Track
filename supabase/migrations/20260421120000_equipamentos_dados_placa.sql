-- CoolTrack Pro — Adiciona coluna `dados_placa` em `equipamentos`.
--
-- Contexto:
--   O fluxo de cadastro com IA (Plus+) extrai ~16 campos da etiqueta do
--   ar-condicionado (nº série, capacidade BTU, tensão, frequência, fase,
--   correntes, pressões, grau de proteção, ano de fabricação, etc.).
--
--   Ao invés de criar 13 colunas dedicadas — que complicam migration, indexação
--   desnecessária e viram schema creep — usamos uma ÚNICA coluna JSONB.
--
--   Vantagens:
--     - Adicionar/remover campo é client-only, sem migration.
--     - JSONB permite query (se um dia precisar filtrar por capacidade, dá).
--     - Default '{}'::jsonb cobre linhas existentes sem NULL check.
--
--   Desvantagens aceitas:
--     - Sem type check por campo (mas o client valida via form + mapper).
--     - Sem UNIQUE/INDEX por campo individual (não é caso de uso hoje).
--
-- Schema esperado do payload (documentado aqui pra não virar "magic blob"):
--   {
--     "numero_serie":         text,    -- ex: "312KAKY3F817"
--     "capacidade_btu":       integer, -- ex: 9000
--     "tensao":               text,    -- "127" | "220" | "380" | "440" | "bivolt"
--     "frequencia_hz":        integer, -- 50 | 60
--     "fases":                integer, -- 1 | 2 | 3
--     "potencia_w":           integer, -- ex: 820
--     "corrente_refrig_a":    numeric, -- ex: 4.63
--     "corrente_aquec_a":     numeric, -- ex: 4.15
--     "pressao_succao_mpa":   numeric, -- ex: 2.4
--     "pressao_descarga_mpa": numeric, -- ex: 4.2
--     "grau_protecao":        text,    -- ex: "IPX0", "IP24"
--     "ano_fabricacao":       integer, -- ex: 2024
--     "_source":              text     -- "ai" | "manual" (auditoria)
--   }
--
-- Idempotente: IF NOT EXISTS. Roda várias vezes sem efeito.
-- Seguro: DEFAULT '{}'::jsonb cobre linhas existentes.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'equipamentos'
  ) THEN
    RAISE NOTICE 'Tabela public.equipamentos não existe — pulando ALTER (esperado em shadow DB do CI).';
    RETURN;
  END IF;

  ALTER TABLE public.equipamentos
    ADD COLUMN IF NOT EXISTS dados_placa jsonb
      NOT NULL DEFAULT '{}'::jsonb;

  -- Guard: garante que o payload seja sempre um object (não array/scalar).
  -- Se alguém tentar inserir `[1,2,3]` ou `"oi"`, o check rejeita.
  ALTER TABLE public.equipamentos
    DROP CONSTRAINT IF EXISTS equipamentos_dados_placa_is_object;

  ALTER TABLE public.equipamentos
    ADD CONSTRAINT equipamentos_dados_placa_is_object
      CHECK (jsonb_typeof(dados_placa) = 'object');

  COMMENT ON COLUMN public.equipamentos.dados_placa IS
    'Dados extraídos da etiqueta (IA ou manual). JSON object com nº série, capacidade, tensão, fase, correntes, pressões, grau proteção, etc. Schema documentado na migration 20260421.';
END $$;
