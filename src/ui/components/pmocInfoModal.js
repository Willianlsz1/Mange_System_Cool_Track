/**
 * CoolTrack Pro - PMOC Info Modal (Fase 6, abr/2026)
 *
 * Documentação inline pro user — explica o que é PMOC, base legal,
 * quando usar, e diferença entre os 2 PDFs (técnico rápido vs. formal).
 *
 * Não tem ações destrutivas; só leitura. Dispensável a qualquer momento
 * via Esc, X, click fora ou botão "Entendi".
 */

import { attachDialogA11y } from '../../core/modal.js';
import { goTo } from '../../core/router.js';

const OVERLAY_ID = 'pmoc-info-modal-overlay';
let _a11yCleanup = null;

function buildHtml() {
  return `
    <div class="modal pmoc-info-modal">
      <header class="pmoc-info-modal__head">
        <div class="pmoc-info-modal__head-icon" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="9" y1="13" x2="15" y2="13"/>
            <line x1="9" y1="17" x2="15" y2="17"/>
          </svg>
        </div>
        <div class="pmoc-info-modal__head-text">
          <h2 class="pmoc-info-modal__title" id="pmoc-info-modal-title">
            Sobre o PMOC
          </h2>
          <p class="pmoc-info-modal__sub">
            Lei Federal 13.589/2018 · ABNT NBR 13971
          </p>
        </div>
        <button type="button" class="pmoc-info-modal__close" id="pmoc-info-close" aria-label="Fechar">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </header>

      <div class="pmoc-info-modal__body">
        <!-- TL;DR — resposta direta antes de qualquer detalhe -->
        <div class="pmoc-info-modal__tldr">
          <span class="pmoc-info-modal__tldr-icon" aria-hidden="true">📌</span>
          <p>
            O <strong>PMOC</strong> é o documento técnico obrigatório pra
            estabelecimentos com climatização em ambientes coletivos
            (escritórios, escolas, hospitais, shoppings).
            Garante a qualidade do ar conforme a legislação federal.
          </p>
        </div>

        <!-- Base legal em 3 chips -->
        <section class="pmoc-info-modal__section">
          <h3>Base legal</h3>
          <div class="pmoc-info-modal__law-grid">
            <div class="pmoc-info-modal__law-card">
              <div class="pmoc-info-modal__law-badge">Lei</div>
              <strong>13.589/2018</strong>
              <span>Torna o PMOC obrigatório pra sistemas ≥ 60.000 BTU/h ou ambiente coletivo.</span>
            </div>
            <div class="pmoc-info-modal__law-card">
              <div class="pmoc-info-modal__law-badge">Portaria</div>
              <strong>GM/MS 3.523/1998</strong>
              <span>Define critérios e parâmetros de qualidade do ar interior.</span>
            </div>
            <div class="pmoc-info-modal__law-card">
              <div class="pmoc-info-modal__law-badge">Norma</div>
              <strong>NBR 13971/2014</strong>
              <span>Procedimentos de manutenção preventiva, corretiva e limpeza.</span>
            </div>
          </div>
        </section>

        <!-- Comparação dos 2 PDFs em cards lado a lado -->
        <section class="pmoc-info-modal__section">
          <h3>Os 2 tipos de PDF do CoolTrack</h3>
          <div class="pmoc-info-modal__compare">
            <article class="pmoc-info-modal__compare-col">
              <header class="pmoc-info-modal__compare-head">
                <div class="pmoc-info-modal__compare-icon" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                  </svg>
                </div>
                <div>
                  <strong>Relatório técnico</strong>
                  <span class="pmoc-info-modal__compare-tier">Todos os planos</span>
                </div>
              </header>
              <ul>
                <li>Geração rápida (PDF em segundos)</li>
                <li>Capa moderna com toolbar de status</li>
                <li>Assinatura digital, fotos e checklist NBR</li>
                <li>Envio direto pelo WhatsApp</li>
              </ul>
              <div class="pmoc-info-modal__compare-use">
                <span aria-hidden="true">💡</span>
                Ideal pra <strong>envio ao cliente após cada visita</strong>
              </div>
            </article>

            <article class="pmoc-info-modal__compare-col pmoc-info-modal__compare-col--pro">
              <header class="pmoc-info-modal__compare-head">
                <div class="pmoc-info-modal__compare-icon pmoc-info-modal__compare-icon--pro" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                    <line x1="12" y1="22.08" x2="12" y2="12"/>
                  </svg>
                </div>
                <div>
                  <strong>PMOC formal <span class="pro-badge pro-badge--inline">PRO</span></strong>
                  <span class="pmoc-info-modal__compare-tier">Exclusivo Pro</span>
                </div>
              </header>
              <ul>
                <li>Documento anual numerado (PMOC YYYY/NN)</li>
                <li>Capa institucional + 6 seções formais</li>
                <li>Cadastro técnico + cronograma 12 meses</li>
                <li>Termo de RT + assinaturas (RT + cliente)</li>
              </ul>
              <div class="pmoc-info-modal__compare-use">
                <span aria-hidden="true">⚖️</span>
                Ideal pra <strong>conformidade legal e auditoria</strong>
              </div>
            </article>
          </div>
        </section>

        <!-- Quando usar cada um -->
        <section class="pmoc-info-modal__section">
          <h3>Quando usar cada um?</h3>
          <div class="pmoc-info-modal__when">
            <div class="pmoc-info-modal__when-row">
              <span class="pmoc-info-modal__when-trigger">Visita rotineira</span>
              <span class="pmoc-info-modal__when-arrow" aria-hidden="true">→</span>
              <span class="pmoc-info-modal__when-action">Relatório técnico rápido (WhatsApp, fecha o ciclo)</span>
            </div>
            <div class="pmoc-info-modal__when-row">
              <span class="pmoc-info-modal__when-trigger">Fim do ano / contrato anual</span>
              <span class="pmoc-info-modal__when-arrow" aria-hidden="true">→</span>
              <span class="pmoc-info-modal__when-action">PMOC formal por cliente (documento oficial)</span>
            </div>
          </div>
        </section>
      </div>

      <footer class="pmoc-info-modal__actions">
        <button type="button" class="btn btn--ghost pmoc-info-modal__btn" id="pmoc-info-ok">
          Entendi
        </button>
        <button type="button" class="btn btn--primary pmoc-info-modal__btn pmoc-info-modal__btn--upgrade"
          id="pmoc-info-upgrade" data-action="open-upgrade"
          data-upgrade-source="pmoc_info_modal" data-highlight-plan="pro">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M3 7l4 4 5-7 5 7 4-4-2 12H5L3 7z"/>
          </svg>
          Ver planos Pro
        </button>
      </footer>
    </div>
  `;
}

function open() {
  document.getElementById(OVERLAY_ID)?.remove();

  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.className = 'modal-overlay is-open pmoc-info-modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'pmoc-info-modal-title');
  overlay.innerHTML = buildHtml();
  document.body.appendChild(overlay);

  const hardClose = () => {
    if (typeof _a11yCleanup === 'function') {
      _a11yCleanup();
      _a11yCleanup = null;
    }
    overlay.remove();
  };

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) hardClose();
  });
  overlay.querySelector('#pmoc-info-close')?.addEventListener('click', hardClose);
  overlay.querySelector('#pmoc-info-ok')?.addEventListener('click', hardClose);
  overlay.querySelector('#pmoc-info-upgrade')?.addEventListener('click', () => {
    hardClose();
    goTo('pricing', { highlightPlan: 'pro' });
  });

  _a11yCleanup = attachDialogA11y(overlay, { onDismiss: hardClose });
}

export const PmocInfoModal = { open };
