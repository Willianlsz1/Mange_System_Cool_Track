/**
 * CoolTrack Pro - Storage v5.0
 * localStorage como cache + Supabase como fonte de verdade
 * Offline first: salva local imediatamente, sincroniza com Supabase em background
 */

import { STORAGE_KEY, Utils } from './utils.js';
import { Toast } from './toast.js';
import { supabase } from './supabase.js';
import { migrateLegacyPhotosForRegistros, normalizePhotoList } from './photoStorage.js';
import { AppError, ErrorCodes, handleError } from './errors.js';

const STORAGE_WARN_BYTES = 4 * 1024 * 1024;
const STORAGE_LIMIT_BYTES = 5 * 1024 * 1024;
const STORAGE_SYNC_DIRTY_KEY = 'cooltrack-sync-dirty-v1';
const STORAGE_SYNC_DELETIONS_KEY = 'cooltrack-sync-deletions-v1';
const STORAGE_CACHE_OWNER_KEY = 'cooltrack-cache-owner-v1';
const SYNC_STATUS_EVENT = 'cooltrack:sync-status';

let _syncRunning = false;
let _queuedState = null;
let _syncStatus = {
  state: 'idle',
  message: '',
  pendingOps: 0,
  updatedAt: new Date().toISOString(),
};

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
    fotos: normalizePhotoList(r.fotos),
    tecnico: String(r.tecnico || ''),
    custoPecas: parseFloat(r.custoPecas || 0) || 0,
    custoMaoObra: parseFloat(r.custoMaoObra || 0) || 0,
    assinatura: Boolean(r.assinatura),
  };
}

async function migrateLegacyPhotosInState(state, userId) {
  if (!state?.registros?.length) {
    return { state, migratedCount: 0, failedCount: 0 };
  }

  const migration = await migrateLegacyPhotosForRegistros(state.registros, { userId });
  if (!migration.migratedCount && !migration.failedCount) {
    return { state, migratedCount: 0, failedCount: 0 };
  }

  const migratedState = { ...state, registros: migration.registros };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(migratedState));
  } catch (_err) {
    // cache local é opcional nessa etapa
  }

  return {
    state: migratedState,
    migratedCount: migration.migratedCount,
    failedCount: migration.failedCount,
  };
}

function getCacheOwner() {
  return localStorage.getItem(STORAGE_CACHE_OWNER_KEY);
}

function setCacheOwner(userId) {
  if (!userId) return;
  localStorage.setItem(STORAGE_CACHE_OWNER_KEY, String(userId));
}

function markDirty() {
  localStorage.setItem(STORAGE_SYNC_DIRTY_KEY, '1');
}

function clearDirty() {
  localStorage.removeItem(STORAGE_SYNC_DIRTY_KEY);
}

function isDirty() {
  return localStorage.getItem(STORAGE_SYNC_DIRTY_KEY) === '1';
}

function parseDeletionQueue() {
  try {
    const raw = localStorage.getItem(STORAGE_SYNC_DELETIONS_KEY);
    if (!raw) return { equipamentos: [], registros: [] };
    const parsed = JSON.parse(raw);
    const equipamentos = Array.isArray(parsed?.equipamentos)
      ? [...new Set(parsed.equipamentos.map(String).filter(Boolean))]
      : [];
    const registros = Array.isArray(parsed?.registros)
      ? [...new Set(parsed.registros.map(String).filter(Boolean))]
      : [];
    return { equipamentos, registros };
  } catch (_error) {
    return { equipamentos: [], registros: [] };
  }
}

function saveDeletionQueue(queue) {
  const sanitized = {
    equipamentos: [...new Set((queue?.equipamentos || []).map(String).filter(Boolean))],
    registros: [...new Set((queue?.registros || []).map(String).filter(Boolean))],
  };
  if (!sanitized.equipamentos.length && !sanitized.registros.length) {
    localStorage.removeItem(STORAGE_SYNC_DELETIONS_KEY);
    return sanitized;
  }
  localStorage.setItem(STORAGE_SYNC_DELETIONS_KEY, JSON.stringify(sanitized));
  return sanitized;
}

function queueDeletions({ equipamentos = [], registros = [] } = {}) {
  const current = parseDeletionQueue();
  const next = {
    equipamentos: [...current.equipamentos, ...equipamentos.map(String).filter(Boolean)],
    registros: [...current.registros, ...registros.map(String).filter(Boolean)],
  };
  const saved = saveDeletionQueue(next);
  updateSyncStatus();
  return saved;
}

function clearSyncMetadata() {
  clearDirty();
  localStorage.removeItem(STORAGE_SYNC_DELETIONS_KEY);
  _queuedState = null;
  updateSyncStatus({ state: 'idle', message: '' });
}

function getPendingOpsCount() {
  const queue = parseDeletionQueue();
  let count = queue.equipamentos.length + queue.registros.length;
  if (isDirty()) count += 1;
  if (_queuedState) count += 1;
  return count;
}

function emitSyncStatus() {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
  window.dispatchEvent(new CustomEvent(SYNC_STATUS_EVENT, { detail: { ..._syncStatus } }));
}

function updateSyncStatus(patch = {}) {
  _syncStatus = {
    ..._syncStatus,
    ...patch,
    pendingOps: getPendingOpsCount(),
    updatedAt: new Date().toISOString(),
  };
  emitSyncStatus();
}

function splitIntoChunks(values, chunkSize = 100) {
  const list = Array.isArray(values) ? values : [];
  const chunks = [];
  for (let i = 0; i < list.length; i += chunkSize) {
    chunks.push(list.slice(i, i + chunkSize));
  }
  return chunks;
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
    const { error } = await supabase.from('equipamentos').upsert(rows, { onConflict: 'id' });
    if (error) throw error;
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
      fotos: normalizePhotoList(r.fotos),
    }));
    const { error } = await supabase.from('registros').upsert(rows, { onConflict: 'id' });
    if (error) throw error;
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
    const rows = [...new Set(tecnicos.map(String).filter(Boolean))].map((nome) => ({
      user_id: userId,
      nome,
    }));
    if (!rows.length) return;
    const { error } = await supabase.from('tecnicos').upsert(rows, { onConflict: 'user_id,nome' });
    if (error) throw error;
  } catch (error) {
    throw new AppError('Falha ao sincronizar técnicos.', ErrorCodes.SYNC_FAILED, 'warning', {
      action: 'pushTecnicos',
      quantidade: tecnicos.length,
      userId,
      cause: error?.message,
    });
  }
}

async function deleteRemoteRegistros(ids, userId) {
  const uniqueIds = [...new Set((ids || []).map(String).filter(Boolean))];
  if (!uniqueIds.length) return;
  for (const chunk of splitIntoChunks(uniqueIds, 100)) {
    const { error } = await supabase
      .from('registros')
      .delete()
      .eq('user_id', userId)
      .in('id', chunk);
    if (error) throw error;
  }
}

async function deleteRemoteEquipamentos(ids, userId) {
  const uniqueIds = [...new Set((ids || []).map(String).filter(Boolean))];
  if (!uniqueIds.length) return;
  for (const chunk of splitIntoChunks(uniqueIds, 100)) {
    const { error } = await supabase
      .from('equipamentos')
      .delete()
      .eq('user_id', userId)
      .in('id', chunk);
    if (error) throw error;
  }
}

async function flushPendingDeletions(userId) {
  const queue = parseDeletionQueue();
  if (!queue.equipamentos.length && !queue.registros.length) return;

  const remaining = {
    ...queue,
    equipamentos: [...queue.equipamentos],
    registros: [...queue.registros],
  };

  if (queue.registros.length) {
    await deleteRemoteRegistros(queue.registros, userId);
    remaining.registros = [];
  }
  if (queue.equipamentos.length) {
    await deleteRemoteEquipamentos(queue.equipamentos, userId);
    remaining.equipamentos = [];
  }

  saveDeletionQueue(remaining);
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
    if (eqRes.error || regRes.error || tecRes.error) {
      throw new Error(
        eqRes.error?.message || regRes.error?.message || tecRes.error?.message || 'select failed',
      );
    }
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
      fotos: normalizePhotoList(r.fotos),
    }))
    .filter((r) => equipIds.has(r.equipId));

  const tecnicos = (tecRes.data || []).map((t) => t.nome);

  return { equipamentos, registros, tecnicos };
}

/* Migracao automatica localStorage -> Supabase */
async function migrateIfNeeded(userId) {
  const MIGRATED_KEY = `cooltrack-migrated-${userId}`;
  if (localStorage.getItem(MIGRATED_KEY)) return;

  const cacheOwner = getCacheOwner();
  if (cacheOwner && cacheOwner !== userId) {
    localStorage.setItem(MIGRATED_KEY, '1');
    return;
  }

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

    const cacheOwner = getCacheOwner();
    const sameOwner = !cacheOwner || cacheOwner === userId;
    const localSnapshot = this._loadLocal();

    if (!sameOwner) {
      clearSyncMetadata();
    }

    if (sameOwner && localSnapshot && this.hasPendingSync()) {
      const synced = await this._syncToSupabase(localSnapshot, {
        silent: true,
        context: 'loadFromSupabase.pendingFlush',
      });
      if (!synced) {
        updateSyncStatus({
          state: 'pending',
          message: 'Sem conexão com a nuvem. Exibindo dados locais.',
        });
        return localSnapshot;
      }
    }

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
      setCacheOwner(userId);
      clearDirty();
      updateSyncStatus({ state: 'synced', message: 'Dados sincronizados.' });

      // Migração gradual de fotos legadas (base64) para Storage sem bloquear o bootstrap
      this._migrateLegacyPhotosAsync(state, userId);
      return state;
    } catch (err) {
      handleError(err, {
        code: ErrorCodes.SYNC_FAILED,
        severity: 'warning',
        message: 'Sincronização pendente. Seus dados estão salvos localmente.',
        context: { action: 'loadFromSupabase.pull' },
      });
      updateSyncStatus({
        state: 'pending',
        message: 'Sincronização pendente. Seus dados estão salvos localmente.',
      });
      return sameOwner ? localSnapshot : null;
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
      if (!parsed || typeof parsed !== 'object') return null;
      const equipamentos = (Array.isArray(parsed.equipamentos) ? parsed.equipamentos : [])
        .map(normalizeEquip)
        .filter(Boolean);
      const equipIds = new Set(equipamentos.map((e) => e.id));
      const registros = (Array.isArray(parsed.registros) ? parsed.registros : [])
        .map((r) => normalizeRegistro(r, equipIds))
        .filter(Boolean);
      const tecnicos = Array.isArray(parsed.tecnicos)
        ? [
            ...new Set(parsed.tecnicos.filter((t) => typeof t === 'string').map((t) => t.trim())),
          ].filter(Boolean)
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
    const isGuestMode = localStorage.getItem('cooltrack-guest-mode') === '1';
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
      if (!isGuestMode) {
        markDirty();
      }
    } catch (error) {
      handleError(error, {
        code: ErrorCodes.STORAGE_QUOTA,
        message: 'Falha ao salvar localmente.',
        context: { action: 'save' },
      });
      return false;
    }

    // 2. Sincroniza com Supabase em background (não bloqueia UI)
    if (!isGuestMode) {
      this._scheduleSync(state);
    }
    return true;
  },

  _scheduleSync(state) {
    _queuedState = state;
    if (_syncRunning) {
      updateSyncStatus({ state: 'pending', message: 'Sincronização em fila.' });
      return;
    }
    _syncRunning = true;
    updateSyncStatus({ state: 'syncing', message: 'Sincronizando alterações...' });
    void this._drainSyncQueue();
  },

  async _drainSyncQueue() {
    try {
      while (_queuedState) {
        const snapshot = _queuedState;
        _queuedState = null;
        const ok = await this._syncToSupabase(snapshot, {
          silent: false,
          context: 'storage._drainSyncQueue',
        });
        if (!ok) break;
      }
    } finally {
      _syncRunning = false;
      if (!this.hasPendingSync()) {
        updateSyncStatus({ state: 'synced', message: 'Dados sincronizados.' });
      }
    }
  },

  async _syncToSupabase(state, { silent = false, context = '_syncToSupabase' } = {}) {
    if (localStorage.getItem('cooltrack-guest-mode') === '1') {
      clearSyncMetadata();
      return false;
    }

    const userId = await getUserId();
    if (!userId) {
      updateSyncStatus({
        state: 'pending',
        message: 'Faça login para sincronizar os dados.',
      });
      return false;
    }

    updateSyncStatus({ state: 'syncing', message: 'Sincronizando alterações...' });

    try {
      await flushPendingDeletions(userId);

      const migration = await migrateLegacyPhotosInState(state, userId);
      const syncState = migration.state;

      await pushEquipamentos(syncState.equipamentos, userId);
      await pushRegistros(syncState.registros, userId);
      await pushTecnicos(syncState.tecnicos, userId);

      if (migration.failedCount > 0) {
        Toast.warning(
          'Algumas fotos não foram enviadas para a nuvem e permaneceram salvas localmente.',
        );
      }
      clearDirty();
      setCacheOwner(userId);
      updateSyncStatus({ state: 'synced', message: 'Dados sincronizados.' });
      return true;
    } catch (err) {
      handleError(err, {
        code: ErrorCodes.SYNC_FAILED,
        severity: 'warning',
        message: 'Sincronização pendente. Seus dados estão salvos localmente.',
        context: { action: context },
        showToast: !silent,
      });
      updateSyncStatus({
        state: 'pending',
        message: 'Sincronização pendente. Tentaremos novamente automaticamente.',
      });
      return false;
    }
  },

  async _migrateLegacyPhotosAsync(state, userId) {
    try {
      const migration = await migrateLegacyPhotosInState(state, userId);
      if (!migration.migratedCount) return;

      await pushRegistros(migration.state.registros, userId);
      if (migration.failedCount > 0) {
        Toast.warning('Algumas fotos antigas não puderam ser migradas e seguem salvas localmente.');
      }
    } catch (error) {
      handleError(error, {
        code: ErrorCodes.SYNC_FAILED,
        severity: 'warning',
        message: 'Migração de fotos pendente. Tentaremos novamente automaticamente.',
        context: { action: 'storage._migrateLegacyPhotosAsync' },
        showToast: false,
      });
    }
  },

  markRegistroDeleted(id) {
    if (localStorage.getItem('cooltrack-guest-mode') === '1') return;
    queueDeletions({ registros: [id] });
    markDirty();
  },

  markEquipDeleted(equipId, registroIds = []) {
    if (localStorage.getItem('cooltrack-guest-mode') === '1') return;
    queueDeletions({ equipamentos: [equipId], registros: registroIds });
    markDirty();
  },

  hasPendingSync() {
    const queue = parseDeletionQueue();
    return Boolean(
      isDirty() ||
      _queuedState ||
      queue.equipamentos.length ||
      queue.registros.length ||
      _syncRunning,
    );
  },

  getSyncStatus() {
    return { ..._syncStatus, pendingOps: getPendingOpsCount() };
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
