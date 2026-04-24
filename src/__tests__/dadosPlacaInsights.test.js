import { describe, it, expect } from 'vitest';
import {
  classifyExtraKey,
  groupCamposExtras,
  isTier1Key,
  filterTier1Extras,
  normalizeRefrigerantCode,
  findRefrigerant,
  detectRefrigerantPhaseOut,
  roundUpToCommercialBreaker,
  suggestBreaker,
  buildTechnicalInsights,
} from '../domain/dadosPlacaInsights.js';

describe('dadosPlacaInsights — classifyExtraKey', () => {
  it('classifica chaves elétricas', () => {
    expect(classifyExtraKey('mca')).toBe('eletrica');
    expect(classifyExtraKey('mocp')).toBe('eletrica');
    expect(classifyExtraKey('tensao_secundaria')).toBe('eletrica');
    expect(classifyExtraKey('fator_potencia')).toBe('eletrica');
  });

  it('classifica chaves termodinâmicas', () => {
    expect(classifyExtraKey('seer')).toBe('termodinamica');
    expect(classifyExtraKey('eer')).toBe('termodinamica');
    expect(classifyExtraKey('iplv')).toBe('termodinamica');
    expect(classifyExtraKey('pressao_max')).toBe('termodinamica');
  });

  it('classifica chaves de refrigerante', () => {
    expect(classifyExtraKey('refrigerant')).toBe('refrigerante');
    expect(classifyExtraKey('refrigerante')).toBe('refrigerante');
    expect(classifyExtraKey('carga_gas_kg')).toBe('refrigerante');
    expect(classifyExtraKey('oleo_tipo')).toBe('refrigerante');
  });

  it('classifica chaves mecânicas', () => {
    expect(classifyExtraKey('compressor_model')).toBe('mecanica');
    expect(classifyExtraKey('fan_speed')).toBe('mecanica');
    expect(classifyExtraKey('valvula_expansao')).toBe('mecanica');
  });

  it('classifica chaves de dimensões', () => {
    expect(classifyExtraKey('peso_kg')).toBe('dimensoes');
    expect(classifyExtraKey('vazao_ar_m3h')).toBe('dimensoes');
    expect(classifyExtraKey('nivel_ruido_db')).toBe('dimensoes');
  });

  it('classifica chaves regulamentares', () => {
    expect(classifyExtraKey('classe_energetica')).toBe('regulamentar');
    expect(classifyExtraKey('norma')).toBe('regulamentar');
    expect(classifyExtraKey('certificacao')).toBe('regulamentar');
  });

  it('cai em "outros" para chaves desconhecidas', () => {
    expect(classifyExtraKey('foo_bar')).toBe('outros');
    expect(classifyExtraKey('random_field')).toBe('outros');
    expect(classifyExtraKey(null)).toBe('outros');
    expect(classifyExtraKey('')).toBe('outros');
  });
});

describe('dadosPlacaInsights — groupCamposExtras', () => {
  it('agrupa rows em ordem canônica de categorias', () => {
    const rows = [
      { key: 'peso_kg', label: 'Peso', value: '42', extra: true },
      { key: 'mca', label: 'MCA', value: '12 A', extra: true },
      { key: 'seer', label: 'SEER', value: '15.2', extra: true },
      { key: 'norma', label: 'Norma', value: 'NBR', extra: true },
    ];
    const groups = groupCamposExtras(rows);
    const ids = groups.map((g) => g.id);
    // Ordem canônica: eletrica → termodinamica → refrigerante → mecanica → dimensoes → regulamentar
    expect(ids).toEqual(['eletrica', 'termodinamica', 'dimensoes', 'regulamentar']);
  });

  it('ignora rows fixas (extra=false)', () => {
    const rows = [
      { key: 'numero_serie', label: 'Nº série', value: 'ABC', extra: false },
      { key: 'mca', label: 'MCA', value: '12', extra: true },
    ];
    const groups = groupCamposExtras(rows);
    expect(groups).toHaveLength(1);
    expect(groups[0].id).toBe('eletrica');
    expect(groups[0].rows).toHaveLength(1);
  });

  it('retorna array vazio com input inválido', () => {
    expect(groupCamposExtras(null)).toEqual([]);
    expect(groupCamposExtras([])).toEqual([]);
    expect(groupCamposExtras('foo')).toEqual([]);
  });

  it('categoria "outros" aparece por último', () => {
    const rows = [
      { key: 'random_xyz', label: 'Random', value: 'foo', extra: true },
      { key: 'mca', label: 'MCA', value: '12', extra: true },
    ];
    const groups = groupCamposExtras(rows);
    expect(groups[groups.length - 1].id).toBe('outros');
  });
});

describe('dadosPlacaInsights — Tier 1 filtering', () => {
  it('identifica chaves Tier 1', () => {
    expect(isTier1Key('mca')).toBe(true);
    expect(isTier1Key('mocp')).toBe(true);
    expect(isTier1Key('refrigerant')).toBe(true);
    expect(isTier1Key('compressor_model')).toBe(true);
    expect(isTier1Key('pressao_max')).toBe(true);
  });

  it('rejeita chaves Tier 2/3', () => {
    expect(isTier1Key('seer')).toBe(false);
    expect(isTier1Key('peso_kg')).toBe(false);
    expect(isTier1Key('norma')).toBe(false);
  });

  it('filterTier1Extras preserva só os Tier 1 com extra:true', () => {
    const rows = [
      { key: 'mca', value: '12', extra: true },
      { key: 'seer', value: '15', extra: true },
      { key: 'compressor_model', value: 'ZR', extra: true },
      { key: 'numero_serie', value: 'X', extra: false },
    ];
    const filtered = filterTier1Extras(rows);
    expect(filtered.map((r) => r.key)).toEqual(['mca', 'compressor_model']);
  });
});

describe('dadosPlacaInsights — refrigerant phase-out', () => {
  it('normaliza códigos variados', () => {
    expect(normalizeRefrigerantCode('r410a')).toBe('R-410A');
    expect(normalizeRefrigerantCode('R 410A')).toBe('R-410A');
    expect(normalizeRefrigerantCode('R-22')).toBe('R-22');
    expect(normalizeRefrigerantCode(null)).toBe(null);
    expect(normalizeRefrigerantCode('')).toBe(null);
  });

  it('detecta phase-out concluído (R-22)', () => {
    const insight = detectRefrigerantPhaseOut({ fluido: 'R-22' });
    expect(insight).not.toBeNull();
    expect(insight.code).toBe('R-22');
    expect(insight.status).toBe('phased_out');
    expect(insight.tone).toBe('alto');
    expect(insight.message).toMatch(/retrofit/i);
  });

  it('detecta phase-out gradual (R-410A)', () => {
    const insight = detectRefrigerantPhaseOut({ fluido: 'R-410A' });
    expect(insight.status).toBe('phase_out_gradual');
    expect(insight.tone).toBe('medio');
  });

  it('detecta low GWP (R-290)', () => {
    const insight = detectRefrigerantPhaseOut({ fluido: 'R-290' });
    expect(insight.status).toBe('low_gwp');
    expect(insight.tone).toBe('baixo');
    expect(insight.message).toMatch(/inflamabilidade/i);
  });

  it('retorna null para refrigerante ativo (R-32)', () => {
    expect(detectRefrigerantPhaseOut({ fluido: 'R-32' })).toBeNull();
  });

  it('retorna null para refrigerante desconhecido', () => {
    expect(detectRefrigerantPhaseOut({ fluido: 'R-9999' })).toBeNull();
  });

  it('retorna null quando não há refrigerante informado', () => {
    expect(detectRefrigerantPhaseOut(null)).toBeNull();
    expect(detectRefrigerantPhaseOut({})).toBeNull();
  });

  it('encontra refrigerante em camposExtras quando ausente no top-level', () => {
    const dp = { camposExtras: [{ key: 'refrigerant', value: 'r-22' }] };
    const insight = detectRefrigerantPhaseOut(dp);
    expect(insight?.code).toBe('R-22');
  });

  it('findRefrigerant prioriza fluido > legado > extras', () => {
    expect(findRefrigerant({ fluido: 'R-32', refrigerante: 'R-22' })).toBe('R-32');
    expect(findRefrigerant({ refrigerante: 'R-22' })).toBe('R-22');
    expect(findRefrigerant({ camposExtras: [{ key: 'refrigerant', value: 'R-290' }] })).toBe(
      'R-290',
    );
  });
});

describe('dadosPlacaInsights — breaker suggestion', () => {
  it('arredonda pra cima no valor comercial mais próximo', () => {
    expect(roundUpToCommercialBreaker(12)).toBe(15);
    expect(roundUpToCommercialBreaker(15)).toBe(15);
    expect(roundUpToCommercialBreaker(16)).toBe(20);
    expect(roundUpToCommercialBreaker(25)).toBe(25);
    expect(roundUpToCommercialBreaker(26)).toBe(32);
    expect(roundUpToCommercialBreaker(150)).toBe(100); // cap no último
  });

  it('retorna null para valores inválidos', () => {
    expect(roundUpToCommercialBreaker(0)).toBeNull();
    expect(roundUpToCommercialBreaker(-5)).toBeNull();
    expect(roundUpToCommercialBreaker(NaN)).toBeNull();
  });

  it('calcula disjuntor a partir de MCA (×1.25)', () => {
    const suggestion = suggestBreaker({
      camposExtras: [{ key: 'mca', value: '12 A' }],
    });
    expect(suggestion).not.toBeNull();
    expect(suggestion.mca).toBe(12);
    expect(suggestion.mocp).toBeNull();
    expect(suggestion.source).toBe('mca');
    // 12 × 1.25 = 15 → exato commercial
    expect(suggestion.suggested).toBe(15);
  });

  it('MOCP tem precedência sobre MCA quando ambos existem', () => {
    const suggestion = suggestBreaker({
      camposExtras: [
        { key: 'mca', value: '12' },
        { key: 'mocp', value: '20' },
      ],
    });
    expect(suggestion.source).toBe('mocp');
    expect(suggestion.suggested).toBe(20);
    expect(suggestion.mocp).toBe(20);
    expect(suggestion.mca).toBe(12);
  });

  it('aceita valores com vírgula e unidades', () => {
    const suggestion = suggestBreaker({
      camposExtras: [{ key: 'mca', value: '16,5 A' }],
    });
    expect(suggestion.mca).toBe(16.5);
    // 16.5 × 1.25 = 20.625 → próximo commercial é 25
    expect(suggestion.suggested).toBe(25);
  });

  it('retorna null quando não há MCA nem MOCP', () => {
    expect(suggestBreaker(null)).toBeNull();
    expect(suggestBreaker({})).toBeNull();
    expect(suggestBreaker({ camposExtras: [{ key: 'seer', value: '15' }] })).toBeNull();
  });

  it('ignora valores não numéricos', () => {
    expect(suggestBreaker({ camposExtras: [{ key: 'mca', value: 'não detectado' }] })).toBeNull();
  });
});

describe('dadosPlacaInsights — buildTechnicalInsights', () => {
  it('retorna ambos insights quando aplicáveis', () => {
    const insights = buildTechnicalInsights({
      fluido: 'R-22',
      camposExtras: [{ key: 'mca', value: '12' }],
    });
    expect(insights.phaseOut).not.toBeNull();
    expect(insights.breaker).not.toBeNull();
  });

  it('retorna null em cada insight quando não aplicável', () => {
    const insights = buildTechnicalInsights({ fluido: 'R-32' });
    expect(insights.phaseOut).toBeNull();
    expect(insights.breaker).toBeNull();
  });

  it('não crasha com input nulo/vazio', () => {
    expect(() => buildTechnicalInsights(null)).not.toThrow();
    expect(() => buildTechnicalInsights({})).not.toThrow();
    expect(() => buildTechnicalInsights({ camposExtras: null })).not.toThrow();
  });
});
