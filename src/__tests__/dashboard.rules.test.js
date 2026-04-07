function isoDateOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function loadDashboardRulesModule({ equip, lastReg } = {}) {
  vi.resetModules();

  const stateMock = {
    getState: vi.fn(() => ({
      equipamentos: equip ? [equip] : [],
      registros: lastReg ? [lastReg] : [],
    })),
    findEquip: vi.fn((id) => (equip?.id === id ? equip : undefined)),
    lastRegForEquip: vi.fn((id) => (equip?.id === id ? lastReg : undefined)),
  };

  vi.doMock('../core/state.js', () => ({
    getState: stateMock.getState,
    findEquip: stateMock.findEquip,
    lastRegForEquip: stateMock.lastRegForEquip,
  }));
  vi.doMock('../core/storage.js', () => ({
    Storage: {
      usage: vi.fn(() => ({ used: 0, total: 5 * 1024 * 1024, percent: 0 })),
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

  it('applies no-history penalty when there is no last record', async () => {
    const { calcHealthScore } = await loadDashboardRulesModule({
      equip: { id: 'eq-1', status: 'ok' },
      lastReg: null,
    });
    expect(calcHealthScore('eq-1')).toBe(70);
  });

  it('combines status, staleness and overdue penalties', async () => {
    const { calcHealthScore } = await loadDashboardRulesModule({
      equip: { id: 'eq-1', status: 'warn' },
      lastReg: {
        id: 'r-1',
        equipId: 'eq-1',
        data: `${isoDateOffset(-40)}T08:00`,
        proxima: isoDateOffset(-1),
      },
    });

    // 100 - 20 (warn) - 10 (older than 30d) - 20 (overdue next date)
    expect(calcHealthScore('eq-1')).toBe(50);
  });

  it('keeps score clamped in low scenarios (danger + stale + overdue)', async () => {
    const { calcHealthScore } = await loadDashboardRulesModule({
      equip: { id: 'eq-1', status: 'danger' },
      lastReg: {
        id: 'r-1',
        equipId: 'eq-1',
        data: `${isoDateOffset(-120)}T08:00`,
        proxima: isoDateOffset(-10),
      },
    });

    expect(calcHealthScore('eq-1')).toBe(5);
  });

  it('classifies score boundaries correctly', async () => {
    const { getHealthClass } = await loadDashboardRulesModule();

    expect(getHealthClass(80)).toBe('ok');
    expect(getHealthClass(79)).toBe('warn');
    expect(getHealthClass(50)).toBe('warn');
    expect(getHealthClass(49)).toBe('danger');
  });
});
