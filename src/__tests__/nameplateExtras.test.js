import { describe, it, expect } from 'vitest';
import {
  mapApiFieldsToFormShape,
  buildCamposExtras,
  humanizeExtraKey,
} from '../domain/nameplateAnalysis.js';

describe('nameplateAnalysis — camposExtras (flexible labels)', () => {
  it('preserva campos desconhecidos top-level como camposExtras', () => {
    const api = {
      identified: true,
      marca: 'LG',
      modelo: 'ABC-1',
      // Chaves fora do whitelist:
      mca: 12,
      mocp: 20,
      compressor_model: 'SC15G',
      peso_kg: 42.5,
    };
    const result = mapApiFieldsToFormShape(api);
    expect(result.identified).toBe(true);
    expect(Array.isArray(result.camposExtras)).toBe(true);
    const keys = result.camposExtras.map((e) => e.key);
    expect(keys).toContain('mca');
    expect(keys).toContain('mocp');
    expect(keys).toContain('compressor_model');
    expect(keys).toContain('peso_kg');
  });

  it('NÃO duplica extras que já têm slot conhecido', () => {
    const api = {
      identified: true,
      numero_serie: 'ABC-1',
      capacidade_btu: 9000,
      mca: 12, // único extra real
    };
    const result = mapApiFieldsToFormShape(api);
    const keys = result.camposExtras.map((e) => e.key);
    expect(keys).toEqual(['mca']);
  });

  it('preserva notas e capacidade_tr como campos do form shape', () => {
    const api = {
      identified: true,
      notas: 'Etiqueta parcialmente legível',
      capacidade_tr: 2.5,
    };
    const result = mapApiFieldsToFormShape(api);
    expect(result.notas).toBe('Etiqueta parcialmente legível');
    expect(result.capacidadeTr).toBe(2.5);
  });

  it('ignora valores nulos, vazios e objetos aninhados nos extras', () => {
    const api = {
      identified: true,
      soft_field: '',
      another: null,
      ignored_object: { a: 1 },
      valid_extra: 'mantém',
    };
    const extras = buildCamposExtras(api);
    const keys = extras.map((e) => e.key);
    expect(keys).toEqual(['valid_extra']);
  });

  it('aceita campos_extras como bloco explícito (array)', () => {
    const api = {
      identified: true,
      campos_extras: [
        { key: 'seer', value: 15.2 },
        { chave: 'cop', valor: 3.1 },
        { key: 'no_value', value: '' }, // deve ser ignorado
      ],
    };
    const extras = buildCamposExtras(api);
    const pairs = extras.map((e) => [e.key, e.value]);
    expect(pairs).toContainEqual(['seer', '15.2']);
    expect(pairs).toContainEqual(['cop', '3.1']);
    expect(pairs.find(([k]) => k === 'no_value')).toBeUndefined();
  });

  it('humanizeExtraKey traduz dicionário comum em pt-BR', () => {
    expect(humanizeExtraKey('mca')).toContain('Corrente mínima');
    expect(humanizeExtraKey('compressor_model')).toContain('compressor');
    expect(humanizeExtraKey('tr')).toContain('TR');
    expect(humanizeExtraKey('pressure')).toBe('Pressão');
  });

  it('humanizeExtraKey normaliza fallback sem dicionário', () => {
    expect(humanizeExtraKey('pressao_maxima_op')).toBe('Pressao maxima op');
    expect(humanizeExtraKey('compressorModel')).toBe('Compressor model');
    expect(humanizeExtraKey(null)).toBe('');
    expect(humanizeExtraKey('')).toBe('');
  });

  it('retorna identified=false intacto quando a API não identificou', () => {
    const result = mapApiFieldsToFormShape({ identified: false, notas: 'Foto ruim' });
    expect(result.identified).toBe(false);
    expect(result.notas).toBe('Foto ruim');
  });
});
