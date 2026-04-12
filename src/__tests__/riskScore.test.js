import { calculateFinalRiskScore } from '../domain/riskScore.js';

describe('risk score with criticidade multiplier', () => {
  it('applies criticidade over technical risk and not over health score', () => {
    const result = calculateFinalRiskScore({
      baseTechnicalRisk: 50,
      criticidade: 'critica',
    });

    expect(result.technicalRisk).toBe(50);
    expect(result.multiplier).toBe(1.4);
    expect(result.finalRisk).toBe(70);
    expect(result.classification).toBe('medio');
  });

  it('clamps final score at 100 when multiplier exceeds the range', () => {
    const result = calculateFinalRiskScore({
      baseTechnicalRisk: 90,
      criticidade: 'critica',
    });

    expect(result.technicalRisk).toBe(90);
    expect(result.finalRisk).toBe(100);
  });
});
