/**
 * CoolTrack Pro - Storage v5.0
 * localStorage como cache + Supabase como fonte de verdade
 * Offline first: salva local imediatamente, sincroniza com Supabase em background
 */

import { STORAGE_KEY, Utils } from './utils.js';
import { Toast } from './toast.js';
import { supabase } from './supabase.js';
import { AppError, ErrorCodes, handleError } from './errors.js';

const STORAGE_WARN_BYTES = 4 * 1024 * 1024;
const STORAGE_LIMIT_BYTES = 5 * 1024 * 1024;

/* Normalizacao (mantida igual) */
function normalizeEquip(e) {
  if (!e || typeof e !== 'object') return null;
  if (!e.id || !e.nome || !e.local) return null;
  return {
    id: String(e.id),
    nome: String(e.nome),
    local: String(e.local),
    status: ['ok', 'warn', 'danger'].includes(e.status) ? e.status : 'ok',
    tag: String(e.tag || ''),
    tipo: String(e.tipo || 'Outro'),
    modelo: String(e.modelo || ''),
    fluido: String(e.fluido || ''),
  };
}

function normalizeRegistro(r, equipamentoIds) {
  if (!r || typeof r !== 'object') return null;
  if (!r.id || !r.equipId || !equipamentoIds.has(String(r.equipId))) return null;
  if (!r.data || !r.tipo) return null;
  return {
    id: String(r.id),
    equipId: String(r.equipId),
    data: String(r.data),
    tipo: String(r.tipo),
    obs: String(r.obs || ''),
    status: ['ok', 'warn', 'danger'].includes(r.status) ? r.status : 'ok',
    pecas: String(r.pecas || ''),
    proxima: String(r.proxima || ''),
    fotos: Array.isArray(r.fotos) ? r.fotos.filter((f) => typeof f === 'string') : [],
    tecnico: String(r.tecnico || ''),
    custoPecas: parseFloat(r.custoPecas || 0) || 0,
    custoMaoObra: parseFloat(r.custoMaoObra || 0) || 0,
    assinatura: Boolean(r.assinatura),
  };
}

/* â”€â”€ Supabase helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
async function getUserId() {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch (error) {
    handleError(error, {
      code: ErrorCodes.AUTH_FAILED,
      message: 'Não foi possível identificar o usuário logado.',
      context: { action: 'storage.getUserId' },
      showToast: false,
    });
    return null;
  }
}

async function pushEquipamentos(equipamentos, userId) {
  if (!equipamentos.length) return;
  try {
    const rows = equipamentos.map((e) => ({
      id: e.id,
      user_id: userId,
      nome: e.nome,
      local: e.local,
      status: e.status,
      tag: e.tag,
      tipo: e.tipo,
      modelo: e.modelo,
      fluido: e.fluido,
    }));
    await supabase.from('equipamentos').upsert(rows, { onConflict: 'id' });
  } catch (error) {
    throw new AppError('Falha ao sincronizar equipamentos.', ErrorCodes.SYNC_FAILED, 'warning', {
      action: 'pushEquipamentos',
      quantidade: equipamentos.length,
      userId,
      cause: error?.message,
    });
  }
}

async function pushRegistros(registros, userId) {
  if (!registros.length) return;
  try {
    const rows = registros.map((r) => ({
      id: r.id,
      user_id: userId,
      equip_id: r.equipId,
      data: r.data,
      tipo: r.tipo,
      obs: r.obs,
      status: r.status,
      pecas: r.pecas,
      proxima: r.proxima,
      tecnico: r.tecnico,
      custo_pecas: r.custoPecas,
      custo_mao_obra: r.custoMaoObra,
      assinatura: r.assinatura,
      fotos: r.fotos,
    }));
    await supabase.from('registros').upsert(rows, { onConflict: 'id' });
  } catch (error) {
    throw new AppError('Falha ao sincronizar registros.', ErrorCodes.SYNC_FAILED, 'warning', {
      action: 'pushRegistros',
      quantidade: registros.length,
      userId,
      cause: error?.message,
    });
  }
}

async function pushTecnicos(tecnicos, userId) {
  if (!tecnicos.length) return;
  try {
    for (const nome of tecnicos) {
      await supabase
        .from('tecnicos')
        .upsert({ user_id: userId, nome }, { onConflict: 'user_id,nome' });
    }
  } catch (error) {
    throw new AppError('Falha ao sincronizar técnicos.', ErrorCodes.SYNC_FAILED, 'warning', {
      action: 'pushTecnicos',
      quantidade: tecnicos.length,
      userId,
      cause: error?.message,
    });
  }
}

async function pullFromSupabase(userId) {
  let eqRes;
  let regRes;
  let tecRes;
  try {
    [eqRes, regRes, tecRes] = await Promise.all([
      supabase.from('equipamentos').select('*').eq('user_id', userId),
      supabase.from('registros').select('*').eq('user_id', userId),
      supabase.from('tecnicos').select('nome').eq('user_id', userId),
    ]);
  } catch (error) {
    throw new AppError('Falha ao carregar dados da nuvem.', ErrorCodes.NETWORK_ERROR, 'warning', {
      action: 'pullFromSupabase',
      userId,
      cause: error?.message,
    });
  }

  const equipamentos = (eqRes.data || []).map((e) => ({
    id: e.id,
    nome: e.nome,
    local: e.local,
    status: e.status,
    tag: e.tag || '',
    tipo: e.tipo || 'Outro',
    modelo: e.modelo || '',
    fluido: e.fluido || '',
  }));

  const equipIds = new Set(equipamentos.map((e) => e.id));

  const registros = (regRes.data || [])
    .map((r) => ({
      id: r.id,
      equipId: r.equip_id,
      data: r.data,
      tipo: r.tipo,
      obs: r.obs || '',
      status: r.status || 'ok',
      pecas: r.pecas || '',
      proxima: r.proxima || '',
      tecnico: r.tecnico || '',
      custoPecas: parseFloat(r.custo_pecas || 0),
      custoMaoObra: parseFloat(r.custo_mao_obra || 0),
      assinatura: Boolean(r.assinatura),
      fotos: Array.isArray(r.fotos) ? r.fotos : [],
    }))
    .filter((r) => equipIds.has(r.equipId));

  const tecnicos = (tecRes.data || []).map((t) => t.nome);

  return { equipamentos, registros, tecnicos };
}

/* Migracao automatica localStorage -> Supabase */
async function migrateIfNeeded(userId) {
  const MIGRATED_KEY = `cooltrack-migrated-${userId}`;
  if (localStorage.getItem(MIGRATED_KEY)) return;

  // Não migra se o usuário estava no modo guest — dados são do seed
  const isGuestMode = localStorage.getItem('cooltrack-guest-mode') === '1';
  if (isGuestMode) {
    localStorage.setItem(MIGRATED_KEY, '1');
    return;
  }

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    localStorage.setItem(MIGRATED_KEY, '1');
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.equipamentos?.length) {
      localStorage.setItem(MIGRATED_KEY, '1');
      return;
    }

    Toast.info('Migrando seus dados para a nuvem...');
    await pushEquipamentos(parsed.equipamentos, userId);
    await pushRegistros(parsed.registros || [], userId);
    await pushTecnicos(parsed.tecnicos || [], userId);
    localStorage.setItem(MIGRATED_KEY, '1');
    Toast.success('Dados migrados com sucesso.');
  } catch (_) {
    // falha silenciosa — tenta na próxima vez
  }
}

/* API publica */
export const Storage = {
  async loadFromSupabase() {
    const userId = await getUserId();
    if (!userId) return null;

    try {
      await migrateIfNeeded(userId);
    } catch (error) {
      handleError(error, {
        code: ErrorCodes.SYNC_FAILED,
        message: 'Falha ao preparar migração de dados.',
        context: { action: 'loadFromSupabase.migrate' },
      });
    }

    try {
      const state = await pullFromSupabase(userId);
      // Atualiza cache local
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return state;
    } catch (err) {
      handleError(err, {
        code: ErrorCodes.SYNC_FAILED,
        severity: 'warning',
        message: 'Sincronização pendente. Seus dados estão salvos localmente.',
        context: { action: 'loadFromSupabase.pull' },
      });
      return this._loadLocal();
    }
  },

  load(defaultState) {
    return this._loadLocal() || defaultState;
  },

  _loadLocal() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.equipamentos)) return null;
      const equipamentos = parsed.equipamentos.map(normalizeEquip).filter(Boolean);
      const equipIds = new Set(equipamentos.map((e) => e.id));
      const registros = (parsed.registros || [])
        .map((r) => normalizeRegistro(r, equipIds))
        .filter(Boolean);
      const tecnicos = Array.isArray(parsed.tecnicos)
        ? parsed.tecnicos.filter((t) => typeof t === 'string')
        : [];
      return { equipamentos, registros, tecnicos };
    } catch (err) {
      handleError(err, {
        code: ErrorCodes.DATA_CORRUPT,
        message: 'Falha ao carregar dados locais.',
        context: { action: '_loadLocal' },
        showToast: false,
      });
      return null;
    }
  },

  save(state) {
    // 1. Salva local imediatamente (offline first)
    try {
      const serialized = JSON.stringify(state);
      const byteSize = serialized.length * 2;
      if (byteSize >= STORAGE_LIMIT_BYTES) {
        Toast.error(`Armazenamento cheio. Remova registros antigos com fotos.`);
        return false;
      }
      if (byteSize >= STORAGE_WARN_BYTES) {
        Toast.warning(`Uso de armazenamento elevado: ${Utils.formatBytes(byteSize)} / 5 MB.`);
      }
      localStorage.setItem(STORAGE_KEY, serialized);
    } catch (error) {
      handleError(error, {
        code: ErrorCodes.STORAGE_QUOTA,
        message: 'Falha ao salvar localmente.',
        context: { action: 'save' },
      });
      return false;
    }

    // 2. Sincroniza com Supabase em background (não bloqueia UI)
    this._syncToSupabase(state);
    return true;
  },

  async _syncToSupabase(state) {
    const userId = await getUserId();
    if (!userId) return; // guest mode - nao sincroniza
    try {
      await pushEquipamentos(state.equipamentos, userId);
      await pushRegistros(state.registros, userId);
      await pushTecnicos(state.tecnicos, userId);
    } catch (err) {
      handleError(err, {
        code: ErrorCodes.SYNC_FAILED,
        severity: 'warning',
        message: 'Sincronização pendente. Seus dados estão salvos localmente.',
        context: { action: '_syncToSupabase' },
      });
    }
  },

  usage() {
    const used = Utils.getStorageBytes();
    return {
      used,
      total: STORAGE_LIMIT_BYTES,
      percent: Math.min(100, Math.round((used / STORAGE_LIMIT_BYTES) * 100)),
    };
  },
};
