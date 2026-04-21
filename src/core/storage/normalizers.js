/**
 * CoolTrack Pro - Storage / normalizers
 * Funções puras de normalização e mapeamento entre o shape interno
 * (equipamentos/registros) e o shape persistido (localStorage / Supabase).
 *
 * Também contém a migração de fotos legadas em base64 para Storage.
 */

import { STORAGE_KEY } from '../utils.js';
import { migrateLegacyPhotosForRegistros, normalizePhotoList } from '../photoStorage.js';
import {
  normalizeCriticidade,
  normalizePrioridadeOperacional,
  normalizePeriodicidadePreventivaDias,
} from '../../domain/maintenance.js';
import { sanitizePersistedEquipamento, sanitizePersistedRegistro } from '../inputValidation.js';

export function normalizeEquip(e) {
  if (!e || typeof e !== 'object') return null;
  if (!e.id) return null;

  const sanitized = sanitizePersistedEquipamento({
    nome: e.nome,
    local: e.local,
    tag: e.tag,
    modelo: e.modelo,
  });
  if (!sanitized) return null;

  return {
    id: String(e.id),
    nome: sanitized.nome,
    local: sanitized.local,
    status: ['ok', 'warn', 'danger'].includes(e.status) ? e.status : 'ok',
    tag: sanitized.tag,
    tipo: String(e.tipo || 'Outro'),
    modelo: sanitized.modelo,
    fluido: String(e.fluido || ''),
    criticidade: normalizeCriticidade(e.criticidade),
    prioridadeOperacional: normalizePrioridadeOperacional(e.prioridadeOperacional || e.prioridade),
    periodicidadePreventivaDias: normalizePeriodicidadePreventivaDias(
      e.periodicidadePreventivaDias,
      e.tipo,
      e.criticidade,
    ),
    // JSONB remoto pode chegar como string se a column vier de snake_case.
    // sanitizeDadosPlaca tolera object/null/undefined e já filtra valores vazios.
    dadosPlaca: sanitizeDadosPlaca(e.dadosPlaca ?? e.dados_placa),
  };
}

export function isLegacyEquipmentSchemaError(error) {
  const message = String(error?.message || '').toLowerCase();
  return (
    message.includes('column') &&
    (message.includes('criticidade') ||
      message.includes('prioridade_operacional') ||
      message.includes('periodicidade_preventiva_dias') ||
      message.includes('dados_placa'))
  );
}

/**
 * Saneia o blob `dados_placa` antes de persistir no Supabase.
 *   - Aceita apenas object (não array/scalar) — idem à constraint da migration.
 *   - Remove chaves com valor null/undefined/'' pra manter o JSON compacto.
 *   - Se o input for null/undefined → retorna `{}` (default da coluna).
 *
 * Não valida schema (capacidade_btu é int?) — isso cabe ao client-side form.
 * O objetivo aqui é só garantir que o INSERT não quebre a constraint do DB.
 */
function sanitizeDadosPlaca(input) {
  if (input == null) return {};
  if (typeof input !== 'object' || Array.isArray(input)) return {};
  const out = {};
  for (const [key, value] of Object.entries(input)) {
    if (value == null || value === '') continue;
    out[key] = value;
  }
  return out;
}

export function mapEquipamentoRow(equipamento, userId, { legacy = false } = {}) {
  const row = {
    id: equipamento.id,
    user_id: userId,
    nome: equipamento.nome,
    local: equipamento.local,
    status: equipamento.status,
    tag: equipamento.tag,
    tipo: equipamento.tipo,
    modelo: equipamento.modelo,
    fluido: equipamento.fluido,
  };
  if (legacy) return row;
  return {
    ...row,
    criticidade: normalizeCriticidade(equipamento.criticidade),
    prioridade_operacional: normalizePrioridadeOperacional(equipamento.prioridadeOperacional),
    periodicidade_preventiva_dias: normalizePeriodicidadePreventivaDias(
      equipamento.periodicidadePreventivaDias,
      equipamento.tipo,
      equipamento.criticidade,
    ),
    // dados_placa é JSONB com DEFAULT '{}'::jsonb + CHECK (jsonb_typeof = 'object').
    // sanitizeDadosPlaca garante object válido mesmo se vier null/array/scalar.
    dados_placa: sanitizeDadosPlaca(equipamento.dadosPlaca),
  };
}

export function normalizeRegistro(r, equipamentoIds) {
  if (!r || typeof r !== 'object') return null;
  if (!r.id || !r.equipId || !equipamentoIds.has(String(r.equipId))) return null;

  const sanitized = sanitizePersistedRegistro(
    {
      equipId: String(r.equipId),
      data: r.data,
      tipo: r.tipo,
      obs: r.obs,
      status: r.status,
      pecas: r.pecas,
      proxima: r.proxima,
      tecnico: r.tecnico,
      custoPecas: r.custoPecas,
      custoMaoObra: r.custoMaoObra,
    },
    {
      existingEquipamentos: [{ id: String(r.equipId) }],
    },
  );
  if (!sanitized) return null;

  return {
    id: String(r.id),
    equipId: sanitized.equipId,
    data: sanitized.data,
    tipo: sanitized.tipo,
    obs: sanitized.obs,
    status: sanitized.status,
    pecas: sanitized.pecas,
    proxima: sanitized.proxima,
    fotos: normalizePhotoList(r.fotos),
    tecnico: sanitized.tecnico,
    custoPecas: sanitized.custoPecas,
    custoMaoObra: sanitized.custoMaoObra,
    assinatura: Boolean(r.assinatura),
  };
}

export async function migrateLegacyPhotosInState(state, userId) {
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
