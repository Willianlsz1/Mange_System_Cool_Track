/**
 * Dev Plan Override — alterna entre Free, Plus e Pro com 1 clique durante
 * testes locais. Só tem efeito quando 'cooltrack-dev-mode' está ligado no
 * localStorage (ou quando o usuário tem is_dev === true no perfil).
 */

const LS_KEY = 'cooltrack-dev-plan-override';

const VALID_VALUES = ['free', 'plus', 'pro'];

// Ordem do ciclo: free → plus → pro → free
const CYCLE_ORDER = ['free', 'plus', 'pro'];

export const DevPlanOverride = {
  /** Retorna 'free' | 'plus' | 'pro' | null (null = sem override) */
  get() {
    const val = localStorage.getItem(LS_KEY);
    return VALID_VALUES.includes(val) ? val : null;
  },

  set(plan) {
    if (VALID_VALUES.includes(plan)) {
      localStorage.setItem(LS_KEY, plan);
    } else {
      localStorage.removeItem(LS_KEY);
    }
  },

  /**
   * Cicla free → plus → pro → free. Se nunca foi setado, começa de 'free'
   * e avança pra 'plus'.
   */
  cycle() {
    const current = this.get() ?? 'free';
    const idx = CYCLE_ORDER.indexOf(current);
    const next = CYCLE_ORDER[(idx + 1) % CYCLE_ORDER.length];
    this.set(next);
    return next;
  },

  /** Alias legado — antes era toggle Free↔Pro, agora cicla os 3 tiers. */
  toggle() {
    return this.cycle();
  },

  /** Aplica o override num objeto de perfil, se estiver ativo. */
  applyToProfile(profile) {
    const override = this.get();
    if (!override) return profile;
    return {
      ...profile,
      plan_code: override,
      plan: override,
      subscription_status: override === 'free' ? 'inactive' : 'active',
      // mantém is_dev para não perder o painel no próximo carregamento
    };
  },

  isActive() {
    return this.get() !== null;
  },
};
