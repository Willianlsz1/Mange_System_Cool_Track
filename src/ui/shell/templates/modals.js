export function renderShellModals() {
  return String.raw`
<!-- MODAL: Cadastrar Equipamento -->
  <div class="modal-overlay" id="modal-add-eq" role="dialog" aria-modal="true" aria-labelledby="modal-add-eq-title">
    <div class="modal">
      <div class="modal__handle"></div>

      <div class="modal__body modal__body--scroll">
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
          <div class="form-group" id="eq-setor-wrapper" style="display:none">
            <label class="form-label" for="eq-setor">Setor <span class="pro-badge">PRO</span></label>
            <select id="eq-setor" class="form-control">
              <option value="">Sem setor</option>
            </select>
            <div class="form-hint">Agrupe este equipamento em um setor para visualização organizada</div>
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
            <input id="eq-tag" class="form-control form-control--mono" type="text" placeholder="Ex: AC-01, CF-FARM, VRF-A" />
            <div class="form-hint">Código que você usa na etiqueta ou plaqueta do equipamento</div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="eq-tipo">Tipo de equipamento</label>
              <select id="eq-tipo" class="form-control">
                <optgroup label="Climatização">
                  <option>Split Hi-Wall</option>
                  <option>Split Cassette</option>
                  <option>Split Piso Teto</option>
                  <option>VRF / VRV</option>
                  <option>GHP</option>
                  <option>Fan Coil</option>
                  <option>Chiller</option>
                  <option>Self Contained</option>
                  <option>Roof Top</option>
                </optgroup>
                <optgroup label="Refrigeração">
                  <option>Câmara Fria</option>
                  <option>Balcão Frigorífico</option>
                  <option>Freezer</option>
                  <option>Geladeira</option>
                  <option>Bebedouro</option>
                </optgroup>
                <optgroup label="Geral">
                  <option>Outro</option>
                </optgroup>
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
        <button class="btn btn--primary" data-action="save-equip">Cadastrar equipamento &rarr;</button>
      </div>
      <p class="modal-trust-note modal-trust-note--footer">&#10003; Você pode editar ou excluir a qualquer momento
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
      <div class="btn-group btn-group--tight">
        <button class="btn btn--outline" id="confirm-no">Cancelar</button>
        <button class="btn btn--danger" id="confirm-yes">Confirmar</button>
      </div>
    </div>
  </div>

  <!-- MODAL: Criar / Editar Setor (PRO) -->
  <div class="modal-overlay" id="modal-add-setor" role="dialog" aria-modal="true" aria-labelledby="modal-add-setor-title">
    <div class="modal modal--sm">
      <div class="modal__handle"></div>
      <div class="modal__body">
        <div class="modal__title" id="modal-add-setor-title">Novo setor</div>
        <div class="modal__subtitle">Agrupe equipamentos por local ou área de trabalho</div>
        <div class="form-group" style="margin-top:16px">
          <label class="form-label" for="setor-nome">Nome do setor *</label>
          <input id="setor-nome" class="form-control" type="text"
            placeholder="Ex: Bloco Cirúrgico, UTI, Recepção, Galpão A..." autocomplete="off" />
        </div>
        <div class="form-group">
          <label class="form-label">Cor do setor</label>
          <div class="setor-color-picker" id="setor-color-picker" role="group" aria-label="Escolha a cor do setor">
            <button type="button" class="setor-color-btn setor-color-btn--selected" data-cor="#00bcd4" style="background:#00bcd4" aria-label="Ciano" aria-pressed="true"></button>
            <button type="button" class="setor-color-btn" data-cor="#00c853" style="background:#00c853" aria-label="Verde" aria-pressed="false"></button>
            <button type="button" class="setor-color-btn" data-cor="#ffab40" style="background:#ffab40" aria-label="Âmbar" aria-pressed="false"></button>
            <button type="button" class="setor-color-btn" data-cor="#ff5252" style="background:#ff5252" aria-label="Vermelho" aria-pressed="false"></button>
            <button type="button" class="setor-color-btn" data-cor="#7c4dff" style="background:#7c4dff" aria-label="Roxo" aria-pressed="false"></button>
            <button type="button" class="setor-color-btn" data-cor="#448aff" style="background:#448aff" aria-label="Azul" aria-pressed="false"></button>
          </div>
          <input type="hidden" id="setor-cor" value="#00bcd4" />
        </div>
      </div>
      <div class="btn-group modal__footer">
        <button class="btn btn--outline" data-action="close-modal" data-id="modal-add-setor">Cancelar</button>
        <button class="btn btn--primary" data-action="save-setor">Criar setor →</button>
      </div>
    </div>
  </div>

  <!-- MODAL: Como funciona o Score -->
  <div class="modal-overlay" id="modal-score-info" role="dialog" aria-modal="true" aria-labelledby="modal-score-info-title">
    <div class="modal modal--sm">
      <div class="modal__body">
        <div class="modal__title" id="modal-score-info-title">📊 Como funciona o Score de Risco</div>
        <div class="modal__subtitle">O score vai de 0 a 100 e indica o risco operacional do equipamento</div>

        <div class="score-info-bands">
          <div class="score-info-band score-info-band--ok">
            <span class="score-info-band__range">0 – 34</span>
            <span class="score-info-band__label">✅ Baixo risco</span>
            <span class="score-info-band__desc">Equipamento com manutenção em dia e operando normalmente.</span>
          </div>
          <div class="score-info-band score-info-band--warn">
            <span class="score-info-band__range">35 – 69</span>
            <span class="score-info-band__label">⚠️ Médio risco</span>
            <span class="score-info-band__desc">Atenção necessária — preventiva próxima ou algum ponto de atenção.</span>
          </div>
          <div class="score-info-band score-info-band--danger">
            <span class="score-info-band__range">70 – 100</span>
            <span class="score-info-band__label">🔴 Alto risco</span>
            <span class="score-info-band__desc">Intervenção prioritária recomendada.</span>
          </div>
        </div>

        <div class="score-info-factors">
          <div class="score-info-factors__title">O que entra no cálculo</div>
          <div class="score-info-factor">
            <span class="score-info-factor__icon">📅</span>
            <div>
              <strong>Histórico de manutenção</strong>
              <p>Quantos dias se passaram desde o último registro. Equipamentos sem manutenção recente acumulam mais risco.</p>
            </div>
          </div>
          <div class="score-info-factor">
            <span class="score-info-factor__icon">🔧</span>
            <div>
              <strong>Próxima preventiva</strong>
              <p>Distância em dias até a próxima manutenção preventiva planejada. Quanto mais próxima ou vencida, maior o score.</p>
            </div>
          </div>
          <div class="score-info-factor">
            <span class="score-info-factor__icon">🔁</span>
            <div>
              <strong>Corretivas recentes</strong>
              <p>Quantidade de manutenções corretivas nos últimos 90 dias. Muitas corretivas indicam instabilidade no equipamento.</p>
            </div>
          </div>
          <div class="score-info-factor">
            <span class="score-info-factor__icon">⚡</span>
            <div>
              <strong>Criticidade operacional</strong>
              <p>Multiplica o score base: Baixa ×1.0 · Média ×1.1 · Alta ×1.25 · Crítica ×1.4. Equipamentos críticos têm risco amplificado.</p>
            </div>
          </div>
          <div class="score-info-factor">
            <span class="score-info-factor__icon">🚦</span>
            <div>
              <strong>Status atual</strong>
              <p>Se o equipamento está operando com restrições ou fora de operação, isso eleva diretamente o score.</p>
            </div>
          </div>
        </div>
      </div>
      <div class="btn-group modal__footer">
        <button class="btn btn--primary" data-action="close-modal" data-id="modal-score-info">Entendi</button>
      </div>
    </div>
  </div>

  <!-- LIGHTBOX -->
  <div class="lightbox" id="lightbox" role="dialog" aria-modal="true" aria-label="Visualizar foto">
    <button class="lightbox__close" aria-label="Fechar">✕</button>
    <img class="lightbox__img" id="lightbox-img" src="" alt="Registro fotográfico" />
  </div>

`;
}
