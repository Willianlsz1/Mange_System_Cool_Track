export function renderShellViews() {
  return String.raw`
<!-- PAINEL -->
        <div class="view active" id="view-inicio">
          <div class="section-title" id="dash-greeting">Sistema Operacional</div>
          <div class="dashboard-bento">
            <div id="dash-alert-strip"></div>
            <div id="dash-next-action"></div>
            <div class="dashboard-operational-grid">
              <div class="dash-section dash-section--critical-now">
                <div class="dash-section-header">
                  <span class="dash-section-header__label">CRÍTICOS AGORA</span>
                  <span class="dash-section-header__line"></span>
                  <span class="dash-section-header__count" id="dash-critical-now-count">0</span>
                </div>
                <div id="dash-critical-now"></div>
              </div>
              <div class="dash-section dash-section--quick-actions">
                <div class="dash-section-header">
                  <span class="dash-section-header__label">AÇÕES RÁPIDAS</span>
                  <span class="dash-section-header__line"></span>
                </div>
                <div class="quick-actions-grid">
                  <button class="btn btn--primary quick-action-btn" data-nav="registro">Registrar manutenção</button>
                  <button class="btn btn--outline quick-action-btn" data-nav="equipamentos">Buscar equipamento</button>
                  <button class="btn btn--danger quick-action-btn" data-nav="alertas">Ver críticos</button>
                </div>
              </div>
            </div>
            <div class="kpi-row">
              <div class="bento-kpi bento-kpi--alert">
                <div class="bento-kpi__label">EQUIPAMENTOS ATIVOS</div>
                <div class="bento-kpi__value" id="hst-alert-bento">—</div>
                <div class="bento-kpi__sub" id="hst-alert-bento-sub"></div>
              </div>
              <div class="bento-kpi bento-kpi--health">
                <div class="bento-kpi__label">EFICIÊNCIA DO SISTEMA</div>
                <div class="bento-kpi__value bento-kpi__value--cyan" id="hst-health">—</div>
                <div class="health-bar">
                  <div class="health-bar__fill health-bar__fill--ok" id="health-bar-fill"></div>
                </div>
                <div class="bento-kpi__sub" id="hst-health-sub"></div>
              </div>
              <div class="bento-kpi bento-kpi--fail">
                <div class="bento-kpi__label">ANOMALIAS OPERACIONAIS</div>
                <div class="bento-kpi__value bento-kpi__value--danger" id="hst-fail-bento">0</div>
                <div class="bento-kpi__sub" id="hst-fail-bento-sub"></div>
              </div>
              <div class="bento-kpi bento-kpi--mes">
                <div class="bento-kpi__label">SERVIÇOS — MÊS ATUAL</div>
                <div class="bento-kpi__value" id="hst-mes-bento">—</div>
                <div id="hst-mes-spark"></div>
                <div class="bento-kpi__sub" id="hst-mes-bento-sub"></div>
              </div>
            </div>
            <div class="dash-center-grid">
              <div class="dash-section">
                <div class="dash-section-header">
                  <span class="dash-section-header__label">EQUIPAMENTOS COM OCORRÊNCIA</span>
                  <span class="dash-section-header__line"></span>
                </div>
                <div id="dash-criticos"></div>
              </div>
              <div class="dash-section">
                <div class="dash-section-header">
                  <span class="dash-section-header__label">ALERTAS ATIVOS — AÇÃO IMEDIATA</span>
                  <span class="dash-section-header__line"></span>
                </div>
                <div id="dash-alertas-mini"></div>
              </div>
            </div>
            <div class="dash-section">
              <div class="dash-section-header">
                <span class="dash-section-header__label">ÚLTIMOS SERVIÇOS</span>
                <span class="dash-section-header__line"></span>
              </div>
              <div id="dash-recentes"></div>
            </div>
            <div class="dash-section dash-section--analysis">
              <div class="dash-section-header">
                <span class="dash-section-header__label">ANÁLISE DO PARQUE</span>
                <span class="dash-section-header__line"></span>
              </div>
              <div class="charts-grid">
                <div class="chart-card">
                  <div class="chart-card__title">STATUS DO PARQUE</div>
                  <div class="chart-card__body"><canvas id="chart-status-pie"></canvas></div>
                </div>
                <div class="chart-card">
                  <div class="chart-card__title">SERVIÇOS POR PERÍODO</div>
                  <div class="chart-card__body"><canvas id="chart-trend-line"></canvas></div>
                </div>
                <div class="chart-card chart-card--full">
                  <div class="chart-card__title">TIPOS DE SERVIÇO — FREQUÊNCIA</div>
                  <div class="chart-card__body"><canvas id="chart-types-bar"></canvas></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- EQUIPAMENTOS -->
        <div class="view" id="view-equipamentos">
          <div class="page-toolbar">
            <div class="section-title">Parque de Equipamentos</div>
            <button class="btn btn--primary btn--sm" data-action="open-modal" data-id="modal-add-eq">+ Novo
              equipamento</button>
          </div>
          <div class="search-bar">
            <span class="search-bar__icon" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 14 14"
                fill="none">
                <circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.2" />
                <path d="M9.5 9.5L12 12" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
              </svg></span>
                <input class="form-control search-bar__input" id="equip-busca" type="text" placeholder="Buscar por nome, TAG ou local..."
                  aria-label="Buscar equipamento" />
          </div>
          <div id="lista-equip" role="list"></div>
        </div>

        <!-- REGISTRO -->
        <div class="view" id="view-registro">
          <div class="section-title">O que foi feito hoje?</div>
          <div class="card">
            <div id="storage-indicator" class="storage-indicator" role="status" aria-live="polite" hidden></div>
            <div class="registro-quick-actions">
              <div class="registro-bloco__label">AÇÕES RÁPIDAS</div>
              <div class="registro-quick-actions__grid">
                <button class="btn btn--outline registro-quick-actions__btn" data-action="quick-service-template"
                  data-template="limpeza">Limpeza</button>
                <button class="btn btn--outline registro-quick-actions__btn" data-action="quick-service-template"
                  data-template="recarga_gas">Recarga de gás</button>
                <button class="btn btn--outline registro-quick-actions__btn" data-action="quick-service-template"
                  data-template="troca_filtro">Troca de filtro</button>
                <button class="btn btn--outline registro-quick-actions__btn" data-action="quick-service-template"
                  data-template="inspecao">Inspeção</button>
                <button class="btn btn--outline registro-quick-actions__btn" data-action="quick-service-template"
                  data-template="manutencao_corretiva">Manutenção corretiva</button>
              </div>
            </div>
            <div class="registro-bloco">
              <div class="registro-bloco__label">O SERVIÇO</div>
              <div class="form-group">
                <label class="form-label" for="r-equip">Em qual equipamento? *</label>
                <select id="r-equip" class="form-control" required aria-required="true">
                  <option value="">Selecione o equipamento...</option>
                </select>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label" for="r-data">Quando foi? *</label>
                  <input id="r-data" class="form-control" type="datetime-local" required aria-required="true" />
                </div>
                <div class="form-group">
                  <label class="form-label" for="r-tipo">O que foi feito? *</label>
                  <select id="r-tipo" class="form-control" required aria-required="true">
                    <option value="">Selecione o tipo...</option>
                    <option>Manutenção Preventiva</option>
                    <option>Manutenção Corretiva</option>
                    <option>Limpeza de Filtros</option>
                    <option>Carga de Gás Refrigerante</option>
                    <option>Troca de Compressor</option>
                    <option>Troca de Capacitor</option>
                    <option>Limpeza de Condensador</option>
                    <option>Limpeza de Evaporador</option>
                    <option>Verificação Elétrica</option>
                    <option>Ajuste de Dreno</option>
                    <option>Inspeção Geral</option>
                    <option>Outro</option>
                  </select>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label" for="r-obs">Descreva o serviço</label>
                <textarea id="r-obs" class="form-control registro-obs"
                  placeholder="O que foi encontrado e o que foi feito. Ex: Filtros sujos, limpeza realizada. Pressão de sucção 68 psi, dentro do normal. Sistema operando corretamente."
                  ></textarea>
                <div class="form-hint">Seja específico — esse texto vai no relatório que você envia ao cliente</div>
              </div>
              <div class="form-group">
                <label class="form-label" for="r-tecnico">Quem fez? *</label>
                <input list="lista-tecnicos" id="r-tecnico" class="form-control"
                  placeholder="Seu nome ou o nome do técnico..." autocomplete="off" required aria-required="true" />
                <datalist id="lista-tecnicos"></datalist>
              </div>
            </div>
            <div class="registro-bloco">
              <div class="registro-bloco__label">MATERIAIS E CUSTO <span
                  class="registro-bloco__opcional">(opcional)</span></div>
              <div class="form-group">
                <label class="form-label" for="r-pecas">Peças e materiais usados</label>
                <input id="r-pecas" class="form-control" type="text"
                  placeholder="Ex: Filtro G4, R-410A 1 kg, Capacitor 30µF 440V" />
                <div class="form-hint">Liste o que foi substituído ou consumido — aparece no relatório</div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label" for="r-custo-pecas">Custo das peças (R$)</label>
                  <input id="r-custo-pecas" class="form-control" type="number" min="0" step="0.01" placeholder="0,00" />
                </div>
                <div class="form-group">
                  <label class="form-label" for="r-custo-mao-obra">Mão de obra (R$)</label>
                  <input id="r-custo-mao-obra" class="form-control" type="number" min="0" step="0.01"
                    placeholder="0,00" />
                </div>
              </div>
            </div>
            <div class="registro-bloco">
              <div class="registro-bloco__label">EVIDÊNCIAS <span class="registro-bloco__opcional">(opcional — aumenta
                  credibilidade com o cliente)</span></div>
              <div class="photo-drop" id="photo-drop-zone">
                <input type="file" accept="image/*" multiple id="input-fotos" aria-label="Adicionar fotos" />
                <div class="photo-drop__icon" aria-hidden="true">📷</div>
                <div class="photo-drop__text" id="photo-drop-text">Adicionar fotos do serviço</div>
                <div class="photo-drop__limit">Antes e depois · Máx. 5 fotos</div>
              </div>
              <div class="photo-grid" id="photo-preview" role="list" aria-label="Fotos adicionadas"></div>
            </div>
            <div class="registro-bloco registro-bloco--future">
              <div class="registro-bloco__label">O QUE VEM A SEGUIR</div>
              <div class="registro-bloco__desc">Como o equipamento saiu do serviço? Quando deve voltar?</div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label" for="r-prioridade">Prioridade sugerida</label>
                  <select id="r-prioridade" class="form-control">
                    <option value="baixa">Baixa</option>
                    <option value="media" selected>Média</option>
                    <option value="alta">Alta</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label" for="r-status">Como ficou?</label>
                  <select id="r-status" class="form-control">
                    <option value="ok">Operando normalmente</option>
                    <option value="warn">Requer atenção em breve</option>
                    <option value="danger">Fora de operação</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label" for="r-proxima">Quando retornar para preventiva?</label>
                  <input id="r-proxima" class="form-control" type="date" />
                  <div class="form-hint">Deixe em branco se não souber agora</div>
                </div>
              </div>
            </div>
            <div class="btn-group registro-btn-group" id="tour-signature-anchor">
              <button class="btn btn--outline" data-action="clear-registro"
                title="Limpa todos os campos">Recomeçar</button>
              <button class="btn btn--primary" data-action="save-registro">Salvar registro</button>
            </div>
            <div class="tour-signature-hint">✍️ A assinatura do cliente é solicitada logo após salvar o registro.</div>
          </div>
        </div>

        <!-- HISTÓRICO -->
        <div class="view" id="view-historico">
          <div class="hist-sticky-header" id="hist-sticky-header">
            <div class="hist-sticky-header__top">
              <div class="section-title section-title--toolbar">Histórico de Serviços</div>
              <div class="hist-sticky-header__actions">
                <span class="hist-count" id="hist-count"></span>
                <button class="btn btn--outline btn--sm" data-nav="relatorio">Gerar Relatório</button>
              </div>
            </div>
            <div class="hist-filters">
              <div class="search-bar search-bar--compact search-bar--grow">
                <span class="search-bar__icon" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 14 14"
                    fill="none">
                    <circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.2" />
                    <path d="M9.5 9.5L12 12" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
                  </svg></span>
                <input class="form-control search-bar__input" id="hist-busca" type="text"
                  placeholder="Buscar equipamento, tipo, técnico..." aria-label="Buscar no histórico" />
              </div>
              <select id="hist-equip" class="form-control hist-equip-select" aria-label="Filtrar por equipamento">
                <option value="">Todos</option>
              </select>
            </div>
          </div>
          <div class="hist-chrono-label" id="hist-chrono-label">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <circle cx="6" cy="6" r="5" stroke="currentColor" stroke-width="1" />
              <path d="M6 3v3l2 1.2" stroke="currentColor" stroke-width="1" stroke-linecap="round" />
            </svg>
            Mais recente primeiro
          </div>
          <div id="timeline" role="list"></div>
        </div>

        <!-- ALERTAS -->
        <div class="view" id="view-alertas">
          <div class="section-title">Alertas e Anormalidades registradas</div>
          <div id="lista-alertas" role="list"></div>
        </div>

        <!-- RELATÓRIO -->
        <div class="view" id="view-relatorio">
          <div class="page-toolbar">
            <div class="section-title">Relatório de Manutenção</div>
            <div class="page-toolbar__actions">
              <button class="btn btn--outline btn--sm" data-nav="historico">← Voltar</button>
              <button class="btn btn--outline btn--sm" id="btn-print" data-action="print">Imprimir</button>
              <button class="btn btn--outline btn--sm btn--whatsapp" id="btn-whatsapp" data-action="whatsapp-export">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" class="icon-inline--fixed">
                  <path
                    d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347" />
                </svg>
                WhatsApp
              </button>
              <button class="btn btn--primary btn--sm" id="btn-export-pdf" data-action="export-pdf">Exportar
                PDF</button>
            </div>
          </div>
          <div class="form-row form-row--report-filters">
            <div class="form-group">
              <label class="form-label" for="rel-equip">Equipamento</label>
              <select id="rel-equip" class="form-control">
                <option value="">Todos</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="rel-de">De</label>
              <input id="rel-de" class="form-control" type="date" />
            </div>
            <div class="form-group">
              <label class="form-label" for="rel-ate">Até</label>
              <input id="rel-ate" class="form-control" type="date" />
            </div>
          </div>
          <div id="relatorio-corpo"></div>
        </div>
`;
}
