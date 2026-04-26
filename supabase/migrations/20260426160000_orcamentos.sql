-- CoolTrack Pro — Tabela `orcamentos` (Fase de instalacao, abr/2026).
--
-- Contexto:
--   Adicao do fluxo de orcamentos pra instalação de equipamentos. Cliente
--   da instalação NAO necessariamente eh o mesmo cliente PMOC (Pro) — pode
--   ser pessoa fisica avulsa que talvez nunca volte (a nao ser por garantia).
--   Por isso os campos de cliente vivem inline na propria tabela em vez de
--   FK obrigatoria pra `clientes`.
--
-- Numeracao: padrao "ORC-YYYY-NNNN" (ano + sequencial), customizavel via
-- profile.orcamento_numero_format (Fase 2). Sequencial eh por user/ano.
--
-- Status workflow:
--   rascunho → enviado → aprovado → convertido (em instalacao)
--                     → recusado
--                     → expirado (validade vencida)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.orcamentos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Identificacao
  numero text NOT NULL,

  -- Cliente AVULSO (geralmente PF unica, sem cadastro formal).
  -- Opcional FK pra clientes (Pro): se technician depois quiser promover
  -- o cliente avulso pra cliente formal, fica linkado.
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  cliente_nome text NOT NULL,
  cliente_telefone text,
  cliente_endereco text,

  -- Conteudo
  titulo text NOT NULL,
  descricao text,
  itens jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{descricao, qty, valor_unitario, total}]

  -- Valores
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  desconto numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,

  -- Comerciais
  validade_dias integer NOT NULL DEFAULT 7,
  forma_pagamento text,
  observacoes text,

  -- Estado
  status text NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho', 'enviado', 'aprovado', 'recusado', 'expirado', 'convertido')),
  enviado_em timestamptz,
  aprovado_em timestamptz,

  -- Conversao em instalacao (Fase 3) — link com registro criado
  registro_id text,
  equipamento_id text,

  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),

  CONSTRAINT orcamentos_pkey PRIMARY KEY (id),
  CONSTRAINT orcamentos_numero_user_unique UNIQUE (user_id, numero),
  CONSTRAINT orcamentos_total_positive CHECK (total >= 0),
  CONSTRAINT orcamentos_validade_positive CHECK (validade_dias > 0)
);

CREATE INDEX IF NOT EXISTS orcamentos_user_id_idx ON public.orcamentos (user_id);
CREATE INDEX IF NOT EXISTS orcamentos_status_idx ON public.orcamentos (status);
CREATE INDEX IF NOT EXISTS orcamentos_created_at_idx ON public.orcamentos (created_at DESC);

-- RLS
ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'orcamentos'
      AND policyname = 'orcamentos_select_own'
  ) THEN
    CREATE POLICY orcamentos_select_own
      ON public.orcamentos FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'orcamentos'
      AND policyname = 'orcamentos_insert_own'
  ) THEN
    CREATE POLICY orcamentos_insert_own
      ON public.orcamentos FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'orcamentos'
      AND policyname = 'orcamentos_update_own'
  ) THEN
    CREATE POLICY orcamentos_update_own
      ON public.orcamentos FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'orcamentos'
      AND policyname = 'orcamentos_delete_own'
  ) THEN
    CREATE POLICY orcamentos_delete_own
      ON public.orcamentos FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

COMMENT ON TABLE public.orcamentos IS
  'Orçamentos de instalação. Cliente avulso (PF) ou linkado a clientes (PJ Pro).';

-- Profile: campo opcional pra customizar formato do numero
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profiles'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN IF NOT EXISTS orcamento_numero_format text DEFAULT 'ORC-{YYYY}-{NNNN}';
    COMMENT ON COLUMN public.profiles.orcamento_numero_format IS
      'Formato customizavel da numeracao de orcamentos. Tokens: {YYYY}=ano, {NNNN}=sequencial 4 digitos zero-padded. Default: ORC-{YYYY}-{NNNN}';
  END IF;
END $$;
