export function shouldShowClientesInMobileNav(planCode) {
  return String(planCode || '').toLowerCase() === 'pro';
}

export function renderShellNav(planCode) {
  const showClientes = shouldShowClientesInMobileNav(planCode);
  return String.raw`
<!-- NAV -->
      <nav class="app-nav" aria-label="Navegação principal">
        <button class="nav-btn is-active" id="nav-inicio" data-nav="inicio" aria-label="Painel">
          <span class="nav-btn__icon" aria-hidden="true">
            <!-- outline (default) -->
            <svg class="nav-btn__svg nav-btn__svg--outline" width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M3 10.5 12 3l9 7.5V20a1.5 1.5 0 0 1-1.5 1.5H15v-7h-6v7H4.5A1.5 1.5 0 0 1 3 20v-9.5Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <!-- filled (active) -->
            <svg class="nav-btn__svg nav-btn__svg--filled" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.08 2.64a1.5 1.5 0 0 1 1.84 0l8.25 6.42A1.5 1.5 0 0 1 21.75 10.25V20A1.75 1.75 0 0 1 20 21.75h-4.25a.75.75 0 0 1-.75-.75v-6.25h-6V21a.75.75 0 0 1-.75.75H4A1.75 1.75 0 0 1 2.25 20v-9.75A1.5 1.5 0 0 1 2.83 9.06l8.25-6.42Z"/>
            </svg>
          </span>
          Painel
        </button>
        <button class="nav-btn" id="nav-equipamentos" data-nav="equipamentos" aria-label="Equipamentos">
          <span class="nav-btn__icon" aria-hidden="true">
            <svg class="nav-btn__svg nav-btn__svg--outline" width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="m14.6 6.3 3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 0 3 3l6.91-6.91a6 6 0 0 0 7.94-7.94l-3.77 3.77-3-3Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <svg class="nav-btn__svg nav-btn__svg--filled" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.37 2.53a.75.75 0 0 1 1.26.32l.84 3.17 3.17.84a.75.75 0 0 1 .33 1.26l-3.27 3.27a6 6 0 0 1-6.22 1.44l-6.55 6.55a2.47 2.47 0 1 1-3.5-3.5l6.55-6.55a6 6 0 0 1 1.44-6.22l3.27-3.27A.75.75 0 0 1 18.37 2.53Z"/>
            </svg>
          </span>
          Equip.
        </button>
        <button class="nav-btn" id="nav-registro" data-nav="registro" aria-label="Registrar serviço">
          <span class="nav-btn__icon" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
            </svg>
          </span>
          <span class="nav-btn__label nav-btn__label--compact">Registrar</span>
        </button>
        <button class="nav-btn" id="nav-historico" data-nav="historico" aria-label="Serviços">
          <span class="nav-btn__icon" aria-hidden="true">
            <svg class="nav-btn__svg nav-btn__svg--outline" width="24" height="24" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/>
              <path d="M12 7v5l3.5 2.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <svg class="nav-btn__svg nav-btn__svg--filled" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2.25a9.75 9.75 0 1 0 9.75 9.75A9.76 9.76 0 0 0 12 2.25Zm3.97 12.72a.9.9 0 0 1-1.27 0l-3.33-3.33a.9.9 0 0 1-.27-.64V7a.9.9 0 1 1 1.8 0v3.63l3.07 3.07a.9.9 0 0 1 0 1.27Z"/>
            </svg>
          </span>
          Serviços
        </button>
        <button class="nav-btn" id="nav-relatorio" data-nav="relatorio" aria-label="Relatório">
          <span class="nav-btn__icon" aria-hidden="true">
            <svg class="nav-btn__svg nav-btn__svg--outline" width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M3 3v18h18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M7 14l4-4 4 4 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <svg class="nav-btn__svg nav-btn__svg--filled" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M4 3.5a1 1 0 0 1 2 0V18h14.5a1 1 0 1 1 0 2H5a1 1 0 0 1-1-1V3.5Z"/>
              <path d="M18.7 8.3a1 1 0 0 1 0 1.4l-4 4a1 1 0 0 1-1.4 0L11 11.4l-3.3 3.3a1 1 0 1 1-1.4-1.4l4-4a1 1 0 0 1 1.4 0l2.3 2.3 3.3-3.3a1 1 0 0 1 1.4 0Z"/>
            </svg>
          </span>
          Relatório
        </button>
<!--
          Botao "Clientes" no bottom nav (mobile). Antes era "Alertas" — mas
          o sino no top header já cobre alertas, entao reaproveitamos o slot
          pra Clientes (que antes ficava escondido dentro do menu de ajuda).
          Pro-gate: não-Pro abre paywall via routes.js (não precisa CSS lock
          aqui pq mobile-first não tem espaco pra um pill PRO ao lado do label).
        -->
        ${
          showClientes
            ? `<button class="nav-btn" id="nav-clientes" data-nav="clientes" aria-label="Clientes">
          <span class="nav-btn__icon" aria-hidden="true">
            <svg class="nav-btn__svg nav-btn__svg--outline" width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <circle cx="9" cy="7" r="4" stroke="currentColor" stroke-width="2"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <svg class="nav-btn__svg nav-btn__svg--filled" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2a6 6 0 0 0-6 6v1a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-1a6 6 0 0 0-6-6Zm7-9.87a4 4 0 0 1 0 7.75v-7.75ZM23 21v-2a4 4 0 0 0-3-3.87v9.87Z"/>
            </svg>
          </span>
          Clientes
        </button>
        `
            : ''
        }
      </nav>
`;
}
