import {
  PRIORITY_LEVEL,
  calculateActionPriority,
  evaluateEquipmentPriority,
} from '../domain/priorityEngine.js';

describe('priority engine', () => {
  it('returns urgente for out of operation assets', () => {
    const result = calculateActionPriority({
      riskScore: 92,
      criticidade: 'critica',
      status: 'danger',
      daysToNext: -5,
      recentCorrectiveCount: 1,
    });

    expect(result.priorityLevel).toBe(PRIORITY_LEVEL.URGENTE);
    expect(result.priorityLabel).toBe('Urgente');
    expect(result.suggestedAction).toContain('corretivo');
    expect(result.priorityReasons).toContain('Equipamento fora de operação');
  });

  it('returns monitorar for near preventive without severe factors', () => {
    const result = calculateActionPriority({
      riskScore: 40,
      criticidade: 'media',
      status: 'ok',
      daysToNext: 3,
      recentCorrectiveCount: 0,
    });

    expect(result.priorityLevel).toBe(PRIORITY_LEVEL.MONITORAR);
    expect(result.suggestedAction).toBe('Programar serviço preventivo');
  });

  it('evaluates equipment priority from context and risk', () => {
    const equipamento = {
      id: 'eq-1',
      nome: 'UTI Split',
      status: 'warn',
      tipo: 'Split Hi-Wall',
      criticidade: 'alta',
      prioridadeOperacional: 'alta',
      periodicidadePreventivaDias: 30,
    };
    const registros = [
      {
        id: 'r-1',
        equipId: 'eq-1',
        data: '2026-03-01T08:00',
        tipo: 'Manutenção corretiva',
        status: 'danger',
      },
    ];

    const result = evaluateEquipmentPriority(equipamento, registros);

    expect(result.priorityLevel).toBeGreaterThanOrEqual(PRIORITY_LEVEL.ALTA);
    expect(result.priorityReasons.length).toBeGreaterThan(0);
  });
});
