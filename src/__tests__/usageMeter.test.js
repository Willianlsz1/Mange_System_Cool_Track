const getStateMock = vi.fn(() => ({ equipamentos: [], registros: [] }));
vi.mock('../core/state.js', () => ({
  getState: () => getStateMock(),
}));

import { UsageMeter, UsageMeterInternal } from '../ui/components/usageMeter.js';

function makeReg(data) {
  return { id: `reg-${Math.random()}`, equipId: 'eq-1', data, tipo: 'Manutenção Preventiva' };
}

describe('UsageMeter', () => {
  beforeEach(() => {
    getStateMock.mockReturnValue({ equipamentos: [], registros: [] });
  });

  it('renderiza contadores e badge quando ultrapassa 80%', () => {
    const now = new Date();
    const currentMonthDate = new Date(now.getFullYear(), now.getMonth(), 10).toISOString();

    getStateMock.mockReturnValue({
      equipamentos: Array.from({ length: 5 }, (_, index) => ({ id: `eq-${index + 1}` })),
      registros: Array.from({ length: 9 }, () => makeReg(currentMonthDate)),
    });

    const html = UsageMeter.render();

    expect(html).toContain(
      'Equipamentos: <span class="usage-meter__value">5 / 5</span> no plano gratis',
    );
    expect(html).toContain(
      'Relatorios este mes: <span class="usage-meter__value">9 / 10</span> no plano gratis',
    );
    expect(html).toContain('QUASE NO LIMITE');
    expect(html).toContain('background:#e8a020');
  });

  it('calcula contagem mensal e cores de barra corretamente', () => {
    const now = new Date();
    const inMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 25).toISOString();

    expect(UsageMeterInternal.countReportsThisMonth([makeReg(inMonth), makeReg(prevMonth)])).toBe(
      1,
    );
    expect(UsageMeterInternal.getReportBarColor(71)).toBe('#e8a020');
    expect(UsageMeterInternal.getReportBarColor(91)).toBe('#e03040');
    expect(UsageMeterInternal.clampPercent(8, 5)).toBe(100);
  });
});
