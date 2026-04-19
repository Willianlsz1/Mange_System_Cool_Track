import { Utils, TIPO_ICON } from '../../../core/utils.js';
import { setState } from '../../../core/state.js';
import { goTo } from '../../../core/router.js';
import { Profile } from '../../../features/profile.js';
import { trackEvent } from '../../../core/telemetry.js';
// Styles foram extraídos pra arquivo cacheável — Vite bundla junto com o
// chunk dinâmico desse módulo (só carrega quando o overlay precisa abrir).
import './firstTimeExperience.css';

const FTX_KEY = 'cooltrack-ftx-done';

function dismiss(overlay, { reason = 'completed' } = {}) {
  // Só emite onboarding_completed quando o usuário realmente terminou o fluxo
  // (reason === 'completed'). Se sair antes, emitimos onboarding_abandoned.
  if (!localStorage.getItem(FTX_KEY)) {
    trackEvent(reason === 'completed' ? 'onboarding_completed' : 'onboarding_abandoned', {
      reason,
    });
  }
  localStorage.setItem(FTX_KEY, '1');
  overlay.style.animation = 'ftx-fade-in .2s ease reverse';
  setTimeout(() => overlay.remove(), 200);
}

export const FirstTimeExperience = {
  show(equipamentos) {
    if (equipamentos.length || localStorage.getItem(FTX_KEY)) return;

    // Primeira vez que o overlay vai aparecer — marca início da ativação.
    trackEvent('onboarding_started', {});

    document.getElementById('ftx-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'ftx-overlay';
    // Estilo completo definido em firstTimeExperience.css (via #ftx-overlay)

    overlay.innerHTML = `
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

          <div class="ftx-eyebrow">Bem-vindo</div>
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

          <label class="ftx-form-label">Como você se chama?</label>
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
        input.classList.remove('ftx-input--error');
        input.placeholder = 'Seu nome completo...';
      });

      btn.addEventListener('click', () => {
        const nome = input.value.trim();
        if (!nome) {
          input.classList.add('ftx-input--error');
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
          <div class="ftx-eyebrow">Passo 1 de 3</div>
          <div class="ftx-title">Qual equipamento você quer monitorar, ${Utils.escapeHtml(firstName)}?</div>
          <div class="ftx-desc">Comece com o mais importante — você pode adicionar mais depois.</div>

          <label class="ftx-form-label">Nome do equipamento *</label>
          <input class="ftx-input" id="ftx-eq-nome" type="text"
            placeholder="Ex: Split da recepção, Câmara do estoque..."
            autocomplete="off" />

          <label class="ftx-form-label">Onde ele fica? *</label>
          <input class="ftx-input" id="ftx-eq-local" type="text"
            placeholder="Ex: Sala dos fundos, Galpão A, 2º andar..."
            autocomplete="off" />

          <div class="ftx-row">
            <div>
              <label class="ftx-form-label">Tipo</label>
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
              <label class="ftx-form-label">Fluido</label>
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
        nomeInput.classList.remove('ftx-input--error');
      });
      localInput?.addEventListener('input', () => {
        localInput.classList.remove('ftx-input--error');
      });

      btn.addEventListener('click', () => {
        const nome = nomeInput.value.trim();
        const local = localInput.value.trim();

        if (!nome) {
          nomeInput.classList.add('ftx-input--error');
          nomeInput.focus();
          return;
        }
        if (!local) {
          localInput.classList.add('ftx-input--error');
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

        // Este é SEMPRE o primeiro equipamento — FTX só roda quando a lista está vazia.
        // Fonte primária pra medir ativação (visita → primeiro equipamento).
        trackEvent('first_equipment_added', {
          source: 'onboarding',
          tipo: equipData.tipo,
          fluido: equipData.fluido,
        });

        renderStep2Preview();
      });
    };

    const renderStep2Preview = () => {
      setDots(2);

      contentEl.innerHTML = `
        <div class="ftx-step">
          <div class="ftx-eyebrow">Passo 2 de 3</div>
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
          <div class="ftx-eyebrow" style="text-align:center;color:var(--success)">Tudo pronto</div>
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
