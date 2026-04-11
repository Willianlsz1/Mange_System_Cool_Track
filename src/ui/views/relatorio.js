/**
 * CoolTrack Pro - Relatório View v5.0
 * Funções: renderRelatorio, populateRelatorioSelects
 */

import { Utils, STATUS_LABEL } from '../../core/utils.js';
import { getState, findEquip } from '../../core/state.js';
import { emptyStateHtml } from '../components/emptyState.js';
import { withSkeleton } from '../components/skeleton.js';
import { CRITICIDADE_LABEL, PRIORIDADE_OPERACIONAL_LABEL } from '../../domain/maintenance.js';

export function populateRelatorioSelects() {
  const { equipamentos } = getState();
  const opts = equipamentos
    .map(
      (e) =>
        `<option value="${Utils.escapeAttr(e.id)}">${Utils.escapeHtml(e.nome)} — ${Utils.escapeHtml(e.local)}</option>`,
    )
    .join('');
  const el = Utils.getEl('rel-equip');
  if (el) el.innerHTML = '<option value="">Todos</option>' + opts;
}

export function renderRelatorio() {
  const { registros } = getState();
  const filtEq = Utils.getVal('rel-equip');
  const de = Utils.getVal('rel-de');
  const ate = Utils.getVal('rel-ate');

  let list = [...registros].sort((a, b) => b.data.localeCompare(a.data));
  if (filtEq) list = list.filter((r) => r.equipId === filtEq);
  if (de) list = list.filter((r) => r.data >= de);
  if (ate) list = list.filter((r) => r.data <= `${ate}T23:59`);

  const el = Utils.getEl('relatorio-corpo');
  if (!el) return;

  const hoje = new Date().toLocaleDateString('pt-BR');
  const total = list.reduce(
    (acc, r) => acc + (parseFloat(r.custoPecas || 0) + parseFloat(r.custoMaoObra || 0)),
    0,
  );

  const renderContent = () => {
    if (!list.length) {
      el.innerHTML = emptyStateHtml({
        icon: '📋',
        title: 'Sem registros no período selecionado',
        description: 'Ajuste os filtros ou registre um novo serviço para gerar o relatório.',
        ctaHtml:
          '<button class="btn btn--outline btn--sm btn--auto" data-nav="historico">Ver histórico</button>',
      });
      return;
    }

    el.innerHTML = `
      <div class="card">
        <div class="report-header">RELATÓRIO DE MANUTENÇÃO — COOLTRACK PRO</div>
        <div class="report-meta">Gerado em ${hoje} · ${list.length} registro(s)${total > 0 ? ` · Total: R$ ${total.toFixed(2).replace('.', ',')}` : ''}</div>
      </div>
      ${list
        .map((r) => {
          const eq = findEquip(r.equipId);
          const custoTotal = parseFloat(r.custoPecas || 0) + parseFloat(r.custoMaoObra || 0);
          const safeStatus = Utils.safeStatus(r.status);
          return `<div class="card report-record">
          <div class="report-record__head">
            <div>
              <div class="report-record__title">${Utils.escapeHtml(r.tipo)}</div>
              <div class="report-record__date">${Utils.formatDatetime(r.data)}</div>
            </div>
            <span class="badge badge--${safeStatus}"><span class="status-dot status-dot--${safeStatus}"></span>${STATUS_LABEL[safeStatus]}</span>
          </div>
          <div class="info-list">
            <div class="info-row"><span class="info-row__label">Equipamento</span><span class="info-row__value">${Utils.escapeHtml(eq?.nome ?? '—')}</span></div>
            <div class="info-row"><span class="info-row__label">TAG</span><span class="info-row__value info-row__value--mono">${Utils.escapeHtml(eq?.tag ?? '—')}</span></div>
            <div class="info-row"><span class="info-row__label">Local</span><span class="info-row__value">${Utils.escapeHtml(eq?.local ?? '—')}</span></div>
            <div class="info-row"><span class="info-row__label">Fluido</span><span class="info-row__value">${Utils.escapeHtml(eq?.fluido ?? '—')}</span></div>
            <div class="info-row"><span class="info-row__label">Criticidade</span><span class="info-row__value">${Utils.escapeHtml(CRITICIDADE_LABEL[eq?.criticidade] || CRITICIDADE_LABEL.media)}</span></div>
            <div class="info-row"><span class="info-row__label">Prioridade operacional</span><span class="info-row__value">${Utils.escapeHtml(PRIORIDADE_OPERACIONAL_LABEL[eq?.prioridadeOperacional] || PRIORIDADE_OPERACIONAL_LABEL.normal)}</span></div>
            <div class="info-row"><span class="info-row__label">Rotina preventiva</span><span class="info-row__value">${eq?.periodicidadePreventivaDias ? `${eq.periodicidadePreventivaDias} dias` : '—'}</span></div>
            <div class="info-row"><span class="info-row__label">Técnico</span><span class="info-row__value">${Utils.escapeHtml(r.tecnico ?? '—')}</span></div>
            ${r.pecas ? `<div class="info-row"><span class="info-row__label">Peças / Materiais</span><span class="info-row__value">${Utils.escapeHtml(r.pecas)}</span></div>` : ''}
            ${r.custoPecas > 0 ? `<div class="info-row"><span class="info-row__label">Custo de Peças</span><span class="info-row__value">R$ ${parseFloat(r.custoPecas).toFixed(2).replace('.', ',')}</span></div>` : ''}
            ${r.custoMaoObra > 0 ? `<div class="info-row"><span class="info-row__label">Mão de Obra</span><span class="info-row__value">R$ ${parseFloat(r.custoMaoObra).toFixed(2).replace('.', ',')}</span></div>` : ''}
            ${custoTotal > 0 ? `<div class="info-row info-row--total"><span class="info-row__label info-row__label--strong">Total do Serviço</span><span class="info-row__value info-row__value--primary">R$ ${custoTotal.toFixed(2).replace('.', ',')}</span></div>` : ''}
            ${r.proxima ? `<div class="info-row"><span class="info-row__label">Próxima Manutenção</span><span class="info-row__value">${Utils.formatDate(r.proxima)}</span></div>` : ''}
            ${r.assinatura ? `<div class="info-row"><span class="info-row__label">Assinatura</span><span class="info-row__value info-row__value--success">✓ Assinado pelo cliente</span></div>` : ''}
          </div>
          <div class="report-record__obs">${Utils.escapeHtml(r.obs)}</div>
        </div>`;
        })
        .join('')}`;
  };

  withSkeleton(
    el,
    { enabled: true, variant: 'report', count: Math.min(Math.max(list.length, 3), 4) },
    renderContent,
  );
}
