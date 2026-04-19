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
  const ICON_GOOGLE = `<svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/><path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/><path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/><path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/></svg>`;

  return `
    <div class="lp">

      <!-- ── TOPBAR ── -->
      <header class="lp-topbar">
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
        <button class="lp-nav-btn" type="button" data-action="login">
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
          Chega de manutenção no papel <br>e no <span class="lp-grad">achismo</span>.
        </h1>
        <p class="lp-sub">
          Registre serviços em campo, gere relatórios PDF com assinatura e nunca perca uma preventiva. Tudo no celular, funciona sem internet.
        </p>

        <div class="lp-ctas">
          <button class="lp-btn-primary" type="button" data-action="start-trial">
            ${ICON_BOLT}
            Experimentar grátis
          </button>
          <button class="lp-btn-secondary" type="button" data-action="login">
            ${ICON_GOOGLE}
            Continuar com Google
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

      <!-- ── SCREENSHOT GALLERY ── -->
      <section class="lp-gallery">
        <div class="lp-gallery__head">
          <div>
            <p class="lp-section-label">Veja o app em ação</p>
            <h2 class="lp-gallery__title">Feito para o campo,<br>do celular ao laudo.</h2>
          </div>
          <span class="lp-gallery__hint">Deslize ${ICON_CHEVRON}</span>
        </div>

        <div class="lp-gallery__track" id="lp-gallery-track">

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

      <!-- ── FINAL CTA (dual orb cyan+cyan + grad word "organizar") ── -->
      <section class="lp-final">
        <div class="lp-final__card">
          <div class="lp-final__title">
            Pronto para <span class="lp-grad">organizar</span> seus atendimentos?
          </div>
          <div class="lp-final__sub">Comece agora. Leva menos de 30 segundos, sem cartão.</div>
          <div class="lp-final__ctas">
            <button class="lp-btn-primary" type="button" data-action="start-trial">
              ${ICON_BOLT}
              Experimentar grátis
            </button>
            <button class="lp-btn-secondary" type="button" data-action="login">
              Já tenho conta
            </button>
          </div>
        </div>
      </section>

    </div><!-- /.lp -->

    <!-- ── STICKY MOBILE ── -->
    <div class="lp-sticky">
      <button class="lp-btn-primary" type="button" data-action="start-trial">
        ${ICON_BOLT}
        Experimentar grátis
      </button>
    </div>
  `;
}
