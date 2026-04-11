export const PLAN_CATALOG = {
  free: {
    key: 'free',
    label: 'Free',
    limits: {
      equipamentos: 5,
      registros: 10,
    },
    perks: ['Até 5 equipamentos', 'Até 10 registros'],
  },
  pro: {
    key: 'pro',
    label: 'Pro',
    limits: {
      equipamentos: Number.POSITIVE_INFINITY,
      registros: Number.POSITIVE_INFINITY,
    },
    perks: ['Equipamentos ilimitados', 'Histórico completo', 'Relatórios'],
  },
};

export function getPlanForUser({ isGuest }) {
  return isGuest ? PLAN_CATALOG.free : PLAN_CATALOG.pro;
}

export function getLimitLabel(resource) {
  if (resource === 'equipamentos') return 'equipamentos';
  return 'registros';
}
