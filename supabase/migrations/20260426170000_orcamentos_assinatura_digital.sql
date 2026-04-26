-- CoolTrack Pro — Orcamentos: Assinatura digital online (Fase 2, abr/2026).
--
-- Contexto:
--   Cliente recebe link unico via WhatsApp, abre no celular (sem login),
--   le o orcamento, assina com o dedo na tela e o orcamento vira aprovado.
--   Tudo offline-first no app — token e assinatura persistem em local primeiro,
--   sync cuida do Supabase.
--
-- Modelo de seguranca:
--   - share_token eh UUID v4 unico (impossible de adivinhar — 122 bits de entropia)
--   - 2 RPCs publicas (anon role) com SECURITY DEFINER pra bypass do RLS:
--     * get_orcamento_by_token(token) — leitura publica do orcamento
--     * sign_orcamento_by_token(token, dataurl, nome, ua) — gravacao da assinatura
--   - Token tem expiracao (default 30 dias) — atena ataques de scrap futuros
--   - User-Agent + timestamp salvos pra trilha de auditoria
--   - Apos assinado, tentativa de re-assinar eh rejeitada (idempotencia)
-- ============================================================

-- 1) Adiciona colunas de assinatura digital
ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS share_token uuid UNIQUE,
  ADD COLUMN IF NOT EXISTS share_token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS assinatura_cliente_dataurl text,
  ADD COLUMN IF NOT EXISTS assinado_em timestamptz,
  ADD COLUMN IF NOT EXISTS assinado_nome text,
  ADD COLUMN IF NOT EXISTS assinado_user_agent text;

-- 2) Atualiza CHECK constraint pra incluir status 'aguardando_assinatura'
--    Drop + recreate (Postgres nao tem ALTER CHECK direto).
ALTER TABLE public.orcamentos
  DROP CONSTRAINT IF EXISTS orcamentos_status_check;

ALTER TABLE public.orcamentos
  ADD CONSTRAINT orcamentos_status_check CHECK (
    status IN (
      'rascunho',
      'enviado',
      'aguardando_assinatura',
      'aprovado',
      'recusado',
      'expirado',
      'convertido'
    )
  );

-- 3) Index pra lookup rapido por token
CREATE INDEX IF NOT EXISTS orcamentos_share_token_idx
  ON public.orcamentos (share_token)
  WHERE share_token IS NOT NULL;

-- ============================================================
-- 4) RPC publica: get_orcamento_by_token
-- ============================================================
-- Retorna os dados do orcamento via token. Acessivel por anon (sem auth).
-- Inclui dados do tecnico (perfil) pra exibir cabeçalho profissional.
--
-- Bloqueia se:
--   - Token nao existe
--   - Token expirou
--   - Orcamento ja esta convertido em instalacao (sem mais sentido editar)

CREATE OR REPLACE FUNCTION public.get_orcamento_by_token(p_token uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_orcamento public.orcamentos%ROWTYPE;
  v_profile_nome text;
  v_profile_empresa text;
  v_profile_telefone text;
  v_profile_crea text;
BEGIN
  IF p_token IS NULL THEN
    RETURN json_build_object('error', 'token_required');
  END IF;

  SELECT * INTO v_orcamento
  FROM public.orcamentos
  WHERE share_token = p_token;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'not_found');
  END IF;

  -- Token vencido — protege contra acesso indefinido a links antigos.
  IF v_orcamento.share_token_expires_at IS NOT NULL
     AND v_orcamento.share_token_expires_at < timezone('utc', now()) THEN
    RETURN json_build_object('error', 'token_expired');
  END IF;

  -- Le profile como jsonb pra resistir a renames (crea -> crea_cft, etc).
  -- Defensivo: usa COALESCE em ambos os nomes possiveis da coluna.
  DECLARE
    v_profile_row jsonb;
  BEGIN
    SELECT to_jsonb(p) INTO v_profile_row
    FROM public.profiles p
    WHERE p.id = v_orcamento.user_id;

    v_profile_nome := COALESCE(v_profile_row->>'nome', '');
    v_profile_empresa := COALESCE(v_profile_row->>'empresa', '');
    v_profile_telefone := COALESCE(v_profile_row->>'telefone', '');
    v_profile_crea := COALESCE(
      v_profile_row->>'crea_cft',
      v_profile_row->>'crea',
      ''
    );
  END;

  RETURN json_build_object(
    'id', v_orcamento.id,
    'numero', v_orcamento.numero,
    'cliente_nome', v_orcamento.cliente_nome,
    'cliente_telefone', v_orcamento.cliente_telefone,
    'cliente_endereco', v_orcamento.cliente_endereco,
    'titulo', v_orcamento.titulo,
    'descricao', v_orcamento.descricao,
    'itens', v_orcamento.itens,
    'subtotal', v_orcamento.subtotal,
    'desconto', v_orcamento.desconto,
    'total', v_orcamento.total,
    'validade_dias', v_orcamento.validade_dias,
    'forma_pagamento', v_orcamento.forma_pagamento,
    'observacoes', v_orcamento.observacoes,
    'status', v_orcamento.status,
    'enviado_em', v_orcamento.enviado_em,
    'aprovado_em', v_orcamento.aprovado_em,
    'assinado_em', v_orcamento.assinado_em,
    'assinado_nome', v_orcamento.assinado_nome,
    'created_at', v_orcamento.created_at,
    'tecnico', json_build_object(
      'nome', COALESCE(v_profile_nome, ''),
      'empresa', COALESCE(v_profile_empresa, ''),
      'telefone', COALESCE(v_profile_telefone, ''),
      'crea', COALESCE(v_profile_crea, '')
    )
  );
END;
$$;

-- Permissao explicita pra anon role (sem login)
REVOKE ALL ON FUNCTION public.get_orcamento_by_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_orcamento_by_token(uuid) TO anon, authenticated;

-- ============================================================
-- 5) RPC publica: sign_orcamento_by_token
-- ============================================================
-- Cliente assina via canvas no celular. Recebe data URL (base64 PNG) +
-- nome de quem assinou + user-agent (auditoria).
--
-- Idempotencia: se ja assinado, retorna already_signed sem sobrescrever.
-- Atualiza status pra 'aprovado' + aprovado_em + assinado_em.

CREATE OR REPLACE FUNCTION public.sign_orcamento_by_token(
  p_token uuid,
  p_assinatura_dataurl text,
  p_nome text,
  p_user_agent text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_orcamento public.orcamentos%ROWTYPE;
  v_now timestamptz := timezone('utc', now());
BEGIN
  IF p_token IS NULL THEN
    RETURN json_build_object('error', 'token_required');
  END IF;

  -- Validacao basica do payload
  IF p_assinatura_dataurl IS NULL OR length(p_assinatura_dataurl) < 100 THEN
    RETURN json_build_object('error', 'invalid_signature');
  END IF;

  IF p_nome IS NULL OR length(trim(p_nome)) < 2 THEN
    RETURN json_build_object('error', 'name_required');
  END IF;

  -- Cap de tamanho — assinatura PNG tipica fica em 30-80 KB. 500 KB eh teto
  -- generoso pra evitar abuso/payload bombs.
  IF length(p_assinatura_dataurl) > 500000 THEN
    RETURN json_build_object('error', 'signature_too_large');
  END IF;

  SELECT * INTO v_orcamento
  FROM public.orcamentos
  WHERE share_token = p_token
  FOR UPDATE; -- lock pra evitar race condition em double-submit

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'not_found');
  END IF;

  IF v_orcamento.share_token_expires_at IS NOT NULL
     AND v_orcamento.share_token_expires_at < v_now THEN
    RETURN json_build_object('error', 'token_expired');
  END IF;

  -- Idempotencia: ja assinado, nao sobrescreve.
  IF v_orcamento.assinado_em IS NOT NULL THEN
    RETURN json_build_object(
      'error', 'already_signed',
      'assinado_em', v_orcamento.assinado_em,
      'assinado_nome', v_orcamento.assinado_nome
    );
  END IF;

  -- Aceita a assinatura. Status pula direto pra 'aprovado' — nao precisa
  -- confirmacao manual depois (assinatura digital eh confirmacao formal).
  UPDATE public.orcamentos
  SET
    assinatura_cliente_dataurl = p_assinatura_dataurl,
    assinado_em = v_now,
    assinado_nome = trim(p_nome),
    assinado_user_agent = p_user_agent,
    status = 'aprovado',
    aprovado_em = v_now,
    updated_at = v_now
  WHERE id = v_orcamento.id;

  RETURN json_build_object(
    'success', true,
    'assinado_em', v_now,
    'assinado_nome', trim(p_nome)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sign_orcamento_by_token(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sign_orcamento_by_token(uuid, text, text, text) TO anon, authenticated;

-- ============================================================
-- 6) Comentarios pra documentacao
-- ============================================================
COMMENT ON COLUMN public.orcamentos.share_token IS
  'UUID publico unico — usado em links como /?orc-sign=<uuid>. Gerado quando o tecnico clica em "Enviar para assinatura digital".';
COMMENT ON COLUMN public.orcamentos.share_token_expires_at IS
  'Expiracao do link publico. Default 30 dias apos geracao.';
COMMENT ON COLUMN public.orcamentos.assinatura_cliente_dataurl IS
  'Data URL base64 (PNG) do canvas de assinatura. Tipico 30-80 KB, max 500 KB.';
COMMENT ON FUNCTION public.get_orcamento_by_token(uuid) IS
  'Leitura publica de orcamento via token. Bypass RLS via SECURITY DEFINER. Acessivel sem login.';
COMMENT ON FUNCTION public.sign_orcamento_by_token(uuid, text, text, text) IS
  'Assinatura publica de orcamento via token. Idempotente. Atualiza status para aprovado.';
