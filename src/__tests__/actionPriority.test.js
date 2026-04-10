import { getActionPriorityScore } from '../domain/actionPriority.js';

describe('action priority score', () => {
  it('adds strong weight for out of operation and overdue preventive', () => {
    const equipamento = {
      id: 'eq-1',
      nome: 'Chiller UTI',
      status: 'danger',
      criticidade: 'alta',
      tipo: 'Chiller',
      periodicidadePreventivaDias: 30,
    };
    const registros = [
      {
        id: 'r-1',
        equipId: 'eq-1',
        data: '2026-02-01T08:00',
        tipo: 'Manutenção corretiva',
        status: 'danger',
      },
    ];

    const result = getActionPriorityScore(equipamento, registros);

    expect(result.actionPriorityScore).toBeGreaterThanOrEqual(110);
    expect(result.group).toBe('critico');
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('returns monitoring group for stable context', () => {
    const equipamento = {
      id: 'eq-2',
      nome: 'Split recepção',
      status: 'ok',
      criticidade: 'baixa',
      tipo: 'Split Hi-Wall',
      periodicidadePreventivaDias: 90,
    };
    const registros = [
      {
        id: 'r-1',
        equipId: 'eq-2',
        data: '2026-04-05T08:00',
        tipo: 'Manutenção preventiva',
        status: 'ok',
      },
    ];

    const result = getActionPriorityScore(equipamento, registros);

    expect(result.group).toBe('monitoramento');
    expect(result.actionPriorityScore).toBeLessThan(90);
  });
});
