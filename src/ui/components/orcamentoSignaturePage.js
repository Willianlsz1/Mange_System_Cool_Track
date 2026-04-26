/**
 * CoolTrack Pro - Página pública de assinatura de orçamento (Fase 2, abr/2026)
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Componente STANDALONE (sem auth, sem shell do app). Renderiza o orçamento
 * em modo leitura + canvas de assinatura touch + botão "Aprovar e assinar".
 *
 * Fluxo:
 *   1) Boot do app detecta `?orc-sign=TOKEN` na URL e chama OrcamentoSignaturePage.mount(token)
 *   2) Componente fetch do orçamento via RPC pública (sem auth)
 *   3) Renderiza tela cheia (substitui body inteiro) com leitura + assinatura
 *   4) Cliente desenha + digita nome + clica "Aprovar e assinar"
 *   5) RPC sign_orcamento_by_token grava → mostra confirmação de sucesso
 *
 * Importante: NÃO usa nenhum CSS do app principal. CSS inline pra
 * garantir que renderiza igual mesmo se a SPA não carregou.
 */

import { fetchOrcamentoByToken, signOrcamentoByToken } from '../../core/orcamentos.js';

const PAGE_ID = 'orc-signature-page';

function brl(n) {
  return Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

// CSS inline da pagina — garante que funciona mesmo se o resto da SPA
// nao carregou (ex: erro de rede no chunk principal). Usa system fonts +
// design tokens proprios pra não depender do CSS principal.
const PAGE_CSS = `
  #${PAGE_ID} {
    position: fixed; inset: 0;
    background: #f5f7fb;
    overflow-y: auto;
    z-index: 99999;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    color: #02131f;
    -webkit-font-smoothing: antialiased;
    line-height: 1.5;
  }
  #${PAGE_ID} * { box-sizing: border-box; }
  #${PAGE_ID} .osp-container {
    max-width: 720px; margin: 0 auto; padding: 16px;
  }
  #${PAGE_ID} .osp-brand {
    text-align: center; padding: 12px 0 16px;
    color: #02131f; font-weight: 700; font-size: 14px;
    letter-spacing: 0.02em;
  }
  #${PAGE_ID} .osp-brand-icon {
    display: inline-flex; align-items: center; justify-content: center;
    width: 28px; height: 28px; background: #ffd60a;
    border-radius: 8px; margin-right: 8px; vertical-align: middle;
  }
  #${PAGE_ID} .osp-brand-icon svg { display: block; }
  #${PAGE_ID} .osp-card {
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04);
    margin-bottom: 12px;
    overflow: hidden;
  }
  #${PAGE_ID} .osp-card-head {
    background: #02131f; color: #fff; padding: 16px 20px;
  }
  #${PAGE_ID} .osp-card-head .osp-numero {
    font-size: 11px; opacity: 0.7; letter-spacing: 0.05em; text-transform: uppercase;
  }
  #${PAGE_ID} .osp-card-head .osp-titulo {
    font-size: 18px; font-weight: 600; margin: 4px 0 0;
  }
  #${PAGE_ID} .osp-card-head .osp-tecnico {
    font-size: 13px; opacity: 0.85; margin-top: 6px;
  }
  #${PAGE_ID} .osp-section {
    padding: 16px 20px; border-bottom: 1px solid #eef1f5;
  }
  #${PAGE_ID} .osp-section:last-child { border-bottom: none; }
  #${PAGE_ID} .osp-section-label {
    font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;
    color: #647585; margin-bottom: 6px; font-weight: 600;
  }
  #${PAGE_ID} .osp-cliente { font-size: 14px; color: #02131f; }
  #${PAGE_ID} .osp-cliente strong { display: block; font-size: 16px; margin-bottom: 4px; }
  #${PAGE_ID} .osp-cliente .osp-cliente-meta { color: #647585; font-size: 13px; }
  #${PAGE_ID} .osp-itens {
    width: 100%; border-collapse: collapse;
  }
  #${PAGE_ID} .osp-itens th {
    text-align: left; font-size: 11px; color: #647585;
    text-transform: uppercase; letter-spacing: 0.04em;
    padding: 6px 4px; border-bottom: 1px solid #eef1f5;
    font-weight: 600;
  }
  #${PAGE_ID} .osp-itens th:nth-child(2),
  #${PAGE_ID} .osp-itens th:nth-child(3),
  #${PAGE_ID} .osp-itens th:nth-child(4) { text-align: right; }
  #${PAGE_ID} .osp-itens td {
    padding: 8px 4px; border-bottom: 1px solid #f5f7fb;
    font-size: 14px; color: #02131f; vertical-align: top;
  }
  #${PAGE_ID} .osp-itens td:nth-child(2),
  #${PAGE_ID} .osp-itens td:nth-child(3),
  #${PAGE_ID} .osp-itens td:nth-child(4) {
    text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums;
  }
  #${PAGE_ID} .osp-totals {
    background: #f5f7fb; padding: 14px 20px;
  }
  #${PAGE_ID} .osp-total-row {
    display: flex; justify-content: space-between; padding: 4px 0;
    font-size: 14px; color: #647585;
  }
  #${PAGE_ID} .osp-total-row.osp-total-row--final {
    border-top: 1px solid #d8dfe6; margin-top: 6px; padding-top: 10px;
    font-weight: 700; color: #02131f; font-size: 18px;
  }
  #${PAGE_ID} .osp-validade {
    text-align: center; padding: 12px;
    color: #647585; font-size: 13px;
  }
  #${PAGE_ID} .osp-canvas-wrap {
    border: 2px dashed #c8d3df; border-radius: 8px;
    background: #fff; touch-action: none;
    aspect-ratio: 16/9;
    position: relative;
    margin-bottom: 8px;
  }
  #${PAGE_ID} .osp-canvas {
    display: block; width: 100%; height: 100%;
    cursor: crosshair;
    border-radius: 6px;
  }
  #${PAGE_ID} .osp-canvas-hint {
    position: absolute; inset: 0;
    display: flex; align-items: center; justify-content: center;
    color: #99a8b7; font-size: 13px;
    pointer-events: none; user-select: none;
  }
  #${PAGE_ID} .osp-canvas-actions {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 12px;
  }
  #${PAGE_ID} .osp-clear {
    background: none; border: none; color: #647585; font-size: 13px;
    cursor: pointer; padding: 4px 8px;
  }
  #${PAGE_ID} .osp-clear:hover { color: #02131f; text-decoration: underline; }
  #${PAGE_ID} .osp-input {
    display: block; width: 100%;
    padding: 12px 14px; font-size: 16px;
    border: 1px solid #c8d3df; border-radius: 8px;
    background: #fff; color: #02131f;
    margin-bottom: 16px;
    font-family: inherit;
    -webkit-appearance: none;
  }
  #${PAGE_ID} .osp-input:focus { outline: 2px solid #00a8e8; outline-offset: 1px; border-color: #00a8e8; }
  #${PAGE_ID} .osp-label {
    display: block; font-size: 13px; color: #02131f;
    font-weight: 600; margin-bottom: 6px;
  }
  #${PAGE_ID} .osp-btn {
    display: block; width: 100%;
    background: #00a8e8; color: #fff;
    border: none; border-radius: 8px;
    padding: 16px;
    font-size: 16px; font-weight: 700;
    cursor: pointer;
    -webkit-appearance: none;
    box-shadow: 0 2px 8px rgba(0,168,232,0.25);
    transition: background .15s ease;
    font-family: inherit;
  }
  #${PAGE_ID} .osp-btn:hover { background: #008cc7; }
  #${PAGE_ID} .osp-btn:disabled {
    background: #c8d3df; box-shadow: none; cursor: not-allowed;
  }
  #${PAGE_ID} .osp-disclaimer {
    margin-top: 12px; font-size: 12px; color: #647585; line-height: 1.4;
    text-align: center;
  }
  #${PAGE_ID} .osp-error {
    background: #fee; color: #b00020; padding: 16px;
    border-radius: 8px; margin: 16px 0; text-align: center;
    font-size: 14px;
  }
  #${PAGE_ID} .osp-loading {
    text-align: center; padding: 60px 20px; color: #647585;
  }
  #${PAGE_ID} .osp-success {
    background: #fff; border-radius: 12px; padding: 32px 20px;
    text-align: center;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04);
  }
  #${PAGE_ID} .osp-success-icon {
    width: 64px; height: 64px; border-radius: 50%;
    background: #00c870; color: #fff;
    display: inline-flex; align-items: center; justify-content: center;
    margin-bottom: 16px;
  }
  #${PAGE_ID} .osp-success h2 { margin: 0 0 8px; font-size: 20px; color: #02131f; }
  #${PAGE_ID} .osp-success p { margin: 4px 0; color: #647585; font-size: 14px; }
  #${PAGE_ID} .osp-success-meta {
    margin-top: 16px; padding-top: 16px;
    border-top: 1px solid #eef1f5;
    font-size: 13px; color: #647585;
  }
`;

function brandHeader() {
  return `
    <div class="osp-brand">
      <span class="osp-brand-icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <g stroke="#02131f" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="3" x2="12" y2="21"/>
            <polyline points="9.5,5 12,3 14.5,5"/>
            <polyline points="9.5,19 12,21 14.5,19"/>
            <g transform="rotate(60 12 12)">
              <line x1="12" y1="3" x2="12" y2="21"/>
              <polyline points="9.5,5 12,3 14.5,5"/>
              <polyline points="9.5,19 12,21 14.5,19"/>
            </g>
            <g transform="rotate(120 12 12)">
              <line x1="12" y1="3" x2="12" y2="21"/>
              <polyline points="9.5,5 12,3 14.5,5"/>
              <polyline points="9.5,19 12,21 14.5,19"/>
            </g>
          </g>
        </svg>
      </span>
      CoolTrack Pro
    </div>`;
}

function renderLoading() {
  return `
    <div class="osp-container">
      ${brandHeader()}
      <div class="osp-card">
        <div class="osp-loading">Carregando orçamento...</div>
      </div>
    </div>`;
}

function renderError(message) {
  return `
    <div class="osp-container">
      ${brandHeader()}
      <div class="osp-error">
        ${escapeHtml(message)}
      </div>
    </div>`;
}

function renderAlreadySigned(orc) {
  return `
    <div class="osp-container">
      ${brandHeader()}
      <div class="osp-success">
        <div class="osp-success-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <h2>Orçamento já aprovado</h2>
        <p>Este orçamento foi assinado em ${formatDate(orc.assinado_em)}.</p>
        <div class="osp-success-meta">
          Assinado por <strong>${escapeHtml(orc.assinado_nome || '')}</strong>
        </div>
      </div>
    </div>`;
}

function renderSignaturePage(orc) {
  const itens = Array.isArray(orc.itens) ? orc.itens : [];
  const tecnico = orc.tecnico || {};

  return `
    <div class="osp-container">
      ${brandHeader()}

      <div class="osp-card">
        <div class="osp-card-head">
          <div class="osp-numero">Orçamento ${escapeHtml(orc.numero)}</div>
          <div class="osp-titulo">${escapeHtml(orc.titulo)}</div>
          ${
            tecnico.nome
              ? `
            <div class="osp-tecnico">
              ${escapeHtml(tecnico.nome)}${tecnico.empresa ? ` · ${escapeHtml(tecnico.empresa)}` : ''}
              ${tecnico.telefone ? ` · ${escapeHtml(tecnico.telefone)}` : ''}
            </div>`
              : ''
          }
        </div>

        <div class="osp-section">
          <div class="osp-section-label">Cliente</div>
          <div class="osp-cliente">
            <strong>${escapeHtml(orc.cliente_nome)}</strong>
            ${orc.cliente_endereco ? `<div class="osp-cliente-meta">${escapeHtml(orc.cliente_endereco)}</div>` : ''}
          </div>
        </div>

        ${
          orc.descricao
            ? `
        <div class="osp-section">
          <div class="osp-section-label">Descrição do serviço</div>
          <div style="font-size:14px;color:#02131f;white-space:pre-wrap;">${escapeHtml(orc.descricao)}</div>
        </div>`
            : ''
        }

        <div class="osp-section">
          <div class="osp-section-label">Itens</div>
          <table class="osp-itens">
            <thead>
              <tr>
                <th>Descrição</th>
                <th>Qtd</th>
                <th>Unit.</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${itens
                .map(
                  (it) => `
                <tr>
                  <td>${escapeHtml(it.descricao || '')}</td>
                  <td>${escapeHtml(String(it.qty || 0))}</td>
                  <td>${brl(it.valorUnitario || it.valor_unitario || 0)}</td>
                  <td>${brl((it.qty || 0) * (it.valorUnitario || it.valor_unitario || 0))}</td>
                </tr>`,
                )
                .join('')}
            </tbody>
          </table>
        </div>

        <div class="osp-totals">
          <div class="osp-total-row">
            <span>Subtotal</span><span>${brl(orc.subtotal)}</span>
          </div>
          ${
            Number(orc.desconto || 0) > 0
              ? `
          <div class="osp-total-row">
            <span>Desconto</span><span>− ${brl(orc.desconto)}</span>
          </div>`
              : ''
          }
          <div class="osp-total-row osp-total-row--final">
            <span>Total</span><span>${brl(orc.total)}</span>
          </div>
        </div>

        ${
          orc.forma_pagamento || orc.observacoes
            ? `
        <div class="osp-section">
          ${
            orc.forma_pagamento
              ? `
            <div class="osp-section-label">Forma de pagamento</div>
            <div style="font-size:14px;margin-bottom:8px;">${escapeHtml(orc.forma_pagamento)}</div>`
              : ''
          }
          ${
            orc.observacoes
              ? `
            <div class="osp-section-label">Observações</div>
            <div style="font-size:14px;white-space:pre-wrap;">${escapeHtml(orc.observacoes)}</div>`
              : ''
          }
        </div>`
            : ''
        }

        <div class="osp-validade">
          Validade: ${orc.validade_dias} dias
        </div>
      </div>

      <div class="osp-card">
        <div class="osp-section">
          <div class="osp-section-label">Sua assinatura digital</div>
          <p style="font-size:13px;color:#647585;margin:0 0 12px;">
            Desenhe sua assinatura abaixo com o dedo (ou mouse) e digite seu nome completo para aprovar este orçamento.
          </p>

          <div class="osp-canvas-wrap">
            <canvas class="osp-canvas" id="osp-canvas"></canvas>
            <div class="osp-canvas-hint" id="osp-canvas-hint">Assine aqui</div>
          </div>

          <div class="osp-canvas-actions">
            <button type="button" class="osp-clear" id="osp-clear">Limpar assinatura</button>
          </div>

          <label class="osp-label" for="osp-nome">Seu nome completo</label>
          <input type="text" class="osp-input" id="osp-nome" maxlength="120"
            placeholder="Ex: Maria Silva" autocomplete="name" />

          <button type="button" class="osp-btn" id="osp-submit">
            Aprovar e assinar
          </button>

          <div class="osp-disclaimer">
            Ao clicar em "Aprovar e assinar", você concorda com este orçamento
            e autoriza a execução do serviço descrito acima. Esta assinatura
            tem validade legal nos termos da MP 2.200-2/2001.
          </div>
        </div>
      </div>
    </div>`;
}

function renderSuccess(result) {
  return `
    <div class="osp-container">
      ${brandHeader()}
      <div class="osp-success">
        <div class="osp-success-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <h2>Orçamento aprovado!</h2>
        <p>Sua assinatura foi registrada com sucesso.</p>
        <p>O técnico será notificado e entrará em contato para agendar o serviço.</p>
        <div class="osp-success-meta">
          Assinado por <strong>${escapeHtml(result.assinado_nome || '')}</strong><br>
          em ${formatDate(result.assinado_em)}
        </div>
      </div>
    </div>`;
}

// ─── Canvas signature pad ─────────────────────────────────────────────────
//
// Implementação minimal: captura pointer events (cobre mouse + touch +
// pen num único listener), guarda traços, redesenha em resize (DPR-aware).
function setupSignaturePad(canvas, hintEl) {
  let drawing = false;
  let hasInk = false;
  let lastX = 0;
  let lastY = 0;
  const ctx = canvas.getContext('2d');

  function resize() {
    // Match canvas internal pixels to display size (Retina-friendly)
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = '#02131f';
  }

  resize();
  window.addEventListener('resize', resize);

  function getPos(evt) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: evt.clientX - rect.left,
      y: evt.clientY - rect.top,
    };
  }

  function start(evt) {
    evt.preventDefault();
    drawing = true;
    const p = getPos(evt);
    lastX = p.x;
    lastY = p.y;
    if (!hasInk) {
      hasInk = true;
      hintEl.style.display = 'none';
    }
  }

  function move(evt) {
    if (!drawing) return;
    evt.preventDefault();
    const p = getPos(evt);
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastX = p.x;
    lastY = p.y;
  }

  function end(evt) {
    if (!drawing) return;
    if (evt) evt.preventDefault();
    drawing = false;
  }

  canvas.addEventListener('pointerdown', start);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('pointerleave', end);

  return {
    isEmpty: () => !hasInk,
    clear: () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      hasInk = false;
      hintEl.style.display = '';
    },
    toDataURL: () => canvas.toDataURL('image/png'),
  };
}

function bindSignatureEvents(token) {
  const canvas = document.getElementById('osp-canvas');
  const hint = document.getElementById('osp-canvas-hint');
  const clearBtn = document.getElementById('osp-clear');
  const nomeInput = document.getElementById('osp-nome');
  const submitBtn = document.getElementById('osp-submit');

  if (!canvas || !nomeInput || !submitBtn) return;

  const pad = setupSignaturePad(canvas, hint);

  clearBtn?.addEventListener('click', () => pad.clear());

  submitBtn.addEventListener('click', async () => {
    if (pad.isEmpty()) {
      alert('Por favor, assine no campo acima.');
      return;
    }
    const nome = nomeInput.value.trim();
    if (nome.length < 2) {
      alert('Por favor, digite seu nome completo.');
      nomeInput.focus();
      return;
    }

    const dataUrl = pad.toDataURL();
    submitBtn.disabled = true;
    submitBtn.textContent = 'Enviando...';

    try {
      const result = await signOrcamentoByToken(token, dataUrl, nome);
      const root = document.getElementById(PAGE_ID);
      if (root) root.innerHTML = renderSuccess(result);
    } catch (error) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Aprovar e assinar';
      alert(error?.message || 'Não foi possível registrar a assinatura.');
    }
  });
}

export const OrcamentoSignaturePage = {
  /**
   * Monta a pagina de assinatura. Substitui o conteudo inteiro do body
   * pra garantir isolamento total da SPA (sem header, sem sidebar, etc).
   */
  async mount(token) {
    // Injeta CSS isolado
    if (!document.getElementById(`${PAGE_ID}-css`)) {
      const style = document.createElement('style');
      style.id = `${PAGE_ID}-css`;
      style.textContent = PAGE_CSS;
      document.head.appendChild(style);
    }

    // Substitui o body inteiro
    document.body.innerHTML = `<div id="${PAGE_ID}">${renderLoading()}</div>`;
    const root = document.getElementById(PAGE_ID);

    try {
      const orc = await fetchOrcamentoByToken(token);

      // Ja assinado? Mostra confirmação retroativa
      if (orc.assinado_em) {
        root.innerHTML = renderAlreadySigned(orc);
        return;
      }

      root.innerHTML = renderSignaturePage(orc);
      bindSignatureEvents(token);
    } catch (error) {
      root.innerHTML = renderError(error?.message || 'Não foi possível carregar este orçamento.');
    }
  },
};
