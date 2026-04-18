/**
 * CoolTrack Pro - FirstTimeExperience / steps
 * Renderização + interação dos 4 passos do onboarding guiado:
 *   0. boas-vindas + nome do técnico
 *   1. primeiro equipamento
 *   2. preview do relatório
 *   3. sucesso + CTA para registro/dashboard
 *
 * Cada passo recebe um `ctx` mutável compartilhado
 * ({ overlay, contentEl, techName, equipData, todayLabel, setDots, dismiss })
 * e chama o próximo renderer diretamente.
 */

import { Utils, TIPO_ICON } from '../../../../core/utils.js';
import { setState } from '../../../../core/state.js';
import { goTo } from '../../../../core/router.js';
import { Profile } from '../../../../features/profile.js';

export function renderStep0(ctx) {
  const { overlay, contentEl, setDots, techName } = ctx;
  setDots(0);
  contentEl.innerHTML = `
    <div class="ftx-step">
      <div class="ftx-logo">
        <div class="ftx-logo-icon">
          <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
            <rect x="1" y="1" width="14" height="14" rx="2" stroke="#00C8E8" stroke-width="1.2"/>
            <circle cx="8" cy="8" r="2.5" stroke="#00C8E8" stroke-width="1.2"/>
            <path d="M8 1v2.5M8 12.5V15M1 8h2.5M12.5 8H15" stroke="#00C8E8" stroke-width="1.2" stroke-linecap="round"/>
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
    ctx.techName = nome;
    Profile.save({ ...Profile.get(), nome });
    Profile.saveLastTecnico(nome);
    renderStep1(ctx);
  });
}

export function renderStep1(ctx) {
  const { overlay, contentEl, setDots } = ctx;
  setDots(1);
  const firstName = ctx.techName.split(' ')[0];

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

    ctx.equipData = {
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
      equipamentos: [...prev.equipamentos, ctx.equipData],
      tecnicos: prev.tecnicos.includes(ctx.techName)
        ? prev.tecnicos
        : [...prev.tecnicos, ctx.techName],
    }));

    renderStep2Preview(ctx);
  });
}

export function renderStep2Preview(ctx) {
  const { overlay, contentEl, setDots, techName, equipData, todayLabel } = ctx;
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
    renderStep3Success(ctx);
  });
}

export function renderStep3Success(ctx) {
  const { overlay, contentEl, setDots, techName, equipData, dismiss } = ctx;
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
    dismiss();
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
    dismiss();
    goTo('inicio');
    setTimeout(() => {
      import('../../../views/dashboard.js').then(({ renderDashboard, updateHeader }) => {
        updateHeader();
        renderDashboard();
      });
    }, 250);
  });
}
