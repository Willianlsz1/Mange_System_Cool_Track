export function renderShellNav() {
  return String.raw`
<!-- NAV -->
      <nav class="app-nav" aria-label="Navegação principal">
        <button class="nav-btn is-active" id="nav-inicio" data-nav="inicio" aria-label="Painel">
          <span class="nav-btn__icon" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
              <path d="M9 22V12h6v10" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
            </svg>
          </span>
          Painel
        </button>
        <button class="nav-btn" id="nav-equipamentos" data-nav="equipamentos" aria-label="Equipamentos">
          <span class="nav-btn__icon" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </span>
          Equip.
        </button>
        <button class="nav-btn" id="nav-registro" data-nav="registro" aria-label="Registrar serviço">
          <span class="nav-btn__icon" aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
            </svg>
          </span>
          <span class="nav-btn__label nav-btn__label--compact">Registrar</span>
        </button>
        <button class="nav-btn" id="nav-historico" data-nav="historico" aria-label="Histórico">
          <span class="nav-btn__icon" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5"/>
              <path d="M12 7v5l3.5 3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </span>
          Histórico
        </button>
        <button class="nav-btn" id="nav-alertas" data-nav="alertas" aria-label="Alertas">
          <span class="nav-btn__icon" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </span>
          Alertas
          <span class="nav-btn__badge" id="alerta-badge">0</span>
        </button>
      </nav>
`;
}
