import { evaluateEquipmentRisk, evaluateEquipmentRiskTrend } from '../domain/maintenance.js';

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

describe('equipment risk track record bonus', () => {
  const baseEquip = {
    id: 'eq-bonus',
    status: 'ok',
    criticidade: 'media',
    prioridadeOperacional: 'normal',
    periodicidadePreventivaDias: 30,
  };

  function preventivaRegistro(id, daysAgo, proximaDaysAhead = null) {
    return {
      id,
      equipId: baseEquip.id,
      data: `${isoDateOffset(-daysAgo)}T08:00`,
      proxima: proximaDaysAhead != null ? isoDateOffset(proximaDaysAhead) : undefined,
      tipo: 'Preventiva padrão',
      status: 'ok',
    };
  }

  it('applies track record bonus when last 3 preventives are on-schedule', () => {
    // periodicidade 30d, registros em -5, -35, -65 dias com próxima agendada para daqui a 25 dias
    const withBonus = evaluateEquipmentRisk(baseEquip, [
      preventivaRegistro('r-1', 5, 25),
      preventivaRegistro('r-2', 35),
      preventivaRegistro('r-3', 65),
    ]);

    // Sem track record (menos registros)
    const withoutBonus = evaluateEquipmentRisk(baseEquip, [preventivaRegistro('r-1', 5, 25)]);

    expect(withBonus.trackRecordBonus).toBeLessThan(0);
    expect(withBonus.score).toBeLessThan(withoutBonus.score);
    expect(withBonus.details.some((d) => d.impact < 0)).toBe(true);
  });

  it('does not apply preventive bonus when any of the 3 most recent registros is corrective', () => {
    const result = evaluateEquipmentRisk(baseEquip, [
      preventivaRegistro('r-1', 5, 25),
      {
        id: 'r-2',
        equipId: baseEquip.id,
        data: `${isoDateOffset(-35)}T08:00`,
        tipo: 'Manutenção Corretiva - Compressor',
        status: 'warn',
      },
      preventivaRegistro('r-3', 65),
    ]);

    // Não deve haver bônus por preventivas consecutivas (há corretiva no meio)
    const bonusLabels = (result.details || []).filter((d) => d.impact < 0).map((d) => d.label);
    expect(bonusLabels).not.toContain('preventivas consecutivas em dia');
  });

  it('applies "no correctives" bonus when history has 3+ preventives and zero correctives', () => {
    const result = evaluateEquipmentRisk(baseEquip, [
      preventivaRegistro('r-1', 5, 25),
      preventivaRegistro('r-2', 35),
      preventivaRegistro('r-3', 65),
    ]);
    const bonusLabels = (result.details || []).filter((d) => d.impact < 0).map((d) => d.label);
    expect(bonusLabels).toContain('sem corretivas no histórico');
  });

  it('applies stable status bonus when recent registros are all ok and status is ok', () => {
    const result = evaluateEquipmentRisk(baseEquip, [
      preventivaRegistro('r-1', 5, 25),
      preventivaRegistro('r-2', 35),
    ]);
    const bonusLabels = (result.details || []).filter((d) => d.impact < 0).map((d) => d.label);
    expect(bonusLabels).toContain('status operacional estável');
  });

  it('does not apply bonus when preventive is overdue', () => {
    const result = evaluateEquipmentRisk(baseEquip, [
      // próxima já venceu (há 10 dias)
      preventivaRegistro('r-1', 40, -10),
      preventivaRegistro('r-2', 70),
      preventivaRegistro('r-3', 100),
    ]);
    const bonusLabels = (result.details || []).filter((d) => d.impact < 0).map((d) => d.label);
    expect(bonusLabels).not.toContain('preventivas consecutivas em dia');
  });
});

describe('equipment risk trend', () => {
  const baseEquip = {
    id: 'eq-trend',
    status: 'ok',
    criticidade: 'media',
    prioridadeOperacional: 'normal',
    periodicidadePreventivaDias: 30,
  };

  it('returns stable trend when there are no registros older than 30 days', () => {
    const trend = evaluateEquipmentRiskTrend(baseEquip, [
      {
        id: 'r-1',
        equipId: baseEquip.id,
        data: `${isoDateOffset(-5)}T08:00`,
        proxima: isoDateOffset(25),
        tipo: 'Preventiva padrão',
        status: 'ok',
      },
    ]);
    expect(trend.trend).toBe('stable');
    expect(trend.delta).toBe(0);
  });

  it('detects improving trend when recent preventive reduces risk vs. 30d ago snapshot', () => {
    const equip = { ...baseEquip, status: 'ok' };
    // No snapshot de 30 dias atrás: última preventiva muito antiga, sem próxima agendada
    // → risco alto. Agora: preventiva recente, próxima no prazo → risco baixo.
    const trend = evaluateEquipmentRiskTrend(equip, [
      {
        id: 'r-recent',
        equipId: equip.id,
        data: `${isoDateOffset(-3)}T08:00`,
        proxima: isoDateOffset(27),
        tipo: 'Preventiva padrão',
        status: 'ok',
      },
      {
        id: 'r-old',
        equipId: equip.id,
        data: `${isoDateOffset(-90)}T08:00`,
        tipo: 'Preventiva padrão',
        status: 'ok',
      },
    ]);
    expect(trend.now).toBeLessThan(trend.past);
    expect(trend.trend).toBe('improving');
    expect(trend.delta).toBeLessThan(0);
  });

  it('detects worsening trend when a recent corrective appears on top of an exemplary history', () => {
    // Cenário: equipamento com histórico exemplar de 3 preventivas em dia
    // (todas >30d — entram no snapshot "past") recebe uma corretiva recente
    // com status warn. O past tem track record completo (−18), o now perde o
    // bônus de estabilidade e ganha penalidade de corretiva recente.
    const equip = { ...baseEquip, periodicidadePreventivaDias: 60 };
    const trend = evaluateEquipmentRiskTrend(equip, [
      {
        id: 'r-new-corr',
        equipId: equip.id,
        data: `${isoDateOffset(-5)}T08:00`,
        tipo: 'Manutenção Corretiva - Vazamento',
        status: 'warn',
      },
      {
        id: 'r-prev-1',
        equipId: equip.id,
        data: `${isoDateOffset(-35)}T08:00`,
        proxima: isoDateOffset(25),
        tipo: 'Preventiva padrão',
        status: 'ok',
      },
      {
        id: 'r-prev-2',
        equipId: equip.id,
        data: `${isoDateOffset(-95)}T08:00`,
        tipo: 'Preventiva padrão',
        status: 'ok',
      },
      {
        id: 'r-prev-3',
        equipId: equip.id,
        data: `${isoDateOffset(-155)}T08:00`,
        tipo: 'Preventiva padrão',
        status: 'ok',
      },
    ]);
    expect(trend.now).toBeGreaterThan(trend.past);
    expect(trend.trend).toBe('worsening');
    expect(trend.delta).toBeGreaterThan(0);
  });
});
