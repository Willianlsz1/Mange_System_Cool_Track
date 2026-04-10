import { PRIORITY_LEVEL } from '../domain/priorityEngine.js';
import {
  ACTION_CODE,
  calculateSuggestedAction,
  evaluateEquipmentSuggestedAction,
} from '../domain/suggestedAction.js';

describe('suggested action engine', () => {
  it('returns immediate corrective for out of operation status', () => {
    const result = calculateSuggestedAction({
      priorityLevel: PRIORITY_LEVEL.ALTA,
      status: 'danger',
      riskScore: 85,
      preventiveOverdue: true,
    });

    expect(result.actionCode).toBe(ACTION_CODE.REGISTER_CORRECTIVE_IMMEDIATE);
    expect(result.actionLabel).toContain('imediatamente');
    expect(result.actionReasons).toContain('Equipamento fora de operação');
  });

  it('returns preventive register when preventive is overdue', () => {
    const result = calculateSuggestedAction({
      priorityLevel: PRIORITY_LEVEL.ALTA,
      status: 'ok',
      preventiveOverdue: true,
      riskScore: 61,
    });

    expect(result.actionCode).toBe(ACTION_CODE.REGISTER_PREVENTIVE);
    expect(result.actionLabel).toBe('Registrar manutenção preventiva');
  });

  it('returns recurrent cause investigation for repeated corrective history', () => {
    const result = calculateSuggestedAction({
      priorityLevel: PRIORITY_LEVEL.ALTA,
      status: 'ok',
      recentCorrectiveCount: 2,
      riskScore: 63,
    });

    expect([
      ACTION_CODE.CHECK_RECURRENT_CAUSE,
      ACTION_CODE.REGISTER_CORRECTIVE_IMMEDIATE,
    ]).toContain(result.actionCode);
    expect(result.actionReasons[0]).toContain('recorrentes');
  });

  it('evaluates equipment action based on context records', () => {
    const equipamento = {
      id: 'eq-2',
      nome: 'Fancoil 1',
      status: 'ok',
      tipo: 'Fan Coil',
      criticidade: 'alta',
      periodicidadePreventivaDias: 30,
    };

    const registros = [
      {
        id: 'r-1',
        equipId: 'eq-2',
        data: '2026-03-01T08:00',
        tipo: 'Manutenção corretiva',
        status: 'danger',
      },
      {
        id: 'r-2',
        equipId: 'eq-2',
        data: '2026-02-10T08:00',
        tipo: 'Manutenção corretiva',
        status: 'warn',
      },
    ];

    const result = evaluateEquipmentSuggestedAction(equipamento, registros);

    expect([
      ACTION_CODE.CHECK_RECURRENT_CAUSE,
      ACTION_CODE.REGISTER_CORRECTIVE_IMMEDIATE,
    ]).toContain(result.actionCode);
    expect(result.actionReasons.length).toBeGreaterThan(0);
  });
});
