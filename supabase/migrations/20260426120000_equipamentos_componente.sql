-- CoolTrack Pro — Adiciona coluna `componente` em `equipamentos`.
--
-- Contexto:
--   O app envia no upsert de equipamento um campo `componente` que distingue
--   o tipo físico do equipamento de climatização: evaporadora (unidade
--   interna), condensadora (unidade externa) ou unica (split tradicional
--   onde o equipamento eh tratado como peça única). A coluna existia no
--   código (mapEquipamentoRow + UI #eq-componente) mas nunca foi criada no
--   schema remoto — causando 400 Bad Request com:
--     "Could not find the 'componente' column of 'equipamentos' in the
--      schema cache" (PGRST204)
--
--   Sem essa migration, o app cai num fallback (storage.js
--   isMissingComponenteSchemaError) que strip-a a coluna e retenta — a
--   operacao funciona, mas o erro 400 polui o console e gera uma request
--   extra a cada sync. Essa migration elimina o fallback.
--
-- Nota sobre shadow DB / CI:
--   Mesmo padrao do 20260417000000: tabela criada out-of-band, então o
--   ALTER fica dentro de DO block que pula se a tabela nao existe (CI).
--
-- Idempotente: usa ADD COLUMN IF NOT EXISTS. Pode rodar varias vezes.
-- Seguro: NULL permitido (so split com componente unico tem valor),
-- CHECK garante consistencia.
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

  -- componente — tipo físico da unidade de climatizacao.
  --   evaporadora | condensadora | unidade_unica  (default null = nao se aplica)
  --
  -- IMPORTANTE: o terceiro valor eh 'unidade_unica' (com underscore), nao 'unica'.
  -- Bate com o <option value="unidade_unica"> no dropdown #eq-componente em
  -- ui/shell/templates/modals.js. Mismatch causa violacao 23514.
  --
  -- Por que NULL eh permitido:
  --   Nem todo "tipo" de equipamento tem componente fisico (ex.: chiller).
  --   O app só preenche quando o tipo eh um dos TIPOS_COM_COMPONENTE
  --   definidos em ui/views/equipamentos.js. Pra outros tipos, manda null.
  ALTER TABLE public.equipamentos
    ADD COLUMN IF NOT EXISTS componente text;

  -- Recria o CHECK constraint de forma idempotente (caso uma versao
  -- anterior tivesse 'unica' em vez de 'unidade_unica').
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'equipamentos_componente_check'
      AND conrelid = 'public.equipamentos'::regclass
  ) THEN
    ALTER TABLE public.equipamentos DROP CONSTRAINT equipamentos_componente_check;
  END IF;

  ALTER TABLE public.equipamentos
    ADD CONSTRAINT equipamentos_componente_check
    CHECK (
      componente IS NULL
      OR componente IN ('evaporadora', 'condensadora', 'unidade_unica')
    );

  COMMENT ON COLUMN public.equipamentos.componente IS
    'Tipo físico da unidade de climatização: evaporadora (interna), condensadora (externa) ou unidade_unica (split tradicional). NULL para tipos sem componente físico (ex.: chiller).';
END $$;
