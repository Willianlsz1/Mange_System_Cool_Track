/**
 * CoolTrack Pro - LandingPage / template
 * Markup HTML da landing page (hero, features, galeria de screenshots,
 * passos, CTA final e sticky mobile). Exportado como função pura para o
 * orquestrador compor dentro do <style> + markup.
 */

export function buildLandingHtml() {
  return `
    <div class="lp">

      <!-- ── TOPBAR ── -->
      <header class="lp-topbar">
        <div class="lp-brand">
          <div class="lp-brand__icon">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="1" width="14" height="14" rx="2" stroke="#00C8E8" stroke-width="1.2"/>
              <circle cx="8" cy="8" r="2.5" stroke="#00C8E8" stroke-width="1.2"/>
              <path d="M8 1v2.5M8 12.5V15M1 8h2.5M12.5 8H15" stroke="#00C8E8" stroke-width="1.2" stroke-linecap="round"/>
            </svg>
          </div>
          <span class="lp-brand__name">CoolTrack</span>
          <span class="lp-brand__badge">PRO</span>
        </div>
        <button class="lp-nav-btn" type="button" data-action="login">
          <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
            <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
          </svg>
          Entrar
        </button>
      </header>

      <!-- ── HERO ── -->
      <section class="lp-hero">
        <span class="lp-kicker">Para técnicos de climatização</span>

        <h1 class="lp-h1">
          Chega de manutenção<br><em>no papel e no achismo.</em>
        </h1>
        <p class="lp-sub">
          Registre serviços em campo, gere relatórios PDF com assinatura e nunca perca uma preventiva. Tudo no celular, funciona sem internet.
        </p>

        <div class="lp-ctas">
          <button class="lp-btn-primary" type="button" data-action="start-trial">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            Testar agora — grátis
          </button>
          <button class="lp-btn-secondary" type="button" data-action="login">
            <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
            </svg>
            Entrar com Google
          </button>
        </div>
        <p class="lp-microcopy">Sem cadastro &bull; Sem cartão de crédito &bull; Comece em segundos</p>

        <!-- Product mockup -->
        <div class="lp-mockup">
          <div class="lp-mockup__bar"></div>
          <div class="lp-mockup__header">
            <span class="lp-mockup__equip">Hospital Central — Chiller 02</span>
            <span class="lp-mockup__score">Risco: 87</span>
          </div>
          <span class="lp-mockup__badge">ALERTA CRÍTICO</span>
          <p class="lp-mockup__action">⚡ Ação sugerida: Inspecionar compressor e registrar corretiva imediata</p>
          <div class="lp-mockup__chips">
            <span class="lp-mockup__chip">Prioridade: Máxima</span>
            <span class="lp-mockup__chip">Último serviço: 18 dias</span>
            <span class="lp-mockup__chip">3 ocorrências este mês</span>
          </div>
        </div>
      </section>

      <!-- ── FEATURES ── -->
      <section class="lp-features">
        <div class="lp-features__grid">
          <div class="lp-feat">
            <div class="lp-feat__icon">📋</div>
            <div>
              <div class="lp-feat__title">Relatório PDF em 1 toque</div>
              <div class="lp-feat__desc">Laudo profissional pronto para enviar pelo WhatsApp, com fotos e assinatura do cliente.</div>
            </div>
          </div>
          <div class="lp-feat">
            <div class="lp-feat__icon">🧊</div>
            <div>
              <div class="lp-feat__title">Histórico de cada equipamento</div>
              <div class="lp-feat__desc">Todas as manutenções, peças e anomalias organizadas por unidade atendida.</div>
            </div>
          </div>
          <div class="lp-feat">
            <div class="lp-feat__icon">🚨</div>
            <div>
              <div class="lp-feat__title">Alertas de preventivas</div>
              <div class="lp-feat__desc">O sistema avisa o que está vencido ou perto do prazo — sem planilha, sem achismo.</div>
            </div>
          </div>
        </div>
      </section>

      <!-- ── SCREENSHOT GALLERY ── -->
      <section class="lp-gallery">
        <div class="lp-gallery__head">
          <div>
            <p class="lp-section-label" style="margin-bottom:8px">Veja o app em ação</p>
            <h2 class="lp-gallery__title">Feito para o campo,<br>do celular ao laudo.</h2>
          </div>
          <span class="lp-gallery__hint">Deslize ›</span>
        </div>

        <div class="lp-gallery__track" id="lp-gallery-track">

          <!-- 1 · Painel Geral -->
          <div class="lp-screen">
            <div class="lp-screen__status">
              <span>9:41</span>
              <span>▮▮▮ ◀</span>
            </div>
            <div class="lp-screen__header">
              <div class="lp-screen__header-label">CoolTrack PRO</div>
              <div class="lp-screen__header-title">Painel Geral</div>
            </div>
            <div class="lp-screen__body">
              <div class="lp-sc-tiles">
                <div class="lp-sc-tile">
                  <div class="lp-sc-tile__val" style="color:#d8eaf6">8</div>
                  <div class="lp-sc-tile__lbl">Equipamentos</div>
                </div>
                <div class="lp-sc-tile">
                  <div class="lp-sc-tile__val" style="color:#e03040">2</div>
                  <div class="lp-sc-tile__lbl">Atenção</div>
                </div>
                <div class="lp-sc-tile">
                  <div class="lp-sc-tile__val" style="color:#00c870">5</div>
                  <div class="lp-sc-tile__lbl">Operando</div>
                </div>
                <div class="lp-sc-tile">
                  <div class="lp-sc-tile__val" style="color:#e8a020">1</div>
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
              <span>▮▮▮ ◀</span>
            </div>
            <div class="lp-screen__header">
              <div class="lp-screen__header-label">Equipamento</div>
              <div class="lp-screen__header-title">Chiller 02</div>
            </div>
            <div class="lp-screen__body">
              <div class="lp-sc-alert lp-sc-alert--danger">
                <div class="lp-sc-alert__title">⚡ Ação recomendada</div>
                <div class="lp-sc-alert__sub">Inspecionar compressor — corretiva urgente</div>
              </div>
              <div class="lp-sc-tiles" style="grid-template-columns:1fr 1fr 1fr; gap:4px">
                <div class="lp-sc-tile">
                  <div class="lp-sc-tile__val" style="color:#e03040;font-size:14px">87</div>
                  <div class="lp-sc-tile__lbl">Risco</div>
                </div>
                <div class="lp-sc-tile">
                  <div class="lp-sc-tile__val" style="color:#d8eaf6;font-size:14px">18</div>
                  <div class="lp-sc-tile__lbl">Dias</div>
                </div>
                <div class="lp-sc-tile">
                  <div class="lp-sc-tile__val" style="color:#e8a020;font-size:14px">3</div>
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
              <span>▮▮▮ ◀</span>
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
                <div style="width:28px;height:28px;background:rgba(0,200,232,.1);border:1px solid rgba(0,200,232,.2);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:14px">📷</div>
                <div style="font-size:9px;color:#2a4258">2 fotos anexadas</div>
              </div>
            </div>
          </div>

          <!-- 4 · Alertas e Pendências -->
          <div class="lp-screen">
            <div class="lp-screen__status">
              <span>9:41</span>
              <span>▮▮▮ ◀</span>
            </div>
            <div class="lp-screen__header">
              <div class="lp-screen__header-label">CoolTrack PRO</div>
              <div class="lp-screen__header-title">Alertas</div>
            </div>
            <div class="lp-screen__body">
              <div class="lp-sc-section" style="color:#e03040">🔴 Intervenção imediata</div>
              <div class="lp-sc-alert lp-sc-alert--danger">
                <div class="lp-sc-alert__title">Chiller 02 — Hospital</div>
                <div class="lp-sc-alert__sub">Risco 87 · Compressor com falha</div>
              </div>
              <div class="lp-sc-alert lp-sc-alert--danger">
                <div class="lp-sc-alert__title">VRF Bloco B — Andar 3</div>
                <div class="lp-sc-alert__sub">Risco 74 · Sem serviço há 45 dias</div>
              </div>
              <div class="lp-sc-section" style="color:#e8a020;margin-top:4px">🟡 Preventivas próximas</div>
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
              <span>▮▮▮ ◀</span>
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
                    <div class="lp-sc-pdf__stat-val" style="color:#d8eaf6">12</div>
                    <div class="lp-sc-pdf__stat-lbl">Serviços</div>
                  </div>
                  <div class="lp-sc-pdf__stat">
                    <div class="lp-sc-pdf__stat-val" style="color:#00c870">9</div>
                    <div class="lp-sc-pdf__stat-lbl">Operando</div>
                  </div>
                  <div class="lp-sc-pdf__stat">
                    <div class="lp-sc-pdf__stat-val" style="color:#e8a020">2</div>
                    <div class="lp-sc-pdf__stat-lbl">Atenção</div>
                  </div>
                  <div class="lp-sc-pdf__stat">
                    <div class="lp-sc-pdf__stat-val" style="color:#e03040">1</div>
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
              <button class="lp-sc-fab">📤 Enviar pelo WhatsApp</button>
              <div style="text-align:center;font-size:8px;color:#1e3a52;margin-top:4px">PDF gerado em 1 toque</div>
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

      <!-- ── HOW IT WORKS ── -->
      <section class="lp-how">
        <p class="lp-section-label">Como funciona</p>
        <div class="lp-how__steps">
          <div class="lp-step">
            <div class="lp-step__num">1</div>
            <div>
              <div class="lp-step__title">Chegou no equipamento?</div>
              <div class="lp-step__desc">Abra o CoolTrack, selecione o equipamento e veja o histórico completo na tela.</div>
            </div>
          </div>
          <div class="lp-step">
            <div class="lp-step__num">2</div>
            <div>
              <div class="lp-step__title">Registre o serviço</div>
              <div class="lp-step__desc">Descrição, fotos, peças trocadas e assinatura — tudo em menos de 2 minutos.</div>
            </div>
          </div>
          <div class="lp-step">
            <div class="lp-step__num">3</div>
            <div>
              <div class="lp-step__title">Gere o PDF e envie</div>
              <div class="lp-step__desc">Um toque gera o laudo com sua marca. Envie pelo WhatsApp direto para o cliente.</div>
            </div>
          </div>
        </div>
      </section>

      <!-- ── FINAL CTA ── -->
      <section class="lp-final">
        <div class="lp-final__card">
          <div class="lp-final__title">Pronto para organizar seus atendimentos?</div>
          <div class="lp-final__sub">Comece agora. Leva menos de 30 segundos, sem cartão.</div>
          <div class="lp-final__ctas">
            <button class="lp-btn-primary" type="button" data-action="start-trial">
              Testar grátis agora
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
        Testar agora — grátis, sem cadastro
      </button>
    </div>
  `;
}
