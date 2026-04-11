/**
 * CoolTrack Pro - WhatsApp Export Module v1.0 (D5)
 * Gera resumo formatado do relatório para envio via WhatsApp Web
 */

import { getState, findEquip } from '../core/state.js';
import { Utils } from '../core/utils.js';
import { Profile } from '../features/profile.js';
export const WhatsAppExport = {
  generateText({ filtEq = '', de = '', ate = '' } = {}) {
    const { registros } = getState();
    const profile = Profile.get();

    let filtered = [...registros].sort((a, b) => b.data.localeCompare(a.data));
    if (filtEq) filtered = filtered.filter((r) => r.equipId === filtEq);
    if (de) filtered = filtered.filter((r) => r.data >= de);
    if (ate) filtered = filtered.filter((r) => r.data <= `${ate}T23:59`);

    if (!filtered.length) return null;

    const hoje = new Date().toLocaleDateString('pt-BR');
    const tecnico = profile?.nome || 'Técnico';
    const empresa = profile?.empresa ? ` — ${profile.empresa}` : '';

    const STATUS_WA = { ok: '✅', warn: '⚠️', danger: '🔴' };

    const linhas = filtered
      .slice(0, 10)
      .map((r, i) => {
        const eq = findEquip(r.equipId);
        const ico = STATUS_WA[r.status] || '✅';
        return `${i + 1}. ${ico} *${r.tipo}*\n   📍 ${eq?.nome || '—'} (${eq?.tag || '—'})\n   🗓 ${Utils.formatDatetime(r.data)}\n   👷 ${r.tecnico || tecnico}`;
      })
      .join('\n\n');

    const resumo = `🧊 *COOLTRACK PRO — Relatório de Manutenção*\n*${tecnico}${empresa}*\nGerado em ${hoje}\n\n${linhas}${filtered.length > 10 ? `\n\n_...e mais ${filtered.length - 10} registro(s)_` : ''}\n\n_Relatório completo gerado pelo CoolTrack Pro_\n\n---\nRelatorio gerado por CoolTrack Pro\nGestao de manutencao para tecnicos HVAC\nCrie sua conta gratis: https://cooltrackpro.com.br`;

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
