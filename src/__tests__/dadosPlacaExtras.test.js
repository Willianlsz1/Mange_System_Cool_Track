import { describe, it, expect } from 'vitest';
import {
  formatDadosPlacaRows,
  hasAnyDadosPlaca,
  prettifyDadosPlacaKey,
  CAMPOS_EXTRAS_DISPLAY_CAP,
} from '../domain/dadosPlacaDisplay.js';

describe('dadosPlacaDisplay — camposExtras rendering', () => {
  it('renderiza fixed rows e marca extras com flag extra:true', () => {
    const rows = formatDadosPlacaRows({
      numero_serie: 'ABC-1',
      capacidade_btu: 9000,
      camposExtras: [{ key: 'mca', label: 'MCA', value: '12' }],
    });
    const fixed = rows.filter((r) => !r.extra);
    const extras = rows.filter((r) => r.extra);
    expect(fixed.map((r) => r.key)).toEqual(['numero_serie', 'capacidade_btu']);
    expect(extras).toEqual([
      expect.objectContaining({ key: 'mca', label: 'MCA', value: '12', extra: true }),
    ]);
  });

  it('omite metadata (_source, notas, _*)', () => {
    const rows = formatDadosPlacaRows({
      numero_serie: 'ABC-1',
      _source: 'ai',
      notas: 'Etiqueta ok',
      _auditoria: 'x',
      camposExtras: [
        { key: '_privado', value: 'secreto' },
        { key: 'ok', value: 'visível' },
      ],
    });
    const keys = rows.map((r) => r.key);
    expect(keys).not.toContain('_source');
    expect(keys).not.toContain('notas');
    expect(keys).not.toContain('_auditoria');
    expect(keys).not.toContain('_privado');
    expect(keys).toContain('ok');
  });

  it('NÃO duplica extras com keys já renderizadas no fixed', () => {
    const rows = formatDadosPlacaRows({
      numero_serie: 'ABC-1',
      camposExtras: [
        { key: 'numero_serie', value: 'DUP' }, // deve ser descartado
        { key: 'peso_kg', value: '42' },
      ],
    });
    const keys = rows.map((r) => r.key);
    expect(keys.filter((k) => k === 'numero_serie').length).toBe(1);
    expect(keys).toContain('peso_kg');
  });

  it('respeita CAMPOS_EXTRAS_DISPLAY_CAP', () => {
    const many = Array.from({ length: CAMPOS_EXTRAS_DISPLAY_CAP + 5 }, (_, i) => ({
      key: `extra_${i}`,
      value: String(i),
    }));
    const rows = formatDadosPlacaRows({ camposExtras: many });
    const extras = rows.filter((r) => r.extra);
    expect(extras.length).toBe(CAMPOS_EXTRAS_DISPLAY_CAP);
  });

  it('retrocompatível: payload sem camposExtras funciona como antes', () => {
    const rows = formatDadosPlacaRows({
      numero_serie: 'X',
      capacidade_btu: 12000,
    });
    expect(rows.every((r) => !r.extra)).toBe(true);
  });

  it('hasAnyDadosPlaca retorna true quando só existem extras', () => {
    expect(hasAnyDadosPlaca({ camposExtras: [{ key: 'seer', value: '15.2' }] })).toBe(true);
  });

  it('ignora entries sem value ou malformadas nos camposExtras', () => {
    const rows = formatDadosPlacaRows({
      camposExtras: [
        null,
        { key: 'ok', value: 'válido' },
        { key: '', value: 'sem chave' },
        { key: 'sem_value', value: '' },
        { key: 'array_value', value: [1, 2] }, // aceita mas stringifica — cap de tipos não é aqui
      ],
    });
    const keys = rows.map((r) => r.key);
    expect(keys).toContain('ok');
    expect(keys).not.toContain('sem_value');
    // `sem chave` não aparece (key vazia falha no checker)
    expect(keys.filter((k) => !k).length).toBe(0);
  });

  it('usa label fornecido ou prettify do key como fallback', () => {
    const rows = formatDadosPlacaRows({
      camposExtras: [
        { key: 'com_label', label: 'Meu Rótulo', value: 'x' },
        { key: 'sem_label', value: 'y' },
      ],
    });
    const labels = rows.filter((r) => r.extra).map((r) => r.label);
    expect(labels).toEqual(['Meu Rótulo', prettifyDadosPlacaKey('sem_label')]);
  });

  it('prettifyDadosPlacaKey normaliza separadores e capitaliza', () => {
    expect(prettifyDadosPlacaKey('peso_kg')).toBe('Peso kg');
    expect(prettifyDadosPlacaKey('compressorModel')).toBe('Compressor model');
    expect(prettifyDadosPlacaKey(null)).toBe('');
    expect(prettifyDadosPlacaKey('')).toBe('');
  });
});
