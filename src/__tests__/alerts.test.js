vi.mock('../core/state.js', () => ({
  getState: vi.fn(),
}));

import { Alerts } from '../domain/alerts.js';
import { getState } from '../core/state.js';

describe('Alerts.getAll', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-07T12:00:00Z'));
    vi.mocked(getState).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('prioritizes critical and overdue assets in maintenance order', () => {
    vi.mocked(getState).mockReturnValue({
      equipamentos: [
        { id: 'eq-danger', nome: 'Chiller A', status: 'danger', criticidade: 'critica' },
        {
          id: 'eq-overdue',
          nome: 'Split Centro Cirurgico',
          status: 'ok',
          criticidade: 'alta',
          prioridadeOperacional: 'alta',
          periodicidadePreventivaDias: 30,
        },
      ],
      registros: [
        {
          id: 'r-overdue',
          equipId: 'eq-overdue',
          data: '2026-03-10T08:00',
          tipo: 'Manutencao Preventiva',
          status: 'ok',
          proxima: '2026-04-01',
        },
      ],
    });

    const alerts = Alerts.getAll();

    expect(alerts.map((alert) => alert.kind)).toEqual(['critical', 'overdue']);
    expect(alerts[0]).toEqual(
      expect.objectContaining({
        kind: 'critical',
        recommendedAction: 'register-now',
        eq: expect.objectContaining({ id: 'eq-danger' }),
      }),
    );
    expect(alerts[1]).toEqual(
      expect.objectContaining({
        kind: 'overdue',
        recommendedAction: 'register-now',
        eq: expect.objectContaining({ id: 'eq-overdue' }),
      }),
    );
  });

  it('creates no-history alerts for high criticality assets without registros', () => {
    vi.mocked(getState).mockReturnValue({
      equipamentos: [
        {
          id: 'eq-1',
          nome: 'Camara Fria Farmacia',
          status: 'ok',
          criticidade: 'critica',
          prioridadeOperacional: 'alta',
          periodicidadePreventivaDias: 30,
        },
      ],
      registros: [],
    });

    const alerts = Alerts.getAll();

    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toEqual(
      expect.objectContaining({
        kind: 'no-history',
        recommendedAction: 'start-history',
        title: 'Equipamento sem historico preventivo',
      }),
    );
  });

  it('opens planning window earlier for critical assets', () => {
    vi.mocked(getState).mockReturnValue({
      equipamentos: [
        {
          id: 'eq-1',
          nome: 'Split UTI',
          status: 'ok',
          criticidade: 'critica',
          prioridadeOperacional: 'alta',
          periodicidadePreventivaDias: 30,
        },
      ],
      registros: [
        {
          id: 'r-1',
          equipId: 'eq-1',
          data: '2026-04-01T08:00',
          tipo: 'Manutencao Preventiva',
          status: 'ok',
          proxima: '2026-04-15',
        },
      ],
    });

    const alerts = Alerts.getAll();

    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toEqual(
      expect.objectContaining({
        kind: 'upcoming',
        recommendedAction: 'schedule',
      }),
    );
  });

  it('flags repeated corrective history as attention risk', () => {
    vi.mocked(getState).mockReturnValue({
      equipamentos: [
        {
          id: 'eq-1',
          nome: 'VRF Torre',
          status: 'warn',
          criticidade: 'alta',
          prioridadeOperacional: 'alta',
          periodicidadePreventivaDias: 45,
        },
      ],
      registros: [
        {
          id: 'r-2',
          equipId: 'eq-1',
          data: '2026-04-05T08:00',
          tipo: 'Manutencao Corretiva',
          status: 'warn',
          proxima: '2026-05-15',
        },
        {
          id: 'r-1',
          equipId: 'eq-1',
          data: '2026-03-20T08:00',
          tipo: 'Troca de capacitor',
          status: 'warn',
          proxima: '2026-04-25',
        },
      ],
    });

    const alerts = Alerts.getAll();

    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toEqual(
      expect.objectContaining({
        kind: 'attention',
        recommendedAction: 'inspect',
      }),
    );
  });
});
