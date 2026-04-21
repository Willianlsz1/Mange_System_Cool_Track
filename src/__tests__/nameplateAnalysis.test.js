/**
 * CoolTrack Pro — Testes do módulo domain/nameplateAnalysis.js
 *
 * Foco: os mapeadores puros (mapTipoToOption, mapRefrigeranteToOption,
 * composeMarcaModelo, mapApiFieldsToFormShape) + os guards de `analyzeNameplate`
 * que rodam antes de qualquer chamada de rede (validação de file + erro
 * NO_SESSION quando não há token).
 *
 * Os caminhos que envolvem rede (response OK, PLAN_GATE_FREE, UPSTREAM_BUSY)
 * não são cobertos aqui de propósito — são testes de integração e vão num
 * arquivo separado se/quando adicionarmos MSW ou mocks de fetch.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock do supabase client — analyzeNameplate chama refreshSession/getSession
// pra obter o JWT. Por padrão fazemos ele não devolver sessão (NO_SESSION).
// Testes individuais podem sobrescrever passando um client customizado.
vi.mock('../core/supabase.js', () => ({
  supabase: {
    auth: {
      refreshSession: vi.fn(async () => ({ data: { session: null } })),
      getSession: vi.fn(async () => ({ data: { session: null } })),
    },
  },
}));

import {
  analyzeNameplate,
  composeMarcaModelo,
  ERR_FILE_INVALID,
  ERR_FILE_TOO_LARGE,
  ERR_NO_SESSION,
  mapApiFieldsToFormShape,
  mapRefrigeranteToOption,
  mapTipoToOption,
  NameplateAnalysisError,
} from '../domain/nameplateAnalysis.js';

describe('mapTipoToOption', () => {
  it('mapeia split → Split Hi-Wall', () => {
    expect(mapTipoToOption('split')).toBe('Split Hi-Wall');
  });

  it('mapeia vrf → VRF / VRV', () => {
    expect(mapTipoToOption('vrf')).toBe('VRF / VRV');
  });

  it('mapeia chiller → Chiller', () => {
    expect(mapTipoToOption('chiller')).toBe('Chiller');
  });

  it('mapeia fan_coil → Fan Coil', () => {
    expect(mapTipoToOption('fan_coil')).toBe('Fan Coil');
  });

  it('mapeia self_contained → Self Contained', () => {
    expect(mapTipoToOption('self_contained')).toBe('Self Contained');
  });

  it('mapeia janela → Outro (não existe option janela no select)', () => {
    expect(mapTipoToOption('janela')).toBe('Outro');
  });

  it('mapeia bomba_calor → Outro', () => {
    expect(mapTipoToOption('bomba_calor')).toBe('Outro');
  });

  it('mapeia outro → Outro', () => {
    expect(mapTipoToOption('outro')).toBe('Outro');
  });

  it('aceita variações de case (SPLIT, Split, sPliT)', () => {
    expect(mapTipoToOption('SPLIT')).toBe('Split Hi-Wall');
    expect(mapTipoToOption('Split')).toBe('Split Hi-Wall');
    expect(mapTipoToOption('sPliT')).toBe('Split Hi-Wall');
  });

  it('trim whitespace antes de casar', () => {
    expect(mapTipoToOption('  split  ')).toBe('Split Hi-Wall');
  });

  it('valor desconhecido cai no fallback Outro', () => {
    expect(mapTipoToOption('inexistente')).toBe('Outro');
    expect(mapTipoToOption('xpto')).toBe('Outro');
  });

  it('null/undefined/string vazia → null (não preenche o campo)', () => {
    expect(mapTipoToOption(null)).toBeNull();
    expect(mapTipoToOption(undefined)).toBeNull();
    expect(mapTipoToOption('')).toBeNull();
  });
});

describe('mapRefrigeranteToOption', () => {
  it('formato ASHRAE já normalizado passa direto', () => {
    expect(mapRefrigeranteToOption('R-410A')).toBe('R-410A');
    expect(mapRefrigeranteToOption('R-22')).toBe('R-22');
    expect(mapRefrigeranteToOption('R-32')).toBe('R-32');
    expect(mapRefrigeranteToOption('R-407C')).toBe('R-407C');
    expect(mapRefrigeranteToOption('R-134A')).toBe('R-134A');
    expect(mapRefrigeranteToOption('R-404A')).toBe('R-404A');
  });

  it('sem hífen (R410A) → R-410A', () => {
    expect(mapRefrigeranteToOption('R410A')).toBe('R-410A');
    expect(mapRefrigeranteToOption('R22')).toBe('R-22');
    expect(mapRefrigeranteToOption('R134A')).toBe('R-134A');
  });

  it('lowercase (r410a, r-134a) → R-410A', () => {
    expect(mapRefrigeranteToOption('r410a')).toBe('R-410A');
    expect(mapRefrigeranteToOption('r-134a')).toBe('R-134A');
  });

  it('com espaços internos ("r 410 a") → R-410A', () => {
    expect(mapRefrigeranteToOption('r 410 a')).toBe('R-410A');
    expect(mapRefrigeranteToOption('R 22')).toBe('R-22');
    expect(mapRefrigeranteToOption(' R-410A ')).toBe('R-410A');
  });

  it('variante reconhecida mas fora da lista → Outro', () => {
    // R-12 foi descontinuado, não consta no select
    expect(mapRefrigeranteToOption('R-12')).toBe('Outro');
    expect(mapRefrigeranteToOption('R-502')).toBe('Outro');
  });

  it('texto aleatório → Outro', () => {
    expect(mapRefrigeranteToOption('xpto')).toBe('Outro');
    expect(mapRefrigeranteToOption('freon')).toBe('Outro');
  });

  it('null/undefined/string vazia → null', () => {
    expect(mapRefrigeranteToOption(null)).toBeNull();
    expect(mapRefrigeranteToOption(undefined)).toBeNull();
    expect(mapRefrigeranteToOption('')).toBeNull();
  });
});

describe('composeMarcaModelo', () => {
  it('marca + modelo → "marca modelo"', () => {
    expect(composeMarcaModelo('LG', 'USNW092WSG3')).toBe('LG USNW092WSG3');
    expect(composeMarcaModelo('Carrier', '42MAA018515LC')).toBe('Carrier 42MAA018515LC');
  });

  it('só marca → "marca"', () => {
    expect(composeMarcaModelo('Samsung', null)).toBe('Samsung');
    expect(composeMarcaModelo('Samsung', '')).toBe('Samsung');
    expect(composeMarcaModelo('Samsung', undefined)).toBe('Samsung');
  });

  it('só modelo → "modelo"', () => {
    expect(composeMarcaModelo(null, 'USNW092WSG3')).toBe('USNW092WSG3');
    expect(composeMarcaModelo('', 'USNW092WSG3')).toBe('USNW092WSG3');
    expect(composeMarcaModelo(undefined, 'USNW092WSG3')).toBe('USNW092WSG3');
  });

  it('ambos vazios/nulos → null (não preenche o campo)', () => {
    expect(composeMarcaModelo(null, null)).toBeNull();
    expect(composeMarcaModelo('', '')).toBeNull();
    expect(composeMarcaModelo(undefined, undefined)).toBeNull();
    expect(composeMarcaModelo(null, undefined)).toBeNull();
  });

  it('trim whitespace de ambos', () => {
    expect(composeMarcaModelo('  LG  ', '  USNW092WSG3  ')).toBe('LG USNW092WSG3');
    expect(composeMarcaModelo('  LG  ', '')).toBe('LG');
  });

  it('whitespace puro conta como vazio', () => {
    expect(composeMarcaModelo('   ', '   ')).toBeNull();
    expect(composeMarcaModelo('LG', '   ')).toBe('LG');
  });
});

describe('mapApiFieldsToFormShape', () => {
  it('identified=false propaga e carrega notas', () => {
    const result = mapApiFieldsToFormShape({
      identified: false,
      notas: 'Imagem muito escura',
    });
    expect(result).toEqual({
      identified: false,
      notas: 'Imagem muito escura',
    });
  });

  it('identified=false sem notas → notas null', () => {
    const result = mapApiFieldsToFormShape({ identified: false });
    expect(result).toEqual({ identified: false, notas: null });
  });

  it('input null/undefined → identified:false', () => {
    expect(mapApiFieldsToFormShape(null)).toEqual({ identified: false, notas: null });
    expect(mapApiFieldsToFormShape(undefined)).toEqual({ identified: false, notas: null });
  });

  it('mapeia resposta completa típica da API (caso LG)', () => {
    const apiFields = {
      identified: true,
      confidence: 'alta',
      tipo_equipamento: 'split',
      refrigerante: 'R-410A',
      marca: 'LG',
      modelo: 'USNW092WSG3',
      numero_serie: '401KADK0Q123',
      capacidade_btu: 9000,
      capacidade_tr: null,
      tensao: 220,
      potencia_w: 820,
      corrente_a: 4.2,
      fases: 1,
      frequencia_hz: 60,
      ano_fabricacao: 2024,
      notas: null,
    };
    const result = mapApiFieldsToFormShape(apiFields);

    expect(result.identified).toBe(true);
    expect(result.confidence).toBe('alta');
    expect(result.tipo).toBe('Split Hi-Wall');
    expect(result.fluido).toBe('R-410A');
    expect(result.marcaModelo).toBe('LG USNW092WSG3');
    expect(result.numeroSerie).toBe('401KADK0Q123');
    expect(result.capacidadeBtu).toBe(9000);
    expect(result.tensao).toBe(220);
    expect(result.fases).toBe(1);
    expect(result.anoFabricacao).toBe(2024);
  });

  it('confidence default é "media" quando a API omite', () => {
    const result = mapApiFieldsToFormShape({
      identified: true,
      tipo_equipamento: 'split',
      refrigerante: 'R-22',
      marca: 'Carrier',
      modelo: null,
    });
    expect(result.confidence).toBe('media');
  });

  it('campos auxiliares ausentes viram null (não undefined)', () => {
    const result = mapApiFieldsToFormShape({
      identified: true,
      tipo_equipamento: 'chiller',
    });
    expect(result.numeroSerie).toBeNull();
    expect(result.capacidadeBtu).toBeNull();
    expect(result.capacidadeTr).toBeNull();
    expect(result.tensao).toBeNull();
    expect(result.potenciaW).toBeNull();
    expect(result.correnteA).toBeNull();
    expect(result.correnteAquecA).toBeNull();
    expect(result.fases).toBeNull();
    expect(result.frequenciaHz).toBeNull();
    expect(result.pressaoSuccaoMpa).toBeNull();
    expect(result.pressaoDescargaMpa).toBeNull();
    expect(result.grauProtecao).toBeNull();
    expect(result.anoFabricacao).toBeNull();
    expect(result.notas).toBeNull();
  });

  it('mapeia os novos 4 campos da etiqueta (corrente aquec, pressões, grau proteção)', () => {
    // Caso completo: a API devolve todos os campos da etiqueta física (16 no
    // total). Garantimos que os 4 adicionados recentemente chegam no shape do
    // form sem alteração — são passados direto pro input (sem select/map).
    const result = mapApiFieldsToFormShape({
      identified: true,
      tipo_equipamento: 'split',
      refrigerante: 'R-410A',
      marca: 'LG',
      modelo: 'USNW092WSG3',
      corrente_aquec_a: 4.15,
      pressao_succao_mpa: 2.4,
      pressao_descarga_mpa: 4.2,
      grau_protecao: 'IPX0',
    });
    expect(result.correnteAquecA).toBe(4.15);
    expect(result.pressaoSuccaoMpa).toBe(2.4);
    expect(result.pressaoDescargaMpa).toBe(4.2);
    expect(result.grauProtecao).toBe('IPX0');
  });

  it('campos primários ausentes → mapped fica null (sinal pro caller não sobrescrever)', () => {
    const result = mapApiFieldsToFormShape({ identified: true });
    expect(result.tipo).toBeNull();
    expect(result.fluido).toBeNull();
    expect(result.marcaModelo).toBeNull();
  });

  it('tipo desconhecido cai em Outro (não quebra o select)', () => {
    const result = mapApiFieldsToFormShape({
      identified: true,
      tipo_equipamento: 'hibrido_futurista',
      refrigerante: 'R-32',
      marca: 'X',
      modelo: 'Y',
    });
    expect(result.tipo).toBe('Outro');
    expect(result.fluido).toBe('R-32');
    expect(result.marcaModelo).toBe('X Y');
  });
});

// ── analyzeNameplate — guards síncronos ─────────────────────────────────────
// Testamos só os caminhos que NÃO envolvem rede: validação de file e o
// early-exit NO_SESSION quando o Supabase não devolve token.

describe('analyzeNameplate — validação de arquivo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejeita file ausente com FILE_INVALID', async () => {
    await expect(analyzeNameplate(null)).rejects.toMatchObject({
      code: ERR_FILE_INVALID,
    });
  });

  it('rejeita file sem type com FILE_INVALID', async () => {
    const file = { size: 100 }; // sem .type
    await expect(analyzeNameplate(file)).rejects.toMatchObject({
      code: ERR_FILE_INVALID,
    });
  });

  it('rejeita type não-imagem com FILE_INVALID', async () => {
    const file = { type: 'application/pdf', size: 100 };
    await expect(analyzeNameplate(file)).rejects.toMatchObject({
      code: ERR_FILE_INVALID,
    });
  });

  it('rejeita file > 8 MB com FILE_TOO_LARGE', async () => {
    const file = { type: 'image/jpeg', size: 9 * 1024 * 1024 };
    await expect(analyzeNameplate(file)).rejects.toMatchObject({
      code: ERR_FILE_TOO_LARGE,
    });
  });

  it('aceita image/jpeg, image/png, image/webp no cheque de type', async () => {
    // Todos devem passar do cheque de file e cair em NO_SESSION (supabase
    // mock devolve null session por padrão).
    for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
      const file = { type, size: 1024 };
      await expect(analyzeNameplate(file)).rejects.toMatchObject({
        code: ERR_NO_SESSION,
      });
    }
  });

  it('erros de validação são instâncias de NameplateAnalysisError', async () => {
    await expect(analyzeNameplate(null)).rejects.toBeInstanceOf(NameplateAnalysisError);
  });
});

describe('analyzeNameplate — sessão', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sem token → NO_SESSION com mensagem de login', async () => {
    const file = { type: 'image/jpeg', size: 1024 };
    try {
      await analyzeNameplate(file);
      throw new Error('deveria ter rejeitado');
    } catch (err) {
      expect(err).toBeInstanceOf(NameplateAnalysisError);
      expect(err.code).toBe(ERR_NO_SESSION);
      expect(err.message).toMatch(/login/i);
    }
  });

  it('respeita supabaseClient custom via opts', async () => {
    // Client custom que também devolve null session — confirma que o caminho
    // de override é usado (não o mock do módulo).
    const customClient = {
      auth: {
        refreshSession: vi.fn(async () => ({ data: { session: null } })),
        getSession: vi.fn(async () => ({ data: { session: null } })),
      },
    };
    const file = { type: 'image/jpeg', size: 1024 };

    await expect(analyzeNameplate(file, { supabaseClient: customClient })).rejects.toMatchObject({
      code: ERR_NO_SESSION,
    });

    // Confirma que o custom client foi consultado
    expect(customClient.auth.refreshSession).toHaveBeenCalled();
  });
});
