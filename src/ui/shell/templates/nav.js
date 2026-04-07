export function renderShellNav() {
  return String.raw`
<!-- NAV -->
      <nav class="app-nav" aria-label="Navegação principal">
        <div class="app-nav__title">OPERAÇÃO</div>
        <button class="nav-btn is-active" id="nav-inicio" data-nav="inicio" aria-label="Painel">
          <span class="nav-btn__icon" aria-hidden="true"><svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <rect x="1.5" y="1.5" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.2" />
              <rect x="8.5" y="1.5" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.2" />
              <rect x="1.5" y="8.5" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.2" />
              <rect x="8.5" y="8.5" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.2" />
            </svg></span>
          Painel
        </button>
        <button class="nav-btn" id="nav-equipamentos" data-nav="equipamentos" aria-label="Equipamentos">
          <span class="nav-btn__icon" aria-hidden="true"><svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <rect x="1.5" y="4.5" width="12" height="9" rx="1.5" stroke="currentColor" stroke-width="1.2" />
              <path d="M5 4.5V3.5a2.5 2.5 0 0 1 5 0v1" stroke="currentColor" stroke-width="1.2"
                stroke-linecap="round" />
              <circle cx="7.5" cy="9" r="1.2" fill="currentColor" />
            </svg></span>
          Equip.
        </button>
        <button class="nav-btn" id="nav-registro" data-nav="registro" aria-label="Registrar serviço">
          <span class="nav-btn__icon" aria-hidden="true"><svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <rect x="2" y="2" width="11" height="11" rx="1.5" stroke="currentColor" stroke-width="1.2" />
              <path d="M7.5 5v5M5 7.5h5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
            </svg></span>
          Registrar
        </button>
        <button class="nav-btn" id="nav-historico" data-nav="historico" aria-label="Histórico">
          <span class="nav-btn__icon" aria-hidden="true"><svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <circle cx="7.5" cy="7.5" r="6" stroke="currentColor" stroke-width="1.2" />
              <path d="M7.5 4.5v3.5l2 1.2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
            </svg></span>
          Histórico
        </button>
        <button class="nav-btn" id="nav-alertas" data-nav="alertas" aria-label="Alertas">
          <span class="nav-btn__icon" aria-hidden="true"><svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <path d="M7.5 2L1.5 12.5h12L7.5 2Z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" />
              <path d="M7.5 6v3.5M7.5 11v.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
            </svg></span>
          Alertas
          <span class="nav-btn__badge" id="alerta-badge">0</span>
        </button>
        <div class="app-nav__title">RELATÓRIOS</div>
        <button class="nav-btn" id="nav-relatorio" data-nav="relatorio" aria-label="Relatório">
          <span class="nav-btn__icon" aria-hidden="true"><svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <rect x="2" y="1" width="11" height="13" rx="1.5" stroke="currentColor" stroke-width="1.2" />
              <path d="M5 5h5M5 8h5M5 11h3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
            </svg></span>
          Relatório
        </button>
      </nav>
`;
}
