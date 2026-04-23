import { describe, expect, it } from 'vitest';
import { SETOR_NOME_MAX, validateSetorNome } from '../core/setorRules.js';

describe('setorRules', () => {
  it('mantém limite único de nome em 40', () => {
    expect(SETOR_NOME_MAX).toBe(40);
  });

  it('trata vazio e espaços como inválido', () => {
    expect(validateSetorNome('').isValid).toBe(false);
    expect(validateSetorNome('   ').isValid).toBe(false);
  });

  it('aceita 40 e rejeita 41 caracteres', () => {
    expect(validateSetorNome('A'.repeat(40)).isValid).toBe(true);
    expect(validateSetorNome('A'.repeat(41)).isValid).toBe(false);
  });
});
