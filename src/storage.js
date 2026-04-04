/**
 * CoolTrack Pro - Storage Module v3.4
 * Corrigido: aviso antes de atingir limite + Toast de erro
 */

import { STORAGE_KEY, Utils } from './utils.js';
import { Toast } from './toast.js';

const STORAGE_WARN_BYTES = 4 * 1024 * 1024;  // 4 MB → aviso
const STORAGE_LIMIT_BYTES = 5 * 1024 * 1024; // 5 MB → bloqueio

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
    fotos: Array.isArray(r.fotos) ? r.fotos.filter(f => typeof f === 'string') : [],
    tecnico: String(r.tecnico || '')
  };
}

export const Storage = {
  load(defaultState) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState;
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.equipamentos) || !Array.isArray(parsed.registros)) return defaultState;

      const equipamentos = parsed.equipamentos.map(normalizeEquip).filter(Boolean);
      const equipamentoIds = new Set(equipamentos.map(e => e.id));
      const registros = parsed.registros.map(r => normalizeRegistro(r, equipamentoIds)).filter(Boolean);
      const tecnicos = Array.isArray(parsed.tecnicos)
        ? parsed.tecnicos.filter(t => typeof t === 'string' && t.trim())
        : (defaultState.tecnicos || []);

      return { equipamentos, registros, tecnicos };
    } catch (_) {
      return defaultState;
    }
  },

  save(state) {
    try {
      const serialized = JSON.stringify(state);
      const byteSize = serialized.length * 2;

      if (byteSize >= STORAGE_LIMIT_BYTES) {
        Toast.error(`Armazenamento quase cheio (${Utils.formatBytes(byteSize)}). Remova fotos antigas antes de salvar.`);
        return false;
      }

      if (byteSize >= STORAGE_WARN_BYTES) {
        Toast.warning(`Uso de armazenamento elevado: ${Utils.formatBytes(byteSize)} de ~5 MB.`);
      }

      localStorage.setItem(STORAGE_KEY, serialized);
      return true;
    } catch (_) {
      Toast.error('Falha ao salvar dados. Armazenamento do navegador pode estar cheio.');
      return false;
    }
  },

  /** Retorna { used, total, percent } */
  usage() {
    const used = Utils.getStorageBytes();
    return {
      used,
      total: STORAGE_LIMIT_BYTES,
      percent: Math.min(100, Math.round((used / STORAGE_LIMIT_BYTES) * 100))
    };
  }
};