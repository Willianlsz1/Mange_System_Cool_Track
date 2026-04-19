/**
 * CoolTrack Pro - LandingPage / template
 * Markup HTML da landing page (hero com dual orb + grad word, gallery,
 * social proof, final CTA com dual orb, sticky mobile).
 *
 * V2Refined — 5 signature moments herdados do AccountModal:
 *   1. DUAL ORB (gold top-left + cyan bottom-right) no mockup do hero
 *   2. GRAD WORD (cyan→gold) em "achismo" (h1) e "organizar" (final CTA)
 *   3. FILLED CHIPS com check-circle inline no mockup
 *   4. CTA primary com bolt + sombra cyan projetada
 *   5. Mini cyan orb por phone frame na gallery
 *
 * Handlers preservados: data-action="start-trial" / "login" são usados
 * pelo orquestrador (landingPage.js) — não mexer sem atualizar os bindings.
 */

export function buildLandingHtml() {
  // Ícones inline — stroke 1.75 currentColor, lucide-style. Zero emoji.
  const ICON_BOLT = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 2 L4 14 L12 14 L11 22 L20 10 L12 10 Z"/></svg>`;
  const ICON_LOGIN = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>`;
  const ICON_CHECK = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><polyline points="8 12.5 11 15.5 16.5 10"/></svg>`;
  const ICON_ALERT = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
  const ICON_WIFI_OFF = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.58 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>`;
  const ICON_CHEVRON = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 6 15 12 9 18"/></svg>`;
  const ICON_CAMERA = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`;
  const ICON_SEND = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`;
  // Ícones de trust — stroke 1.75 currentColor, lucide-style, mesma linguagem visual.
  const ICON_SHIELD = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>`;
  const ICON_LOCK = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
  const ICON_REFUND = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>`;
  const ICON_UNLOCK = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>`;
  const ICON_X = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><line x1="8.5" y1="8.5" x2="15.5" y2="15.5"/><line x1="15.5" y1="8.5" x2="8.5" y2="15.5"/></svg>`;

  return `
    <div class="lp">

      <!-- ── TOPBAR ── -->
      <header class="lp-topbar" role="banner">
        <div class="lp-brand">
          <div class="lp-brand__icon">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <g stroke="#00C8E8" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" fill="none">
                <g>
                  <line x1="8" y1="2" x2="8" y2="14"/>
                  <polyline points="6.5,3.2 8,2 9.5,3.2"/>
                  <polyline points="6.5,12.8 8,14 9.5,12.8"/>
                </g>
                <g transform="rotate(60 8 8)">
                  <line x1="8" y1="2" x2="8" y2="14"/>
                  <polyline points="6.5,3.2 8,2 9.5,3.2"/>
                  <polyline points="6.5,12.8 8,14 9.5,12.8"/>
                </g>
                <g transform="rotate(120 8 8)">
                  <line x1="8" y1="2" x2="8" y2="14"/>
                  <polyline points="6.5,3.2 8,2 9.5,3.2"/>
                  <polyline points="6.5,12.8 8,14 9.5,12.8"/>
                </g>
              </g>
              <circle cx="8" cy="8" r="0.9" fill="#00C8E8"/>
            </svg>
          </div>
          <span class="lp-brand__name">CoolTrack</span>
          <span class="lp-brand__badge">PRO</span>
        </div>
        <button class="lp-nav-btn" type="button" data-action="login" data-source="topbar">
          ${ICON_LOGIN}
          Entrar
        </button>
      </header>

      <!-- ── HERO ── -->
      <section class="lp-hero">
        <span class="lp-kicker">
          <span class="lp-kicker__dot" aria-hidden="true"></span>
          Para técnicos de climatização
        </span>

        <h1 class="lp-h1">
          Chega de planilha.<br>Seu relatório de manutenção pronto em <span class="lp-grad">30 segundos</span>.
        </h1>
        <p class="lp-sub">
          Técnico registra no celular com foto e assinatura. Funciona offline — sincroniza sozinho quando o sinal volta.
        </p>

        <div class="lp-ctas lp-ctas--single">
          <button
            class="lp-btn-primary"
            type="button"
            data-action="start-trial"
            data-source="hero"
          >
            ${ICON_BOLT}
            Experimentar grátis
          </button>
        </div>
        <p class="lp-microcopy">Sem cadastro &bull; Sem cartão &bull; Comece em segundos</p>

        <!-- Product mockup com DUAL ORB -->
        <div class="lp-mockup">
          <div class="lp-mockup__bar"></div>
          <div class="lp-mockup__header">
            <span class="lp-mockup__equip">Hospital Central</span>
            <span class="lp-mockup__unit">Chiller 02</span>
          </div>
          <div class="lp-mockup__score">
            <div class="lp-mockup__disk"><span>87</span></div>
            <div class="lp-mockup__badge">${ICON_ALERT} Alerta Crítico</div>
          </div>
          <div class="lp-mockup__chips">
            <span class="lp-chip">${ICON_CHECK} Prioridade máxima</span>
            <span class="lp-chip">${ICON_CHECK} 18 dias sem serviço</span>
            <span class="lp-chip">${ICON_CHECK} 3 ocorrências este mês</span>
          </div>
        </div>
      </section>

      <!-- ── COMO FUNCIONA (3 passos) ── -->
      <section class="lp-how" aria-labelledby="lp-how-title">
        <p class="lp-section-label">Como funciona</p>
        <h2 class="lp-how__title" id="lp-how-title">
          Do primeiro toque<br>ao PDF assinado.
        </h2>
        <ol class="lp-how__steps">
          <li class="lp-how__step">
            <div class="lp-how__step-num">1</div>
            <div class="lp-how__step-body">
              <h3 class="lp-how__step-title">Cadastra o equipamento</h3>
              <p class="lp-how__step-text">Tag, local, tipo e criticidade. 30 segundos por equipamento.</p>
            </div>
          </li>
          <li class="lp-how__step-connector" aria-hidden="true"></li>
          <li class="lp-how__step">
            <div class="lp-how__step-num">2</div>
            <div class="lp-how__step-body">
              <h3 class="lp-how__step-title">Registra o serviço em campo</h3>
              <p class="lp-how__step-text">Descrição, peças, foto e assinatura do cliente. Funciona sem sinal.</p>
            </div>
          </li>
          <li class="lp-how__step-connector" aria-hidden="true"></li>
          <li class="lp-how__step">
            <div class="lp-how__step-num">3</div>
            <div class="lp-how__step-body">
              <h3 class="lp-how__step-title">Gera PDF em 1 toque</h3>
              <p class="lp-how__step-text">Relatório pronto pra enviar no WhatsApp, imprimir ou arquivar.</p>
            </div>
          </li>
        </ol>
      </section>

      <!-- ── SCREENSHOT GALLERY ── -->
      <section class="lp-gallery">
        <div class="lp-gallery__head">
          <div>
            <p class="lp-section-label">Veja o app em ação</p>
            <h2 class="lp-gallery__title">Feito para o campo,<br>do celular ao laudo.</h2>
          </div>
          <span class="lp-gallery__hint">Deslize ${ICON_CHEVRON}</span>
        </div>

        <div
          class="lp-gallery__track"
          id="lp-gallery-track"
          role="region"
          aria-label="Telas do app CoolTrack (deslize ou use as setas do teclado)"
          tabindex="0"
        >

          <!-- 1 · Painel Geral -->
          <div class="lp-screen">
            <div class="lp-screen__status">
              <span>9:41</span>
              <span>▮▮▮</span>
            </div>
            <div class="lp-screen__header">
              <div class="lp-screen__header-label">CoolTrack PRO</div>
              <div class="lp-screen__header-title">Painel Geral</div>
            </div>
            <div class="lp-screen__body">
              <div class="lp-sc-tiles">
                <div class="lp-sc-tile">
                  <div class="lp-sc-tile__val" style="color:#e8f2fa">8</div>
                  <div class="lp-sc-tile__lbl">Equipamentos</div>
                </div>
                <div class="lp-sc-tile">
                  <div class="lp-sc-tile__val" style="color:#ff5577">2</div>
                  <div class="lp-sc-tile__lbl">Atenção</div>
                </div>
                <div class="lp-sc-tile">
                  <div class="lp-sc-tile__val" style="color:#00c870">5</div>
                  <div class="lp-sc-tile__lbl">Operando</div>
                </div>
                <div class="lp-sc-tile">
                  <div class="lp-sc-tile__val" style="color:#e8b94a">1</div>
                  <div class="lp-sc-tile__lbl">Preventiva</div>
                </div>
              </div>
              <div class="lp-sc-section">Equipamentos</div>
              <div class="lp-sc-row">
                <div class="lp-sc-dot lp-sc-dot--danger"></div>
                <div class="lp-sc-row__info">
                  <div class="lp-sc-row__name">Chiller 02 — Hospital</div>
                  <div class="lp-sc-row__sub">Risco 87 · Serviço há 18d</div>
                </div>
                <span class="lp-sc-badge lp-sc-badge--danger">CRÍTICO</span>
              </div>
              <div class="lp-sc-row">
                <div class="lp-sc-dot lp-sc-dot--warn"></div>
                <div class="lp-sc-row__info">
                  <div class="lp-sc-row__name">Fan Coil — Sala VIP</div>
                  <div class="lp-sc-row__sub">Risco 52 · Preventiva em 5d</div>
                </div>
                <span class="lp-sc-badge lp-sc-badge--warn">ATENÇÃO</span>
              </div>
              <div class="lp-sc-row">
                <div class="lp-sc-dot lp-sc-dot--ok"></div>
                <div class="lp-sc-row__info">
                  <div class="lp-sc-row__name">Split — Recepção</div>
                  <div class="lp-sc-row__sub">Risco 12 · Serviço há 3d</div>
                </div>
                <span class="lp-sc-badge lp-sc-badge--ok">OK</span>
              </div>
            </div>
          </div>

          <!-- 2 · Detalhes do Equipamento -->
          <div class="lp-screen">
            <div class="lp-screen__status">
              <span>9:41</span>
              <span>▮▮▮</span>
            </div>
            <div class="lp-screen__header">
              <div class="lp-screen__header-label">Equipamento</div>
              <div class="lp-screen__header-title">Chiller 02</div>
            </div>
            <div class="lp-screen__body">
              <div class="lp-sc-alert lp-sc-alert--danger">
                <div class="lp-sc-alert__title">Ação recomendada</div>
                <div class="lp-sc-alert__sub">Inspecionar compressor — corretiva urgente</div>
              </div>
              <div class="lp-sc-tiles" style="grid-template-columns:1fr 1fr 1fr; gap:4px">
                <div class="lp-sc-tile">
                  <div class="lp-sc-tile__val" style="color:#ff5577;font-size:14px">87</div>
                  <div class="lp-sc-tile__lbl">Risco</div>
                </div>
                <div class="lp-sc-tile">
                  <div class="lp-sc-tile__val" style="color:#e8f2fa;font-size:14px">18</div>
                  <div class="lp-sc-tile__lbl">Dias</div>
                </div>
                <div class="lp-sc-tile">
                  <div class="lp-sc-tile__val" style="color:#e8b94a;font-size:14px">3</div>
                  <div class="lp-sc-tile__lbl">Ocorr.</div>
                </div>
              </div>
              <div class="lp-sc-section">Histórico recente</div>
              <div class="lp-sc-row">
                <div class="lp-sc-dot lp-sc-dot--danger"></div>
                <div class="lp-sc-row__info">
                  <div class="lp-sc-row__name">Manutenção Corretiva</div>
                  <div class="lp-sc-row__sub">15 abr 2026 · João Silva</div>
                </div>
              </div>
              <div class="lp-sc-row">
                <div class="lp-sc-dot lp-sc-dot--ok"></div>
                <div class="lp-sc-row__info">
                  <div class="lp-sc-row__name">Preventiva Mensal</div>
                  <div class="lp-sc-row__sub">27 mar 2026 · João Silva</div>
                </div>
              </div>
              <div class="lp-sc-row">
                <div class="lp-sc-dot lp-sc-dot--ok"></div>
                <div class="lp-sc-row__info">
                  <div class="lp-sc-row__name">Troca de Filtros</div>
                  <div class="lp-sc-row__sub">10 mar 2026 · João Silva</div>
                </div>
              </div>
            </div>
          </div>

          <!-- 3 · Novo Registro de Serviço -->
          <div class="lp-screen">
            <div class="lp-screen__status">
              <span>9:41</span>
              <span>▮▮▮</span>
            </div>
            <div class="lp-screen__header">
              <div class="lp-screen__header-label">Novo Serviço</div>
              <div class="lp-screen__header-title">Registrar atendimento</div>
            </div>
            <div class="lp-screen__body">
              <div class="lp-sc-field lp-sc-field--filled">
                <div class="lp-sc-field__label">Equipamento</div>
                <div class="lp-sc-field__value">Chiller 02 — Hospital Central</div>
              </div>
              <div class="lp-sc-field lp-sc-field--filled">
                <div class="lp-sc-field__label">Tipo de serviço</div>
                <div class="lp-sc-field__value">Manutenção Corretiva</div>
              </div>
              <div class="lp-sc-field lp-sc-field--filled" style="min-height:52px">
                <div class="lp-sc-field__label">Observações</div>
                <div class="lp-sc-field__value" style="line-height:1.4">Substituído capacitor do compressor. Verificado nível de gás R-410A...</div>
              </div>
              <div class="lp-sc-field lp-sc-field--filled">
                <div class="lp-sc-field__label">Peças utilizadas</div>
                <div class="lp-sc-field__value">Capacitor 45µF CBB65</div>
              </div>
              <div style="display:flex;gap:5px">
                <div class="lp-sc-field" style="flex:1">
                  <div class="lp-sc-field__label">Custo peças</div>
                  <div class="lp-sc-field__value">R$ 85,00</div>
                </div>
                <div class="lp-sc-field" style="flex:1">
                  <div class="lp-sc-field__label">Mão de obra</div>
                  <div class="lp-sc-field__value">R$ 120,00</div>
                </div>
              </div>
              <div style="display:flex;align-items:center;gap:6px;padding:4px 0">
                <div style="width:28px;height:28px;background:rgba(0,200,232,.1);border:1px solid rgba(0,200,232,.2);border-radius:6px;display:flex;align-items:center;justify-content:center;color:#00c8e8">${ICON_CAMERA}</div>
                <div style="font-size:9px;color:#8aaac8">2 fotos anexadas</div>
              </div>
            </div>
          </div>

          <!-- 4 · Alertas e Pendências -->
          <div class="lp-screen">
            <div class="lp-screen__status">
              <span>9:41</span>
              <span>▮▮▮</span>
            </div>
            <div class="lp-screen__header">
              <div class="lp-screen__header-label">CoolTrack PRO</div>
              <div class="lp-screen__header-title">Alertas</div>
            </div>
            <div class="lp-screen__body">
              <div class="lp-sc-section" style="color:#ff5577"><span class="lp-sc-dot lp-sc-dot--danger" style="width:6px;height:6px"></span> Intervenção imediata</div>
              <div class="lp-sc-alert lp-sc-alert--danger">
                <div class="lp-sc-alert__title">Chiller 02 — Hospital</div>
                <div class="lp-sc-alert__sub">Risco 87 · Compressor com falha</div>
              </div>
              <div class="lp-sc-alert lp-sc-alert--danger">
                <div class="lp-sc-alert__title">VRF Bloco B — Andar 3</div>
                <div class="lp-sc-alert__sub">Risco 74 · Sem serviço há 45 dias</div>
              </div>
              <div class="lp-sc-section" style="color:#e8b94a;margin-top:4px"><span class="lp-sc-dot lp-sc-dot--warn" style="width:6px;height:6px"></span> Preventivas próximas</div>
              <div class="lp-sc-alert lp-sc-alert--warn">
                <div class="lp-sc-alert__title">Fan Coil — Sala VIP</div>
                <div class="lp-sc-alert__sub">Preventiva recomendada até 19/04</div>
              </div>
              <div class="lp-sc-alert lp-sc-alert--warn">
                <div class="lp-sc-alert__title">Split — Diretoria</div>
                <div class="lp-sc-alert__sub">Preventiva recomendada até 22/04</div>
              </div>
              <div class="lp-sc-alert lp-sc-alert--warn">
                <div class="lp-sc-alert__title">Condensadora — Cobertura</div>
                <div class="lp-sc-alert__sub">Limpeza de filtros vencida</div>
              </div>
            </div>
          </div>

          <!-- 5 · Relatório PDF gerado -->
          <div class="lp-screen">
            <div class="lp-screen__status">
              <span>9:41</span>
              <span>▮▮▮</span>
            </div>
            <div class="lp-screen__header">
              <div class="lp-screen__header-label">Exportar</div>
              <div class="lp-screen__header-title">Relatório PDF</div>
            </div>
            <div class="lp-screen__body">
              <div class="lp-sc-pdf">
                <div class="lp-sc-pdf__bar"></div>
                <div class="lp-sc-pdf__title">COOLTRACK<span style="color:#00c8e8">PRO</span></div>
                <div class="lp-sc-pdf__sub">Relatório de Serviços · Abr 2026</div>
                <div class="lp-sc-pdf__grid">
                  <div class="lp-sc-pdf__stat">
                    <div class="lp-sc-pdf__stat-val" style="color:#e8f2fa">12</div>
                    <div class="lp-sc-pdf__stat-lbl">Serviços</div>
                  </div>
                  <div class="lp-sc-pdf__stat">
                    <div class="lp-sc-pdf__stat-val" style="color:#00c870">9</div>
                    <div class="lp-sc-pdf__stat-lbl">Operando</div>
                  </div>
                  <div class="lp-sc-pdf__stat">
                    <div class="lp-sc-pdf__stat-val" style="color:#e8b94a">2</div>
                    <div class="lp-sc-pdf__stat-lbl">Atenção</div>
                  </div>
                  <div class="lp-sc-pdf__stat">
                    <div class="lp-sc-pdf__stat-val" style="color:#ff5577">1</div>
                    <div class="lp-sc-pdf__stat-lbl">Crítico</div>
                  </div>
                </div>
                <div class="lp-sc-pdf__line"></div>
                <div class="lp-sc-pdf__row">
                  <span class="lp-sc-pdf__row-label">Técnico</span>
                  <span class="lp-sc-pdf__row-val">João Silva</span>
                </div>
                <div class="lp-sc-pdf__row">
                  <span class="lp-sc-pdf__row-label">Empresa</span>
                  <span class="lp-sc-pdf__row-val">ClimaTech HVAC</span>
                </div>
                <div class="lp-sc-pdf__row">
                  <span class="lp-sc-pdf__row-label">Custo total</span>
                  <span class="lp-sc-pdf__row-val" style="color:#00c870">R$ 1.840,00</span>
                </div>
              </div>
              <button class="lp-sc-fab">${ICON_SEND} Enviar pelo WhatsApp</button>
              <div style="text-align:center;font-size:8px;color:#6a8ba8;margin-top:4px">PDF gerado em 1 toque</div>
            </div>
          </div>

        </div><!-- /.lp-gallery__track -->

        <div class="lp-gallery__dots" id="lp-gallery-dots">
          <div class="lp-gallery__dot"></div>
          <div class="lp-gallery__dot"></div>
          <div class="lp-gallery__dot"></div>
          <div class="lp-gallery__dot"></div>
          <div class="lp-gallery__dot"></div>
        </div>
      </section>

      <!-- ── OFFLINE DEMO (prova visual do diferencial offline-first) ── -->
      <section class="lp-offline" aria-labelledby="lp-offline-title">
        <div class="lp-offline__head">
          <p class="lp-section-label">Offline-first</p>
          <h2 class="lp-offline__title" id="lp-offline-title">
            Sem sinal?<br>Seu trabalho <span class="lp-grad">continua</span>.
          </h2>
          <p class="lp-offline__sub">
            Subsolo, cobertura, obra sem Wi-Fi. Você registra, assina e gera o PDF offline. Sincroniza sozinho quando o sinal volta.
          </p>
        </div>

        <div class="lp-offline__demo">
          <div class="lp-offline__bar">
            <span class="lp-offline__bar-icon">${ICON_WIFI_OFF}</span>
            <span class="lp-offline__bar-text">Modo offline ativo</span>
            <span class="lp-offline__bar-status">3 registros na fila</span>
          </div>

          <ul class="lp-offline__queue" role="list">
            <li class="lp-offline__item">
              <span class="lp-offline__check">${ICON_CHECK}</span>
              <div class="lp-offline__item-body">
                <div class="lp-offline__item-title">Chiller 02 — Preventiva mensal</div>
                <div class="lp-offline__item-meta">Salvo local · 09:14</div>
              </div>
              <span class="lp-offline__pill">Pendente</span>
            </li>
            <li class="lp-offline__item">
              <span class="lp-offline__check">${ICON_CHECK}</span>
              <div class="lp-offline__item-body">
                <div class="lp-offline__item-title">Fan Coil — Troca de filtros</div>
                <div class="lp-offline__item-meta">Salvo local · 10:02</div>
              </div>
              <span class="lp-offline__pill">Pendente</span>
            </li>
            <li class="lp-offline__item">
              <span class="lp-offline__check">${ICON_CHECK}</span>
              <div class="lp-offline__item-body">
                <div class="lp-offline__item-title">Split Diretoria — Corretiva</div>
                <div class="lp-offline__item-meta">Salvo local · 11:28</div>
              </div>
              <span class="lp-offline__pill">Pendente</span>
            </li>
          </ul>

          <div class="lp-offline__sync" role="status">
            <span class="lp-offline__sync-dot" aria-hidden="true"></span>
            Sincroniza sozinho assim que o sinal voltar.
          </div>
        </div>
      </section>

      <!-- ── SOCIAL PROOF STRIP ── -->
      <section class="lp-social" aria-label="Números do CoolTrack">
        <span class="lp-social__item">
          <span class="lp-social__num">142+</span>
          técnicos
        </span>
        <span class="lp-social__sep" aria-hidden="true"></span>
        <span class="lp-social__item">
          <span class="lp-social__num">2.400+</span>
          relatórios gerados
        </span>
        <span class="lp-social__sep" aria-hidden="true"></span>
        <span class="lp-social__item">
          <span class="lp-social__icon">${ICON_WIFI_OFF}</span>
          100% offline-ready
        </span>
      </section>

      <!-- ── TRUST STRIP (objection busters) ── -->
      <section class="lp-trust" aria-label="Compromissos do CoolTrack">
        <div class="lp-trust__item">
          <span class="lp-trust__icon">${ICON_SHIELD}</span>
          <span class="lp-trust__text">
            <strong>LGPD compliant</strong>
            <span class="lp-trust__sub">DPO + Central LGPD</span>
          </span>
        </div>
        <div class="lp-trust__item">
          <span class="lp-trust__icon">${ICON_LOCK}</span>
          <span class="lp-trust__text">
            <strong>Dados criptografados</strong>
            <span class="lp-trust__sub">em trânsito (HTTPS/TLS)</span>
          </span>
        </div>
        <div class="lp-trust__item">
          <span class="lp-trust__icon">${ICON_REFUND}</span>
          <span class="lp-trust__text">
            <strong>7 dias de garantia</strong>
            <span class="lp-trust__sub">reembolso integral</span>
          </span>
        </div>
        <div class="lp-trust__item">
          <span class="lp-trust__icon">${ICON_UNLOCK}</span>
          <span class="lp-trust__text">
            <strong>Sem fidelidade</strong>
            <span class="lp-trust__sub">cancela a qualquer hora</span>
          </span>
        </div>
      </section>

      <!-- ── ANTES vs DEPOIS (comparativo de transformação) ── -->
      <section class="lp-compare" aria-labelledby="lp-compare-title">
        <p class="lp-section-label lp-compare__label">Antes vs. Depois</p>
        <h2 class="lp-compare__title" id="lp-compare-title">
          A mudança<br>é concreta.
        </h2>

        <div class="lp-compare__grid">
          <article class="lp-compare__card lp-compare__card--before" aria-label="Como era antes">
            <h3 class="lp-compare__card-title">
              <span class="lp-compare__badge lp-compare__badge--before">Antes</span>
              Caderno, WhatsApp e planilha
            </h3>
            <ul class="lp-compare__list lp-compare__list--before">
              <li>${ICON_X} Relatório em 20 minutos, copiando tudo à mão</li>
              <li>${ICON_X} Sem histórico: "quando foi a última preventiva mesmo?"</li>
              <li>${ICON_X} Cliente cobra serviço e ninguém acha a prova</li>
              <li>${ICON_X} Preventiva só quando o equipamento já quebrou</li>
              <li>${ICON_X} Fotos perdidas no rolo de câmera do celular</li>
            </ul>
          </article>

          <article class="lp-compare__card lp-compare__card--after" aria-label="Como fica com CoolTrack">
            <h3 class="lp-compare__card-title">
              <span class="lp-compare__badge lp-compare__badge--after">Depois</span>
              CoolTrack no celular
            </h3>
            <ul class="lp-compare__list lp-compare__list--after">
              <li>${ICON_CHECK} PDF pronto em 30 segundos, com assinatura do cliente</li>
              <li>${ICON_CHECK} Histórico completo de cada equipamento, pesquisável</li>
              <li>${ICON_CHECK} Cliente recebe o PDF no WhatsApp em 1 toque</li>
              <li>${ICON_CHECK} App avisa antes da preventiva vencer</li>
              <li>${ICON_CHECK} Fotos anexadas no registro, organizadas por equipamento</li>
            </ul>
          </article>
        </div>
      </section>

      <!-- ── PRICING ── -->
      <section class="lp-pricing" aria-labelledby="lp-pricing-title">
        <div class="lp-pricing__head">
          <p class="lp-section-label">Planos</p>
          <h2 class="lp-pricing__title" id="lp-pricing-title">
            Escolha o plano certo<br>pro seu jeito de trabalhar.
          </h2>
          <p class="lp-pricing__sub">Comece grátis. Faça upgrade quando precisar de mais.</p>

          <div
            class="lp-pricing-toggle"
            id="lp-pricing-toggle"
            role="group"
            aria-label="Ciclo de cobrança"
          >
            <button
              class="lp-pricing-toggle__btn lp-pricing-toggle__btn--active"
              data-billing="monthly"
              type="button"
            >
              Mensal
            </button>
            <button
              class="lp-pricing-toggle__btn"
              data-billing="annual"
              type="button"
            >
              Anual <span class="lp-pricing-toggle__save">-28%</span>
            </button>
          </div>
        </div>

        <div class="lp-pricing-grid" role="list">

          <!-- ═════ FREE ═════ -->
          <article class="lp-pricing-card" role="listitem" aria-label="Plano Gratuito">
            <span class="lp-pricing-badge lp-pricing-badge--free">Grátis</span>
            <h3 class="lp-pricing-card__title">Free</h3>
            <div class="lp-pricing-card__price-block">
              <p class="lp-pricing-card__price">
                R$ 0 <span class="lp-pricing-card__period">/ sempre</span>
              </p>
            </div>
            <ul class="lp-pricing-features">
              <li>${ICON_CHECK} Até 3 equipamentos cadastrados</li>
              <li>${ICON_CHECK} 10 registros de serviço/mês</li>
              <li>${ICON_CHECK} 5 PDFs/mês <span class="lp-pricing-features__note">(com marca d'água)</span></li>
              <li>${ICON_CHECK} Histórico dos últimos 30 dias</li>
              <li>${ICON_CHECK} Funciona offline</li>
            </ul>
            <button
              class="lp-pricing-card__cta lp-pricing-card__cta--free"
              type="button"
              data-action="start-trial"
              data-source="pricing_free"
            >
              Começar grátis
            </button>
            <p class="lp-pricing-card__microcopy">Sem cartão &bull; Sem cadastro</p>
          </article>

          <!-- ═════ PLUS ═════ -->
          <article
            class="lp-pricing-card lp-pricing-card--plus"
            role="listitem"
            aria-label="Plano Plus"
          >
            <span class="lp-pricing-badge lp-pricing-badge--plus">Intermediário</span>
            <h3 class="lp-pricing-card__title">Plus</h3>
            <div class="lp-pricing-card__price-block">
              <p
                class="lp-pricing-card__price lp-pricing-card__price--plus"
                data-price-monthly
              >
                R$ 29 <span class="lp-pricing-card__period">/ mês</span>
              </p>
              <div class="lp-pricing-card__price-annual" data-price-annual hidden>
                <p class="lp-pricing-card__price lp-pricing-card__price--plus">
                  R$ 20<span class="lp-pricing-card__cents">,75</span>
                  <span class="lp-pricing-card__period">/ mês</span>
                </p>
                <p class="lp-pricing-card__annual-detail">
                  R$ 249/ano
                  <span class="lp-pricing-card__save-pill">economiza R$ 99</span>
                </p>
              </div>
            </div>
            <ul class="lp-pricing-features">
              <li>${ICON_CHECK} Até 25 equipamentos cadastrados</li>
              <li>${ICON_CHECK} <strong>Registros ilimitados</strong></li>
              <li>${ICON_CHECK} 100 PDFs/mês <strong>sem marca d'água</strong></li>
              <li>${ICON_CHECK} <strong>Assinatura digital</strong> do cliente no PDF</li>
              <li>${ICON_CHECK} Fotos dos equipamentos (até 3 por eq.)</li>
              <li>${ICON_CHECK} Histórico completo</li>
            </ul>
            <button
              class="lp-pricing-card__cta lp-pricing-card__cta--plus"
              type="button"
              data-action="start-trial"
              data-source="pricing_plus"
            >
              Começar grátis
            </button>
            <p class="lp-pricing-card__microcopy">
              Comece no Free, faça upgrade quando precisar
            </p>
          </article>

          <!-- ═════ PRO (highlighted) ═════ -->
          <article
            class="lp-pricing-card lp-pricing-card--pro lp-pricing-card--highlight"
            role="listitem"
            aria-label="Plano Pro"
          >
            <span class="lp-pricing-badge lp-pricing-badge--popular">★ Mais popular</span>
            <h3 class="lp-pricing-card__title">Pro</h3>
            <div class="lp-pricing-card__price-block">
              <p
                class="lp-pricing-card__price lp-pricing-card__price--pro"
                data-price-monthly
              >
                R$ 49 <span class="lp-pricing-card__period">/ mês</span>
              </p>
              <div class="lp-pricing-card__price-annual" data-price-annual hidden>
                <p class="lp-pricing-card__price lp-pricing-card__price--pro">
                  R$ 34<span class="lp-pricing-card__cents">,92</span>
                  <span class="lp-pricing-card__period">/ mês</span>
                </p>
                <p class="lp-pricing-card__annual-detail">
                  R$ 419/ano
                  <span class="lp-pricing-card__save-pill">economiza R$ 169</span>
                </p>
              </div>
            </div>
            <ul class="lp-pricing-features">
              <li>${ICON_CHECK} <strong>Equipamentos ilimitados</strong></li>
              <li>${ICON_CHECK} <strong>PDFs e WhatsApp ilimitados</strong></li>
              <li>${ICON_CHECK} Assinatura digital no PDF</li>
              <li>${ICON_CHECK} <strong>Agrupamento por setores</strong></li>
              <li>${ICON_CHECK} Fotos dos equipamentos</li>
              <li>${ICON_CHECK} <strong>Suporte prioritário</strong></li>
            </ul>
            <button
              class="lp-pricing-card__cta lp-pricing-card__cta--pro"
              type="button"
              data-action="start-trial"
              data-source="pricing_pro"
            >
              Começar grátis
            </button>
            <p class="lp-pricing-card__microcopy">
              Teste grátis. Faça upgrade pra Pro quando precisar
            </p>
          </article>

        </div>
      </section>

      <!-- ── COUNTER-SIGNAL (pra quem é / não é) ── -->
      <section class="lp-fit" aria-labelledby="lp-fit-title">
        <p class="lp-section-label lp-fit__label">Honestidade</p>
        <h2 class="lp-fit__title" id="lp-fit-title">
          Não é pra todo mundo.<br>E isso é de propósito.
        </h2>

        <div class="lp-fit__grid">
          <article class="lp-fit__card lp-fit__card--yes" aria-label="Feito pra quem">
            <h3 class="lp-fit__card-title">
              <span class="lp-fit__badge lp-fit__badge--yes">Feito pra</span>
              técnicos que…
            </h3>
            <ul class="lp-fit__list lp-fit__list--yes">
              <li>${ICON_CHECK} Fazem manutenção em campo, longe da oficina</li>
              <li>${ICON_CHECK} Precisam de PDF assinado pra prestar contas</li>
              <li>${ICON_CHECK} Ainda usam papel, WhatsApp ou planilha e querem organizar</li>
              <li>${ICON_CHECK} Querem ver histórico completo de cada equipamento</li>
              <li>${ICON_CHECK} Trabalham em lugares com sinal ruim e precisam de offline</li>
            </ul>
          </article>

          <article class="lp-fit__card lp-fit__card--no" aria-label="Não serve pra quem">
            <h3 class="lp-fit__card-title">
              <span class="lp-fit__badge lp-fit__badge--no">Não serve</span>
              pra quem…
            </h3>
            <ul class="lp-fit__list lp-fit__list--no">
              <li>${ICON_X} Precisa de ERP completo com NFe integrada</li>
              <li>${ICON_X} Gerencia frota de 500+ equipamentos em paralelo</li>
              <li>${ICON_X} Trabalha só de desktop e nunca abre o celular em serviço</li>
              <li>${ICON_X} Quer um CRM de vendas (focamos em manutenção, não prospecção)</li>
            </ul>
          </article>
        </div>
      </section>

      <!-- ── FAQ ── -->
      <section class="lp-faq" aria-labelledby="lp-faq-title">
        <p class="lp-section-label lp-faq__label">Perguntas frequentes</p>
        <h2 class="lp-faq__title" id="lp-faq-title">Antes de começar.</h2>

        <div class="lp-faq__list">
          <details class="lp-faq__item" data-question="offline">
            <summary>Funciona mesmo sem internet?</summary>
            <p>
              Sim. O CoolTrack é offline-first: você cadastra equipamentos, registra serviços e gera PDFs em campo, mesmo sem sinal. A sincronização com a nuvem acontece automaticamente quando o celular reconecta.
            </p>
          </details>

          <details class="lp-faq__item" data-question="install">
            <summary>Preciso instalar alguma coisa?</summary>
            <p>
              Não. O CoolTrack é uma webapp (PWA) — abre no navegador do celular e dá pra adicionar à tela inicial em 2 toques. Funciona como app nativo, sem precisar baixar de loja.
            </p>
          </details>

          <details class="lp-faq__item" data-question="free_trial">
            <summary>Posso testar de graça antes de pagar?</summary>
            <p>
              Pode. O plano <strong>Free</strong> é gratuito pra sempre, sem pedir cartão. Você usa todo o app com 3 equipamentos e 10 registros/mês. Quando precisar de mais, faz upgrade pra Plus ou Pro a qualquer momento.
            </p>
          </details>

          <details class="lp-faq__item" data-question="signature">
            <summary>O PDF tem assinatura digital com validade?</summary>
            <p>
              O cliente assina o PDF com o dedo na tela do celular e a assinatura fica gravada no documento gerado. Disponível nos planos <strong>Plus</strong> e <strong>Pro</strong>. É reconhecida como evidência de execução do serviço.
            </p>
          </details>

          <details class="lp-faq__item" data-question="security">
            <summary>Meus dados ficam seguros?</summary>
            <p>
              Sim. Os dados ficam armazenados localmente no celular e sincronizados via Supabase com criptografia em trânsito. Mesmo cancelando a assinatura, todo o histórico continua acessível no plano Free.
            </p>
          </details>

          <details class="lp-faq__item" data-question="cancel">
            <summary>Posso cancelar a qualquer momento?</summary>
            <p>
              Pode. Sem multa, sem fidelidade. O acesso pago fica ativo até o fim do período já cobrado. Depois disso você volta automaticamente pro plano Free e continua usando o que já cadastrou.
            </p>
          </details>
        </div>
      </section>

      <!-- ── FINAL CTA (dual orb cyan+cyan + grad word "organizar") ── -->
      <section class="lp-final" aria-labelledby="lp-final-title">
        <div class="lp-final__card">
          <h2 class="lp-final__title" id="lp-final-title">
            Pronto para <span class="lp-grad">organizar</span> seus atendimentos?
          </h2>
          <p class="lp-final__sub">Comece agora. Leva menos de 30 segundos, sem cartão.</p>
          <div class="lp-final__ctas">
            <button
              class="lp-btn-primary"
              type="button"
              data-action="start-trial"
              data-source="final"
            >
              ${ICON_BOLT}
              Experimentar grátis
            </button>
            <button
              class="lp-btn-secondary"
              type="button"
              data-action="login"
              data-source="final"
            >
              Já tenho conta
            </button>
          </div>
        </div>
      </section>

      <!-- ── FOOTER ── -->
      <footer class="lp-footer" role="contentinfo">
        <div class="lp-footer__inner">
          <div class="lp-footer__brand-block">
            <div class="lp-brand">
              <div class="lp-brand__icon">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <g stroke="#00C8E8" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" fill="none">
                    <g>
                      <line x1="8" y1="2" x2="8" y2="14"/>
                      <polyline points="6.5,3.2 8,2 9.5,3.2"/>
                      <polyline points="6.5,12.8 8,14 9.5,12.8"/>
                    </g>
                    <g transform="rotate(60 8 8)">
                      <line x1="8" y1="2" x2="8" y2="14"/>
                      <polyline points="6.5,3.2 8,2 9.5,3.2"/>
                      <polyline points="6.5,12.8 8,14 9.5,12.8"/>
                    </g>
                    <g transform="rotate(120 8 8)">
                      <line x1="8" y1="2" x2="8" y2="14"/>
                      <polyline points="6.5,3.2 8,2 9.5,3.2"/>
                      <polyline points="6.5,12.8 8,14 9.5,12.8"/>
                    </g>
                  </g>
                  <circle cx="8" cy="8" r="0.9" fill="#00C8E8"/>
                </svg>
              </div>
              <span class="lp-brand__name">CoolTrack</span>
              <span class="lp-brand__badge">PRO</span>
            </div>
            <p class="lp-footer__tagline">
              Gestão de climatização e refrigeração para técnicos que vão a campo.
            </p>
          </div>

          <div class="lp-footer__cols">
            <nav class="lp-footer__col" aria-label="Produto">
              <h4 class="lp-footer__col-title">Produto</h4>
              <a class="lp-footer__link" href="#lp-pricing-title">Planos</a>
              <a class="lp-footer__link" href="#lp-faq-title">Perguntas frequentes</a>
              <button
                class="lp-footer__link"
                type="button"
                data-action="login"
                data-source="footer"
              >
                Entrar
              </button>
            </nav>

            <nav class="lp-footer__col" aria-label="Legal">
              <h4 class="lp-footer__col-title">Legal</h4>
              <a class="lp-footer__link" href="/legal/termos.html">Termos de uso</a>
              <a class="lp-footer__link" href="/legal/privacidade.html"
                >Política de privacidade</a
              >
              <a class="lp-footer__link" href="/legal/lgpd.html">LGPD</a>
            </nav>

            <nav class="lp-footer__col" aria-label="Contato">
              <h4 class="lp-footer__col-title">Contato</h4>
              <a class="lp-footer__link" href="mailto:suporte@cooltrackpro.com.br">
                suporte@cooltrackpro.com.br
              </a>
              <span class="lp-footer__meta">Resposta em até 24h úteis</span>
            </nav>
          </div>
        </div>

        <div class="lp-footer__bottom">
          <span class="lp-footer__copy">
            &copy; 2026 CoolTrack Pro. Todos os direitos reservados.
          </span>
          <span class="lp-footer__made">Feito no Brasil</span>
        </div>
      </footer>

    </div><!-- /.lp -->

    <!-- ── STICKY MOBILE ── -->
    <div class="lp-sticky">
      <button
        class="lp-btn-primary"
        type="button"
        data-action="start-trial"
        data-source="sticky"
      >
        ${ICON_BOLT}
        Experimentar grátis
      </button>
    </div>
  `;
}
