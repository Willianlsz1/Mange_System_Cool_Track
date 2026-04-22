import { describe, expect, it } from 'vitest';
import {
  formatStatusConclusion,
  sanitizeObservation,
  sanitizePublicText,
} from '../domain/pdf/sanitizers.js';

describe('pdf sanitizers', () => {
  it('sanitizePublicText remove placeholders internos', () => {
    expect(sanitizePublicText('Cliente não identificado')).toBe('Não informado');
    expect(sanitizePublicText('Preencha no modal de registro')).toBe('Não informado');
    expect(sanitizePublicText('Local a definir')).toBe('Não informado');
  });

  it('sanitizeObservation remove texto de onboarding/teste', () => {
    expect(sanitizeObservation('Última manutenção registrada durante o onboarding')).toBe(
      'Não informado',
    );
    expect(sanitizeObservation('Texto de teste')).toBe('Não informado');
  });

  it('formatStatusConclusion produz frase natural', () => {
    expect(formatStatusConclusion({ ok: 2, warn: 0, danger: 0 })).toMatch(/operando normalmente/i);
    expect(formatStatusConclusion({ ok: 1, warn: 1, danger: 0 })).toMatch(/pontos de atenção/i);
    expect(formatStatusConclusion({ ok: 0, warn: 0, danger: 1 })).toMatch(/intervenção corretiva/i);
  });
});
