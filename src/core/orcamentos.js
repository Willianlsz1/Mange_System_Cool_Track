/**
 * CoolTrack Pro - Orçamentos (Fase de instalação, abr/2026)
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Módulo dedicado pra CRUD de orçamentos de instalação. Espelha o padrão
 * de `clientes.js` (sem replicar a infra completa do storage.js).
 *
 * Decisões de design:
 *   1. Cliente AVULSO inline (nome + telefone + endereço) — não força FK
 *      pra `clientes` (Pro). Maior parte das instalações é PF one-off.
 *   2. Numeração customizável via `profile.orcamento_numero_format`.
 *      Default: ORC-2026-0001. Sequencial é por user/ano.
 *   3. Itens em jsonb pra flexibilidade (text-livre, sem catálogo).
 *
 * Estado: state.orcamentos. Hidratado on-demand quando user entra na rota.
 */

import { supabase } from './supabase.js';
import { setState, getState } from './state.js';
import { handleError, ErrorCodes, AppError } from './errors.js';

const TABLE = 'orcamentos';

/**
 * Normaliza row do Supabase pra shape do app.
 */
function normalizeOrcamentoRow(row) {
  if (!row || typeof row !== 'object') return null;
  if (!row.id || !row.numero || !row.cliente_nome) return null;
  return {
    id: String(row.id),
    numero: String(row.numero),
    clienteId: row.cliente_id || null,
    clienteNome: String(row.cliente_nome || '').trim(),
    clienteTelefone: row.cliente_telefone ? String(row.cliente_telefone).trim() : '',
    clienteEndereco: row.cliente_endereco ? String(row.cliente_endereco).trim() : '',
    titulo: String(row.titulo || '').trim(),
    descricao: row.descricao ? String(row.descricao).trim() : '',
    itens: Array.isArray(row.itens) ? row.itens : [],
    subtotal: Number(row.subtotal || 0),
    desconto: Number(row.desconto || 0),
    total: Number(row.total || 0),
    validadeDias: Number(row.validade_dias || 7),
    formaPagamento: row.forma_pagamento ? String(row.forma_pagamento).trim() : '',
    observacoes: row.observacoes ? String(row.observacoes).trim() : '',
    status: row.status || 'rascunho',
    enviadoEm: row.enviado_em || null,
    aprovadoEm: row.aprovado_em || null,
    registroId: row.registro_id || null,
    equipamentoId: row.equipamento_id || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    // Fase 2: assinatura digital
    shareToken: row.share_token || null,
    shareTokenExpiresAt: row.share_token_expires_at || null,
    assinaturaClienteDataUrl: row.assinatura_cliente_dataurl || null,
    assinadoEm: row.assinado_em || null,
    assinadoNome: row.assinado_nome || null,
  };
}

/**
 * Inverso: shape do app → row do banco.
 */
function denormalizeOrcamento(orcamento, userId) {
  return {
    id: orcamento.id, // undefined em insert (Supabase gera default uuid)
    user_id: userId,
    numero: String(orcamento.numero || '').trim(),
    cliente_id: orcamento.clienteId || null,
    cliente_nome: String(orcamento.clienteNome || '').trim(),
    cliente_telefone: orcamento.clienteTelefone?.trim() || null,
    cliente_endereco: orcamento.clienteEndereco?.trim() || null,
    titulo: String(orcamento.titulo || '').trim(),
    descricao: orcamento.descricao?.trim() || null,
    itens: Array.isArray(orcamento.itens) ? orcamento.itens : [],
    subtotal: Number(orcamento.subtotal || 0),
    desconto: Number(orcamento.desconto || 0),
    total: Number(orcamento.total || 0),
    validade_dias: Number(orcamento.validadeDias || 7),
    forma_pagamento: orcamento.formaPagamento?.trim() || null,
    observacoes: orcamento.observacoes?.trim() || null,
    status: orcamento.status || 'rascunho',
    enviado_em: orcamento.enviadoEm || null,
    aprovado_em: orcamento.aprovadoEm || null,
    registro_id: orcamento.registroId || null,
    equipamento_id: orcamento.equipamentoId || null,
    // Fase 2: assinatura digital — opcional, só envia se setado
    share_token: orcamento.shareToken || null,
    share_token_expires_at: orcamento.shareTokenExpiresAt || null,
  };
}

/**
 * Gera o próximo número de orçamento conforme o formato do profile.
 * Formato default: ORC-{YYYY}-{NNNN}. Tokens suportados:
 *   {YYYY} = ano atual
 *   {YY}   = 2 digitos do ano
 *   {NNNN} = sequencial 4 digitos zero-padded
 *   {NN}   = sequencial 2 digitos zero-padded
 *   {N}    = sequencial sem padding
 *
 * Calcula o próximo seq baseado no maior número existente do user no ano.
 */
export function generateOrcamentoNumero(existingOrcamentos, ano, format) {
  const f = format || 'ORC-{YYYY}-{NNNN}';
  const anoStr = String(ano);
  const anoStr2 = anoStr.slice(-2);

  // Encontra maior sequencial existente do ano (qualquer formato)
  let maxSeq = 0;
  const yearMatch = new RegExp(`(?:${anoStr}|${anoStr2})`);
  (existingOrcamentos || []).forEach((o) => {
    if (!o?.numero) return;
    if (!yearMatch.test(o.numero)) return;
    // Extrai o último número do código (sequencial)
    const match = String(o.numero).match(/(\d+)\s*$/);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > maxSeq) maxSeq = n;
    }
  });

  const nextSeq = maxSeq + 1;
  return f
    .replace(/\{YYYY\}/g, anoStr)
    .replace(/\{YY\}/g, anoStr2)
    .replace(/\{NNNN\}/g, String(nextSeq).padStart(4, '0'))
    .replace(/\{NN\}/g, String(nextSeq).padStart(2, '0'))
    .replace(/\{N\}/g, String(nextSeq));
}

/**
 * Busca todos os orçamentos do user logado. Atualiza state.orcamentos.
 * Tolerante: se a tabela ainda não existe (migration pendente), retorna [].
 */
export async function loadOrcamentos() {
  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user?.id) {
      setState((prev) => ({ ...prev, orcamentos: [] }));
      return [];
    }

    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      // Tabela não existe ainda? migration pendente.
      if (
        error.code === '42P01' ||
        String(error.message || '')
          .toLowerCase()
          .includes('does not exist')
      ) {
        console.warn('[orcamentos] tabela ainda não existe — rode supabase db push');
        setState((prev) => ({ ...prev, orcamentos: [] }));
        return [];
      }
      throw error;
    }

    const orcamentos = (data || []).map(normalizeOrcamentoRow).filter(Boolean);
    setState((prev) => ({ ...prev, orcamentos }));
    return orcamentos;
  } catch (error) {
    handleError(error, {
      code: ErrorCodes.NETWORK_ERROR,
      message: 'Não foi possível carregar a lista de orçamentos.',
      context: { action: 'orcamentos.loadOrcamentos' },
    });
    setState((prev) => ({ ...prev, orcamentos: prev.orcamentos || [] }));
    return getState().orcamentos || [];
  }
}

/**
 * Insere ou atualiza orçamento. Se orcamento.id existe, faz upsert por id.
 * Se não tem numero, gera automaticamente (formato do profile).
 *
 * @returns o orcamento persistido (com id e timestamps preenchidos)
 */
export async function upsertOrcamento(orcamento, opts = {}) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user?.id) {
    throw new AppError('Faça login para salvar orçamentos.', ErrorCodes.UNAUTHORIZED, 'error');
  }

  // Auto-gera número se não tiver (insert novo)
  let payload = { ...orcamento };
  if (!payload.numero && !payload.id) {
    const ano = new Date().getFullYear();
    const profile = opts.profile || {};
    const format = profile.orcamento_numero_format || 'ORC-{YYYY}-{NNNN}';
    const existing = getState().orcamentos || [];
    payload.numero = generateOrcamentoNumero(existing, ano, format);
  }

  const row = denormalizeOrcamento(payload, user.id);
  if (!row.numero) {
    throw new AppError(
      'Número do orçamento é obrigatório.',
      ErrorCodes.VALIDATION_ERROR,
      'warning',
    );
  }
  if (!row.cliente_nome) {
    throw new AppError('Nome do cliente é obrigatório.', ErrorCodes.VALIDATION_ERROR, 'warning');
  }
  if (!row.titulo) {
    throw new AppError(
      'Título do orçamento é obrigatório.',
      ErrorCodes.VALIDATION_ERROR,
      'warning',
    );
  }

  // Insert: omite id pra Supabase usar default. Update: passa id.
  const finalPayload = row.id
    ? row
    : (() => {
        const { id: _omit, ...rest } = row;
        return rest;
      })();

  const { data, error } = await supabase
    .from(TABLE)
    .upsert(finalPayload, { onConflict: 'id' })
    .select()
    .single();

  if (error) {
    throw new AppError('Falha ao salvar orçamento.', ErrorCodes.SYNC_FAILED, 'error', {
      action: 'upsertOrcamento',
      cause: error.message,
    });
  }

  const normalized = normalizeOrcamentoRow(data);

  // Atualiza state local
  setState((prev) => {
    const list = prev.orcamentos || [];
    const idx = list.findIndex((o) => o.id === normalized.id);
    const next = [...list];
    if (idx >= 0) next[idx] = normalized;
    else next.unshift(normalized); // novo orçamento aparece no topo
    return { ...prev, orcamentos: next };
  });

  return normalized;
}

/**
 * Apaga orçamento por id.
 */
export async function deleteOrcamento(id) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user?.id) {
    throw new AppError('Faça login para apagar orçamentos.', ErrorCodes.UNAUTHORIZED, 'error');
  }

  const { error } = await supabase.from(TABLE).delete().eq('id', id).eq('user_id', user.id);

  if (error) {
    throw new AppError('Falha ao apagar orçamento.', ErrorCodes.SYNC_FAILED, 'error', {
      action: 'deleteOrcamento',
      id,
      cause: error.message,
    });
  }

  setState((prev) => ({
    ...prev,
    orcamentos: (prev.orcamentos || []).filter((o) => o.id !== id),
  }));
}

/**
 * Helper: encontra orçamento no state.
 */
export function findOrcamento(id) {
  return (getState().orcamentos || []).find((o) => o.id === id) || null;
}

/**
 * Conta orçamentos criados no mês corrente — usado pra plan gating Free
 * (limite de 1/mês como porta de entrada).
 */
export function countOrcamentosThisMonth() {
  const now = new Date();
  const ymPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return (getState().orcamentos || []).filter((o) => {
    return o.createdAt && String(o.createdAt).startsWith(ymPrefix);
  }).length;
}

/**
 * Marca orçamento como expirado se a validade já passou. Helper local
 * (não chama Supabase — só recalcula no state). Chamar em loadOrcamentos
 * pra refletir status no UI sem precisar de cron job no servidor.
 */
export function markExpiredLocally(orcamentos) {
  const now = Date.now();
  return (orcamentos || []).map((o) => {
    if (o.status !== 'enviado' && o.status !== 'rascunho') return o;
    if (!o.enviadoEm) return o;
    const sentAt = new Date(o.enviadoEm).getTime();
    const validUntil = sentAt + o.validadeDias * 24 * 60 * 60 * 1000;
    if (now > validUntil) return { ...o, status: 'expirado' };
    return o;
  });
}

// ─── Fase 2: Assinatura digital ───────────────────────────────────────────
//
// Fluxo:
//   1) Técnico clica "Enviar para assinatura digital"
//   2) generateShareToken() gera UUID + expiração 30d, persiste no orçamento,
//      muda status para 'aguardando_assinatura'
//   3) Técnico compartilha link via WhatsApp: ${origin}/?orc-sign=<TOKEN>
//   4) Cliente abre o link no celular — bootstrap da SPA detecta o param,
//      monta a view standalone OrcamentoSignaturePage e chama
//      fetchOrcamentoByToken() (RPC pública)
//   5) Cliente assina no canvas + nome → signOrcamentoByToken() grava
//      a assinatura, status vira 'aprovado' automaticamente
//
// Toda a parte pública (fetch + sign) usa RPCs SECURITY DEFINER no Supabase,
// então o cliente NÃO precisa de auth. As policies RLS de orcamentos
// continuam fechadas.

const SHARE_TOKEN_TTL_DAYS = 30;

function generateUuidV4() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Gera ou reusa o share_token do orçamento. Persiste no banco + atualiza
 * status para 'aguardando_assinatura' (se ainda era rascunho).
 * Idempotente: se já tem token válido (não expirado), reusa.
 */
export async function generateShareToken(orcamento) {
  if (!orcamento?.id) {
    throw new AppError(
      'Orçamento precisa ser salvo antes de gerar link.',
      ErrorCodes.VALIDATION_ERROR,
      'warning',
    );
  }

  const now = Date.now();
  if (
    orcamento.shareToken &&
    orcamento.shareTokenExpiresAt &&
    new Date(orcamento.shareTokenExpiresAt).getTime() > now
  ) {
    return {
      token: orcamento.shareToken,
      expiresAt: orcamento.shareTokenExpiresAt,
      url: buildShareUrl(orcamento.shareToken),
    };
  }

  const token = generateUuidV4();
  const expiresAt = new Date(now + SHARE_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from(TABLE)
    .update({
      share_token: token,
      share_token_expires_at: expiresAt,
      status: orcamento.status === 'rascunho' ? 'aguardando_assinatura' : orcamento.status,
      enviado_em: orcamento.enviadoEm || new Date().toISOString(),
    })
    .eq('id', orcamento.id)
    .select()
    .single();

  if (error) {
    throw new AppError('Falha ao gerar link de assinatura.', ErrorCodes.SYNC_FAILED, 'error', {
      action: 'generateShareToken',
      cause: error.message,
    });
  }

  const normalized = normalizeOrcamentoRow(data);
  setState((prev) => {
    const list = prev.orcamentos || [];
    const idx = list.findIndex((o) => o.id === normalized.id);
    if (idx < 0) return prev;
    const next = [...list];
    next[idx] = normalized;
    return { ...prev, orcamentos: next };
  });

  return { token, expiresAt, url: buildShareUrl(token) };
}

/**
 * Monta a URL pública usando origin atual + ?orc-sign=TOKEN.
 */
export function buildShareUrl(token) {
  if (typeof window === 'undefined') return `?orc-sign=${token}`;
  const origin = window.location.origin || '';
  return `${origin}/?orc-sign=${encodeURIComponent(token)}`;
}

/**
 * Lê orçamento via token público — chamado pela view standalone OrcamentoSignaturePage.
 * NÃO requer auth.
 */
export async function fetchOrcamentoByToken(token) {
  if (!token) {
    throw new AppError('Token não fornecido.', ErrorCodes.VALIDATION_ERROR, 'warning');
  }

  const { data, error } = await supabase.rpc('get_orcamento_by_token', { p_token: token });

  if (error) {
    // Detecção mais precisa de migration faltando — só PGRST202 (function not
    // found) ou substring específico que não causa falso positivo.
    const errMsg = String(error.message || '').toLowerCase();
    const isMissingFunction =
      error.code === 'PGRST202' ||
      errMsg.includes('could not find the function') ||
      errMsg.includes('function public.get_orcamento_by_token') ||
      errMsg.includes('does not exist in the schema cache');

    // Schema cache stale: função existe no banco mas PostgREST ainda não
    // recarregou. Acontece logo depois de aplicar uma migration.
    const isSchemaCacheStale = errMsg.includes('schema cache') || error.code === 'PGRST204';

    let friendly;
    if (isMissingFunction) {
      friendly =
        "Migration pendente. No Supabase rode: NOTIFY pgrst, 'reload schema'; " +
        'ou aplique a migration 20260426170000_orcamentos_assinatura_digital.sql.';
    } else if (isSchemaCacheStale) {
      friendly =
        'Schema do servidor desatualizado. No Supabase Dashboard: Settings → API → "Reload schema".';
    } else {
      friendly = `Não foi possível carregar este orçamento. (${error.message || 'erro desconhecido'} · code=${error.code || '-'})`;
    }

    console.error('[fetchOrcamentoByToken] RPC error:', error);
    throw new AppError(friendly, ErrorCodes.NETWORK_ERROR, 'error', {
      cause: error.message,
      code: error.code,
    });
  }

  if (!data || data.error) {
    const errCode = data?.error || 'unknown';
    const messages = {
      not_found: 'Link inválido ou orçamento removido.',
      token_expired: 'Este link expirou. Solicite um novo ao seu técnico.',
      token_required: 'Token não fornecido.',
    };
    throw new AppError(
      messages[errCode] || 'Não foi possível carregar este orçamento.',
      ErrorCodes.VALIDATION_ERROR,
      'warning',
      { errorCode: errCode },
    );
  }

  return data;
}

/**
 * Grava a assinatura do cliente via RPC pública.
 */
export async function signOrcamentoByToken(token, dataUrl, nome) {
  if (!token || !dataUrl || !nome) {
    throw new AppError('Dados incompletos.', ErrorCodes.VALIDATION_ERROR, 'warning');
  }

  const userAgent =
    typeof navigator !== 'undefined' ? String(navigator.userAgent || '').slice(0, 500) : null;

  const { data, error } = await supabase.rpc('sign_orcamento_by_token', {
    p_token: token,
    p_assinatura_dataurl: dataUrl,
    p_nome: nome,
    p_user_agent: userAgent,
  });

  if (error) {
    throw new AppError(
      'Falha ao registrar a assinatura. Verifique sua conexão.',
      ErrorCodes.NETWORK_ERROR,
      'error',
      { cause: error.message },
    );
  }

  if (!data || data.error) {
    const errCode = data?.error || 'unknown';
    const messages = {
      already_signed: `Este orçamento já foi assinado por ${data?.assinado_nome || 'outra pessoa'}.`,
      invalid_signature: 'Assinatura inválida — tente desenhar novamente.',
      signature_too_large: 'Assinatura muito grande — tente uma versão mais simples.',
      name_required: 'Por favor, informe seu nome completo.',
      not_found: 'Link inválido ou orçamento removido.',
      token_expired: 'Este link expirou. Solicite um novo ao seu técnico.',
    };
    throw new AppError(
      messages[errCode] || 'Não foi possível registrar a assinatura.',
      ErrorCodes.VALIDATION_ERROR,
      'warning',
      { errorCode: errCode },
    );
  }

  return data;
}

/**
 * Template padrão de itens de instalação de split residencial.
 */
export const TEMPLATE_INSTALACAO_SPLIT = [
  { descricao: 'Equipamento Split (especificar marca/BTU)', qty: 1, valorUnitario: 0 },
  { descricao: 'Tubulação de cobre (1/4" + 3/8") por metro', qty: 5, valorUnitario: 0 },
  { descricao: 'Cabo PP 4mm² para alimentação', qty: 5, valorUnitario: 0 },
  { descricao: 'Suporte para condensadora', qty: 1, valorUnitario: 0 },
  { descricao: 'Isolamento térmico para tubulação', qty: 5, valorUnitario: 0 },
  { descricao: 'Mão de obra (instalação completa)', qty: 1, valorUnitario: 0 },
];
