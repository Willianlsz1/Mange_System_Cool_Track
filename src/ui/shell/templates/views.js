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
                <!--
                  CTA primário. No estado normal (tem equipamento, sem alerta
                  crítico) vira "Cadastrar com foto" (IA) — feature diferenciadora.
                  Em alerta de parque, vira a ação recomendada do alerta. Em
                  empty state (sem equipamento), vira "Cadastrar meu primeiro".
                -->
                <button class="dash__hero-cta" id="dash-hero-cta" type="button" data-nav="registro">
                  <span class="dash__hero-cta-icon" aria-hidden="true" id="dash-hero-cta-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" /></svg>
                  </span>
                  <span class="dash__hero-cta-label" id="dash-hero-cta-label">Registrar manutenção</span>
                </button>
                <!--
                  CTA secundário. Só aparece no estado "normal" (tem equipamento,
                  sem alerta) como atalho pra registro de serviço. Ícone raio +
                  texto curto. Visual discreto (outline) pra não competir com o
                  primário, mas presente pra manter muscle memory do técnico que
                  vem pra registrar todo dia.
                -->
                <button class="dash__hero-cta dash__hero-cta--secondary" id="dash-hero-cta-secondary"
                  type="button" data-nav="registro" hidden>
                  <span class="dash__hero-cta-icon" aria-hidden="true">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" /></svg>
                  </span>
                  <span class="dash__hero-cta-label" id="dash-hero-cta-secondary-label">Registrar serviço</span>
                </button>
              </div>
            </article>

            <!-- Empty state (sem equipamento) -->
            <div id="dash-empty" class="dash__empty" hidden></div>

            <!--
              Onboarding + Overflow banner.
              O banner de overflow é um slot fino (só uma linha) que aparece
              quando o usuário Free ultrapassa um limite. Substitui o par
              usage-meter + upgrade-card que ficava aqui antes — esses dois
              blocos empurravam KPIs e cards pra baixo mesmo quando o usuário
              ainda estava dentro dos limites, e no Free over-limit ainda por
              cima duplicavam a mensagem "você precisa do Plus". Mantemos só
              o banner discreto + um modal one-shot acionado pelo dashboard
              no primeiro overflow.
            -->
            <div id="dash-onboarding"></div>
            <div id="dash-overflow-banner"></div>

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
          <!-- Sprite local (Lucide stroke 1.75) usado pelo hero e pelos filters. -->
          <svg class="equip-sprite" width="0" height="0" aria-hidden="true" focusable="false">
            <defs>
              <symbol id="eq-ri-layers" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/></symbol>
              <symbol id="eq-ri-inbox" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></symbol>
              <symbol id="eq-ri-alert-triangle" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></symbol>
              <symbol id="eq-ri-alert-octagon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></symbol>
              <symbol id="eq-ri-calendar-clock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h6"/><path d="M16 2v4M8 2v4M3 10h18"/><circle cx="18" cy="17" r="4"/><path d="M18 15v2l1 1"/></symbol>
              <symbol id="eq-ri-grid" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></symbol>
            </defs>
          </svg>

          <!-- Hero "Organizar parque" — visível no overview (PRO com setores ou FREE/Plus). -->
          <section class="equip-hero" id="equip-hero" aria-labelledby="equip-hero-title" hidden>
            <span class="equip-hero__orb equip-hero__orb--tl" aria-hidden="true"></span>
            <span class="equip-hero__orb equip-hero__orb--br" aria-hidden="true"></span>
            <div class="equip-hero__head">
              <h1 class="equip-hero__title" id="equip-hero-title">Organizar parque</h1>
              <p class="equip-hero__sub" id="equip-hero-sub"></p>
              <div class="equip-hero__cta" id="equip-hero-sem-setor-cta" hidden></div>
            </div>
            <div class="equip-hero__kpis" id="equip-hero-kpis" role="list"></div>
          </section>

          <!-- Quick filters: 5 pílulas (Todos · Sem setor · Em atenção · Críticos · Preventiva ≤30d). -->
          <nav class="equip-filters" id="equip-filters" aria-label="Filtrar equipamentos" hidden></nav>

          <div class="page-toolbar">
            <div class="section-title" id="equip-page-title">Parque de Equipamentos</div>
            <div id="equip-toolbar-actions" style="display:flex;gap:8px;align-items:center">
              <button class="btn btn--primary btn--sm" data-action="open-modal" data-id="modal-add-eq">+ Novo equipamento</button>
            </div>
          </div>
          <!--
            Wrapper flex que coloca search bar + toggle Lista/Grade na mesma
            linha. Antes o toggle estava DENTRO da .search-bar (que é só
            position:relative, sem flex) e quebrava pra linha solta abaixo
            do input. Agora wrapper externo controla a disposição:
              [ search input flex:1 ] [ toggle flex-shrink:0 ]
            A .search-bar mantém a UI interna do input + ícone lupa
            sem precisar de mudança estrutural.
          -->
          <div class="equip-search-row">
            <div class="search-bar" id="equip-search-bar">
              <span class="search-bar__icon" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 14 14"
                  fill="none">
                  <circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.2" />
                  <path d="M9.5 9.5L12 12" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
                </svg></span>
              <input class="form-control search-bar__input" id="equip-busca" type="text" placeholder="Buscar por nome, TAG ou local..."
                aria-label="Buscar equipamento" />
            </div>
            <div class="equip-view-toggle" role="group" aria-label="Modo de visualização">
              <button type="button" class="equip-view-toggle__btn equip-view-toggle__btn--list"
                data-action="equip-set-view-mode" data-mode="list"
                aria-pressed="true" aria-label="Modo lista" title="Lista">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <line x1="3" y1="6" x2="21" y2="6"/>
                  <line x1="3" y1="12" x2="21" y2="12"/>
                  <line x1="3" y1="18" x2="21" y2="18"/>
                </svg>
              </button>
              <button type="button" class="equip-view-toggle__btn equip-view-toggle__btn--grid"
                data-action="equip-set-view-mode" data-mode="grid"
                aria-pressed="false" aria-label="Modo grade com foto grande" title="Grade">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <rect x="3" y="3" width="7" height="7"/>
                  <rect x="14" y="3" width="7" height="7"/>
                  <rect x="14" y="14" width="7" height="7"/>
                  <rect x="3" y="14" width="7" height="7"/>
                </svg>
              </button>
            </div>
          </div>
          <div id="lista-equip" role="list"></div>
        </div>

        <!-- REGISTRO -->
        <div class="view" id="view-registro">
          <!-- Icon sprite (lucide-style, stroke 1.75) — usado só pelas novas classes registro-* -->
          <svg class="registro-sprite" width="0" height="0" aria-hidden="true" focusable="false">
            <defs>
              <symbol id="ri-clipboard" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 12h6M9 16h4"/></symbol>
              <symbol id="ri-sparkles" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z"/></symbol>
              <symbol id="ri-bolt" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/></symbol>
              <symbol id="ri-filter" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h18l-7 9v6l-4 2v-8L3 4z"/></symbol>
              <symbol id="ri-eye" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></symbol>
              <symbol id="ri-wrench" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a4 4 0 0 0-5 5L3 18l3 3 6.7-6.7a4 4 0 0 0 5-5l-3 1.5-2-2 1.5-3z"/></symbol>
              <symbol id="ri-plus" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></symbol>
              <symbol id="ri-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l5 5L20 6"/></symbol>
              <symbol id="ri-check-circle" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></symbol>
              <symbol id="ri-user" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></symbol>
              <symbol id="ri-package" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7l9-4 9 4v10l-9 4-9-4V7z"/><path d="M3 7l9 4 9-4M12 11v10"/></symbol>
              <symbol id="ri-camera" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h3l2-2h6l2 2h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="4"/></symbol>
              <symbol id="ri-calendar" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></symbol>
              <symbol id="ri-map-pin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s7-7 7-13a7 7 0 0 0-14 0c0 6 7 13 7 13z"/><circle cx="12" cy="9" r="2.5"/></symbol>
              <symbol id="ri-signal" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20h2M7 15h2M12 10h2M17 5h2"/><path d="M4 20v0M9 15v5M14 10v10M19 5v15"/></symbol>
              <symbol id="ri-pen" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4l6 6-11 11H3v-6L14 4z"/></symbol>
              <symbol id="ri-save" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3h11l4 4v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M8 3v5h8V3M8 21v-7h8v7"/></symbol>
              <symbol id="ri-rewind" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></symbol>
              <symbol id="ri-info" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v5h1"/></symbol>
            </defs>
          </svg>
          <div class="section-title section-title--registro" hidden>Registrar serviço</div>
          <div class="card card--registro">
            <div id="storage-indicator" class="storage-indicator" role="status" aria-live="polite" hidden></div>

            <!-- HERO V2 (UX audit): compactado pra 1 linha — pill com label
                 dinamico ("Novo registro" / "Editando registro") + meter
                 visual de progresso (5 segments) + contador X/5. Sem orbs,
                 sem titulo decorativo, sem chips redundantes. Reduz altura
                 vertical em ~120px no mobile. -->
            <section class="registro-hero registro-hero--compact" id="registro-hero" data-state="empty" aria-labelledby="registro-hero-pill-text">
              <span class="registro-hero__pill">
                <svg aria-hidden="true"><use href="#ri-clipboard"/></svg>
                <span id="registro-hero-pill-text">Novo registro</span>
              </span>
              <div class="registro-hero__progress" aria-label="Progresso dos campos obrigatorios">
                <div class="registro-hero__meter" id="registro-hero-meter" role="progressbar" aria-valuemin="0" aria-valuemax="5" aria-valuenow="0">
                  <span class="registro-hero__seg"></span>
                  <span class="registro-hero__seg"></span>
                  <span class="registro-hero__seg"></span>
                  <span class="registro-hero__seg"></span>
                  <span class="registro-hero__seg"></span>
                </div>
                <div class="registro-hero__count"><b id="form-progress-count">0</b>/5</div>
              </div>
              <!-- Sub mantido pra exibir status dinamico (ex: "Equipamento selecionado") -->
              <p class="registro-hero__sub" id="registro-hero-sub" hidden></p>
            </section>

            <!-- UX V2 audit fix #82: foto promovida a açao rapida acima do form.
                 Tecnico em campo costuma fotografar PRIMEIRO (etiqueta, antes/
                 depois) e preencher dados depois. Atalho rapido que abre a
                 camera direto (capture="environment"); preview aparece embaixo
                 no <details class="registro-details"> normal. Usa o MESMO
                 input-fotos-camera que ja existe (sem duplicar state). -->
            <div class="registro-kicker">Comece pela foto</div>
            <label class="registro-photo-quick" for="input-fotos-camera">
              <span class="registro-photo-quick__icon" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M4 7h3l2-2h6l2 2h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z"/>
                  <circle cx="12" cy="13" r="3"/>
                </svg>
              </span>
              <span class="registro-photo-quick__body">
                <span class="registro-photo-quick__title">Tirar foto da etiqueta agora</span>
                <span class="registro-photo-quick__hint">abre a camera direto · até 5 fotos por serviço</span>
              </span>
              <span class="registro-photo-quick__chevron" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              </span>
            </label>

            <!-- ============== Ações rápidas ============== -->
            <div class="registro-kicker">Ações rápidas</div>
            <div class="registro-quick" role="group" aria-label="Modelos rápidos de serviço">
              <button type="button" class="registro-quick__tile" data-action="quick-service-template"
                data-template="limpeza" data-color="cyan" aria-pressed="false">
                <span class="registro-quick__icon" aria-hidden="true"><svg><use href="#ri-sparkles"/></svg></span>
                <span class="registro-quick__label">Limpeza<small>preventiva</small></span>
              </button>
              <button type="button" class="registro-quick__tile" data-action="quick-service-template"
                data-template="recarga_gas" data-color="amber" aria-pressed="false">
                <span class="registro-quick__icon" aria-hidden="true"><svg><use href="#ri-bolt"/></svg></span>
                <span class="registro-quick__label">Recarga<small>de gás</small></span>
              </button>
              <button type="button" class="registro-quick__tile" data-action="quick-service-template"
                data-template="troca_filtro" data-color="teal" aria-pressed="false">
                <span class="registro-quick__icon" aria-hidden="true"><svg><use href="#ri-filter"/></svg></span>
                <span class="registro-quick__label">Troca<small>de filtro</small></span>
              </button>
              <button type="button" class="registro-quick__tile" data-action="quick-service-template"
                data-template="inspecao" data-color="violet" aria-pressed="false">
                <span class="registro-quick__icon" aria-hidden="true"><svg><use href="#ri-eye"/></svg></span>
                <span class="registro-quick__label">Inspeção<small>técnica</small></span>
              </button>
              <button type="button" class="registro-quick__tile" data-action="quick-service-template"
                data-template="manutencao_corretiva" data-color="red" aria-pressed="false">
                <span class="registro-quick__icon" aria-hidden="true"><svg><use href="#ri-wrench"/></svg></span>
                <span class="registro-quick__label">Manutenção<small>corretiva</small></span>
              </button>
            </div>

            <!-- ============== Bloco obrigatório ============== -->
            <div class="registro-kicker">O serviço</div>
            <section class="registro-bloco registro-bloco--required">
              <div class="registro-bloco__header">
                <h2 class="registro-bloco__title">Dados do atendimento</h2>
                <span class="registro-bloco__required-tag"><svg aria-hidden="true"><use href="#ri-check"/></svg> Obrigatório</span>
              </div>
              <p class="registro-bloco__hint">Preencha os 5 campos para liberar o PDF do cliente.</p>

              <!-- Equipamento: trigger card + custom picker com SEARCH (UX V2 audit fix).
                   Resolve o gargalo de tecnico com 50+ equips rolando lista nativa.
                   Hidden &lt;select&gt; preserva state pra saveRegistro ler como antes. -->
              <div class="registro-field registro-field--equip-picker">
                <label class="registro-field__label" for="r-equip-trigger">Em qual equipamento?<span class="req">*</span></label>
                <button type="button" class="registro-equip-trigger" id="r-equip-trigger"
                  data-r-action="open-equip-picker" aria-haspopup="dialog" aria-expanded="false">
                  <span class="registro-equip-trigger__icon" aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                      <path d="m14.6 6.3 3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 0 3 3l6.91-6.91a6 6 0 0 0 7.94-7.94l-3.77 3.77-3-3Z"/>
                    </svg>
                  </span>
                  <span class="registro-equip-trigger__body">
                    <span class="registro-equip-trigger__name" id="r-equip-name">Selecione o equipamento...</span>
                    <span class="registro-equip-trigger__meta" id="r-equip-meta" hidden></span>
                  </span>
                  <svg class="registro-equip-trigger__chev" width="16" height="16" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                    stroke-linejoin="round" aria-hidden="true">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>
                <select id="r-equip" class="registro-field__select registro-field__select--hidden"
                  required aria-required="true" aria-hidden="true" tabindex="-1">
                  <option value="">Selecione o equipamento...</option>
                </select>
              </div>

              <div class="registro-field__row">
                <div class="registro-field">
                  <label class="registro-field__label" for="r-data">Quando foi?<span class="req">*</span></label>
                  <!-- UX V2: default "Hoje agora" + chip pra abrir o picker.
                       Reduz friccao em ~90% dos casos onde o tecnico registra
                       no momento que terminou o servico. JS popula r-data com
                       new Date().toISOString().slice(0,16) no init. -->
                  <div class="registro-field__datetime" id="registro-datetime-wrap">
                    <button type="button" class="registro-field__datetime-now"
                      id="r-data-now-btn" aria-pressed="true"
                      title="Usa a data e hora deste momento">
                      <svg aria-hidden="true"><use href="#ri-calendar"/></svg>
                      <span id="r-data-now-label">Hoje agora</span>
                    </button>
                    <button type="button" class="registro-field__datetime-edit"
                      id="r-data-edit-btn" title="Mudar data e hora">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M14 4l6 6-11 11H3v-6L14 4z"/>
                      </svg>
                      <span>Mudar</span>
                    </button>
                    <input id="r-data" class="registro-field__input registro-field__input--datetime-hidden"
                      type="datetime-local" required aria-required="true"
                      aria-label="Data e hora do servico" />
                  </div>
                </div>
                <div class="registro-field registro-field--select">
                  <label class="registro-field__label" for="r-tipo">O que foi feito?<span class="req">*</span></label>
                  <select id="r-tipo" class="registro-field__select" required aria-required="true">
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

              <!-- Campo custom aparece só quando tipo = "Outro". Controlado via JS
                   em registro.js (_bindTipoCustomToggle). Limite 40 chars: entra
                   compacto no PDF / histórico / relatório como "Outro · {custom}". -->
              <div class="registro-field registro-field--tipo-custom" id="r-tipo-custom-wrap" hidden>
                <label class="registro-field__label" for="r-tipo-custom">Qual serviço?<span class="req">*</span></label>
                <input id="r-tipo-custom" class="registro-field__input" type="text"
                  maxlength="40" autocomplete="off"
                  placeholder="Ex: Teste de estanqueidade, alinhamento de ventilador..." />
                <p class="registro-field__help">Descreva em poucas palavras (até 40 caracteres).</p>
              </div>

              <div class="registro-field">
                <label class="registro-field__label" for="r-obs">Detalhes pro cliente</label>
                <textarea id="r-obs" class="registro-field__textarea registro-obs"
                  placeholder="Ex.: limpei filtros e verifiquei pressão de sucção — tudo ok."
                  ></textarea>
                <p class="registro-field__help">Em poucas palavras. Esse texto vai no relatório que você envia ao cliente.</p>
              </div>

              <div class="registro-field">
                <label class="registro-field__label" for="r-tecnico">Quem fez?<span class="req">*</span></label>
                <div class="registro-field__with-icon">
                  <svg aria-hidden="true"><use href="#ri-user"/></svg>
                  <input id="r-tecnico" class="registro-field__input" list="lista-técnicos" type="text"
                    placeholder="Seu nome ou o nome do técnico..." autocomplete="off" required aria-required="true" />
                  <datalist id="lista-tecnicos"></datalist>
                </div>
              </div>
            </section>

            <!-- ============== Blocos opcionais ============== -->
            <div class="registro-kicker">Detalhes opcionais</div>

            <details class="registro-details">
              <summary class="registro-details__summary">
                <span class="registro-details__icon" aria-hidden="true"><svg><use href="#ri-user"/></svg></span>
                <div class="registro-details__titles">
                  <div class="registro-details__title">Cliente do serviço</div>
                  <div class="registro-details__subtitle">opcional — aparece na capa do PDF</div>
                </div>
                <span class="registro-details__add" aria-hidden="true"><svg><use href="#ri-plus"/></svg><span class="registro-details__add-label"> Adicionar</span></span>
              </summary>
              <div class="registro-details__body">
                <div class="registro-field">
                  <label class="registro-field__label" for="r-cliente-nome">Nome ou razão social</label>
                  <input id="r-cliente-nome" class="registro-field__input" type="text"
                    maxlength="200" placeholder="Ex: Supermercado Boa Compra LTDA" autocomplete="organization" />
                </div>
                <div class="registro-field__row">
                  <div class="registro-field">
                    <label class="registro-field__label" for="r-cliente-documento">CPF / CNPJ</label>
                    <input id="r-cliente-documento" class="registro-field__input" type="text"
                      maxlength="30" placeholder="00.000.000/0000-00" autocomplete="off" />
                  </div>
                  <div class="registro-field">
                    <label class="registro-field__label" for="r-cliente-contato">Telefone / contato</label>
                    <input id="r-cliente-contato" class="registro-field__input" type="text"
                      maxlength="120" placeholder="(11) 9 0000-0000" autocomplete="tel" />
                  </div>
                </div>
                <div class="registro-field">
                  <label class="registro-field__label" for="r-local-atendimento">Local do atendimento</label>
                  <div class="registro-field__with-icon">
                    <svg aria-hidden="true"><use href="#ri-map-pin"/></svg>
                    <input id="r-local-atendimento" class="registro-field__input" type="text"
                      maxlength="300" placeholder="Endereço completo — rua, número, bairro, cidade/UF" autocomplete="street-address" />
                  </div>
                  <p class="registro-field__help">Pode ser diferente do local cadastrado no equipamento.</p>
                </div>
              </div>
            </details>

            <details class="registro-details">
              <summary class="registro-details__summary">
                <span class="registro-details__icon" aria-hidden="true"><svg><use href="#ri-package"/></svg></span>
                <div class="registro-details__titles">
                  <div class="registro-details__title">Materiais e custo</div>
                  <div class="registro-details__subtitle">opcional — entra no relatório</div>
                </div>
                <span class="registro-details__add" aria-hidden="true"><svg><use href="#ri-plus"/></svg><span class="registro-details__add-label"> Adicionar</span></span>
              </summary>
              <div class="registro-details__body">
                <div class="registro-field">
                  <label class="registro-field__label" for="r-pecas">Peças e materiais usados</label>
                  <input id="r-pecas" class="registro-field__input" type="text"
                    placeholder="Ex: Filtro G4, R-410A 1 kg, Capacitor 30µF 440V" />
                  <p class="registro-field__help">Liste o que foi substituído ou consumido.</p>
                </div>
                <div class="registro-field__row">
                  <div class="registro-field">
                    <label class="registro-field__label" for="r-custo-pecas">Custo das peças</label>
                    <div class="registro-field__money">
                      <input id="r-custo-pecas" class="registro-field__input" type="number" min="0" step="0.01" placeholder="0,00" />
                    </div>
                  </div>
                  <div class="registro-field">
                    <label class="registro-field__label" for="r-custo-mao-obra">Mão de obra</label>
                    <div class="registro-field__money">
                      <input id="r-custo-mao-obra" class="registro-field__input" type="number" min="0" step="0.01" placeholder="0,00" />
                    </div>
                  </div>
                </div>
              </div>
            </details>

            <details class="registro-details">
              <summary class="registro-details__summary">
                <span class="registro-details__icon" aria-hidden="true"><svg><use href="#ri-camera"/></svg></span>
                <div class="registro-details__titles">
                  <div class="registro-details__title">Evidências</div>
                  <div class="registro-details__subtitle">opcional — aumenta a credibilidade</div>
                </div>
                <span class="registro-details__add" aria-hidden="true"><svg><use href="#ri-plus"/></svg><span class="registro-details__add-label"> Adicionar</span></span>
              </summary>
              <div class="registro-details__body">
                <label id="photo-drop-zone" class="registro-photo-drop" for="input-fotos">
                  <span class="registro-photo-drop__icon" aria-hidden="true"><svg><use href="#ri-camera"/></svg></span>
                  <div class="registro-photo-drop__title" id="photo-drop-text">Toque para adicionar fotos</div>
                  <p class="registro-photo-drop__hint">Antes / depois, etiqueta do equipamento, peça trocada</p>
                  <div class="registro-photo-drop__meta">ATÉ 5 FOTOS · JPG OU PNG</div>
                  <input type="file" accept="image/*" multiple id="input-fotos" aria-label="Adicionar fotos" />
                </label>

                <!-- Atalho "Tirar foto agora" — só aparece em mobile (CSS esconde
                     em desktop via hover:hover). capture="environment" abre a
                     câmera direto, sem passar pelo picker de galeria. -->
                <label class="equip-photo-shortcut" for="input-fotos-camera">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M4 7h3l2-2h6l2 2h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z"
                      stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" />
                    <circle cx="12" cy="13" r="3" stroke="currentColor" stroke-width="1.6" />
                  </svg>
                  Tirar foto agora
                </label>
                <input type="file" accept="image/*" capture="environment" id="input-fotos-camera"
                  class="visually-hidden" aria-label="Tirar foto com a câmera" />

                <div class="photo-grid" id="photo-preview" role="list" aria-label="Fotos adicionadas"></div>
              </div>
            </details>

            <details class="registro-details registro-details--next">
              <summary class="registro-details__summary">
                <span class="registro-details__icon" aria-hidden="true"><svg><use href="#ri-signal"/></svg></span>
                <div class="registro-details__titles">
                  <div class="registro-details__title">O que vem a seguir <span class="registro-details__pri">Recomendado</span></div>
                  <div class="registro-details__subtitle">prioridade, status e próxima preventiva</div>
                </div>
                <span class="registro-details__add" aria-hidden="true"><svg><use href="#ri-plus"/></svg><span class="registro-details__add-label"> Adicionar</span></span>
              </summary>
              <div class="registro-details__body">
                <p class="registro-bloco__hint">Como o equipamento saiu do serviço? Quando deve voltar?</p>
                <div class="registro-field__row">
                  <div class="registro-field registro-field--select">
                    <label class="registro-field__label" for="r-prioridade">Prioridade sugerida</label>
                    <select id="r-prioridade" class="registro-field__select">
                      <option value="baixa">Baixa</option>
                      <option value="media" selected>Média</option>
                      <option value="alta">Alta</option>
                    </select>
                  </div>
                  <div class="registro-field registro-field--select">
                    <label class="registro-field__label" for="r-status">Como ficou?</label>
                    <select id="r-status" class="registro-field__select">
                      <option value="ok">Operando normalmente</option>
                      <option value="warn">Requer atenção em breve</option>
                      <option value="danger">Fora de operação</option>
                    </select>
                  </div>
                </div>
                <div class="registro-field">
                  <label class="registro-field__label" for="r-proxima">Quando retornar para preventiva?</label>
                  <div class="registro-field__with-icon">
                    <svg aria-hidden="true"><use href="#ri-calendar"/></svg>
                    <input id="r-proxima" class="registro-field__input" type="date" />
                  </div>
                  <p class="registro-field__help">Deixe em branco se não souber agora.</p>
                </div>
              </div>
            </details>

            <!--
              PMOC Fase 3: Checklist NBR 13971 (recomendado em preventiva).
              O body é renderizado dinamicamente por registro.js#renderChecklist
              baseado no tipo do equipamento selecionado. Quando o tipo de
              serviço NÃO é preventiva, o accordion fica colapsado e discreto;
              quando É preventiva, ganha um pill 'Recomendado para PMOC' em
              destaque.
            -->
            <details class="registro-details registro-details--checklist" id="r-checklist-details" hidden>
              <summary class="registro-details__summary">
                <span class="registro-details__icon" aria-hidden="true">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M9 11l3 3L22 4"/>
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                  </svg>
                </span>
                <div class="registro-details__titles">
                  <div class="registro-details__title">
                    Checklist NBR 13971
                    <span class="registro-details__pri" id="r-checklist-pri" hidden>Recomendado p/ PMOC</span>
                  </div>
                  <div class="registro-details__subtitle" id="r-checklist-summary">selecione o equipamento primeiro</div>
                </div>
                <span class="registro-details__add" aria-hidden="true">
                  <svg><use href="#ri-plus"/></svg>
                  <span class="registro-details__add-label"> Preencher</span>
                </span>
              </summary>
              <div class="registro-details__body">
                <div id="r-checklist-body" class="r-checklist__body" aria-live="polite"></div>
              </div>
            </details>

            <!-- UX V2 audit fix #90: assinatura do cliente movida pra ANTES
                 do rodape de acao. Antes ficava DEPOIS do botao Salvar — usuario
                 ja achava que tinha terminado. Agora ele ve "Assinatura: Incluso"
                 antes de tocar em Salvar e enviar. -->
            <div class="registro-sig-hint" id="registro-signature-hint" hidden>
              <span class="registro-sig-hint__ic" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 19l7-7 3 3-7 7-3-3z"/>
                  <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
                  <path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/>
                </svg>
              </span>
              <div class="registro-sig-hint__body">
                <div class="registro-sig-hint__head">
                  <strong class="registro-sig-hint__title">Assinatura do cliente</strong>
                  <span class="registro-sig-hint__badge">Incluso</span>
                </div>
                <p class="registro-sig-hint__desc">
                  Ao salvar, solicitamos a rubrica do cliente —
                  fica anexada ao registro e aparece no PDF oficial do serviço.
                </p>
              </div>
            </div>

            <!-- ============== Rodapé de ação V2 (UX audit #80) ============== -->
            <!-- Hierarquia: 1 botao primario verde "Salvar e enviar pro cliente"
                 que faz save + abre WhatsApp em 1 clique. Save-only fica como
                 acao secundaria (link inline). Recomeçar é ghost. -->
            <div class="registro-actions registro-actions--v2" id="tour-signature-anchor">
              <button class="btn btn--ghost registro-actions__ghost" data-action="clear-registro"
                title="Limpa todos os campos">
                <svg aria-hidden="true"><use href="#ri-rewind"/></svg>
                <span>Recomeçar</span>
              </button>
              <div class="registro-actions__main">
                <button class="btn btn--primary btn--whats registro-actions__primary"
                  data-action="save-and-share-registro"
                  title="Salva o serviço e ja abre o WhatsApp pro cliente">
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.768.967-.94 1.164-.173.198-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.002-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  <span>Salvar e enviar pro cliente</span>
                </button>
                <button class="btn btn--ghost registro-actions__save-only" data-action="save-registro"
                  title="Só salva (sem enviar)">
                  <svg aria-hidden="true"><use href="#ri-save"/></svg>
                  <span>Só salvar</span>
                </button>
              </div>
            </div>
            <p class="registro-field__help" style="margin:8px 0 0">Ao tocar em <strong>Salvar e enviar</strong>, o PDF é gerado e o WhatsApp abre direto pro cliente.</p>
          </div>
        </div>

        <!-- HISTÓRICO -->
        <div class="view" id="view-historico">
          <div class="servicos-toggle" role="tablist" aria-label="Modo de visualização">
            <button type="button" class="servicos-toggle__btn servicos-toggle__btn--lista"
              data-nav="historico" role="tab" aria-label="Lista de serviços">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
                <line x1="8" y1="18" x2="21" y2="18"/>
                <circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/>
              </svg>
              <span>Lista</span>
            </button>
            <button type="button" class="servicos-toggle__btn servicos-toggle__btn--relatorio"
              data-nav="relatorio" role="tab" aria-label="Relatório com KPIs e PDF">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M3 3v18h18"/><path d="M7 14l4-4 4 4 5-5"/>
              </svg>
              <span>Relatório</span>
            </button>
          </div>
          <div class="hist-sticky-header" id="hist-sticky-header">
            <div class="hist-sticky-header__row">
              <div class="hist-title">Histórico de Serviços</div>
              <span class="hist-count" id="hist-count" aria-live="polite"></span>
              <div class="hist-sticky-header__spacer"></div>
<!-- Botão "Relatório" removido — o toggle [Lista | Relatório] no topo
                   da view já faz a navegação pra view de Relatório, então o botão
                   no header virou redundante. -->
            </div>
            <div class="hist-sticky-header__row">
              <div class="hist-search-row">
                <label class="hist-input" for="hist-busca">
                  <span class="hist-input__icon" aria-hidden="true">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>
                    </svg>
                  </span>
                  <input id="hist-busca" type="search"
                    placeholder="Buscar equipamento, tipo, técnico…" aria-label="Buscar no histórico" />
                </label>
                <button type="button" class="hist-filters-trigger" id="hist-filters-trigger"
                  data-hist-action="open-filters-sheet"
                  aria-label="Abrir filtros avancados">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <line x1="4" y1="6" x2="20" y2="6"/>
                    <line x1="7" y1="12" x2="17" y2="12"/>
                    <line x1="10" y1="18" x2="14" y2="18"/>
                  </svg>
                  Filtros
                  <span class="hist-filters-trigger__count" id="hist-filters-count" hidden>0</span>
                </button>
                <div class="hist-select">
                  <select id="hist-setor" aria-label="Filtrar por setor" style="display:none">
                    <option value="">Todos os setores</option>
                  </select>
                </div>
                <div class="hist-select">
                  <select id="hist-equip" aria-label="Filtrar por equipamento">
                    <option value="">Todos os equipamentos</option>
                  </select>
                </div>
              </div>
            </div>
            <div class="hist-sticky-header__row hist-sticky-header__row--quickfilters"
              id="hist-quickfilters-slot">
              <!-- preenchido por renderHist com .hist-quickfilters -->
            </div>
          </div>
          <div id="hist-active-chips-slot"><!-- preenchido por renderHist --></div>
          <div class="hist-chrono-label" id="hist-chrono-label">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>
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

        <!-- CLIENTES (full redesign abr/2026: KPIs + alert + filtros + cards + paginacao).
             Conteudo todo construido por renderClientes() em ui/views/clientes.js. -->
        <div class="view" id="view-clientes">
          <div id="clientes-root"></div>
        </div>

        <!-- RELATÓRIO -->
        <div class="view" id="view-relatorio">
          <div class="servicos-toggle" role="tablist" aria-label="Modo de visualização">
            <button type="button" class="servicos-toggle__btn servicos-toggle__btn--lista"
              data-nav="historico" role="tab" aria-label="Lista de serviços">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
                <line x1="8" y1="18" x2="21" y2="18"/>
                <circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/>
              </svg>
              <span>Lista</span>
            </button>
            <button type="button" class="servicos-toggle__btn servicos-toggle__btn--relatorio"
              data-nav="relatorio" role="tab" aria-label="Relatório com KPIs e PDF">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M3 3v18h18"/><path d="M7 14l4-4 4 4 5-5"/>
              </svg>
              <span>Relatório</span>
            </button>
          </div>
          <!--
            Toolbar V2 (audit UX): WhatsApp como acao PRIMARIA (botao verde
            grande, ponto que tecnico em campo precisa). PDF secundario
            (outline cyan). Acoes raras (PMOC, Sobre) ficam dentro do "+ mais"
            kebab no canto. Reduz cliques pra acao mais comum de 5 -> 2.
          -->
          <div class="rel-toolbar">
            <div class="rel-toolbar__actions rel-toolbar__actions--v2">
              <button class="rel-toolbar__btn rel-toolbar__btn--whatsapp"
                id="btn-whatsapp" data-action="whatsapp-export" type="button"
                title="Gera o PDF e abre o compartilhamento via WhatsApp">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347"/>
                </svg>
                <span>Enviar pro cliente</span>
              </button>
              <button class="rel-toolbar__btn rel-toolbar__btn--pdf"
                id="btn-export-pdf" data-action="export-pdf" type="button"
                title="Gera e baixa o PDF do relatório">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M12 4v12"/><path d="M7 11l5 5 5-5"/><path d="M4 20h16"/>
                </svg>
                <span>Baixar PDF</span>
              </button>
              <div class="rel-toolbar__more rel-export-dd" id="rel-export-dd">
                <button class="rel-toolbar__btn rel-toolbar__btn--icon rel-export-dd__main"
                  id="btn-export-dd-toggle" data-action="toggle-export-dd" type="button"
                  aria-haspopup="menu" aria-expanded="false" aria-controls="rel-export-dd-menu"
                  aria-label="Mais opções" title="Mais opções">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/>
                  </svg>
                </button>
                <div class="rel-export-dd__menu" id="rel-export-dd-menu" role="menu" hidden>
                  <button type="button" class="rel-export-dd__item rel-export-dd__item--pmoc rel-export-dd__item--featured"
                    role="menuitem" data-action="open-pmoc-modal" data-tier="unknown"
                    title="Documento PMOC formal anual conforme NBR 13971 — Pro.">
                    <span class="rel-export-dd__item-icon" aria-hidden="true">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                      <line x1="9" y1="15" x2="15" y2="15"/>
                      <line x1="9" y1="11" x2="15" y2="11"/>
                    </svg>
                    </span>
                    <div class="rel-export-dd__item-text">
                      <strong>Gerar PMOC formal <span class="pro-badge pro-badge--inline" aria-hidden="true">PRO</span></strong>
                      <span>Documento anual conforme NBR 13971 — capa institucional, cronograma 12 meses e termo de RT</span>
                    </div>
                    <span class="rel-export-dd__item-arrow" aria-hidden="true">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M9 6l6 6-6 6"/>
                      </svg>
                    </span>
                  </button>
                  <button type="button" class="rel-export-dd__item rel-export-dd__item--meta"
                    role="menuitem" data-action="open-pmoc-info" title="Saiba quando usar cada um.">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  
                      stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v5h1"/>
                    </svg>
                    <span>Sobre o PMOC</span>
                  </button>
                </div>
              </div>
              <div id="pdf-quota-slot" class="rel-toolbar__quota-slot"></div>
            </div>
          </div>

          <h1 class="rel-title">Relatório de Manutenção</h1>

          <div id="rel-hero" class="rel-hero" aria-live="polite"></div>

          <div id="rel-filters" class="rel-filters" role="group" aria-label="Filtros do relatório">
            <div id="rel-filters-chips" class="rel-filters__chips"></div>
            <div id="rel-filters-advanced" class="rel-filters__advanced" hidden>
              <div class="rel-filters__advanced-grid">
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
            </div>
          </div>

          <div id="relatorio-corpo" class="rel-records"></div>
        </div>

        <!-- PLANOS -->
        <div class="view" id="view-pricing"></div>

        <!-- CONTA (full-page Minha Conta) -->
        <div class="view" id="view-conta"></div>

        <!-- PRIVACIDADE (Politica LGPD) -->
        <div class="view" id="view-privacidade"></div>

        <!-- V3: ORÇAMENTOS DE INSTALAÇÃO -->
        <div class="view" id="view-orcamentos"></div>
`;
}
