import { getState } from '../../../core/state.js';

export const OnboardingBanner = {
  render() {
    const { equipamentos } = getState();
    const bannerEl = document.getElementById('onboarding-banner');
    if (equipamentos.length) {
      if (bannerEl) bannerEl.remove();
      return;
    }
    if (bannerEl) return;
    const el = document.createElement('div');
    el.id = 'onboarding-banner';
    el.className = 'onboarding-banner';
    el.innerHTML = `
      <div class="onboarding-banner__icon">🚀</div>
      <div>
        <div class="onboarding-banner__title">Cadastre seu primeiro equipamento</div>
        <div class="onboarding-banner__desc">Em 2 minutos voce tera seu primeiro relatorio profissional pronto.</div>
      </div>
      <button class="btn btn--primary btn--sm" data-action="open-modal" data-id="modal-add-eq">Adicionar meu primeiro equipamento</button>
    `;
    document.getElementById('lista-equip')?.before(el);
  },
  remove() {
    document.getElementById('onboarding-banner')?.remove();
  },
};
