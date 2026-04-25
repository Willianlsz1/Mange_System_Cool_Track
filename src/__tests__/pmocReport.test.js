/**
 * Tests for PMOC Fase 5 — pmocReport sequencial numbering.
 * Não testa o output do PDF (jsPDF requer canvas/DOM real); foca no
 * comportamento puro de numeração e na shape do output.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { nextPmocNumber } from '../domain/pdf/pmoc/pmocReport.js';

describe('nextPmocNumber', () => {
  beforeEach(() => {
    // Limpa storage entre testes
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  it('retorna PMOC YYYY/01 na primeira chamada com commit', () => {
    const num = nextPmocNumber('user-A', 2026, true);
    expect(num).toBe('PMOC 2026/01');
  });

  it('incrementa sequencialmente por user+ano com commit', () => {
    nextPmocNumber('user-A', 2026, true);
    nextPmocNumber('user-A', 2026, true);
    const third = nextPmocNumber('user-A', 2026, true);
    expect(third).toBe('PMOC 2026/03');
  });

  it('escopo separado por user', () => {
    nextPmocNumber('user-A', 2026, true);
    nextPmocNumber('user-A', 2026, true);
    const userB = nextPmocNumber('user-B', 2026, true);
    expect(userB).toBe('PMOC 2026/01');
  });

  it('escopo separado por ano', () => {
    nextPmocNumber('user-A', 2026, true);
    nextPmocNumber('user-A', 2026, true);
    const ano2027 = nextPmocNumber('user-A', 2027, true);
    expect(ano2027).toBe('PMOC 2027/01');
  });

  it('preview (commit=false) não incrementa', () => {
    nextPmocNumber('user-A', 2026, true); // /01
    const preview = nextPmocNumber('user-A', 2026, false);
    expect(preview).toBe('PMOC 2026/02');
    // Re-preview: ainda /02, não avançou
    const preview2 = nextPmocNumber('user-A', 2026, false);
    expect(preview2).toBe('PMOC 2026/02');
  });

  it('userId null cai em escopo "anon"', () => {
    const a = nextPmocNumber(null, 2026, true);
    const b = nextPmocNumber(null, 2026, true);
    expect(a).toBe('PMOC 2026/01');
    expect(b).toBe('PMOC 2026/02');
  });

  it('formato sempre com pad de 2 dígitos', () => {
    for (let i = 0; i < 9; i += 1) nextPmocNumber('user-A', 2026, true);
    const tenth = nextPmocNumber('user-A', 2026, true); // 10
    expect(tenth).toBe('PMOC 2026/10');
  });
});
