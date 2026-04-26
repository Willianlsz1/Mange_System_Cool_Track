-- CoolTrack Pro — Fix: get_orcamento_by_token referencia coluna inexistente
-- ============================================================
-- A migration anterior (20260426170000) tentava ler `crea` do profiles, mas
-- a coluna foi renomeada pra `crea_cft` na migration 20260426140000. Resultado:
-- erro 42703 ao chamar a função pelo cliente publico.
--
-- Fix: usar to_jsonb pra ler campos do profile de forma defensiva (funciona
-- mesmo se as colunas tiverem nomes diferentes em ambientes diversos).
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_orcamento_by_token(p_token uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_orcamento public.orcamentos%ROWTYPE;
  v_profile_row jsonb;
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

  IF v_orcamento.share_token_expires_at IS NOT NULL
     AND v_orcamento.share_token_expires_at < timezone('utc', now()) THEN
    RETURN json_build_object('error', 'token_expired');
  END IF;

  -- Le profile como jsonb pra resistir a renames (crea -> crea_cft, etc).
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
      'nome', v_profile_nome,
      'empresa', v_profile_empresa,
      'telefone', v_profile_telefone,
      'crea', v_profile_crea
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_orcamento_by_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_orcamento_by_token(uuid) TO anon, authenticated;

-- Forca recarga do cache do PostgREST pra a versao nova ser visivel imediatamente.
NOTIFY pgrst, 'reload schema';
