/**
 * CoolTrack Pro - Storage / remote
 * Camada que conversa com o Supabase: resolve o usuário atual, faz upsert
 * de equipamentos/registros/técnicos, apaga registros remotos em lotes
 * (chunk de 100 ids) e baixa o snapshot completo do usuário.
 */

import { supabase } from '../supabase.js';
import { normalizePhotoList } from '../photoStorage.js';
import { AppError, ErrorCodes, handleError } from '../errors.js';
import {
  normalizeCriticidade,
  normalizePrioridadeOperacional,
  normalizePeriodicidadePreventivaDias,
} from '../../domain/maintenance.js';
import { isLegacyEquipmentSchemaError, mapEquipamentoRow } from './normalizers.js';
import { parseDeletionQueue, saveDeletionQueue } from './syncState.js';

function splitIntoChunks(values, chunkSize = 100) {
  const list = Array.isArray(values) ? values : [];
  const chunks = [];
  for (let i = 0; i < list.length; i += chunkSize) {
    chunks.push(list.slice(i, i + chunkSize));
  }
  return chunks;
}

export async function getUserId() {
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

export async function pushEquipamentos(equipamentos, userId) {
  if (!equipamentos.length) return;
  try {
    const rows = equipamentos.map((equipamento) => mapEquipamentoRow(equipamento, userId));
    let { error } = await supabase.from('equipamentos').upsert(rows, { onConflict: 'id' });
    if (error && isLegacyEquipmentSchemaError(error)) {
      const legacyRows = equipamentos.map((equipamento) =>
        mapEquipamentoRow(equipamento, userId, { legacy: true }),
      );
      ({ error } = await supabase.from('equipamentos').upsert(legacyRows, { onConflict: 'id' }));
    }
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

export async function pushRegistros(registros, userId) {
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

export async function pushTecnicos(tecnicos, userId) {
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

export async function flushPendingDeletions(userId) {
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

export async function pullFromSupabase(userId) {
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
    criticidade: normalizeCriticidade(e.criticidade),
    prioridadeOperacional: normalizePrioridadeOperacional(
      e.prioridade_operacional || e.prioridadeOperacional,
    ),
    periodicidadePreventivaDias: normalizePeriodicidadePreventivaDias(
      e.periodicidade_preventiva_dias,
      e.tipo,
      e.criticidade,
    ),
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
