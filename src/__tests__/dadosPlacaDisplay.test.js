import { describe, expect, it } from 'vitest';
import { formatDadosPlacaRows, hasAnyDadosPlaca } from '../domain/dadosPlacaDisplay.js';

// Esses testes trancam a convenção de formatação pt-BR (vírgula decimal, ponto
// de milhar, unidades explícitas). Mudança intencional no formatter deve
// quebrar estes e obrigar atualização consciente.

describe('formatDadosPlacaRows — formatação por campo', () => {
  it('retorna array vazio pra null/undefined/array/scalar', () => {
    expect(formatDadosPlacaRows(null)).toEqual([]);
    expect(formatDadosPlacaRows(undefined)).toEqual([]);
    expect(formatDadosPlacaRows([])).toEqual([]);
    expect(formatDadosPlacaRows('oi')).toEqual([]);
    expect(formatDadosPlacaRows(42)).toEqual([]);
  });

  it('omite campos vazios/null/undefined do blob', () => {
    const rows = formatDadosPlacaRows({
      numero_serie: '',
      capacidade_btu: null,
      tensao: undefined,
      frequencia_hz: 60,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ key: 'frequencia_hz', value: '60 Hz' });
  });

  it('ignora _source e chaves desconhecidas', () => {
    const rows = formatDadosPlacaRows({
      _source: 'ai',
      _random_key: 'whatever',
      capacidade_btu: 9000,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].key).toBe('capacidade_btu');
  });

  it('respeita FIELD_ORDER semântico (identificação → elétrica → térmica → proteção → ano)', () => {
    // Envia fora de ordem, espera retornar em ordem canônica.
    const rows = formatDadosPlacaRows({
      ano_fabricacao: 2024,
      capacidade_btu: 9000,
      numero_serie: 'ABC',
      grau_protecao: 'IPX0',
      tensao: '220',
    });
    expect(rows.map((r) => r.key)).toEqual([
      'numero_serie',
      'capacidade_btu',
      'tensao',
      'grau_protecao',
      'ano_fabricacao',
    ]);
  });

  it('formata capacidade BTU com separador de milhar pt-BR', () => {
    const rows = formatDadosPlacaRows({ capacidade_btu: 9000 });
    expect(rows[0].value).toBe('9.000 BTU');

    const rows2 = formatDadosPlacaRows({ capacidade_btu: 12000 });
    expect(rows2[0].value).toBe('12.000 BTU');
  });

  it('formata tensão numérica como "220 V" e preserva "bivolt" capitalizado', () => {
    expect(formatDadosPlacaRows({ tensao: '220' })[0].value).toBe('220 V');
    expect(formatDadosPlacaRows({ tensao: '127' })[0].value).toBe('127 V');
    expect(formatDadosPlacaRows({ tensao: 'bivolt' })[0].value).toBe('Bivolt');
    expect(formatDadosPlacaRows({ tensao: 'BIVOLT' })[0].value).toBe('Bivolt');
  });

  it('formata frequência com unidade Hz', () => {
    expect(formatDadosPlacaRows({ frequencia_hz: 60 })[0].value).toBe('60 Hz');
    expect(formatDadosPlacaRows({ frequencia_hz: 50 })[0].value).toBe('50 Hz');
  });

  it('mapeia fases 1/2/3 pra Monofásico/Bifásico/Trifásico', () => {
    expect(formatDadosPlacaRows({ fases: 1 })[0].value).toBe('Monofásico');
    expect(formatDadosPlacaRows({ fases: 2 })[0].value).toBe('Bifásico');
    expect(formatDadosPlacaRows({ fases: 3 })[0].value).toBe('Trifásico');
  });

  it('fallback genérico pra fases fora de 1-3', () => {
    expect(formatDadosPlacaRows({ fases: 4 })[0].value).toBe('4 fases');
  });

  it('formata potência com unidade W', () => {
    expect(formatDadosPlacaRows({ potencia_w: 820 })[0].value).toBe('820 W');
    expect(formatDadosPlacaRows({ potencia_w: 1500 })[0].value).toBe('1.500 W');
  });

  it('formata correntes com 2 casas decimais em vírgula pt-BR + unidade A', () => {
    expect(formatDadosPlacaRows({ corrente_refrig_a: 4.63 })[0].value).toBe('4,63 A');
    expect(formatDadosPlacaRows({ corrente_aquec_a: 4.15 })[0].value).toBe('4,15 A');
    // Inteiro vira "N,00 A" — mantém consistência visual.
    expect(formatDadosPlacaRows({ corrente_refrig_a: 4 })[0].value).toBe('4,00 A');
  });

  it('formata pressões com 1 casa decimal em vírgula pt-BR + unidade MPa', () => {
    expect(formatDadosPlacaRows({ pressao_succao_mpa: 2.4 })[0].value).toBe('2,4 MPa');
    expect(formatDadosPlacaRows({ pressao_descarga_mpa: 4.2 })[0].value).toBe('4,2 MPa');
  });

  it('preserva grau de proteção como-está (é código IPxy)', () => {
    expect(formatDadosPlacaRows({ grau_protecao: 'IPX0' })[0].value).toBe('IPX0');
    expect(formatDadosPlacaRows({ grau_protecao: 'IP24' })[0].value).toBe('IP24');
  });

  it('valida range do ano de fabricação (1900-2100)', () => {
    expect(formatDadosPlacaRows({ ano_fabricacao: 2024 })[0].value).toBe('2024');
    // Out of range — omitido.
    expect(formatDadosPlacaRows({ ano_fabricacao: 1800 })).toEqual([]);
    expect(formatDadosPlacaRows({ ano_fabricacao: 3000 })).toEqual([]);
  });

  it('marca número de série e grau de proteção com mono: true', () => {
    const rows = formatDadosPlacaRows({
      numero_serie: 'ABC-123',
      grau_protecao: 'IPX0',
      capacidade_btu: 9000,
    });
    const serie = rows.find((r) => r.key === 'numero_serie');
    const grau = rows.find((r) => r.key === 'grau_protecao');
    const cap = rows.find((r) => r.key === 'capacidade_btu');
    expect(serie.mono).toBe(true);
    expect(grau.mono).toBe(true);
    expect(cap.mono).toBeUndefined();
  });

  it('blob completo produz 12 linhas em ordem', () => {
    const rows = formatDadosPlacaRows({
      numero_serie: '312KAKY3F817',
      capacidade_btu: 9000,
      tensao: '220',
      frequencia_hz: 60,
      fases: 1,
      potencia_w: 820,
      corrente_refrig_a: 4.63,
      corrente_aquec_a: 4.15,
      pressao_succao_mpa: 2.4,
      pressao_descarga_mpa: 4.2,
      grau_protecao: 'IPX0',
      ano_fabricacao: 2024,
      _source: 'ai',
    });
    expect(rows).toHaveLength(12);
    expect(rows.map((r) => r.label)).toEqual([
      'Nº de série',
      'Capacidade',
      'Tensão',
      'Frequência',
      'Fases',
      'Potência',
      'Corrente (refrig.)',
      'Corrente (aquec.)',
      'Pressão de sucção',
      'Pressão de descarga',
      'Grau de proteção',
      'Ano de fabricação',
    ]);
  });
});

describe('hasAnyDadosPlaca', () => {
  it('retorna false pra input vazio/null/undefined/array', () => {
    expect(hasAnyDadosPlaca(null)).toBe(false);
    expect(hasAnyDadosPlaca(undefined)).toBe(false);
    expect(hasAnyDadosPlaca({})).toBe(false);
    expect(hasAnyDadosPlaca([])).toBe(false);
  });

  it('retorna false se só tiver _source ou chaves vazias', () => {
    expect(hasAnyDadosPlaca({ _source: 'ai' })).toBe(false);
    expect(hasAnyDadosPlaca({ numero_serie: '', capacidade_btu: null })).toBe(false);
  });

  it('retorna true se tiver pelo menos um campo preenchido', () => {
    expect(hasAnyDadosPlaca({ capacidade_btu: 9000 })).toBe(true);
    expect(hasAnyDadosPlaca({ _source: 'ai', numero_serie: 'ABC' })).toBe(true);
  });
});
