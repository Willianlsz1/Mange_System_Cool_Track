-- CoolTrack Pro — Adiciona colunas de planejamento de manutenção em `equipamentos`.
--
-- Contexto:
--   O app envia no upsert de equipamento 3 campos que descrevem o perfil
--   de manutenção: criticidade, prioridade_operacional e
--   periodicidade_preventiva_dias. As colunas existiam no código mas nunca
--   foram criadas no schema remoto — causando 400 Bad Request no PostgREST.
--
-- Nota sobre shadow DB / CI:
--   A tabela `public.equipamentos` foi criada out-of-band (SQL Editor),
--   antes de existirem migrations versionadas nesse repo. O CI do Supabase
--   roda as migrations numa shadow DB limpa e quebrava aqui porque a
--   tabela não existia. Por isso envolvemos tudo em um DO block que só
--   roda se a tabela existir — em produção roda normal, em CI vira no-op.
--
-- Idempotente: usa IF NOT EXISTS em tudo. Pode rodar várias vezes sem efeito.
-- Seguro: DEFAULT cobre as linhas existentes; CHECK garante consistência.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'equipamentos'
  ) THEN
    RAISE NOTICE 'Tabela public.equipamentos não existe — pulando ALTERs (esperado em shadow DB do CI).';
    RETURN;
  END IF;

  -- criticidade — percepção de impacto do equipamento no processo do cliente.
  --  baixa | media | alta | critica  (default: media)
  ALTER TABLE public.equipamentos
    ADD COLUMN IF NOT EXISTS criticidade text
      NOT NULL DEFAULT 'media'
      CHECK (criticidade IN ('baixa', 'media', 'alta', 'critica'));

  -- prioridade_operacional — prioridade no contexto da operação do cliente.
  --  baixa | normal | alta  (default: normal)
  ALTER TABLE public.equipamentos
    ADD COLUMN IF NOT EXISTS prioridade_operacional text
      NOT NULL DEFAULT 'normal'
      CHECK (prioridade_operacional IN ('baixa', 'normal', 'alta'));

  -- periodicidade_preventiva_dias — intervalo sugerido (em dias) entre
  -- manutenções preventivas. O app clamp-a em [15, 365]; refletimos aqui.
  -- Default null = "app calcula pela regra padrão por tipo+criticidade".
  ALTER TABLE public.equipamentos
    ADD COLUMN IF NOT EXISTS periodicidade_preventiva_dias integer
      CHECK (
        periodicidade_preventiva_dias IS NULL
        OR (periodicidade_preventiva_dias BETWEEN 15 AND 365)
      );

  -- Comentários para o catálogo do Supabase (aparecem no Table Editor)
  COMMENT ON COLUMN public.equipamentos.criticidade IS
    'Criticidade do equipamento: baixa, media, alta, critica.';
  COMMENT ON COLUMN public.equipamentos.prioridade_operacional IS
    'Prioridade operacional: baixa, normal, alta.';
  COMMENT ON COLUMN public.equipamentos.periodicidade_preventiva_dias IS
    'Intervalo sugerido (em dias) entre manutenções preventivas. 15–365.';
END $$;
