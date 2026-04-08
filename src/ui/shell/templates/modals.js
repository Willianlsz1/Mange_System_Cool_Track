export function renderShellModals() {
  return String.raw`
<!-- MODAL: Cadastrar Equipamento -->
  <div class="modal-overlay" id="modal-add-eq" role="dialog" aria-modal="true" aria-labelledby="modal-add-eq-title">
    <div class="modal">
      <div class="modal__handle"></div>

      <div class="modal__body modal__body--scroll">
        <div class="modal-progress-header">
          <div>
            <div class="modal__title" id="modal-add-eq-title">Qual equipamento vocÃª quer monitorar?</div>
            <div class="modal__subtitle">SÃ³ 2 campos obrigatÃ³rios para comeÃ§ar</div>
          </div>
          <div class="modal-steps" aria-label="Etapas">
            <span class="modal-step modal-step--active" id="step-dot-1">1</span>
            <span class="modal-step-line"></span>
            <span class="modal-step" id="step-dot-2">2</span>
          </div>
        </div>

        <div id="eq-step-1">
          <div class="form-group">
            <label class="form-label" for="eq-nome">Como vocÃª chama esse equipamento? *</label>
            <input id="eq-nome" class="form-control" type="text"
              placeholder="Ex: Split da recepÃ§Ã£o, CÃ¢mara do estoque..." required autocomplete="off" />
            <div class="form-hint">Use um nome que vocÃª reconheÃ§a rapidamente no campo</div>
          </div>
          <div class="form-group">
            <label class="form-label" for="eq-local">Onde ele fica? *</label>
            <input id="eq-local" class="form-control" type="text"
              placeholder="Ex: Sala dos fundos, GalpÃ£o A, 2Âº andar..." required autocomplete="off" />
          </div>
          <button class="eq-expand-btn" id="eq-expand-details" type="button" aria-expanded="false"
            aria-controls="eq-step-2">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" id="eq-expand-icon">
              <path d="M3 5l4 4 4-4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"
                stroke-linejoin="round" />
            </svg>
            Adicionar detalhes tÃ©cnicos
            <span class="eq-expand-hint">(TAG, fluido, modelo â€” opcional)</span>
          </button>
        </div>

        <div id="eq-step-2" class="eq-details-panel" aria-hidden="true">
          <div class="eq-details-divider">Detalhes tÃ©cnicos <span>(opcional â€” pode preencher depois)</span></div>
          <div class="form-group">
            <label class="form-label" for="eq-tag">TAG / CÃ³digo de identificaÃ§Ã£o</label>
            <input id="eq-tag" class="form-control form-control--mono" type="text" placeholder="Ex: AC-01, CF-FARM, VRF-A" />
            <div class="form-hint">CÃ³digo que vocÃª usa na etiqueta ou plaqueta do equipamento</div>
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
                <option>CÃ¢mara Fria</option>
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
          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="eq-criticidade">Criticidade do ativo</label>
              <select id="eq-criticidade" class="form-control">
                <option value="baixa">Baixa</option>
                <option value="media" selected>Media</option>
                <option value="alta">Alta</option>
                <option value="critica">Critica</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="eq-prioridade">Prioridade operacional</label>
              <select id="eq-prioridade" class="form-control">
                <option value="baixa">Baixa</option>
                <option value="normal" selected>Normal</option>
                <option value="alta">Alta</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="eq-periodicidade">Periodicidade preventiva (dias)</label>
            <input id="eq-periodicidade" class="form-control" type="number" min="15" max="365" step="5" value="90" />
            <div class="form-hint" id="eq-periodicidade-hint">Sugestao automatica conforme tipo e criticidade.</div>
          </div>
        </div>
      </div>

      <div class="btn-group modal__footer">
        <button class="btn btn--outline" data-action="close-modal" data-id="modal-add-eq">Cancelar</button>
        <button class="btn btn--primary" data-action="save-equip">Cadastrar equipamento â†’</button>
      </div>
      <p class="modal-trust-note modal-trust-note--footer">âœ“ VocÃª pode editar ou excluir a qualquer momento
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

  <!-- MODAL: ConfirmaÃ§Ã£o -->
  <div class="modal-overlay" id="modal-confirm" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title"
    aria-describedby="confirm-msg">
    <div class="modal modal--sm">
      <div class="modal__title" id="confirm-title">Confirmar AÃ§Ã£o</div>
      <div class="modal__text" id="confirm-msg">Tem certeza?</div>
      <div class="btn-group btn-group--tight">
        <button class="btn btn--outline" id="confirm-no">Cancelar</button>
        <button class="btn btn--danger" id="confirm-yes">Confirmar</button>
      </div>
    </div>
  </div>

  <!-- LIGHTBOX -->
  <div class="lightbox" id="lightbox" role="dialog" aria-modal="true" aria-label="Visualizar foto">
    <button class="lightbox__close" aria-label="Fechar">âœ•</button>
    <img class="lightbox__img" id="lightbox-img" src="" alt="Registro fotogrÃ¡fico" />
  </div>

  <button id="tour-help-btn" class="tour-help-btn" type="button" aria-label="Reiniciar tour guiado" title="Reiniciar tour">?</button>
`;
}
