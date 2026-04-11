export function renderShellHeader() {
  return String.raw`
<!-- HEADER -->
    <header class="app-header">
      <div class="app-header__top">
        <div class="app-logo">
          <div class="app-logo__icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="1" width="14" height="14" rx="2" stroke="#00C8E8" stroke-width="1.2" />
              <circle cx="8" cy="8" r="2.5" stroke="#00C8E8" stroke-width="1.2" />
              <path d="M8 1v2.5M8 12.5V15M1 8h2.5M12.5 8H15" stroke="#00C8E8" stroke-width="1.2"
                stroke-linecap="round" />
            </svg>
          </div>
          CoolTrack <span class="app-logo__sub">PRO</span>
        </div>

        <div class="app-header__tagline">Gestão de manutenção para técnicos de climatização</div>

        <div class="app-header__actions">
          <div class="app-header__status">
            <div class="status-indicator" id="status-sistema">
              <span class="status-indicator__dot status-indicator__dot--ok"></span>
              <span>Sistema operacional</span>
            </div>
            <div class="status-indicator" id="status-falhas" hidden>
              <span class="status-indicator__dot status-indicator__dot--danger"></span>
              <span id="status-falhas-txt">0 anomalias críticas</span>
            </div>
            <div class="status-indicator" id="sync-status" hidden>
              <span class="status-indicator__dot status-indicator__dot--warn"></span>
              <span id="sync-status-txt">Sincronização pendente</span>
            </div>
          </div>
          <div class="app-header__date" id="hdr-date"></div>
          <div class="header-help">
            <button
              class="header-icon-btn"
              id="header-help-btn"
              data-action="toggle-help-menu"
              aria-label="Ajuda"
              title="Ajuda"
              aria-expanded="false"
              aria-controls="header-help-menu"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.2" />
                <path
                  d="M6.8 6.1a1.7 1.7 0 1 1 2.3 1.6c-.6.3-.9.7-.9 1.3"
                  stroke="currentColor"
                  stroke-width="1.2"
                  stroke-linecap="round"
                />
                <circle cx="8" cy="11.7" r=".7" fill="currentColor" />
              </svg>
            </button>
            <div class="header-help-menu" id="header-help-menu" hidden>
              <button type="button" class="header-help-menu__item" data-action="help-open-tutorial">
                Ver tutorial
              </button>
              <button type="button" class="header-help-menu__item" data-action="help-score-info">
                Como funciona o score
              </button>
              <button type="button" class="header-help-menu__item" data-action="help-support">
                Suporte
              </button>
            </div>
          </div>

          <button
            class="header-icon-btn header-alert-btn"
            data-action="go-alertas"
            aria-label="Abrir alertas"
            title="Alertas"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M8 2.2a3.4 3.4 0 0 0-3.4 3.4v1.2c0 .8-.2 1.6-.6 2.3l-.4.9h8.8l-.4-.9c-.4-.7-.6-1.5-.6-2.3V5.6A3.4 3.4 0 0 0 8 2.2Z"
                stroke="currentColor"
                stroke-width="1.2"
                stroke-linejoin="round"
              />
              <path d="M6.4 11.8a1.6 1.6 0 0 0 3.2 0" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
            </svg>
            <span class="header-alert-pill" id="header-alert-pill" hidden>0</span>
            <span class="header-alert-tooltip" id="header-alert-tooltip" role="tooltip" hidden></span>
          </button>

          <button class="header-icon-btn" data-action="open-profile" aria-label="Meu perfil"
            title="Meu perfil — pré-preenche seu nome nos registros">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="5.5" r="3" stroke="currentColor" stroke-width="1.2" />
              <path d="M2 14c0-3.3 2.7-5 6-5s6 1.7 6 5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
            </svg>

          </button>
          <button class="theme-toggle" id="theme-toggle" type="button" aria-label="Alternar tema" hidden>
            <span class="theme-toggle__icon" id="theme-icon">🌙</span>
          </button>
        </div>
      </div>

        <div class="header-stats-bar">
          <div class="header-stats-bar__inner" id="stats-bar-inner">
            <div class="stat-pill">
              <div class="stat-pill__value" id="hst-total">—</div>
              <div class="stat-pill__label">EQUIPAMENTOS ATIVOS</div>
            </div>
            <div class="stat-pill">
              <div class="stat-pill__value" id="hst-mes">—</div>
              <div class="stat-pill__label">SERVIÇOS ESTE MÊS</div>
            </div>
            <div class="stat-pill">
              <div class="stat-pill__value stat-pill__value--danger" id="hst-alert">—</div>
              <div class="stat-pill__label">ALERTAS CRÍTICOS</div>
            </div>
          </div>
        </div>
      </header>
`;
}
