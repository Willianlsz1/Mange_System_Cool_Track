import { describe, expect, it } from 'vitest';
import {
  DadosPlacaValidationError,
  formatDecimalHint,
  parseDadosPlacaFloat,
} from '../domain/dadosPlacaValidation.js';

// Fixture: spec realista de um campo de corrente (Amperes, max plausível = 100)
const CORRENTE_SPEC = {
  inputId: 'eq-corrente-refrig',
  label: 'Corrente refrig.',
  unit: 'A',
  max: 100,
};

// Fixture: spec de pressão (MPa, max plausível = 10). Range menor que corrente
// — valor 42 deve ser considerado outlier aqui.
const PRESSAO_SPEC = {
  inputId: 'eq-pressao-suc',
  label: 'Pressão sucção',
  unit: 'MPa',
  max: 10,
};

describe('parseDadosPlacaFloat — parsing e normalização', () => {
  it('retorna null para valores vazios ou nulos (caller omite o campo)', () => {
    expect(parseDadosPlacaFloat(null, CORRENTE_SPEC)).toBe(null);
    expect(parseDadosPlacaFloat(undefined, CORRENTE_SPEC)).toBe(null);
    expect(parseDadosPlacaFloat('', CORRENTE_SPEC)).toBe(null);
    expect(parseDadosPlacaFloat('   ', CORRENTE_SPEC)).toBe(null);
  });

  it('retorna null para strings não numéricas', () => {
    expect(parseDadosPlacaFloat('abc', CORRENTE_SPEC)).toBe(null);
    expect(parseDadosPlacaFloat('not a number', CORRENTE_SPEC)).toBe(null);
  });

  it('parseia decimais com ponto (formato en-US)', () => {
    expect(parseDadosPlacaFloat('4.63', CORRENTE_SPEC)).toBe(4.63);
    expect(parseDadosPlacaFloat('0.5', CORRENTE_SPEC)).toBe(0.5);
  });

  it('parseia decimais com vírgula (formato pt-BR)', () => {
    expect(parseDadosPlacaFloat('4,63', CORRENTE_SPEC)).toBe(4.63);
    expect(parseDadosPlacaFloat('2,4', PRESSAO_SPEC)).toBe(2.4);
  });

  it('aceita números já parseados (fluxo IA preenche form)', () => {
    expect(parseDadosPlacaFloat(4.63, CORRENTE_SPEC)).toBe(4.63);
    expect(parseDadosPlacaFloat(0, CORRENTE_SPEC)).toBe(0);
  });

  it('aceita inteiros dentro do range plausível', () => {
    // 42 A é alto mas não impossível (<100) → passa
    expect(parseDadosPlacaFloat('42', CORRENTE_SPEC)).toBe(42);
    // 100 A exatamente no limite → passa (comparação é estritamente >)
    expect(parseDadosPlacaFloat('100', CORRENTE_SPEC)).toBe(100);
  });
});

describe('parseDadosPlacaFloat — range guard (separador decimal esquecido)', () => {
  it('lança DadosPlacaValidationError quando o valor estoura o max', () => {
    expect(() => parseDadosPlacaFloat('42', PRESSAO_SPEC)).toThrow(DadosPlacaValidationError);
    expect(() => parseDadosPlacaFloat('150', CORRENTE_SPEC)).toThrow(DadosPlacaValidationError);
  });

  it('inclui metadados no erro para Toast + foco no input', () => {
    try {
      parseDadosPlacaFloat('42', PRESSAO_SPEC);
      expect.fail('Devia ter lançado');
    } catch (err) {
      expect(err).toBeInstanceOf(DadosPlacaValidationError);
      expect(err.inputId).toBe('eq-pressao-suc');
      expect(err.label).toBe('Pressão sucção');
      expect(err.unit).toBe('MPa');
      expect(err.value).toBe(42);
      expect(err.max).toBe(10);
    }
  });

  it('não lança se o spec não tem max definido (campos sem range)', () => {
    const specSemMax = { inputId: 'x', label: 'X', unit: 'unit' };
    expect(parseDadosPlacaFloat('9999', specSemMax)).toBe(9999);
  });

  it('trata vírgula antes de aplicar o range guard', () => {
    // "4,2" → 4.2 passa o range de pressão (max=10); não deve lançar
    expect(parseDadosPlacaFloat('4,2', PRESSAO_SPEC)).toBe(4.2);
    // "42,0" com vírgula decimal → 42 estoura o range → lança
    expect(() => parseDadosPlacaFloat('42,0', PRESSAO_SPEC)).toThrow(DadosPlacaValidationError);
  });
});

describe('formatDecimalHint — sugestão de separador', () => {
  it('divide por 10 e formata com vírgula (hint "esqueceu a vírgula")', () => {
    expect(formatDecimalHint(42)).toBe('4,2');
    expect(formatDecimalHint(150)).toBe('15,0');
    expect(formatDecimalHint(23)).toBe('2,3');
  });

  it('retorna string vazia para inputs inválidos', () => {
    expect(formatDecimalHint(null)).toBe('');
    expect(formatDecimalHint(undefined)).toBe('');
    expect(formatDecimalHint(NaN)).toBe('');
    expect(formatDecimalHint('42')).toBe('');
  });
});
