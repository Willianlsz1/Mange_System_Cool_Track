/**
 * CoolTrack Pro - Clientes (Fase 2 PMOC, abr/2026)
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Módulo dedicado pra CRUD de clientes. NÃO replica a infra completa do
 * `storage.js` (offline queue, normalizers complexos, sync background)
 * porque:
 *
 *   1. Clientes raramente são editados offline (técnico tá no escritório
 *      quando cadastra cliente, ou na hora de gerar PMOC — momentos com rede).
 *   2. Volume baixo: técnico médio tem 5-30 clientes. Não compensa cache
 *      sofisticado.
 *   3. Fase 2 entrega valor rapidamente. Se virar pain point real,
 *      refatora pra usar o storage.js master loop.
 *
 * Estado: state.clientes (Map-friendly array). Hidratado on-demand.
 * Persistência: tabela `public.clientes` no Supabase. RLS já aplicada
 *   pela migration 20260425120000_pmoc_clientes_empresa.sql.
 */

import { supabase } from './supabase.js';
import { setState, getState } from './state.js';
import { handleError, ErrorCodes, AppError } from './errors.js';

const TABLE = 'clientes';

/**
 * Normaliza row do Supabase pra shape do app. Sanitiza strings, garante
 * que campos opcionais nulos viram empty string (mais fácil pra UI lidar).
 */
function normalizeClienteRow(row) {
  if (!row || typeof row !== 'object') return null;
  if (!row.id || !row.nome) return null;
  return {
    id: String(row.id),
    nome: String(row.nome).trim(),
    razaoSocial: row.razao_social ? String(row.razao_social).trim() : '',
    cnpj: row.cnpj ? String(row.cnpj).trim() : '',
    inscricaoEstadual: row.inscricao_estadual ? String(row.inscricao_estadual).trim() : '',
    inscricaoMunicipal: row.inscricao_municipal ? String(row.inscricao_municipal).trim() : '',
    endereco: row.endereco ? String(row.endereco).trim() : '',
    contato: row.contato ? String(row.contato).trim() : '',
    urlChamados: row.url_chamados ? String(row.url_chamados).trim() : '',
    observacoes: row.observacoes ? String(row.observacoes).trim() : '',
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

/**
 * Inverso do normalize: shape do app → row do banco. Empty strings
 * viram null (Postgres trata null e empty diferente em queries).
 */
function denormalizeCliente(cliente, userId) {
  return {
    id: cliente.id, // pode ser undefined em insert — Supabase gera default
    user_id: userId,
    nome: String(cliente.nome || '').trim(),
    razao_social: cliente.razaoSocial?.trim() || null,
    cnpj: cliente.cnpj?.trim() || null,
    inscricao_estadual: cliente.inscricaoEstadual?.trim() || null,
    inscricao_municipal: cliente.inscricaoMunicipal?.trim() || null,
    endereco: cliente.endereco?.trim() || null,
    contato: cliente.contato?.trim() || null,
    url_chamados: cliente.urlChamados?.trim() || null,
    observacoes: cliente.observacoes?.trim() || null,
  };
}

/**
 * Busca todos os clientes do user logado. Atualiza state.clientes.
 * Tolerante: se a tabela ainda não existe (migration não rodou), retorna []
 * e loga warning — app continua funcional, só sem clientes.
 */
export async function loadClientes() {
  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user?.id) {
      // Sem login → estado limpo, ninguém quebra
      setState((prev) => ({ ...prev, clientes: [] }));
      return [];
    }

    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('user_id', user.id)
      .order('nome', { ascending: true });

    if (error) {
      // Tabela não existe ainda? Provavelmente migration não rodou.
      // Loga e segue com array vazio — não derruba o app.
      if (
        error.code === '42P01' || // undefined_table
        String(error.message || '')
          .toLowerCase()
          .includes('does not exist')
      ) {
        console.warn('[clientes] tabela ainda não existe — rode supabase db push');
        setState((prev) => ({ ...prev, clientes: [] }));
        return [];
      }
      throw error;
    }

    const clientes = (data || []).map(normalizeClienteRow).filter(Boolean);
    setState((prev) => ({ ...prev, clientes }));
    return clientes;
  } catch (error) {
    handleError(error, {
      code: ErrorCodes.NETWORK_ERROR,
      message: 'Não foi possível carregar a lista de clientes.',
      context: { action: 'clientes.loadClientes' },
    });
    setState((prev) => ({ ...prev, clientes: prev.clientes || [] }));
    return getState().clientes || [];
  }
}

/**
 * Insere ou atualiza cliente. Se cliente.id existe, faz upsert por id.
 * Senão, insert com id auto-gerado pelo Postgres.
 *
 * @returns o cliente persistido (com id e timestamps preenchidos pelo banco)
 */
export async function upsertCliente(cliente) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user?.id) {
    throw new AppError('Faça login para salvar clientes.', ErrorCodes.UNAUTHORIZED, 'error');
  }

  const row = denormalizeCliente(cliente, user.id);
  if (!row.nome) {
    throw new AppError('Nome do cliente é obrigatório.', ErrorCodes.VALIDATION_ERROR, 'warning');
  }

  // Insert: omite id pra Postgres usar default. Update: passa id no upsert.
  const payload = row.id
    ? row
    : (() => {
        const { id: _omit, ...rest } = row;
        return rest;
      })();

  const { data, error } = await supabase
    .from(TABLE)
    .upsert(payload, { onConflict: 'id' })
    .select()
    .single();

  if (error) {
    throw new AppError('Falha ao salvar cliente.', ErrorCodes.SYNC_FAILED, 'error', {
      action: 'upsertCliente',
      cause: error.message,
    });
  }

  const normalized = normalizeClienteRow(data);

  // Atualiza state local: substitui se existir, adiciona se novo.
  setState((prev) => {
    const list = prev.clientes || [];
    const idx = list.findIndex((c) => c.id === normalized.id);
    const next = [...list];
    if (idx >= 0) next[idx] = normalized;
    else next.push(normalized);
    next.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    return { ...prev, clientes: next };
  });

  return normalized;
}

/**
 * Apaga cliente por id. equipamentos vinculados ficam órfãos (cliente_id=null
 * via ON DELETE SET NULL na FK).
 */
export async function deleteCliente(id) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user?.id) {
    throw new AppError('Faça login para apagar clientes.', ErrorCodes.UNAUTHORIZED, 'error');
  }

  const { error } = await supabase.from(TABLE).delete().eq('id', id).eq('user_id', user.id);

  if (error) {
    throw new AppError('Falha ao apagar cliente.', ErrorCodes.SYNC_FAILED, 'error', {
      action: 'deleteCliente',
      id,
      cause: error.message,
    });
  }

  setState((prev) => ({
    ...prev,
    clientes: (prev.clientes || []).filter((c) => c.id !== id),
    // Equipamentos: limpa cliente_id local (já foi limpo no banco via FK).
    equipamentos: (prev.equipamentos || []).map((e) =>
      e.clienteId === id ? { ...e, clienteId: null } : e,
    ),
  }));
}

/**
 * Helper: encontra cliente no state. Usado por viewEquip pra mostrar
 * o nome do cliente vinculado, etc.
 */
export function findCliente(id) {
  if (!id) return null;
  return (getState().clientes || []).find((c) => c.id === id) || null;
}

// ── Validação CNPJ/CPF (permissiva: warning, não bloqueia) ────────────────

/**
 * Valida CNPJ pelo dígito verificador. Aceita com ou sem formatação.
 * Retorna { ok: boolean, kind: 'cnpj' | 'cpf' | 'unknown', message?: string }.
 *
 * Permissivo: chamadores podem usar `result.ok` pra mostrar warning amarelo,
 * mas devem permitir salvar mesmo com `ok: false` (cliente exterior, condomínio
 * sem CNPJ formal, técnico digitou errado mas vai corrigir depois, etc).
 */
export function validateCnpjOrCpf(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return { ok: true, kind: 'unknown' }; // empty = ok (opcional)
  if (digits.length === 11) {
    return { ok: validateCpfDigits(digits), kind: 'cpf' };
  }
  if (digits.length === 14) {
    return { ok: validateCnpjDigits(digits), kind: 'cnpj' };
  }
  return {
    ok: false,
    kind: 'unknown',
    message: 'Esperado 11 dígitos (CPF) ou 14 dígitos (CNPJ).',
  };
}

function validateCpfDigits(d) {
  if (/^(\d)\1{10}$/.test(d)) return false; // 11111111111 etc
  let sum = 0;
  for (let i = 0; i < 9; i += 1) sum += parseInt(d[i], 10) * (10 - i);
  let dig = 11 - (sum % 11);
  if (dig >= 10) dig = 0;
  if (dig !== parseInt(d[9], 10)) return false;
  sum = 0;
  for (let i = 0; i < 10; i += 1) sum += parseInt(d[i], 10) * (11 - i);
  dig = 11 - (sum % 11);
  if (dig >= 10) dig = 0;
  return dig === parseInt(d[10], 10);
}

function validateCnpjDigits(d) {
  if (/^(\d)\1{13}$/.test(d)) return false;
  const calc = (slice, weights) => {
    let sum = 0;
    for (let i = 0; i < slice.length; i += 1) sum += parseInt(slice[i], 10) * weights[i];
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  if (calc(d.slice(0, 12), w1) !== parseInt(d[12], 10)) return false;
  if (calc(d.slice(0, 13), w2) !== parseInt(d[13], 10)) return false;
  return true;
}

/**
 * Formata CNPJ ou CPF pra display. Não-validado vira passthrough.
 */
export function formatCnpjOrCpf(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }
  if (digits.length === 14) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
  }
  return raw || '';
}
