function isoDateOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function loadDashboardRulesModule({ equip, registros } = {}) {
  vi.resetModules();

  const registrosForEquip = Array.isArray(registros) ? registros : [];
  const stateMock = {
    getState: vi.fn(() => ({
      equipamentos: equip ? [equip] : [],
      registros: registrosForEquip,
    })),
    findEquip: vi.fn((id) => (equip?.id === id ? equip : undefined)),
    regsForEquip: vi.fn((id) => (equip?.id === id ? registrosForEquip : [])),
  };

  vi.doMock('../core/state.js', () => ({
    getState: stateMock.getState,
    findEquip: stateMock.findEquip,
    regsForEquip: stateMock.regsForEquip,
  }));
  vi.doMock('../core/storage.js', () => ({
    Storage: {
      usage: vi.fn(() => ({ used: 0, total: 5 * 1024 * 1024, percent: 0 })),
      getSyncStatus: vi.fn(() => ({ state: 'idle', pendingOps: 0 })),
    },
  }));
  vi.doMock('../domain/alerts.js', () => ({
    Alerts: { getAll: vi.fn(() => []) },
  }));
  vi.doMock('../ui/components/charts.js', () => ({
    Charts: { refreshAll: vi.fn() },
  }));
  vi.doMock('../ui/components/onboarding.js', () => ({
    OnboardingBanner: { render: vi.fn() },
  }));

  return import('../ui/views/dashboard.js');
}

describe('dashboard rule functions', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 0 when equipment does not exist', async () => {
    const { calcHealthScore } = await loadDashboardRulesModule();
    expect(calcHealthScore('eq-missing')).toBe(0);
  });

  it('new equipment with status ok and no history scores 100 (no penalty)', async () => {
    // Equipamento recém cadastrado com status ok não deve sofrer penalidade por
    // ausência de histórico — evita que apareça como "fora do padrão" logo após cadastro.
    const { calcHealthScore } = await loadDashboardRulesModule({
      equip: {
        id: 'eq-1',
        status: 'ok',
        criticidade: 'baixa',
        prioridadeOperacional: 'baixa',
      },
      registros: [],
    });

    expect(calcHealthScore('eq-1')).toBe(100);
  });

  it('applies no-history penalty when status is warn and no registros exist', async () => {
    // warn (16) + sem histórico (22) + criticidade baixa (0) = 38 → score 62
    const { calcHealthScore } = await loadDashboardRulesModule({
      equip: {
        id: 'eq-1',
        status: 'warn',
        criticidade: 'baixa',
        prioridadeOperacional: 'baixa',
      },
      registros: [],
    });

    expect(calcHealthScore('eq-1')).toBe(62);
  });

  it('combines status, overdue routine and recent issue penalties', async () => {
    const { calcHealthScore } = await loadDashboardRulesModule({
      equip: {
        id: 'eq-1',
        status: 'warn',
        criticidade: 'baixa',
        prioridadeOperacional: 'baixa',
        periodicidadePreventivaDias: 30,
      },
      registros: [
        {
          id: 'r-1',
          equipId: 'eq-1',
          data: `${isoDateOffset(-40)}T08:00`,
          status: 'warn',
          tipo: 'Inspecao Geral',
          proxima: isoDateOffset(-1),
        },
      ],
    });

    expect(calcHealthScore('eq-1')).toBe(56);
  });

  it('keeps score low in severe scenarios', async () => {
    const { calcHealthScore } = await loadDashboardRulesModule({
      equip: {
        id: 'eq-1',
        status: 'danger',
        criticidade: 'baixa',
        prioridadeOperacional: 'baixa',
        periodicidadePreventivaDias: 30,
      },
      registros: [
        {
          id: 'r-1',
          equipId: 'eq-1',
          data: `${isoDateOffset(-120)}T08:00`,
          status: 'danger',
          tipo: 'Inspecao Geral',
          proxima: isoDateOffset(-10),
        },
      ],
    });

    expect(calcHealthScore('eq-1')).toBe(20);
  });

  it('classifies score boundaries correctly', async () => {
    const { getHealthClass } = await loadDashboardRulesModule();

    expect(getHealthClass(80)).toBe('ok');
    expect(getHealthClass(79)).toBe('warn');
    expect(getHealthClass(55)).toBe('warn');
    expect(getHealthClass(54)).toBe('danger');
  });
});
