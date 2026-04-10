import { evaluateEquipmentRisk } from '../domain/maintenance.js';

function isoDateOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

describe('equipment risk score', () => {
  it('returns high risk with overdue preventive, corrective history and danger status', () => {
    const result = evaluateEquipmentRisk(
      {
        id: 'eq-1',
        status: 'danger',
        criticidade: 'alta',
        prioridadeOperacional: 'alta',
        periodicidadePreventivaDias: 30,
      },
      [
        {
          id: 'r-1',
          equipId: 'eq-1',
          data: `${isoDateOffset(-10)}T08:00`,
          proxima: isoDateOffset(-10),
          tipo: 'Manutenção Corretiva - Compressor',
          status: 'danger',
        },
        {
          id: 'r-2',
          equipId: 'eq-1',
          data: `${isoDateOffset(-25)}T08:00`,
          tipo: 'Manutenção Corretiva - Vazamento',
          status: 'warn',
        },
        {
          id: 'r-3',
          equipId: 'eq-1',
          data: `${isoDateOffset(-35)}T08:00`,
          tipo: 'Manutenção Corretiva - Capacitor',
          status: 'warn',
        },
      ],
    );

    expect(result.classification).toBe('alto');
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.technicalBaseScore).toBeGreaterThan(0);
    expect(result.criticidadeMultiplier).toBe(1.25);
    expect(result.factors).toContain('preventiva vencida');
    expect(result.factors).toContain('histórico de corretivas');
    expect(result.factors).toContain('criticidade operacional');
  });

  it('returns low risk with healthy cadence and no corrective records', () => {
    const result = evaluateEquipmentRisk(
      {
        id: 'eq-1',
        status: 'ok',
        criticidade: 'media',
        prioridadeOperacional: 'normal',
        periodicidadePreventivaDias: 60,
      },
      [
        {
          id: 'r-1',
          equipId: 'eq-1',
          data: `${isoDateOffset(-10)}T08:00`,
          proxima: isoDateOffset(25),
          tipo: 'Preventiva padrão',
          status: 'ok',
        },
      ],
    );

    expect(result.classification).toBe('baixo');
    expect(result.score).toBeLessThan(35);
    expect(result.criticidadeMultiplier).toBe(1.1);
  });
});
