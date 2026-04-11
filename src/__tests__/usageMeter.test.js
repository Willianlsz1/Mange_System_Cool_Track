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

  it('renderiza badge de quase limite quando uso está entre 80% e 100%', () => {
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
    expect(html).toContain('Desbloquear ilimitado →');
    expect(html).toContain('QUASE NO LIMITE');
    expect(html).toContain('usage-meter__badge--warn');
  });

  it('prioriza estado de limite ultrapassado com badge, cor e CTA corretos', () => {
    const now = new Date();
    const currentMonthDate = new Date(now.getFullYear(), now.getMonth(), 10).toISOString();

    getStateMock.mockReturnValue({
      equipamentos: Array.from({ length: 8 }, (_, index) => ({ id: `eq-${index + 1}` })),
      registros: Array.from({ length: 12 }, () => makeReg(currentMonthDate)),
    });

    const html = UsageMeter.render();

    expect(html).toContain(
      'Equipamentos: <span class="usage-meter__value">8 / 5</span> no plano gratis',
    );
    expect(html).toContain('width:100%;background:#e03040');
    expect(html).toContain('LIMITE ULTRAPASSADO');
    expect(html).toContain('usage-meter__badge--danger');
    expect(html).toContain('Voce precisa do plano Pro para continuar →');
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
    expect(UsageMeterInternal.getUsageState(8, 4).hasOverLimit).toBe(true);
    expect(UsageMeterInternal.getUsageState(5, 9).hasNearLimit).toBe(true);
  });
});
