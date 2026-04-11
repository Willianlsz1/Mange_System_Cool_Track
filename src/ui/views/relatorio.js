/**
 * CoolTrack Pro - RelatÃ³rio View v5.0
 * FunÃ§Ãµes: renderRelatorio, populateRelatorioSelects
 */

import { Utils, STATUS_LABEL } from '../../core/utils.js';
import { getState, findEquip } from '../../core/state.js';
import { withSkeleton } from '../components/skeleton.js';
import { CRITICIDADE_LABEL, PRIORIDADE_OPERACIONAL_LABEL } from '../../domain/maintenance.js';

export function populateRelatorioSelects() {
  const { equipamentos } = getState();
  const el = Utils.getEl('rel-equip');
  if (!el) return;

  el.textContent = '';
  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = 'Todos';
  el.appendChild(defaultOption);

  equipamentos.forEach((equipamento) => {
    const option = document.createElement('option');
    option.value = String(equipamento.id || '');
    option.textContent = `${equipamento.nome || '—'} — ${equipamento.local || '—'}`;
    el.appendChild(option);
  });
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
      el.innerHTML = `<section class="engaging-empty-state" aria-label="Sem dados para relatÃ³rio">
        <div class="engaging-empty-state__icon">ðŸ“‹</div>
        <h3 class="engaging-empty-state__title">Sem registros no perÃ­odo selecionado</h3>
        <p class="engaging-empty-state__description">Registre um serviÃ§o e veja seu relatÃ³rio profissional pronto para envio em segundos.</p>
        <div class="report-empty-preview-wrap" role="presentation">
          <div class="report-empty-preview">
            <div class="report-empty-preview__header">
              <div class="report-empty-preview__brand">
                <span>â„ï¸</span>
                <span>CoolTrack Pro â€” RelatÃ³rio de ServiÃ§o</span>
              </div>
            </div>
            <div class="report-empty-preview__meta">
              <div><span>TÃ©cnico</span><strong>Seu nome</strong></div>
              <div><span>Data</span><strong>${Utils.escapeHtml(hoje)}</strong></div>
              <div><span>Equipamento</span><strong>Split Loja Centro</strong></div>
              <div><span>Tipo</span><strong>ManutenÃ§Ã£o Preventiva</strong></div>
            </div>
            <table class="report-empty-preview__table" aria-label="Preview de relatÃ³rio">
              <thead>
                <tr><th>ServiÃ§o</th><th>Status</th><th>Obs</th></tr>
              </thead>
              <tbody>
                <tr><td>Limpeza de filtros</td><td>ConcluÃ­do</td><td>Fluxo estabilizado</td></tr>
                <tr><td>InspeÃ§Ã£o elÃ©trica</td><td>ConcluÃ­do</td><td>Sem aquecimento</td></tr>
                <tr><td>VerificaÃ§Ã£o de dreno</td><td>ConcluÃ­do</td><td>Sem obstruÃ§Ã£o</td></tr>
              </tbody>
            </table>
          </div>
        </div>
        <button class="btn btn--primary engaging-empty-state__cta" data-nav="registro">Registrar serviÃ§o para gerar relatÃ³rio â†’</button>
      </section>`;
      return;
    }

    el.innerHTML = `
      <div class="card">
        <div class="report-header">RELATÃ“RIO DE MANUTENÃ‡ÃƒO â€” COOLTRACK PRO</div>
        <div class="report-meta">Gerado em ${hoje} Â· ${list.length} registro(s)${total > 0 ? ` Â· Total: R$ ${total.toFixed(2).replace('.', ',')}` : ''}</div>
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
            <div class="info-row"><span class="info-row__label">Equipamento</span><span class="info-row__value">${Utils.escapeHtml(eq?.nome ?? 'â€”')}</span></div>
            <div class="info-row"><span class="info-row__label">TAG</span><span class="info-row__value info-row__value--mono">${Utils.escapeHtml(eq?.tag ?? 'â€”')}</span></div>
            <div class="info-row"><span class="info-row__label">Local</span><span class="info-row__value">${Utils.escapeHtml(eq?.local ?? 'â€”')}</span></div>
            <div class="info-row"><span class="info-row__label">Fluido</span><span class="info-row__value">${Utils.escapeHtml(eq?.fluido ?? 'â€”')}</span></div>
            <div class="info-row"><span class="info-row__label">Criticidade</span><span class="info-row__value">${Utils.escapeHtml(CRITICIDADE_LABEL[eq?.criticidade] || CRITICIDADE_LABEL.media)}</span></div>
            <div class="info-row"><span class="info-row__label">Prioridade operacional</span><span class="info-row__value">${Utils.escapeHtml(PRIORIDADE_OPERACIONAL_LABEL[eq?.prioridadeOperacional] || PRIORIDADE_OPERACIONAL_LABEL.normal)}</span></div>
            <div class="info-row"><span class="info-row__label">Rotina preventiva</span><span class="info-row__value">${Utils.escapeHtml(eq?.periodicidadePreventivaDias ? `${eq.periodicidadePreventivaDias} dias` : 'â€”')}</span></div>
            <div class="info-row"><span class="info-row__label">TÃ©cnico</span><span class="info-row__value">${Utils.escapeHtml(r.tecnico ?? 'â€”')}</span></div>
            ${r.pecas ? `<div class="info-row"><span class="info-row__label">PeÃ§as / Materiais</span><span class="info-row__value">${Utils.escapeHtml(r.pecas)}</span></div>` : ''}
            ${r.custoPecas > 0 ? `<div class="info-row"><span class="info-row__label">Custo de PeÃ§as</span><span class="info-row__value">R$ ${parseFloat(r.custoPecas).toFixed(2).replace('.', ',')}</span></div>` : ''}
            ${r.custoMaoObra > 0 ? `<div class="info-row"><span class="info-row__label">MÃ£o de Obra</span><span class="info-row__value">R$ ${parseFloat(r.custoMaoObra).toFixed(2).replace('.', ',')}</span></div>` : ''}
            ${custoTotal > 0 ? `<div class="info-row info-row--total"><span class="info-row__label info-row__label--strong">Total do ServiÃ§o</span><span class="info-row__value info-row__value--primary">R$ ${custoTotal.toFixed(2).replace('.', ',')}</span></div>` : ''}
            ${r.proxima ? `<div class="info-row"><span class="info-row__label">PrÃ³xima ManutenÃ§Ã£o</span><span class="info-row__value">${Utils.formatDate(r.proxima)}</span></div>` : ''}
            ${r.assinatura ? `<div class="info-row"><span class="info-row__label">Assinatura</span><span class="info-row__value info-row__value--success">âœ“ Assinado pelo cliente</span></div>` : ''}
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
