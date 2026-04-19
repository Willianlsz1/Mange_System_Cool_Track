import { Utils, TIPO_ICON } from '../../../core/utils.js';
import { setState } from '../../../core/state.js';
import { goTo } from '../../../core/router.js';
import { Profile } from '../../../features/profile.js';

const FTX_KEY = 'cooltrack-ftx-done';

function dismiss(overlay) {
  localStorage.setItem(FTX_KEY, '1');
  overlay.style.animation = 'ftx-fade-in .2s ease reverse';
  setTimeout(() => overlay.remove(), 200);
}

export const FirstTimeExperience = {
  show(equipamentos) {
    if (equipamentos.length || localStorage.getItem(FTX_KEY)) return;

    document.getElementById('ftx-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'ftx-overlay';
    overlay.style.cssText = `
      position:fixed;inset:0;z-index:200;
      background:rgba(7,17,31,0.92);
      display:flex;align-items:center;justify-content:center;
      padding:16px;
      animation:ftx-fade-in .25s ease;
    `;

    overlay.innerHTML = `
      <style>
        @keyframes ftx-fade-in{from{opacity:0}to{opacity:1}}
        @keyframes ftx-slide-up{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes ftx-step-in{from{opacity:0;transform:translateX(24px)}to{opacity:1;transform:translateX(0)}}

        #ftx-card{
          background:#0C1929;
          border:1px solid rgba(0,200,232,0.15);
          border-radius:16px;
          width:100%;max-width:480px;
          padding:32px;
          animation:ftx-slide-up .3s ease;
          position:relative;
        }

        .ftx-steps{
          display:flex;align-items:center;gap:6px;
          margin-bottom:28px;
        }
        .ftx-step-dot{
          width:6px;height:6px;border-radius:50%;
          background:rgba(0,200,232,0.2);
          transition:all .2s;
        }
        .ftx-step-dot.active{
          background:#00C8E8;width:20px;border-radius:3px;
        }
        .ftx-step-dot.done{background:rgba(0,200,112,0.6)}

        .ftx-step{animation:ftx-step-in .25s ease}

        .ftx-logo{
          display:flex;align-items:center;gap:10px;
          margin-bottom:24px;
        }
        .ftx-logo-icon{
          width:40px;height:40px;
          background:rgba(0,200,232,0.1);
          border:1px solid rgba(0,200,232,0.2);
          border-radius:10px;
          display:flex;align-items:center;justify-content:center;
        }
        .ftx-logo-text{font-size:18px;font-weight:600;color:#E8F2FA;letter-spacing:.02em}
        .ftx-logo-sub{
          font-size:9px;font-weight:600;letter-spacing:.1em;
          color:#00C8E8;background:rgba(0,200,232,0.1);
          border:1px solid rgba(0,200,232,0.2);
          padding:2px 6px;border-radius:4px;
        }

        .ftx-eyebrow{
          font-size:11px;font-weight:600;letter-spacing:.1em;
          color:#00C8E8;margin-bottom:8px;
        }
        .ftx-title{
          font-size:22px;font-weight:700;color:#E8F2FA;
          line-height:1.25;margin-bottom:10px;
        }
        .ftx-desc{
          font-size:14px;color:#8AAAC8;line-height:1.6;
          margin-bottom:24px;
        }

        .ftx-form-label{
          font-size:11px;font-weight:600;color:#6A8BA8;
          letter-spacing:.06em;margin-bottom:6px;display:block;
        }
        .ftx-input{
          width:100%;background:rgba(255,255,255,0.05);
          border:1px solid rgba(255,255,255,0.1);
          border-radius:8px;padding:12px 14px;
          font-size:15px;color:#E8F2FA;
          font-family:inherit;outline:none;
          transition:border-color .15s;
          margin-bottom:14px;
        }
        .ftx-input:focus{border-color:rgba(0,200,232,0.5)}
        .ftx-input::placeholder{color:rgba(138,170,200,0.4)}
        .ftx-select{
          width:100%;background:rgba(255,255,255,0.05);
          border:1px solid rgba(255,255,255,0.1);
          border-radius:8px;padding:12px 14px;
          font-size:15px;color:#E8F2FA;
          font-family:inherit;outline:none;
          transition:border-color .15s;
          margin-bottom:14px;
          cursor:pointer;
        }
        .ftx-select:focus{border-color:rgba(0,200,232,0.5)}
        .ftx-select option{background:#0C1929;color:#E8F2FA}

        .ftx-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}

        .ftx-btn-primary{
          width:100%;background:#00C8E8;color:#07111F;
          border:none;border-radius:10px;
          padding:14px;font-size:15px;font-weight:600;
          font-family:inherit;cursor:pointer;
          transition:opacity .15s,transform .1s;
        }
        .ftx-btn-primary:hover{opacity:.92}
        .ftx-btn-primary:active{transform:scale(.99)}
        .ftx-btn-primary:disabled{opacity:.4;cursor:not-allowed}

        .ftx-hint{
          font-size:12px;color:rgba(138,170,200,0.5);
          text-align:center;margin-top:12px;
        }

        .ftx-success-icon{
          width:56px;height:56px;border-radius:50%;
          background:rgba(0,200,112,0.15);
          border:1px solid rgba(0,200,112,0.3);
          display:flex;align-items:center;justify-content:center;
          margin:0 auto 20px;
          font-size:24px;
        }
        .ftx-actions{display:flex;flex-direction:column;gap:10px;margin-top:20px}
        .ftx-btn-sec{
          width:100%;background:transparent;
          border:1px solid rgba(255,255,255,0.1);
          border-radius:10px;padding:13px;
          font-size:14px;color:#8AAAC8;
          font-family:inherit;cursor:pointer;
          transition:border-color .15s,color .15s;
        }
        .ftx-btn-sec:hover{border-color:rgba(255,255,255,0.2);color:#E8F2FA}

        .ftx-value-props{
          display:flex;flex-direction:column;gap:8px;
          margin-bottom:24px;
        }
        .ftx-prop{
          display:flex;align-items:center;gap:10px;
          font-size:13px;color:#8AAAC8;
        }
        .ftx-prop-icon{
          width:28px;height:28px;border-radius:6px;
          background:rgba(0,200,232,0.08);
          border:1px solid rgba(0,200,232,0.15);
          display:flex;align-items:center;justify-content:center;
          font-size:13px;flex-shrink:0;
        }
        .ftx-report-copy-top{
          font-size:14px;color:#CFE2F4;line-height:1.5;
          margin-bottom:14px;
        }
        .ftx-report-preview-wrap{
          position:relative;
          max-height:280px;
          overflow:hidden;
          border-radius:10px;
          border:1px solid rgba(255,255,255,0.14);
          margin-bottom:14px;
          background:#fff;
        }
        .ftx-report-preview-wrap::after{
          content:"";
          position:absolute;
          left:0;right:0;bottom:0;
          height:58px;
          background:linear-gradient(180deg,rgba(255,255,255,0) 0%,#fff 78%);
          pointer-events:none;
        }
        .ftx-report-preview{
          background:#fff;
          color:#1B2430;
          padding:14px;
          font-size:11px;
          line-height:1.45;
        }
        .ftx-report-header{
          display:flex;align-items:center;justify-content:space-between;
          gap:10px;padding-bottom:10px;border-bottom:1px solid #DCE4EC;
          margin-bottom:10px;
        }
        .ftx-report-brand{
          display:flex;align-items:center;gap:8px;
          font-size:12px;font-weight:700;color:#0F2237;
        }
        .ftx-report-logo{
          width:22px;height:22px;border-radius:6px;
          background:#E8F8FC;border:1px solid #BCEAF3;
          display:flex;align-items:center;justify-content:center;
          color:#0089A0;font-size:12px;
        }
        .ftx-report-meta{
          display:grid;grid-template-columns:1fr 1fr;gap:8px 12px;
          margin-bottom:10px;
        }
        .ftx-report-meta span{display:block;color:#5A6A7D;font-size:10px}
        .ftx-report-meta strong{font-size:11px;color:#162232}
        .ftx-report-table{
          width:100%;border-collapse:collapse;
          margin-bottom:14px;
        }
        .ftx-report-table th,
        .ftx-report-table td{
          border:1px solid #DEE6EE;
          padding:6px 7px;
          text-align:left;
          vertical-align:top;
          font-size:10px;
        }
        .ftx-report-table th{
          background:#F5F8FB;
          color:#33445A;
          font-weight:700;
        }
        .ftx-signature-mock{
          margin-top:14px;
          padding-top:12px;
          border-top:1px solid #E2E8EF;
        }
        .ftx-signature-line{
          margin-top:18px;
          border-top:1px dashed #8A98A8;
          padding-top:6px;
          font-size:10px;
          color:#4C5C6E;
          width:68%;
        }
        .ftx-report-copy-bottom{
          text-align:center;
          color:#8AAAC8;
          font-size:13px;
          margin-bottom:16px;
        }
      </style>

      <div id="ftx-card">
        <div class="ftx-steps">
          <div class="ftx-step-dot active" id="ftx-dot-0"></div>
          <div class="ftx-step-dot" id="ftx-dot-1"></div>
          <div class="ftx-step-dot" id="ftx-dot-2"></div>
          <div class="ftx-step-dot" id="ftx-dot-3"></div>
        </div>
        <div id="ftx-content"></div>
      </div>
    `;

    document.body.appendChild(overlay);

    let techName = Profile.get()?.nome || '';
    let equipData = {};
    const todayLabel = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(new Date());

    const contentEl = overlay.querySelector('#ftx-content');

    const setDots = (current) => {
      [0, 1, 2, 3].forEach((i) => {
        const dot = overlay.querySelector(`#ftx-dot-${i}`);
        dot.className = 'ftx-step-dot' + (i === current ? ' active' : i < current ? ' done' : '');
      });
    };

    const renderStep0 = () => {
      setDots(0);
      contentEl.innerHTML = `
        <div class="ftx-step">
          <div class="ftx-logo">
            <div class="ftx-logo-icon">
              <svg width="20" height="20" viewBox="0 0 16 16" fill="none" aria-hidden="true">
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
            <span class="ftx-logo-text">CoolTrack</span>
            <span class="ftx-logo-sub">PRO</span>
          </div>

          <div class="ftx-eyebrow">BEM-VINDO</div>
          <div class="ftx-title">Chega de planilha. Seus relatorios prontos em 30 segundos.</div>

          <div class="ftx-value-props">
            <div class="ftx-prop">
              <div class="ftx-prop-icon">📄</div>
              Gere relatórios PDF com assinatura do cliente em segundos
            </div>
            <div class="ftx-prop">
              <div class="ftx-prop-icon">🔔</div>
              Nunca mais perca uma preventiva — alertas automáticos
            </div>
            <div class="ftx-prop">
              <div class="ftx-prop-icon">📱</div>
              Registre serviços em campo, funciona sem internet
            </div>
          </div>

          <label class="ftx-form-label">COMO VOCÊ SE CHAMA?</label>
          <input class="ftx-input" id="ftx-nome" type="text"
            placeholder="Seu nome completo..."
            value="${Utils.escapeAttr(techName)}"
            autocomplete="name" />

          <button class="ftx-btn-primary" id="ftx-next-0">
            Vamos la &rarr;
          </button>
          <div class="ftx-hint">2 minutos para configurar &middot; Sem cartão de crédito</div>
        </div>`;

      const input = overlay.querySelector('#ftx-nome');
      const btn = overlay.querySelector('#ftx-next-0');

      setTimeout(() => input?.focus(), 100);

      input?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') btn.click();
      });
      input?.addEventListener('input', () => {
        input.style.borderColor = '';
        input.placeholder = 'Seu nome completo...';
      });

      btn.addEventListener('click', () => {
        const nome = input.value.trim();
        if (!nome) {
          input.style.borderColor = 'rgba(224,48,64,0.6)';
          input.placeholder = 'Digite seu nome para continuar';
          input.focus();
          return;
        }
        techName = nome;
        Profile.save({ ...Profile.get(), nome });
        Profile.saveLastTecnico(nome);
        renderStep1();
      });
    };

    const renderStep1 = () => {
      setDots(1);
      const firstName = techName.split(' ')[0];

      contentEl.innerHTML = `
        <div class="ftx-step">
          <div class="ftx-eyebrow">PASSO 1 DE 3</div>
          <div class="ftx-title">Qual equipamento você quer monitorar, ${Utils.escapeHtml(firstName)}?</div>
          <div class="ftx-desc">Comece com o mais importante — você pode adicionar mais depois.</div>

          <label class="ftx-form-label">NOME DO EQUIPAMENTO *</label>
          <input class="ftx-input" id="ftx-eq-nome" type="text"
            placeholder="Ex: Split da recepção, Câmara do estoque..."
            autocomplete="off" />

          <label class="ftx-form-label">ONDE ELE FICA? *</label>
          <input class="ftx-input" id="ftx-eq-local" type="text"
            placeholder="Ex: Sala dos fundos, Galpão A, 2º andar..."
            autocomplete="off" />

          <div class="ftx-row">
            <div>
              <label class="ftx-form-label">TIPO</label>
              <select class="ftx-select" id="ftx-eq-tipo">
                <option>Split Hi-Wall</option>
                <option>Split Cassette</option>
                <option>Split Piso Teto</option>
                <option>VRF / VRV</option>
                <option>Chiller</option>
                <option>Fan Coil</option>
                <option>Self Contained</option>
                <option>Roof Top</option>
                <option>Câmara Fria</option>
                <option>Outro</option>
              </select>
            </div>
            <div>
              <label class="ftx-form-label">FLUIDO</label>
              <select class="ftx-select" id="ftx-eq-fluido">
                <option>R-410A</option>
                <option>R-22</option>
                <option>R-32</option>
                <option>R-407C</option>
                <option>R-134A</option>
                <option>R-404A</option>
                <option>Outro</option>
              </select>
            </div>
          </div>

          <button class="ftx-btn-primary" id="ftx-next-1">
            Salvar e continuar &rarr;
          </button>
          <div class="ftx-hint">Você edita ou exclui a qualquer momento</div>
        </div>`;

      const nomeInput = overlay.querySelector('#ftx-eq-nome');
      const localInput = overlay.querySelector('#ftx-eq-local');
      const btn = overlay.querySelector('#ftx-next-1');

      setTimeout(() => nomeInput?.focus(), 100);
      nomeInput?.addEventListener('input', () => {
        nomeInput.style.borderColor = '';
      });
      localInput?.addEventListener('input', () => {
        localInput.style.borderColor = '';
      });

      btn.addEventListener('click', () => {
        const nome = nomeInput.value.trim();
        const local = localInput.value.trim();

        if (!nome) {
          nomeInput.style.borderColor = 'rgba(224,48,64,0.6)';
          nomeInput.focus();
          return;
        }
        if (!local) {
          localInput.style.borderColor = 'rgba(224,48,64,0.6)';
          localInput.focus();
          return;
        }

        equipData = {
          id: Utils.uid(),
          nome,
          local,
          status: 'ok',
          tag: '',
          tipo: overlay.querySelector('#ftx-eq-tipo').value,
          fluido: overlay.querySelector('#ftx-eq-fluido').value,
          modelo: '',
        };

        setState((prev) => ({
          ...prev,
          equipamentos: [...prev.equipamentos, equipData],
          tecnicos: prev.tecnicos.includes(techName) ? prev.tecnicos : [...prev.tecnicos, techName],
        }));

        renderStep2Preview();
      });
    };

    const renderStep2Preview = () => {
      setDots(2);

      contentEl.innerHTML = `
        <div class="ftx-step">
          <div class="ftx-eyebrow">PASSO 2 DE 3</div>
          <div class="ftx-report-copy-top">Esse e o tipo de relatorio que seus clientes vao receber.</div>

          <div class="ftx-report-preview-wrap" role="presentation">
            <div class="ftx-report-preview">
              <div class="ftx-report-header">
                <div class="ftx-report-brand">
                  <span class="ftx-report-logo">❄️</span>
                  <span>CoolTrack Pro — Relatorio de Servico</span>
                </div>
              </div>

              <div class="ftx-report-meta">
                <div><span>Tecnico</span><strong>${Utils.escapeHtml(techName)}</strong></div>
                <div><span>Data</span><strong>${Utils.escapeHtml(todayLabel)}</strong></div>
                <div><span>Equipamento</span><strong>${Utils.escapeHtml(equipData.nome)}</strong></div>
                <div><span>Tipo de servico</span><strong>Manutencao Preventiva</strong></div>
              </div>

              <table class="ftx-report-table" aria-label="Preview de relatorio">
                <thead>
                  <tr>
                    <th>Servico</th>
                    <th>Status</th>
                    <th>Obs</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Limpeza de filtros</td>
                    <td>Concluido</td>
                    <td>Fluxo de ar estabilizado</td>
                  </tr>
                  <tr>
                    <td>Inspecao eletrica</td>
                    <td>Concluido</td>
                    <td>Sem aquecimento anormal</td>
                  </tr>
                  <tr>
                    <td>Verificacao de dreno</td>
                    <td>Concluido</td>
                    <td>Sem obstrucao detectada</td>
                  </tr>
                </tbody>
              </table>

              <div class="ftx-signature-mock">
                <span>Assinatura do cliente</span>
                <div class="ftx-signature-line">Nome e assinatura</div>
              </div>
            </div>
          </div>

          <div class="ftx-report-copy-bottom">Profissional. Automatico. Com a sua marca.</div>

          <button class="ftx-btn-primary" id="ftx-next-2">
            Quero gerar relatorios assim &rarr;
          </button>
        </div>`;

      overlay.querySelector('#ftx-next-2').addEventListener('click', () => {
        renderStep3Success();
      });
    };

    const renderStep3Success = () => {
      setDots(3);
      const icon = TIPO_ICON[equipData.tipo] ?? '⚙️';
      const firstName = techName.split(' ')[0];

      contentEl.innerHTML = `
        <div class="ftx-step">
          <div class="ftx-success-icon">✅</div>
          <div class="ftx-eyebrow" style="text-align:center;color:#00C870">TUDO PRONTO</div>
          <div class="ftx-title" style="text-align:center">
            ${icon} ${Utils.escapeHtml(equipData.nome)} cadastrado!
          </div>
          <div class="ftx-desc" style="text-align:center">
            Agora registre o primeiro serviço, ${Utils.escapeHtml(firstName)}.<br>
            O histórico começa aqui.
          </div>

          <div class="ftx-actions">
            <button class="ftx-btn-primary" id="ftx-go-registro">
              Registrar meu primeiro servico &rarr;
            </button>
            <button class="ftx-btn-sec" id="ftx-go-dashboard">
              Explorar o painel
            </button>
          </div>

          <div class="ftx-hint" style="margin-top:16px">
            Dica: quanto mais você registra, mais preciso fica o score de eficiência
          </div>
        </div>`;

      overlay.querySelector('#ftx-go-registro').addEventListener('click', () => {
        dismiss(overlay);
        requestAnimationFrame(() => {
          goTo('registro');
          setTimeout(() => {
            const sel = document.getElementById('r-equip');
            if (sel) sel.value = equipData.id;
            const tecInput = document.getElementById('r-tecnico');
            if (tecInput && !tecInput.value) tecInput.value = techName;
          }, 150);
        });
      });

      overlay.querySelector('#ftx-go-dashboard').addEventListener('click', () => {
        dismiss(overlay);
        goTo('inicio');
        setTimeout(() => {
          import('../../views/dashboard.js').then(({ renderDashboard, updateHeader }) => {
            updateHeader();
            renderDashboard();
          });
        }, 250);
      });
    };

    renderStep0();
  },
};
