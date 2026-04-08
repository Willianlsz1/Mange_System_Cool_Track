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
            <div class="status-indicator" id="status-falhas" style="display:none">
              <span class="status-indicator__dot status-indicator__dot--danger"></span>
              <span id="status-falhas-txt">0 falhas</span>
            </div>
            <div class="status-indicator" id="sync-status" style="display:none">
              <span class="status-indicator__dot status-indicator__dot--warn"></span>
              <span id="sync-status-txt">Sincronização pendente</span>
            </div>
          </div>
          <div class="app-header__date" id="hdr-date"></div>

        <button class="header-icon-btn" data-action="open-profile" aria-label="Meu perfil"
          title="Meu perfil — pré-preenche seu nome nos registros">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="5.5" r="3" stroke="currentColor" stroke-width="1.2" />
            <path d="M2 14c0-3.3 2.7-5 6-5s6 1.7 6 5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
          </svg>

        </button>
        <button class="theme-toggle" id="theme-toggle" type="button" aria-label="Alternar tema" style="display:none">
          <span class="theme-toggle__icon" id="theme-icon">🌙</span>
        </button>

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
              <div class="stat-pill__value" id="hst-alert" style="color:var(--danger)">—</div>
              <div class="stat-pill__label">ALERTAS CRÍTICOS</div>
            </div>
          </div>
        </div>
    </header>
`;
}
