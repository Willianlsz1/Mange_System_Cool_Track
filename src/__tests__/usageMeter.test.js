import { beforeEach, describe, expect, it, vi } from 'vitest';

const getStateMock = vi.fn(() => ({ equipamentos: [], registros: [] }));
vi.mock('../core/state.js', () => ({
  getState: () => getStateMock(),
}));

import { UsageMeter, UsageMeterInternal as UMI } from '../ui/components/usageMeter.js';

function makeReg(data) {
  return { id: `reg-${Math.random()}`, equipId: 'eq-1', data, tipo: 'Manutencao Preventiva' };
}

describe('UsageMeter', () => {
  beforeEach(() => {
    getStateMock.mockReturnValue({ equipamentos: [], registros: [] });
  });

  it('renders free near-limit state with 3-equipment plan cap', () => {
    const now = new Date();
    const currentMonthDate = new Date(now.getFullYear(), now.getMonth(), 10).toISOString();

    getStateMock.mockReturnValue({
      equipamentos: Array.from({ length: 3 }, (_, index) => ({ id: `eq-${index + 1}` })),
      registros: Array.from({ length: 9 }, () => makeReg(currentMonthDate)),
    });

    const html = UsageMeter.render({ planCode: 'free' });

    expect(html).toContain(
      'Equipamentos: <span class="usage-meter__value">3 / 3</span> no plano gratis',
    );
    expect(html).toContain(
      'Relatorios este mes: <span class="usage-meter__value">9 / 10</span> no plano gratis',
    );
    expect(html).toContain('Desbloquear ilimitado &rarr;');
    expect(html).toContain('QUASE NO LIMITE');
    expect(html).toContain('usage-meter__badge--warn');
  });

  it('prioritizes exceeded state and premium CTA for free users above limit', () => {
    const now = new Date();
    const currentMonthDate = new Date(now.getFullYear(), now.getMonth(), 10).toISOString();

    getStateMock.mockReturnValue({
      equipamentos: Array.from({ length: 4 }, (_, index) => ({ id: `eq-${index + 1}` })),
      registros: Array.from({ length: 12 }, () => makeReg(currentMonthDate)),
    });

    const html = UsageMeter.render({ planCode: 'free' });

    expect(html).toContain(
      'Equipamentos: <span class="usage-meter__value">4 / 3</span> no plano gratis',
    );
    expect(html).toContain('width:100%;background:#e03040');
    expect(html).toContain('LIMITE ULTRAPASSADO');
    expect(html).toContain('usage-meter__badge--danger');
    expect(html).toContain('Voce precisa do plano Pro para continuar &rarr;');
  });

  it('renders pro state without upgrade CTA priority', () => {
    const now = new Date();
    const currentMonthDate = new Date(now.getFullYear(), now.getMonth(), 10).toISOString();

    getStateMock.mockReturnValue({
      equipamentos: Array.from({ length: 7 }, (_, index) => ({ id: `eq-${index + 1}` })),
      registros: Array.from({ length: 12 }, () => makeReg(currentMonthDate)),
    });

    const html = UsageMeter.render({ planCode: 'pro' });

    expect(html).toContain('PLANO PRO ATIVO');
    expect(html).toContain('Recursos premium e limites expandidos liberados.');
    expect(html).not.toContain('data-action="open-upgrade"');
  });

  it('keeps internal usage helpers coherent', () => {
    const now = new Date();
    const inMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 25).toISOString();

    expect(UMI.countReportsThisMonth([makeReg(inMonth), makeReg(prevMonth)])).toBe(1);
    expect(UMI.getReportBarColor(71)).toBe('#e8a020');
    expect(UMI.getReportBarColor(91)).toBe('#e03040');
    expect(UMI.clampPercent(8, 3)).toBe(100);
    expect(UMI.getUsageState(4, 4).hasOverLimit).toBe(true);
    expect(UMI.getUsageState(2, 9).hasNearLimit).toBe(true);
    expect(UMI.normalizePlanCode('pro')).toBe('pro');
    expect(UMI.normalizePlanCode('enterprise')).toBe('free');
  });
});
