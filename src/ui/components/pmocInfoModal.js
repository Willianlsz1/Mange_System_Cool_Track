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
        <div class="pmoc-info-modal__head-text">
          <h2 class="pmoc-info-modal__title" id="pmoc-info-modal-title">
            Sobre o PMOC
          </h2>
          <p class="pmoc-info-modal__sub">
            Plano de Manutenção, Operação e Controle conforme a Lei Federal 13.589/2018
            e a norma ABNT NBR 13971.
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
        <section class="pmoc-info-modal__section">
          <h3>O que é o PMOC?</h3>
          <p>
            O PMOC (Plano de Manutenção, Operação e Controle) é o documento técnico
            obrigatório pra estabelecimentos que usam climatização artificial em
            ambientes coletivos (escritórios, escolas, hospitais, shopping etc).
            Garante a qualidade do ar interior conforme a legislação federal.
          </p>
        </section>

        <section class="pmoc-info-modal__section">
          <h3>Base legal</h3>
          <ul>
            <li><strong>Lei 13.589/2018</strong> — torna obrigatório o PMOC pra todos sistemas com capacidade ≥ 60.000 BTU/h ou que atendem ambiente coletivo.</li>
            <li><strong>Portaria GM/MS 3.523/1998</strong> — define critérios e parâmetros de qualidade do ar interior.</li>
            <li><strong>ABNT NBR 13971/2014</strong> — especifica procedimentos de manutenção preventiva, corretiva e limpeza.</li>
          </ul>
        </section>

        <section class="pmoc-info-modal__section">
          <h3>Os 2 tipos de PDF do CoolTrack</h3>
          <div class="pmoc-info-modal__compare">
            <div class="pmoc-info-modal__compare-col">
              <div class="pmoc-info-modal__compare-tag">Relatório técnico</div>
              <ul>
                <li>Geração rápida</li>
                <li>Capa cyan + serviços do filtro</li>
                <li>Inclui assinatura digital, fotos e checklist NBR (se preenchido)</li>
                <li>Ideal pra <strong>envio ao cliente após cada visita</strong></li>
                <li>Disponível em todos os planos</li>
              </ul>
            </div>
            <div class="pmoc-info-modal__compare-col pmoc-info-modal__compare-col--pro">
              <div class="pmoc-info-modal__compare-tag">PMOC formal <span class="pro-badge pro-badge--inline">PRO</span></div>
              <ul>
                <li>Documento anual numerado (PMOC YYYY/NN)</li>
                <li>Capa institucional formal monocromática (preto/cinza)</li>
                <li>Cadastro técnico de equipamentos + cronograma 12 meses + termo de RT</li>
                <li>Ideal pra <strong>conformidade legal e auditoria</strong></li>
                <li>Exclusivo do plano Pro</li>
              </ul>
            </div>
          </div>
        </section>

        <section class="pmoc-info-modal__section">
          <h3>Quando usar cada um?</h3>
          <p>
            <strong>Visita rotineira</strong> → relatório técnico rápido (envia no
            WhatsApp, fecha o ciclo).
            <br/>
            <strong>Final do ano / início do contrato anual</strong> → PMOC formal
            por cliente (entrega como documento oficial).
          </p>
        </section>

        <div class="pmoc-info-modal__actions">
          <button type="button" class="btn btn--outline pmoc-info-modal__btn" id="pmoc-info-ok">
            Entendi
          </button>
          <button type="button" class="btn btn--primary pmoc-info-modal__btn"
            id="pmoc-info-upgrade" data-action="open-upgrade"
            data-upgrade-source="pmoc_info_modal" data-highlight-plan="pro">
            Ver planos Pro
          </button>
        </div>
      </div>
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
