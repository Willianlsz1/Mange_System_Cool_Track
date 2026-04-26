/**
 * Desktop sidebar (>=1024px) — substitui o bottom nav em viewports largos.
 * V3 redesign abr/2026:
 *   - 3 secoes com kicker labels (OPERACAO / GESTAO / SISTEMA)
 *   - Reorder pra fluxo logico (Painel -> Registrar -> Servicos | Equipamentos +
 *     Clientes | Relatorios + Alertas)
 *   - Pill "Atalho: R" no Registrar servico
 *   - Plan card com calendar icon + data inline + chevron CTA
 *   - Item Configuracoes no rodape (abre o menu de help/settings do header)
 */

const ICON_HOME = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"
  stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
  <path d="M3 10.5 12 3l9 7.5V20a1.5 1.5 0 0 1-1.5 1.5H15v-7h-6v7H4.5A1.5 1.5 0 0 1 3 20v-9.5Z"/>
</svg>`;

const ICON_PLUS_CIRCLE = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"
  stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="12" cy="12" r="9"/>
  <line x1="12" y1="8" x2="12" y2="16"/>
  <line x1="8" y1="12" x2="16" y2="12"/>
</svg>`;

const ICON_CLOCK = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"
  stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="12" cy="12" r="9"/>
  <path d="M12 7v5l3.5 2.5"/>
</svg>`;

const ICON_WRENCH = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"
  stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
  <path d="m14.6 6.3 3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 0 3 3l6.91-6.91a6 6 0 0 0 7.94-7.94l-3.77 3.77-3-3Z"/>
</svg>`;

const ICON_USERS = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"
  stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
  <circle cx="9" cy="7" r="4"/>
  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
</svg>`;

const ICON_FILE = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"
  stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
  <polyline points="14 2 14 8 20 8"/>
  <line x1="9" y1="15" x2="15" y2="15"/>
  <line x1="9" y1="11" x2="15" y2="11"/>
</svg>`;

const ICON_BELL = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"
  stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9Z"/>
  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
</svg>`;

const ICON_CROWN = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"
  stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
  <path d="M2 8l5 5 5-9 5 9 5-5-2 12H4z"/>
</svg>`;

const ICON_CALENDAR_SM = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none"
  stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <rect x="3" y="5" width="18" height="16" rx="2"/>
  <path d="M3 9h18M8 3v4M16 3v4"/>
</svg>`;

const ICON_CHEV_R = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"
  stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <polyline points="9 6 15 12 9 18"/>
</svg>`;

const ICON_CHEV_DOWN = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"
  stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <polyline points="6 9 12 15 18 9"/>
</svg>`;

const ICON_GEAR = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"
  stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <circle cx="12" cy="12" r="3"/>
  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/>
</svg>`;

export function renderShellSidebar() {
  return String.raw`
<!-- SIDEBAR (desktop >=1024px) - V3 abr/2026
     Estrutura: brand + 3 secoes (OPERACAO/GESTAO/SISTEMA) + plan card +
     divider + user chip + Configuracoes row. Active state controlado pelo
     router via .is-active. -->
<aside class="app-sidebar" aria-label="Navegacao principal (desktop)">
  <div class="app-sidebar__brand">
    <div class="app-sidebar__brand-icon" aria-hidden="true">
      <!-- Snowflake oficial CoolTrack (mesmo SVG do header app-logo). -->
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <g stroke="#02131f" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <g>
            <line x1="12" y1="3" x2="12" y2="21"/>
            <polyline points="9.5,5 12,3 14.5,5"/>
            <polyline points="9.5,19 12,21 14.5,19"/>
          </g>
          <g transform="rotate(60 12 12)">
            <line x1="12" y1="3" x2="12" y2="21"/>
            <polyline points="9.5,5 12,3 14.5,5"/>
            <polyline points="9.5,19 12,21 14.5,19"/>
          </g>
          <g transform="rotate(120 12 12)">
            <line x1="12" y1="3" x2="12" y2="21"/>
            <polyline points="9.5,5 12,3 14.5,5"/>
            <polyline points="9.5,19 12,21 14.5,19"/>
          </g>
        </g>
        <circle cx="12" cy="12" r="1.4" fill="#02131f"/>
      </svg>
    </div>
    <div class="app-sidebar__brand-text">
      <span class="app-sidebar__brand-name">CoolTrack</span>
      <span class="app-sidebar__brand-tag">PRO</span>
    </div>
  </div>

  <nav class="app-sidebar__nav" aria-label="Menu principal">

    <!-- ── Secao OPERACAO ── -->
    <div class="app-sidebar__section">
      <div class="app-sidebar__section-kicker">OPERACAO</div>
      <button type="button" class="app-sidebar__nav-item is-active"
        id="sidenav-inicio" data-nav="inicio">
        ${ICON_HOME}<span>Painel</span>
      </button>
      <button type="button" class="app-sidebar__nav-item app-sidebar__nav-item--register"
        id="sidenav-registro" data-nav="registro">
        ${ICON_PLUS_CIRCLE}<span>Registrar servico</span>
        <span class="app-sidebar__shortcut" aria-hidden="true">Atalho: R</span>
      </button>
      <button type="button" class="app-sidebar__nav-item"
        id="sidenav-historico" data-nav="historico">
        ${ICON_CLOCK}<span>Servicos</span>
      </button>
    </div>

    <!-- ── Secao GESTAO ── -->
    <div class="app-sidebar__section">
      <div class="app-sidebar__section-kicker">GESTAO</div>
      <button type="button" class="app-sidebar__nav-item"
        id="sidenav-equipamentos" data-nav="equipamentos">
        ${ICON_WRENCH}<span>Equipamentos</span>
      </button>
      <button type="button" class="app-sidebar__nav-item"
        id="sidenav-clientes" data-nav="clientes">
        ${ICON_USERS}<span>Clientes</span>
      </button>
    </div>

    <!-- ── Secao SISTEMA ── -->
    <div class="app-sidebar__section">
      <div class="app-sidebar__section-kicker">SISTEMA</div>
      <button type="button" class="app-sidebar__nav-item"
        id="sidenav-relatorio" data-nav="relatorio">
        ${ICON_FILE}<span>Relatorios</span>
      </button>
      <button type="button" class="app-sidebar__nav-item"
        id="sidenav-alertas" data-nav="alertas">
        ${ICON_BELL}<span>Alertas</span>
        <span class="app-sidebar__nav-badge" id="sidenav-alerta-badge" hidden>0</span>
      </button>
    </div>

  </nav>

  <div class="app-sidebar__footer">
    <!-- Card do plano: nome + status + data + Gerenciar. Conteudo
         populado em runtime por updateShellSidebar() apos profile carregar.
         Default visual = "Plano Free" pra evitar flash. -->
    <div class="app-sidebar__plan-card" id="sidenav-plan-card" data-plan="free">
      <div class="app-sidebar__plan-card-head">
        <span class="app-sidebar__plan-card-icon" aria-hidden="true">${ICON_CROWN}</span>
        <span class="app-sidebar__plan-card-title" id="sidenav-plan-name">Plano Free</span>
      </div>
      <p class="app-sidebar__plan-card-sub" id="sidenav-plan-sub">
        Recursos basicos
      </p>
      <div class="app-sidebar__plan-card-meta" id="sidenav-plan-meta" hidden>
        <span class="app-sidebar__plan-card-meta-icon" aria-hidden="true">${ICON_CALENDAR_SM}</span>
        <span id="sidenav-plan-renew">Ate 25/05/2026</span>
      </div>
      <button type="button" class="app-sidebar__plan-card-cta"
        id="sidenav-plan-cta" data-nav="pricing">
        <span id="sidenav-plan-cta-label">Conhecer planos</span>
        <span aria-hidden="true">${ICON_CHEV_R}</span>
      </button>
    </div>

    <div class="app-sidebar__divider" aria-hidden="true"></div>

    <!-- User chip: avatar + nome + role. Click navega pra /conta. -->
    <button type="button" class="app-sidebar__user-chip" id="sidenav-user-chip"
      data-nav="conta" aria-label="Abrir minha conta">
      <span class="app-sidebar__user-avatar" id="sidenav-user-avatar">U</span>
      <span class="app-sidebar__user-info">
        <span class="app-sidebar__user-name" id="sidenav-user-name">Usuario</span>
        <span class="app-sidebar__user-role" id="sidenav-user-role">Administrador</span>
      </span>
      <span class="app-sidebar__user-chev" aria-hidden="true">${ICON_CHEV_DOWN}</span>
    </button>

    <!-- Configuracoes: abre o menu existente do header (toggle-help-menu).
         Reusa o mesmo handler ja registrado no controller. -->
    <button type="button" class="app-sidebar__settings"
      id="sidenav-settings" data-action="toggle-help-menu"
      aria-label="Configuracoes e ajuda" title="Configuracoes e ajuda">
      <span class="app-sidebar__settings-icon" aria-hidden="true">${ICON_GEAR}</span>
      <span class="app-sidebar__settings-label">Configuracoes</span>
      <span class="app-sidebar__settings-chev" aria-hidden="true">${ICON_CHEV_R}</span>
    </button>
  </div>
</aside>
`;
}
