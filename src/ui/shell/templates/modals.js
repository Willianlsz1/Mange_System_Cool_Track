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
            <nav class="modal-breadcrumb" aria-label="Seções do cadastro">
              <span class="modal-breadcrumb__item modal-breadcrumb__item--active" id="crumb-essenciais">
                <span class="modal-breadcrumb__dot" aria-hidden="true">●</span> Essenciais
              </span>
              <span class="modal-breadcrumb__sep" aria-hidden="true">/</span>
              <span class="modal-breadcrumb__item" id="crumb-contexto">Contexto</span>
              <span class="modal-breadcrumb__sep" aria-hidden="true">/</span>
              <span class="modal-breadcrumb__item modal-breadcrumb__item--muted" id="crumb-detalhes">Detalhes técnicos</span>
            </nav>
          </div>
          <div class="modal-steps modal-steps--counter" aria-label="Etapas">
            <span class="modal-steps__counter" id="eq-step-counter">1 / 2</span>
            <span class="modal-step modal-step--active visually-hidden" id="step-dot-1">1</span>
            <span class="modal-step visually-hidden" id="step-dot-2">2</span>
          </div>
        </div>

        <!--
          Hero CTA: "Aponta a câmera, a gente preenche".
          Dois estados mutuamente exclusivos:
          - .nameplate-cta--active (Plus+): botão primário que abre o file
            picker. Preenche tipo/fluido/marca-modelo no step 2 via IA.
          - .nameplate-cta--locked (Free): mesmo layout, CTA redireciona pro
            upsell. Mantemos o layout IDÊNTICO entre os dois estados pra não
            causar "shift" visual quando o user fizer upgrade.
          O toggle é feito por applyNameplateCtaGate() no controller, baseado
          no plano efetivo. Input file fica fora do bloco locked (dentro do
          active) pra não ativar listeners quando estiver bloqueado.
        -->
        <div class="nameplate-cta" id="nameplate-cta" data-state="hidden" hidden>
          <div class="nameplate-cta__icon" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M4 7h3l2-2h6l2 2h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z"
                stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" />
              <circle cx="12" cy="13" r="3.5" stroke="currentColor" stroke-width="1.6" />
              <path d="M15 10l2-2M9 10L7 8" stroke="currentColor" stroke-width="1.4"
                stroke-linecap="round" />
            </svg>
          </div>
          <div class="nameplate-cta__text">
            <div class="nameplate-cta__title">
              Aponta a câmera pra etiqueta
              <span class="plus-badge plus-badge--inline" aria-hidden="true">PLUS</span>
            </div>
            <p class="nameplate-cta__sub" id="nameplate-cta-sub">
              A IA preenche tipo, fluido e marca/modelo pra você.
            </p>
          </div>
          <div class="nameplate-cta__action">
            <!-- Estado active (Plus+): label abre o file picker escondido. -->
            <label class="btn btn--primary btn--sm nameplate-cta__btn nameplate-cta__btn--active"
              for="nameplate-file-input" id="nameplate-cta-btn-active">
              Usar foto da etiqueta
            </label>
            <!-- Estado locked (Free): botão puxa pro upsell. -->
            <button type="button"
              class="btn btn--primary btn--sm nameplate-cta__btn nameplate-cta__btn--locked"
              data-action="nameplate-upsell-cta" id="nameplate-cta-btn-locked">
              Desbloquear com Plus →
            </button>
          </div>
          <input type="file" id="nameplate-file-input"
            accept="image/jpeg,image/png,image/webp"
            class="visually-hidden" data-action="nameplate-file-selected" />
        </div>

        <!--
          Overlay de análise: full-width sobre o form enquanto o Vision processa.
          Renderizado aqui (irmão do nameplate-cta) pra não afetar o layout e
          ficar acima do form na z-order natural.
          Controlado pelo nameplateCapture.js via classes .is-active / .is-done.
          Mostra: thumbnail da foto, scanning line animada, label do estágio,
          progress bar 0→100%, e ao final um "result panel" com % detectado.
        -->
        <div class="nameplate-scan" id="nameplate-scan" data-state="idle" hidden>
          <div class="nameplate-scan__body">
            <div class="nameplate-scan__preview" aria-hidden="true">
              <img class="nameplate-scan__img" id="nameplate-scan-img" alt="" />
              <div class="nameplate-scan__line"></div>
            </div>
            <div class="nameplate-scan__info">
              <div class="nameplate-scan__stage" id="nameplate-scan-stage">
                <span class="nameplate-scan__spinner" aria-hidden="true"></span>
                <span id="nameplate-scan-stage-text">Carregando foto…</span>
              </div>
              <div class="nameplate-scan__bar" role="progressbar"
                aria-label="Progresso da análise da etiqueta"
                aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"
                id="nameplate-scan-bar">
                <div class="nameplate-scan__bar-fill" id="nameplate-scan-bar-fill"></div>
              </div>
              <div class="nameplate-scan__percent" id="nameplate-scan-percent">0%</div>
            </div>
          </div>
          <!-- Result panel: aparece depois do progresso chegar em 100%.
               Mostra X/Y detectados + botão "Revisar campos". -->
          <div class="nameplate-scan__result" id="nameplate-scan-result" hidden>
            <div class="nameplate-scan__result-head">
              <div class="nameplate-scan__result-icon" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div class="nameplate-scan__result-title" id="nameplate-scan-result-title">
                Detectei <b id="nameplate-scan-detected">0</b>/<b id="nameplate-scan-total">16</b> campos
                <span class="nameplate-scan__result-percent" id="nameplate-scan-result-percent"></span>
              </div>
            </div>
            <p class="nameplate-scan__result-sub" id="nameplate-scan-result-sub">
              Revise os campos preenchidos e complete os que faltaram.
            </p>
            <button type="button" class="btn btn--primary btn--sm nameplate-scan__result-btn"
              data-action="nameplate-scan-review" id="nameplate-scan-review">
              Ver campos preenchidos →
            </button>
          </div>
        </div>

        <!--
          Banner de "conquista" mostrado só após a IA preencher o form com
          sucesso. Dois propósitos:
            1. Dar ao user o "ahá, funcionou" (vira o Plus em valor percebido)
            2. Direcionar o olho pros campos que ainda precisam de revisão
          Controlado por showAiBanner() em nameplateCapture.js. Fica escondido
          no render inicial e entre aberturas do modal.
        -->
        <div class="eq-ai-banner" id="eq-ai-banner" hidden>
          <div class="eq-ai-banner__icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 3l2.09 4.26L18.5 8l-3.25 3.16.77 4.48L12 13.5l-4.02 2.14.77-4.48L5.5 8l4.41-.74L12 3z"
                fill="currentColor"/>
            </svg>
          </div>
          <div class="eq-ai-banner__body">
            <div class="eq-ai-banner__title" id="eq-ai-banner-title">
              Dados preenchidos automaticamente
            </div>
            <div class="eq-ai-banner__sub" id="eq-ai-banner-sub">
              Revise rapidamente e finalize o cadastro.
            </div>
          </div>
        </div>

        <div id="eq-step-1">
          <div class="eq-form-section-head">
            <span class="eq-form-section-head__label">Essenciais</span>
          </div>
          <div class="form-group">
            <label class="form-label" for="eq-nome">Como você chama esse equipamento? <span class="form-label__req" aria-hidden="true">*</span></label>
            <input id="eq-nome" class="form-control" type="text"
              placeholder="Ex: Split da recepção, Câmara do estoque..."
              required aria-required="true" aria-describedby="eq-nome-hint" autocomplete="off" />
            <div class="form-hint" id="eq-nome-hint">Use um nome que você reconheça rapidamente no campo</div>
          </div>
          <div class="form-group">
            <label class="form-label" for="eq-local">Onde ele fica? <span class="form-label__req" aria-hidden="true">*</span></label>
            <input id="eq-local" class="form-control" type="text"
              placeholder="Ex: Sala dos fundos, Galpão A, 2º andar..."
              required aria-required="true" autocomplete="off" />
          </div>

          <div class="eq-context-group" id="eq-context-group" style="display:none">
            <div class="eq-form-section-head">
              <span class="eq-form-section-head__label">Contexto</span>
              <span class="eq-form-section-head__meta">— opcional, melhora organização</span>
            </div>
            <div class="eq-context-group__card">
              <label class="eq-context-row eq-context-row--setor" id="eq-setor-wrapper" for="eq-setor" style="display:none">
                <span class="eq-context-row__icon" aria-hidden="true">
                  <span class="eq-context-row__dot"></span>
                </span>
                <span class="eq-context-row__body">
                  <span class="eq-context-row__title">
                    Setor <span class="pro-badge pro-badge--inline">PRO</span>
                  </span>
                  <span class="eq-context-row__sub" id="eq-setor-sub">Sem setor atribuído</span>
                </span>
                <select id="eq-setor" class="eq-context-row__select" aria-label="Setor">
                  <option value="">Sem setor</option>
                </select>
                <svg class="eq-context-row__chev" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M3 5l4 4 4-4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </label>

              <!--
                V4: O bloco de fotos foi MOVIDO pra fora do modal de cadastro.
                Agora as fotos são gerenciadas via avatar + CTA "Gerenciar
                fotos" no detail view do equipamento (modal-eq-photos). A
                mudança elimina a confusão de UX onde o usuário via dois
                locais de foto (cadastro + card) sem saber qual era a
                identificação principal. O fluxo novo: cria o equipamento
                → abre o detail → usa o avatar pra adicionar fotos.
              -->
            </div>
          </div>

          <button class="eq-expand-btn eq-expand-btn--pill" id="eq-expand-details" type="button" aria-expanded="false"
            aria-controls="eq-step-2">
            <span class="eq-expand-btn__body">
              <span class="eq-expand-btn__title">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" id="eq-expand-icon" aria-hidden="true">
                  <path d="M3 5l4 4 4-4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"
                    stroke-linejoin="round" />
                </svg>
                Adicionar detalhes técnicos
              </span>
              <span class="eq-expand-hint">TAG, fluido, modelo — pode preencher depois</span>
            </span>
          </button>
        </div>

        <div id="eq-step-2" class="eq-details-panel" aria-hidden="true">
          <div class="eq-details-divider">Detalhes técnicos <span>(opcional — pode preencher depois)</span></div>
          <div class="form-group">
            <label class="form-label" for="eq-tag">TAG / Código de identificação</label>
            <input id="eq-tag" class="form-control form-control--mono" type="text"
              placeholder="Ex: AC-01, CF-FARM, VRF-A" aria-describedby="eq-tag-hint" />
            <div class="form-hint" id="eq-tag-hint">Código que você usa na etiqueta ou plaqueta do equipamento</div>
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

          <!--
            Campos da etiqueta (preenchidos pela IA quando o user usa "Usar foto da etiqueta").
            Todos opcionais. Quando a IA não detecta um campo, o placeholder vira
            "não detectado — toque pra preencher" via applyFieldsToForm().
            Persistidos em equipamentos.dados_placa (JSONB) pela migration 20260421.
          -->
          <div class="eq-details-subhead">
            <span class="eq-details-subhead__label">Dados da etiqueta</span>
            <span class="eq-details-subhead__meta" id="eq-etiqueta-status">— opcional, a IA preenche por foto</span>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="eq-numero-serie">Nº de série</label>
              <input id="eq-numero-serie" class="form-control form-control--mono" type="text"
                placeholder="Ex: 312KAKY3F817" autocomplete="off" />
            </div>
            <div class="form-group">
              <label class="form-label" for="eq-capacidade-btu">Capacidade (BTU/h)</label>
              <input id="eq-capacidade-btu" class="form-control" type="number" min="0" step="500"
                placeholder="Ex: 9000, 12000, 24000" inputmode="numeric" />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="eq-tensao">Tensão (V)</label>
              <select id="eq-tensao" class="form-control">
                <option value="">—</option>
                <option value="127">127 V</option>
                <option value="220">220 V</option>
                <option value="380">380 V</option>
                <option value="440">440 V</option>
                <option value="bivolt">Bivolt (127/220)</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="eq-frequencia">Frequência (Hz)</label>
              <select id="eq-frequencia" class="form-control">
                <option value="">—</option>
                <option value="50">50 Hz</option>
                <option value="60" selected>60 Hz</option>
              </select>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="eq-fase">Fase</label>
              <select id="eq-fase" class="form-control">
                <option value="">—</option>
                <option value="1">Monofásica (1φ)</option>
                <option value="2">Bifásica (2φ)</option>
                <option value="3">Trifásica (3φ)</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="eq-potencia">Potência (W)</label>
              <input id="eq-potencia" class="form-control" type="number" min="0" step="10"
                placeholder="Ex: 820, 2400" inputmode="numeric" />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="eq-corrente-refrig">Corrente refrig. (A)</label>
              <input id="eq-corrente-refrig" class="form-control" type="number" min="0" max="100" step="0.01"
                placeholder="Ex: 4,63" inputmode="decimal" data-decimal-hint="corrente" />
            </div>
            <div class="form-group">
              <label class="form-label" for="eq-corrente-aquec">Corrente aquec. (A)</label>
              <input id="eq-corrente-aquec" class="form-control" type="number" min="0" max="100" step="0.01"
                placeholder="Ex: 4,15" inputmode="decimal" data-decimal-hint="corrente" />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="eq-pressao-suc">Pressão sucção (MPa)</label>
              <input id="eq-pressao-suc" class="form-control" type="number" min="0" max="10" step="0.1"
                placeholder="Ex: 2,4" inputmode="decimal" data-decimal-hint="pressao" />
            </div>
            <div class="form-group">
              <label class="form-label" for="eq-pressao-desc">Pressão descarga (MPa)</label>
              <input id="eq-pressao-desc" class="form-control" type="number" min="0" max="10" step="0.1"
                placeholder="Ex: 4,2" inputmode="decimal" data-decimal-hint="pressao" />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="eq-grau-protecao">Grau de proteção</label>
              <input id="eq-grau-protecao" class="form-control form-control--mono" type="text"
                placeholder="Ex: IPX0, IP24" autocomplete="off" />
            </div>
            <div class="form-group">
              <label class="form-label" for="eq-ano-fabricacao">Ano de fabricação</label>
              <input id="eq-ano-fabricacao" class="form-control" type="number" min="1990" max="2040" step="1"
                placeholder="Ex: 2024" inputmode="numeric" />
            </div>
          </div>

          <div class="eq-details-subhead">
            <span class="eq-details-subhead__label">Operação</span>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="eq-criticidade">Criticidade do ativo</label>
              <select id="eq-criticidade" class="form-control">
                <option value="baixa">Baixa</option>
                <option value="media" selected>Média</option>
                <option value="alta">Alta</option>
                <option value="critica">Crítica</option>
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
            <input id="eq-periodicidade" class="form-control" type="number" min="15" max="365" step="5" value="90"
              aria-describedby="eq-periodicidade-hint" />
            <div class="form-hint" id="eq-periodicidade-hint">Sugestão automática conforme tipo e criticidade.</div>
          </div>
        </div>
      </div>

      <div class="btn-group modal__footer">
        <button class="btn btn--outline" data-action="close-modal" data-id="modal-add-eq">Cancelar</button>
        <button class="btn btn--primary" data-action="save-equip">&#10003; Confirmar e cadastrar</button>
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

  <!--
    MODAL: Fotos do Equipamento
    Editor dedicado de fotos, aberto a partir do detail view (avatar + CTA
    "Gerenciar fotos"). Foi extraído do modal-add-eq pra resolver a confusão
    de UX em que o usuário via dois locais de foto (cadastro + perfil). Agora
    fotos só se gerenciam aqui, pós-cadastro, no contexto do equipamento.
    O componente EquipmentPhotos é reutilizado — só trocaram-se os IDs dos
    targets DOM pra não colidir com o resto do app.
  -->
  <div class="modal-overlay" id="modal-eq-photos" role="dialog" aria-modal="true"
    aria-labelledby="eq-photos-title">
    <div class="modal">
      <div class="modal__handle"></div>
      <div class="modal__body modal__body--scroll">
        <div class="modal__title" id="eq-photos-title">Fotos do equipamento</div>
        <p class="modal__text eq-photos-modal__lead" id="eq-photos-subtitle">
          Até 3 fotos pra identificar o equipamento em campo. A primeira vira a capa do card.
        </p>

        <div class="equip-photo-block" id="eq-photos-block">
          <label class="equip-photo-dropzone" for="eq-photos-gallery" id="eq-photos-drop-zone">
            <svg class="equip-photo-dropzone__icon" width="22" height="22" viewBox="0 0 24 24" fill="none"
              aria-hidden="true">
              <path d="M4 7h3l2-2h6l2 2h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z"
                stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" />
              <circle cx="12" cy="13" r="3.5" stroke="currentColor" stroke-width="1.6" />
            </svg>
            <span class="equip-photo-dropzone__text">
              <span class="equip-photo-dropzone__title" id="eq-photos-drop-text">Tirar foto ou escolher da galeria</span>
              <span class="equip-photo-dropzone__sub">câmera ou arquivos · até 3</span>
            </span>
          </label>
          <input type="file" id="eq-photos-gallery" accept="image/*" multiple
            class="visually-hidden" data-action="eq-photos-add" />

          <label class="equip-photo-shortcut" for="eq-photos-camera">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 7h3l2-2h6l2 2h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z"
                stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" />
              <circle cx="12" cy="13" r="3" stroke="currentColor" stroke-width="1.6" />
            </svg>
            Atalho: abrir câmera direto
          </label>
          <input type="file" id="eq-photos-camera" accept="image/*" capture="environment"
            class="visually-hidden" data-action="eq-photos-add" />

          <div class="equip-photo-counter photo-counter visually-hidden" aria-live="polite">0/3 fotos</div>
          <div class="photo-preview equip-photo-preview" id="eq-photos-preview" role="list"></div>

          <!--
            Locked state (Free). Mesmo padrão do gate antigo em modal-add-eq:
            .equip-photo-block--locked no wrapper esconde dropzone+preview via
            CSS e mostra o card de upsell. Aplicado por applyEquipPhotosEditorGate.
          -->
          <div class="equip-photo-locked" id="eq-photos-locked" hidden>
            <div class="equip-photo-locked__icon" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <rect x="5" y="11" width="14" height="9" rx="2"
                  stroke="currentColor" stroke-width="1.6" />
                <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor"
                  stroke-width="1.6" stroke-linecap="round" />
              </svg>
            </div>
            <div class="equip-photo-locked__text">
              <div class="equip-photo-locked__title">
                Fotos do equipamento
                <span class="plus-badge plus-badge--inline" aria-hidden="true">PLUS</span>
              </div>
              <p class="equip-photo-locked__sub">
                Identifique equipamentos em campo pelas fotos — até 3 por equipamento.
              </p>
            </div>
            <button type="button" class="btn btn--primary btn--sm equip-photo-locked__cta"
              data-action="eq-photos-upsell-cta">
              Desbloquear com Plus →
            </button>
          </div>
        </div>
      </div>

      <div class="btn-group modal__footer">
        <button class="btn btn--outline" data-action="close-modal" data-id="modal-eq-photos">Cancelar</button>
        <button class="btn btn--primary" data-action="save-eq-photos">Salvar fotos</button>
      </div>
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

  <!-- MODAL: Criar / Editar Setor (PRO) — premium redesign -->
  <div class="modal-overlay" id="modal-add-setor" role="dialog" aria-modal="true" aria-labelledby="modal-add-setor-title">
    <div class="modal setor-modal">
      <div class="modal__handle"></div>

      <header class="setor-modal__hero">
        <span class="setor-modal__orb setor-modal__orb--tr" aria-hidden="true"></span>
        <span class="setor-modal__orb setor-modal__orb--bl" aria-hidden="true"></span>
        <div class="setor-modal__hero-row">
          <div class="setor-modal__hero-copy">
            <span class="setor-modal__badge">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 6l3.5-3L12 6l5.5-3L21 6l-2 12H5L3 6z"/></svg>
              Pro · Setores
            </span>
            <h2 class="setor-modal__title" id="modal-add-setor-title">Novo setor</h2>
            <p class="setor-modal__subtitle">Agrupe equipamentos por local ou área de trabalho.</p>
          </div>
          <button type="button" class="setor-modal__close" data-action="close-modal" data-id="modal-add-setor" aria-label="Fechar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </div>
      </header>

      <div class="setor-modal__body">
        <!-- NOME -->
        <div class="setor-modal__field">
          <div class="setor-modal__field-head">
            <label for="setor-nome" class="setor-modal__label">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none"/></svg>
              Nome do setor
              <span class="setor-modal__label-req" aria-hidden="true">*</span>
            </label>
            <span class="setor-modal__counter" id="setor-nome-counter" aria-live="polite">0/40</span>
          </div>
          <input
            id="setor-nome"
            class="setor-modal__input"
            type="text"
            placeholder="Ex: Bloco Cirúrgico, UTI, Cozinha…"
            autocomplete="off"
            maxlength="50"
            required
            aria-describedby="setor-nome-err"
          />
          <div class="setor-modal__error" id="setor-nome-err" hidden>
            <span class="setor-modal__error-badge" aria-hidden="true">!</span>
            Dê um nome ao setor pra continuar.
          </div>
        </div>

        <!-- COR -->
        <div class="setor-modal__field">
          <div class="setor-modal__field-head">
            <span class="setor-modal__label">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.8 4.6L18 9.4l-4.2 1.8L12 15.8l-1.8-4.6L6 9.4l4.2-1.8L12 3z"/><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15z"/></svg>
              Cor do setor
              <span class="setor-modal__label-req" aria-hidden="true">*</span>
            </span>
            <span class="setor-modal__color-readout">
              <span class="setor-modal__color-name" id="setor-color-name">Ciano</span>
              <span class="setor-modal__color-sep">·</span>
              <span class="setor-modal__color-hex" id="setor-color-hex">#00c8e8</span>
            </span>
          </div>
          <div class="setor-modal__swatches" id="setor-color-picker" role="radiogroup" aria-label="Paleta de cores do setor">
            <div class="setor-modal__swatch-cell">
              <button type="button" class="setor-modal__swatch setor-modal__swatch--selected" data-cor="#00c8e8" data-nome="Ciano" role="radio" aria-checked="true" aria-label="Cor Ciano">
                <span class="setor-modal__swatch-dot" style="background:#00c8e8"></span>
              </button>
              <span class="setor-modal__swatch-label">Ciano</span>
            </div>
            <div class="setor-modal__swatch-cell">
              <button type="button" class="setor-modal__swatch" data-cor="#00c853" data-nome="Esmeralda" role="radio" aria-checked="false" aria-label="Cor Esmeralda">
                <span class="setor-modal__swatch-dot" style="background:#00c853"></span>
              </button>
              <span class="setor-modal__swatch-label">Esmeralda</span>
            </div>
            <div class="setor-modal__swatch-cell">
              <button type="button" class="setor-modal__swatch" data-cor="#ffab40" data-nome="Âmbar" role="radio" aria-checked="false" aria-label="Cor Âmbar">
                <span class="setor-modal__swatch-dot" style="background:#ffab40"></span>
              </button>
              <span class="setor-modal__swatch-label">Âmbar</span>
            </div>
            <div class="setor-modal__swatch-cell">
              <button type="button" class="setor-modal__swatch" data-cor="#ff5252" data-nome="Coral" role="radio" aria-checked="false" aria-label="Cor Coral">
                <span class="setor-modal__swatch-dot" style="background:#ff5252"></span>
              </button>
              <span class="setor-modal__swatch-label">Coral</span>
            </div>
            <div class="setor-modal__swatch-cell">
              <button type="button" class="setor-modal__swatch" data-cor="#7c4dff" data-nome="Violeta" role="radio" aria-checked="false" aria-label="Cor Violeta">
                <span class="setor-modal__swatch-dot" style="background:#7c4dff"></span>
              </button>
              <span class="setor-modal__swatch-label">Violeta</span>
            </div>
            <div class="setor-modal__swatch-cell">
              <button type="button" class="setor-modal__swatch" data-cor="#448aff" data-nome="Azul" role="radio" aria-checked="false" aria-label="Cor Azul">
                <span class="setor-modal__swatch-dot" style="background:#448aff"></span>
              </button>
              <span class="setor-modal__swatch-label">Azul</span>
            </div>
            <div class="setor-modal__swatch-cell">
              <button type="button" class="setor-modal__swatch" data-cor="#f06292" data-nome="Rosa" role="radio" aria-checked="false" aria-label="Cor Rosa">
                <span class="setor-modal__swatch-dot" style="background:#f06292"></span>
              </button>
              <span class="setor-modal__swatch-label">Rosa</span>
            </div>
            <div class="setor-modal__swatch-cell">
              <button type="button" class="setor-modal__swatch" data-cor="#9ccc65" data-nome="Verde-lima" role="radio" aria-checked="false" aria-label="Cor Verde-lima">
                <span class="setor-modal__swatch-dot" style="background:#9ccc65"></span>
              </button>
              <span class="setor-modal__swatch-label">Verde-lima</span>
            </div>
            <div class="setor-modal__swatch-cell">
              <button type="button" class="setor-modal__swatch" data-cor="#ff7043" data-nome="Laranja" role="radio" aria-checked="false" aria-label="Cor Laranja">
                <span class="setor-modal__swatch-dot" style="background:#ff7043"></span>
              </button>
              <span class="setor-modal__swatch-label">Laranja</span>
            </div>
            <div class="setor-modal__swatch-cell">
              <button type="button" class="setor-modal__swatch" data-cor="#26a69a" data-nome="Teal" role="radio" aria-checked="false" aria-label="Cor Teal">
                <span class="setor-modal__swatch-dot" style="background:#26a69a"></span>
              </button>
              <span class="setor-modal__swatch-label">Teal</span>
            </div>
          </div>
          <input type="hidden" id="setor-cor" value="#00c8e8" />
        </div>

        <!-- DESCRIÇÃO -->
        <div class="setor-modal__field">
          <div class="setor-modal__field-head">
            <label for="setor-descricao" class="setor-modal__label">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10"/></svg>
              Descrição
              <span class="setor-modal__label-opt">(opcional)</span>
            </label>
            <span class="setor-modal__counter" id="setor-descricao-counter" aria-live="polite">0/120</span>
          </div>
          <textarea
            id="setor-descricao"
            class="setor-modal__input setor-modal__input--textarea"
            rows="2"
            maxlength="140"
            placeholder="Ex: Ala cirúrgica com 12 splits e 2 fan coils."
          ></textarea>
        </div>

        <!-- RESPONSÁVEL -->
        <div class="setor-modal__field">
          <div class="setor-modal__field-head">
            <label for="setor-responsavel" class="setor-modal__label">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 5-6 8-6s6.5 2 8 6"/></svg>
              Responsável
              <span class="setor-modal__label-opt">(opcional)</span>
            </label>
          </div>
          <div class="setor-modal__input-wrap">
            <span class="setor-modal__input-icon" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 5-6 8-6s6.5 2 8 6"/></svg>
            </span>
            <input
              id="setor-responsavel"
              class="setor-modal__input setor-modal__input--with-icon"
              type="text"
              maxlength="120"
              placeholder="Ex: Dr. Carlos Silva · Enfª Ana Souza"
            />
          </div>
        </div>

        <!-- PREVIEW -->
        <div class="setor-modal__preview">
          <div class="setor-modal__preview-head">
            <span class="setor-modal__preview-label">
              <span class="setor-modal__preview-dot" aria-hidden="true"></span>
              Prévia
              <span class="setor-modal__preview-hint">· como vai aparecer na grade</span>
            </span>
            <span class="setor-modal__contrast" id="setor-contrast" data-aa="pass">AA ✓ · 14.1:1</span>
          </div>
          <div class="setor-modal__preview-card" id="setor-modal-preview-card" style="--setor-cor:#00c8e8">
            <span class="setor-modal__preview-border" aria-hidden="true"></span>
            <div class="setor-modal__preview-body">
              <div class="setor-modal__preview-top">
                <div class="setor-modal__preview-info">
                  <div class="setor-modal__preview-name" id="setor-modal-preview-name">Novo setor</div>
                  <div class="setor-modal__preview-meta">
                    <span class="setor-modal__preview-meta-dot" aria-hidden="true"></span>
                    <span id="setor-modal-preview-count">0 equipamentos</span>
                  </div>
                </div>
                <div class="setor-modal__preview-score">
                  <div class="setor-modal__preview-score-label">Score</div>
                  <div class="setor-modal__preview-score-value" id="setor-modal-preview-score">—</div>
                </div>
              </div>
              <div class="setor-modal__preview-status" id="setor-modal-preview-status">
                <div class="setor-modal__preview-status-row">
                  <span class="setor-modal__preview-status-pill">
                    <span class="setor-modal__preview-status-dot" aria-hidden="true"></span>
                    <span id="setor-modal-preview-status-label">Aguardando dados</span>
                  </span>
                  <span class="setor-modal__preview-status-meta" id="setor-modal-preview-status-meta">—</span>
                </div>
                <div class="setor-modal__preview-bar"><span class="setor-modal__preview-bar-fill" id="setor-modal-preview-bar"></span></div>
              </div>
              <div class="setor-modal__preview-cta">
                <span class="setor-modal__preview-cta-text">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
                  Ver equipamentos
                </span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 6 15 12 9 18"/></svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer class="setor-modal__footer">
        <button type="button" class="setor-modal__btn setor-modal__btn--ghost" data-action="close-modal" data-id="modal-add-setor">Cancelar</button>
        <button type="button" class="setor-modal__btn setor-modal__btn--primary" data-action="save-setor" id="setor-save-btn">
          <span class="setor-modal__btn-label">Criar setor →</span>
        </button>
      </footer>
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
            <span class="score-info-band__range">0 – 39</span>
            <span class="score-info-band__label">✅ Baixo risco</span>
            <span class="score-info-band__desc">Equipamento com manutenção em dia e operando normalmente.</span>
          </div>
          <div class="score-info-band score-info-band--warn">
            <span class="score-info-band__range">40 – 74</span>
            <span class="score-info-band__label">⚠️ Médio risco</span>
            <span class="score-info-band__desc">Atenção necessária — preventiva próxima ou algum ponto de atenção.</span>
          </div>
          <div class="score-info-band score-info-band--danger">
            <span class="score-info-band__range">75 – 100</span>
            <span class="score-info-band__label">🔴 Alto risco</span>
            <span class="score-info-band__desc">Intervenção prioritária recomendada.</span>
          </div>
        </div>

        <div class="score-info-factors">
          <div class="score-info-factors__title">O que aumenta o score</div>
          <div class="score-info-factor">
            <span class="score-info-factor__icon">🚦</span>
            <div>
              <strong>Status atual</strong>
              <p>Equipamento fora de operação é o fator mais pesado. Operar com restrições também sobe o score.</p>
            </div>
          </div>
          <div class="score-info-factor">
            <span class="score-info-factor__icon">🔧</span>
            <div>
              <strong>Próxima preventiva</strong>
              <p>Quanto mais próxima ou vencida a próxima preventiva, maior o score. Preventiva vencida é o segundo maior peso.</p>
            </div>
          </div>
          <div class="score-info-factor">
            <span class="score-info-factor__icon">📅</span>
            <div>
              <strong>Tempo desde o último serviço</strong>
              <p>Comparado à periodicidade planejada do equipamento. Passou do intervalo, o score sobe.</p>
            </div>
          </div>
          <div class="score-info-factor">
            <span class="score-info-factor__icon">🔁</span>
            <div>
              <strong>Corretivas recentes</strong>
              <p>Quantas corretivas aparecem entre os últimos 3 registros. Reincidência indica instabilidade.</p>
            </div>
          </div>
          <div class="score-info-factor">
            <span class="score-info-factor__icon">⚡</span>
            <div>
              <strong>Criticidade operacional</strong>
              <p>Multiplica o score base: Baixa ×1.0 · Média ×1.1 · Alta ×1.25 · Crítica ×1.4. Equipamentos críticos têm risco amplificado.</p>
            </div>
          </div>
        </div>

        <div class="score-info-factors">
          <div class="score-info-factors__title score-info-factors__title--bonus">O que reduz o score (bônus)</div>
          <p class="score-info-factors__caption">Bom comportamento derruba o risco. Cada bônus abaixo é subtraído do score técnico:</p>
          <div class="score-info-factor score-info-factor--bonus">
            <span class="score-info-factor__icon">✅</span>
            <div>
              <strong>Preventivas em dia &minus;10</strong>
              <p>3 preventivas consecutivas cumpridas dentro do prazo, com a próxima ainda não atrasada.</p>
            </div>
          </div>
          <div class="score-info-factor score-info-factor--bonus">
            <span class="score-info-factor__icon">🛡️</span>
            <div>
              <strong>Sem corretivas &minus;5</strong>
              <p>Nenhuma corretiva no histórico (com 3+ registros) ou última corretiva há mais de 180 dias.</p>
            </div>
          </div>
          <div class="score-info-factor score-info-factor--bonus">
            <span class="score-info-factor__icon">💚</span>
            <div>
              <strong>Status estável &minus;3</strong>
              <p>Equipamento em operação normal e registros recentes sem alertas.</p>
            </div>
          </div>
        </div>

        <div class="score-info-factors">
          <div class="score-info-factors__title score-info-factors__title--trend">Tendência de 30 dias</div>
          <p class="score-info-factors__caption">No card do equipamento, a seta compara o score atual com 30 dias atrás:</p>
          <div class="score-info-factor score-info-factor--trend">
            <span class="score-info-factor__icon score-info-factor__icon--improving">↓</span>
            <div>
              <strong>Melhorando</strong>
              <p>O risco caiu nos últimos 30 dias. A manutenção preventiva está surtindo efeito.</p>
            </div>
          </div>
          <div class="score-info-factor score-info-factor--trend">
            <span class="score-info-factor__icon score-info-factor__icon--worsening">↑</span>
            <div>
              <strong>Piorando</strong>
              <p>O risco subiu nos últimos 30 dias. Vale agendar uma inspeção antes que escale.</p>
            </div>
          </div>
          <div class="score-info-factor score-info-factor--trend">
            <span class="score-info-factor__icon score-info-factor__icon--stable">→</span>
            <div>
              <strong>Estável</strong>
              <p>Variação pequena ou histórico ainda curto para comparar.</p>
            </div>
          </div>
        </div>
      </div>
      <div class="btn-group modal__footer modal__footer--inline">
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
