import { getState } from '../../../core/state.js';

// Mantida em sync com a constante em firstTimeExperience.js. Evitamos importar
// esse módulo aqui de forma estática pra não arrastar o CSS/assets do overlay
// no chunk inicial — o FirstTimeExperience é carregado sob demanda quando
// o banner de retomada é acionado.
const FTX_SKIP_KEY = 'cooltrack-ftx-skipped';

export const OnboardingBanner = {
  render() {
    const { equipamentos } = getState();
    const bannerEl = document.getElementById('onboarding-banner');
    if (equipamentos.length) {
      if (bannerEl) bannerEl.remove();
      return;
    }
    if (bannerEl) return;

    const wasSkipped = !!localStorage.getItem(FTX_SKIP_KEY);
    const el = document.createElement('div');
    el.id = 'onboarding-banner';
    el.className = 'onboarding-banner';

    if (wasSkipped) {
      // Usuário pulou o FTX deliberadamente — oferece retomar o cadastro
      // em vez de abrir o modal de adicionar equipamento direto. A ideia é
      // preservar o ponto de contato com o preview de PDF que é o "aha
      // moment" do produto.
      el.innerHTML = `
        <div class="onboarding-banner__icon">⏱️</div>
        <div>
          <div class="onboarding-banner__title">Ative seu primeiro equipamento em 2 min</div>
          <div class="onboarding-banner__desc">Cadastre o equipamento e registre a última manutenção.</div>
        </div>
        <button class="btn btn--primary btn--sm" id="onboarding-banner-resume" type="button">Continuar &rarr;</button>
      `;
      document.getElementById('lista-equip')?.before(el);
      document.getElementById('onboarding-banner-resume')?.addEventListener('click', async () => {
        // Lazy import: só carrega o FTX (e seu CSS) quando o usuário
        // realmente quer retomar. Mantém o chunk inicial enxuto.
        const { FirstTimeExperience } = await import('./firstTimeExperience.js');
        FirstTimeExperience.reopen(getState().equipamentos);
      });
      return;
    }

    el.innerHTML = `
      <div class="onboarding-banner__icon">🚀</div>
      <div>
        <div class="onboarding-banner__title">Comece por 1 equipamento real</div>
        <div class="onboarding-banner__desc">Crie o equipamento e registre a última manutenção para ativar o status.</div>
      </div>
      <button class="btn btn--primary btn--sm" data-action="open-modal" data-id="modal-add-eq">Adicionar meu primeiro equipamento</button>
    `;
    document.getElementById('lista-equip')?.before(el);
  },
  remove() {
    document.getElementById('onboarding-banner')?.remove();
  },
};
