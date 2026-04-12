/**
 * Dev Plan Override — permite alternar entre Free e Pro com 1 clique durante testes.
 * Só tem efeito quando o usuário tem is_dev === true no perfil.
 */

const LS_KEY = 'cooltrack-dev-plan-override';

export const DevPlanOverride = {
  /** Retorna 'pro' | 'free' | null (null = sem override, usa dado real do Supabase) */
  get() {
    const val = localStorage.getItem(LS_KEY);
    return val === 'pro' || val === 'free' ? val : null;
  },

  set(plan) {
    if (plan === 'pro' || plan === 'free') {
      localStorage.setItem(LS_KEY, plan);
    } else {
      localStorage.removeItem(LS_KEY);
    }
  },

  toggle() {
    const current = this.get();
    this.set(current === 'pro' ? 'free' : 'pro');
    return this.get();
  },

  /** Aplica o override num objeto de perfil, se estiver ativo */
  applyToProfile(profile) {
    const override = this.get();
    if (!override) return profile;
    return {
      ...profile,
      plan_code: override,
      plan: override,
      subscription_status: override === 'pro' ? 'active' : 'inactive',
      // mantém is_dev para não perder o painel no próximo carregamento
    };
  },

  isActive() {
    return this.get() !== null;
  },
};
