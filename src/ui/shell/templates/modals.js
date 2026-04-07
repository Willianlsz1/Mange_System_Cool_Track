export function renderShellModals() {
  return String.raw`
<!-- MODAL: Cadastrar Equipamento -->
  <div class="modal-overlay" id="modal-add-eq" role="dialog" aria-modal="true" aria-labelledby="modal-add-eq-title">
    <div class="modal">
      <div class="modal__handle"></div>

      <div style="flex:1;overflow-y:auto;padding:24px 24px 8px">
        <div class="modal-progress-header">
          <div>
            <div class="modal__title" id="modal-add-eq-title">Qual equipamento você quer monitorar?</div>
            <div class="modal__subtitle">Só 2 campos obrigatórios para começar</div>
          </div>
          <div class="modal-steps" aria-label="Etapas">
            <span class="modal-step modal-step--active" id="step-dot-1">1</span>
            <span class="modal-step-line"></span>
            <span class="modal-step" id="step-dot-2">2</span>
          </div>
        </div>

        <div id="eq-step-1">
          <div class="form-group">
            <label class="form-label" for="eq-nome">Como você chama esse equipamento? *</label>
            <input id="eq-nome" class="form-control" type="text"
              placeholder="Ex: Split da recepção, Câmara do estoque..." required autocomplete="off" />
            <div class="form-hint">Use um nome que você reconheça rapidamente no campo</div>
          </div>
          <div class="form-group">
            <label class="form-label" for="eq-local">Onde ele fica? *</label>
            <input id="eq-local" class="form-control" type="text"
              placeholder="Ex: Sala dos fundos, Galpão A, 2º andar..." required autocomplete="off" />
          </div>
          <button class="eq-expand-btn" id="eq-expand-details" type="button" aria-expanded="false"
            aria-controls="eq-step-2">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" id="eq-expand-icon">
              <path d="M3 5l4 4 4-4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"
                stroke-linejoin="round" />
            </svg>
            Adicionar detalhes técnicos
            <span class="eq-expand-hint">(TAG, fluido, modelo — opcional)</span>
          </button>
        </div>

        <div id="eq-step-2" class="eq-details-panel" aria-hidden="true">
          <div class="eq-details-divider">Detalhes técnicos <span>(opcional — pode preencher depois)</span></div>
          <div class="form-group">
            <label class="form-label" for="eq-tag">TAG / Código de identificação</label>
            <input id="eq-tag" class="form-control" type="text" placeholder="Ex: AC-01, CF-FARM, VRF-A"
              style="font-family:var(--font-mono);letter-spacing:0.05em" />
            <div class="form-hint">Código que você usa na etiqueta ou plaqueta do equipamento</div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="eq-tipo">Tipo de equipamento</label>
              <select id="eq-tipo" class="form-control">
                <option>Split Hi-Wall</option>
                <option>Split Cassette</option>
                <option>Split Piso Teto</option>
                <option>VRF / VRV</option>
                <option>Chiller</option>
                <option>Fan Coil</option>
                <option>Self Contained</option>
                <option>Roof Top</option>
                <option>Câmara Fria</option>
                <option>Outro</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="eq-fluido">Fluido refrigerante</label>
              <select id="eq-fluido" class="form-control">
                <option>R-410A</option>
                <option>R-22</option>
                <option>R-32</option>
                <option>R-407C</option>
                <option>R-134A</option>
                <option>R-404A</option>
                <option>Outro</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="eq-modelo">Marca / Modelo</label>
            <input id="eq-modelo" class="form-control" type="text"
              placeholder="Ex: Carrier 18.000 BTU, York 30 TR..." />
          </div>
        </div>
      </div>

      <div class="btn-group" style="padding:16px 24px;border-top:1px solid var(--border);flex-shrink:0;margin-top:0">
        <button class="btn btn--outline" data-action="close-modal" data-id="modal-add-eq">Cancelar</button>
        <button class="btn btn--primary" data-action="save-equip">Cadastrar equipamento →</button>
      </div>
      <p class="modal-trust-note" style="padding:0 24px 16px;margin:0">✓ Você pode editar ou excluir a qualquer momento
      </p>
    </div>
  </div>

  <!-- MODAL: Detalhes do Equipamento -->
  <div class="modal-overlay" id="modal-eq-det" role="dialog" aria-modal="true" aria-labelledby="eq-det-title">
    <div class="modal">
      <div class="modal__handle"></div>
      <div id="eq-det-corpo"></div>
    </div>
  </div>

  <!-- MODAL: Confirmação -->
  <div class="modal-overlay" id="modal-confirm" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title"
    aria-describedby="confirm-msg">
    <div class="modal modal--sm">
      <div class="modal__title" id="confirm-title">Confirmar Ação</div>
      <div class="modal__text" id="confirm-msg">Tem certeza?</div>
      <div class="btn-group" style="margin-top:20px">
        <button class="btn btn--outline" id="confirm-no">Cancelar</button>
        <button class="btn btn--danger" id="confirm-yes">Confirmar</button>
      </div>
    </div>
  </div>

  <!-- LIGHTBOX -->
  <div class="lightbox" id="lightbox" role="dialog" aria-modal="true" aria-label="Visualizar foto">
    <button class="lightbox__close" aria-label="Fechar">✕</button>
    <img class="lightbox__img" id="lightbox-img" src="" alt="Registro fotográfico" />
  </div>

  <button id="tour-help-btn" class="tour-help-btn" type="button" aria-label="Reiniciar tour guiado" title="Reiniciar tour">?</button>
`;
}
