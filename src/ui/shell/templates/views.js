export function renderShellViews() {
  return String.raw`
<!-- PAINEL (V2Refined redesign) -->
        <div class="view active" id="view-inicio">
          <section class="dash" id="dash" data-tier="free" data-tone="ok">
            <!-- Hero Status Card — pill (TUDO OPERANDO/AÇÃO NECESSÁRIA) + greeting + chips + CTA -->
            <article class="dash__hero" id="dash-hero" aria-label="Status geral do parque">
              <span class="dash__hero-orb dash__hero-orb--a" aria-hidden="true"></span>
              <span class="dash__hero-orb dash__hero-orb--b" aria-hidden="true"></span>
              <div class="dash__hero-body">
                <span class="dash__hero-pill" id="dash-hero-pill">
                  <span class="dash__hero-pill-icon" id="dash-hero-pill-icon" aria-hidden="true">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7l4 4 5-7 5 7 4-4-2 12H5L3 7z" /></svg>
                  </span>
                  <span class="dash__hero-pill-text" id="dash-hero-pill-text">TUDO OPERANDO</span>
                </span>
                <h1 class="dash__hero-greeting" id="dash-hero-greeting">Olá</h1>
                <div class="dash__hero-datetime" id="dash-hero-datetime"></div>
                <p class="dash__hero-desc" id="dash-hero-desc">Seu parque está saudável.</p>
                <div class="dash__hero-chips" id="dash-hero-chips"></div>
              </div>
              <div class="dash__hero-cta-wrap">
                <button class="dash__hero-cta" id="dash-hero-cta" type="button" data-nav="registro">
                  <span class="dash__hero-cta-icon" aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" /></svg>
                  </span>
                  <span class="dash__hero-cta-label" id="dash-hero-cta-label">Registrar manutenção</span>
                </button>
              </div>
            </article>

            <!-- Empty state (sem equipamento) -->
            <div id="dash-empty" class="dash__empty" hidden></div>

            <!-- Onboarding + Usage meter + Upgrade card (mantidos para integração de plano) -->
            <div id="dash-onboarding"></div>
            <div id="dash-usage-meter"></div>
            <div id="dash-upgrade-card"></div>

            <!-- KPI Grid — 2×2 mobile / 1×4 desktop -->
            <section class="dash__kpi-grid" aria-label="Indicadores principais">
              <article class="dash__kpi">
                <div class="dash__kpi-label">Ativos</div>
                <div class="dash__kpi-value" id="dash-kpi-ativos">—</div>
                <div class="dash__kpi-sub" id="dash-kpi-ativos-sub">—</div>
              </article>
              <article class="dash__kpi">
                <div class="dash__kpi-label">Eficiência</div>
                <div class="dash__kpi-value" id="dash-kpi-ef">—</div>
                <div class="dash__kpi-spark" id="dash-kpi-ef-spark" aria-hidden="true"></div>
                <div class="dash__kpi-sub" id="dash-kpi-ef-sub">—</div>
              </article>
              <article class="dash__kpi">
                <div class="dash__kpi-label">Anomalias</div>
                <div class="dash__kpi-value" id="dash-kpi-anom">0</div>
                <div class="dash__kpi-sub" id="dash-kpi-anom-sub">sem alerta</div>
              </article>
              <article class="dash__kpi">
                <div class="dash__kpi-label">Serviços / mês</div>
                <div class="dash__kpi-value" id="dash-kpi-mes">—</div>
                <div class="dash__kpi-spark" id="dash-kpi-mes-spark" aria-hidden="true"></div>
                <div class="dash__kpi-sub" id="dash-kpi-mes-sub">—</div>
              </article>
            </section>

            <!-- Próxima ação + Último serviço -->
            <section class="dash__pair">
              <article class="dash__card dash__card--next-action" id="dash-next-action-card" data-tone="ok">
                <div class="dash__card-label">Próxima ação</div>
                <div class="dash__card-title" id="dash-next-title">Nenhuma ação urgente</div>
                <div class="dash__card-sub" id="dash-next-sub">—</div>
                <button class="dash__card-cta" id="dash-next-cta" type="button" data-nav="historico" data-action="" data-id="">
                  <span class="dash__card-cta-label" id="dash-next-cta-label">Ver histórico</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                </button>
              </article>
              <article class="dash__card dash__card--last-service" id="dash-last-service" hidden>
                <div class="dash__card-icon" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.8 2.8-2.8-2.8 2.8-2.8z" /></svg>
                </div>
                <div class="dash__card-body">
                  <div class="dash__card-label">Último serviço</div>
                  <div class="dash__card-title" id="dash-last-title">—</div>
                  <div class="dash__card-sub" id="dash-last-sub">—</div>
                  <div class="dash__card-desc" id="dash-last-desc"></div>
                </div>
              </article>
            </section>

            <!-- A fazer agora (equipamentos) -->
            <section class="dash__section" id="dash-critical-section" hidden>
              <header class="dash__section-header">
                <span class="dash__section-label">A FAZER AGORA</span>
                <span class="dash__section-count" id="dash-critical-now-count">0</span>
              </header>
              <div id="dash-critical-now"></div>
            </section>

            <!-- Alertas ativos -->
            <section class="dash__section" id="dash-alerts-section" hidden>
              <header class="dash__section-header">
                <span class="dash__section-label">Alertas ativos</span>
              </header>
              <div id="dash-alertas-mini"></div>
              <div id="dash-upgrade-inline-hint"></div>
            </section>

            <!-- Equipamentos com ocorrência -->
            <section class="dash__section" id="dash-criticos-section" hidden>
              <header class="dash__section-header">
                <span class="dash__section-label">Equipamentos com ocorrência</span>
              </header>
              <div id="dash-criticos"></div>
            </section>

            <!-- Últimos serviços registrados -->
            <section class="dash__section" id="dash-recentes-section" hidden>
              <header class="dash__section-header">
                <span class="dash__section-label">Últimos serviços</span>
              </header>
              <div id="dash-recentes"></div>
            </section>

            <!-- Análise do parque — accordion mobile / grid desktop -->
            <section class="dash__analise" aria-label="Análise do parque">
              <header class="dash__section-header">
                <span class="dash__section-label">Análise do parque</span>
              </header>
              <div class="dash__accordion">
                <details class="dash__accordion-item">
                  <summary class="dash__accordion-summary">
                    <span class="dash__accordion-title">Status do parque</span>
                    <span class="dash__accordion-chev" aria-hidden="true"></span>
                  </summary>
                  <div class="dash__accordion-body">
                    <canvas id="chart-status-pie"></canvas>
                  </div>
                </details>
                <details class="dash__accordion-item">
                  <summary class="dash__accordion-summary">
                    <span class="dash__accordion-title">Serviços por período</span>
                    <span class="dash__accordion-chev" aria-hidden="true"></span>
                  </summary>
                  <div class="dash__accordion-body">
                    <canvas id="chart-trend-line"></canvas>
                  </div>
                </details>
                <details class="dash__accordion-item">
                  <summary class="dash__accordion-summary">
                    <span class="dash__accordion-title">Tipos de serviço</span>
                    <span class="dash__accordion-chev" aria-hidden="true"></span>
                  </summary>
                  <div class="dash__accordion-body">
                    <canvas id="chart-types-bar"></canvas>
                  </div>
                </details>
              </div>
            </section>
          </section>
        </div>

        <!-- EQUIPAMENTOS -->
        <div class="view" id="view-equipamentos">
          <div class="page-toolbar">
            <div class="section-title" id="equip-page-title">Parque de Equipamentos</div>
            <div id="equip-toolbar-actions" style="display:flex;gap:8px;align-items:center">
              <button class="btn btn--primary btn--sm" data-action="open-modal" data-id="modal-add-eq">+ Novo equipamento</button>
            </div>
          </div>
          <div class="search-bar" id="equip-search-bar">
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
              <div class="registro-bloco__label">Ações rápidas</div>
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
              <div class="registro-bloco__label">Cliente do serviço <span
                  class="registro-bloco__opcional">(opcional — aparece na capa do PDF)</span></div>
              <div class="registro-bloco__desc">Nome, documento, local e contato do cliente que recebeu o serviço. Usamos esses dados no cabeçalho do relatório e na página de assinatura.</div>
              <div class="form-group">
                <label class="form-label" for="r-cliente-nome">Nome ou razão social</label>
                <input id="r-cliente-nome" class="form-control" type="text"
                  maxlength="200" placeholder="Ex: Supermercado Boa Compra LTDA" autocomplete="organization" />
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label" for="r-cliente-documento">CPF / CNPJ</label>
                  <input id="r-cliente-documento" class="form-control" type="text"
                    maxlength="30" placeholder="00.000.000/0000-00" autocomplete="off" />
                </div>
                <div class="form-group">
                  <label class="form-label" for="r-cliente-contato">Telefone / contato</label>
                  <input id="r-cliente-contato" class="form-control" type="text"
                    maxlength="120" placeholder="(11) 9 0000-0000" autocomplete="tel" />
                </div>
              </div>
              <div class="form-group">
                <label class="form-label" for="r-local-atendimento">Local do atendimento</label>
                <input id="r-local-atendimento" class="form-control" type="text"
                  maxlength="300" placeholder="Endereço completo — rua, número, bairro, cidade/UF" autocomplete="street-address" />
                <div class="form-hint">Pode ser diferente do local cadastrado no equipamento</div>
              </div>
            </div>
            <div class="registro-bloco">
              <div class="registro-bloco__label">O serviço</div>
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
              <div class="registro-bloco__label">Materiais e custo <span
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
              <div class="registro-bloco__label">Evidências <span class="registro-bloco__opcional">(opcional — aumenta
                  credibilidade com o cliente)</span></div>
              <div class="photo-drop" id="photo-drop-zone">
                <input type="file" accept="image/*" multiple id="input-fotos" aria-label="Adicionar fotos" />
                <div class="photo-drop__icon" aria-hidden="true">📷</div>
                <div class="photo-drop__text" id="photo-drop-text">Toque para adicionar fotos</div>
                <div class="photo-drop__hint">Antes / depois, etiqueta do equipamento, peça trocada</div>
                <div class="photo-drop__limit">Até 5 fotos &middot; JPG ou PNG</div>
              </div>
              <div class="photo-grid" id="photo-preview" role="list" aria-label="Fotos adicionadas"></div>
            </div>
            <div class="registro-bloco registro-bloco--future">
              <div class="registro-bloco__label">O que vem a seguir</div>
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
              <select id="hist-setor" class="form-control hist-equip-select" aria-label="Filtrar por setor" style="display:none">
                <option value="">Todos os setores</option>
              </select>
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
          <div id="alertas-contextual"></div>
          <div id="lista-alertas" role="list"></div>
        </div>

        <!-- RELATÓRIO -->
        <div class="view" id="view-relatorio">
          <div class="page-toolbar">
            <div class="section-title">Relatório de Manutenção</div>
            <div class="page-toolbar__actions">
              <button class="btn btn--outline btn--sm" data-nav="historico">&larr; Voltar</button>
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

        <!-- PLANOS -->
        <div class="view" id="view-pricing"></div>
`;
}
