/**
 * CoolTrack Pro - WhatsApp Export Module v1.0 (D5)
 * Gera resumo formatado do relatório para envio via WhatsApp Web
 */

import { getState, findEquip } from '../core/state.js';
import { Utils } from '../core/utils.js';
import { Profile } from '../features/profile.js';

const SERVICE_LABELS = {
  limpeza_filtros: 'Limpeza de filtros',
  inspecao_geral: 'Inspeção geral',
  carga_gas: 'Carga de gás refrigerante',
  preventiva: 'Preventiva',
  corretiva: 'Corretiva',
  outros: 'Manutenção',
};

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function classifyService(tipo) {
  const normalized = normalizeText(tipo);
  if (!normalized) return 'outros';
  if (normalized.includes('limpeza') && normalized.includes('filtro')) return 'limpeza_filtros';
  if (normalized.includes('inspecao')) return 'inspecao_geral';
  if (normalized.includes('carga') && normalized.includes('gas')) return 'carga_gas';
  if (normalized.includes('preventiva')) return 'preventiva';
  if (normalized.includes('corretiva')) return 'corretiva';
  return 'outros';
}

function summarizeServices(registros = []) {
  const counts = new Map();
  for (const registro of registros) {
    const key = classifyService(registro?.tipo);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function buildServiceLine(registros = []) {
  if (!registros.length) return 'Serviço: Manutenção.';
  if (registros.length === 1) {
    const key = classifyService(registros[0]?.tipo);
    return `Serviço: ${SERVICE_LABELS[key]}.`;
  }

  const ranked = summarizeServices(registros);
  const topLabels = ranked.slice(0, 2).map(([key]) => SERVICE_LABELS[key]);
  if (topLabels.length === 1) {
    return `Foram registrados ${registros.length} atendimentos no período. Serviço principal: ${topLabels[0]}.`;
  }
  return `Foram registrados ${registros.length} atendimentos no período. Principais serviços: ${topLabels[0]} e ${topLabels[1]}.`;
}

function formatServiceDate(isoDateTime) {
  const dateLabel = Utils.formatDate(isoDateTime);
  return dateLabel === '—' ? new Date().toLocaleDateString('pt-BR') : dateLabel;
}

export const WhatsAppExport = {
  generateText({ registroId = '', filtEq = '', de = '', ate = '' } = {}) {
    const { registros } = getState();
    const profile = Profile.get();

    let filtered = [...registros].sort((a, b) => b.data.localeCompare(a.data));
    if (registroId) filtered = filtered.filter((r) => r.id === registroId);
    else {
      if (filtEq) filtered = filtered.filter((r) => r.equipId === filtEq);
      if (de) filtered = filtered.filter((r) => r.data >= de);
      if (ate) filtered = filtered.filter((r) => r.data <= `${ate}T23:59`);
    }

    if (!filtered.length) return null;

    const latest = filtered[0];
    const equipRefId = registroId ? latest?.equipId : filtEq || latest?.equipId;
    const equip = findEquip(equipRefId);
    const equipName = equip?.nome || 'equipamento informado';
    const serviceDate = formatServiceDate(latest?.data);
    const serviceLine = buildServiceLine(filtered);
    const tecnico = profile?.nome || latest?.tecnico || 'Equipe de manutenção';
    const assinatura = profile?.empresa ? `${tecnico} • ${profile.empresa}` : tecnico;

    const resumo = `Olá! Segue o resumo da manutenção realizada em ${serviceDate} no equipamento ${equipName}.\n${serviceLine}\nQualquer dúvida, estou à disposição.\n\nAtenciosamente,\n${assinatura}`;

    return resumo;
  },

  send(options = {}) {
    const texto = this.generateText(options);
    if (!texto) return false;
    const url = `https://wa.me/?text=${encodeURIComponent(texto)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    return true;
  },
};

export const __testables = {
  classifyService,
  buildServiceLine,
};
