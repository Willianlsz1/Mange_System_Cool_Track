import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ───────────────────────────────────────────────────────────────────
// Foco dos testes: helpers puros expostos pela view (buildPeriodNarrative,
// countCorretivas, shouldShowCorretivasBanner, getProximasAcoes). Utils é
// real — precisamos de daysUntil/formatDate/escapeHtml. Tudo que tem
// side-effect (state, skeleton, signature, pdfQuotaBadge) é mockado pra
// isolar a importação.

vi.mock('../core/state.js', () => ({
  getState: vi.fn(() => ({ registros: [], equipamentos: [] })),
  findEquip: vi.fn(() => null),
}));
vi.mock('../ui/components/skeleton.js', () => ({
  withSkeleton: (_el, _opts, fn) => fn(),
}));
vi.mock('../domain/maintenance.js', () => ({
  CRITICIDADE_LABEL: { media: 'Média' },
  PRIORIDADE_OPERACIONAL_LABEL: { normal: 'Normal' },
}));
vi.mock('../domain/dadosPlacaDisplay.js', () => ({
  formatDadosPlacaRows: vi.fn(() => []),
}));
vi.mock('../ui/components/pdfQuotaBadge.js', () => ({
  PdfQuotaBadge: { refresh: vi.fn() },
}));
vi.mock('../ui/components/signature.js', () => ({
  getSignatureForRecord: vi.fn(() => null),
  SignatureViewerModal: { open: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('buildPeriodNarrative', () => {
  it('retorna null quando lista está vazia', async () => {
    const { buildPeriodNarrative } = await import('../ui/views/relatorio.js');
    expect(buildPeriodNarrative([])).toBeNull();
    expect(buildPeriodNarrative(null)).toBeNull();
    expect(buildPeriodNarrative(undefined)).toBeNull();
  });

  it('conta atendimentos e equipamentos únicos', async () => {
    const { buildPeriodNarrative } = await import('../ui/views/relatorio.js');
    const result = buildPeriodNarrative([
      { equipId: 'e1', tipo: 'Manutenção Preventiva' },
      { equipId: 'e1', tipo: 'Manutenção Preventiva' }, // mesmo equip
      { equipId: 'e2', tipo: 'Manutenção Preventiva' },
    ]);
    expect(result.total).toBe(3);
    expect(result.equipsUnicos).toBe(2);
  });

  it('usa singular quando total=1 e equipsUnicos=1', async () => {
    const { buildPeriodNarrative } = await import('../ui/views/relatorio.js');
    const result = buildPeriodNarrative([{ equipId: 'e1', tipo: 'Manutenção Preventiva' }]);
    expect(result.text).toMatch(/1 atendimento em 1 equipamento/);
  });

  it('inclui predomínio quando tipo dominante ≥30% E há múltiplos tipos', async () => {
    const { buildPeriodNarrative } = await import('../ui/views/relatorio.js');
    const result = buildPeriodNarrative([
      { equipId: 'e1', tipo: 'Manutenção Preventiva' },
      { equipId: 'e2', tipo: 'Manutenção Preventiva' },
      { equipId: 'e3', tipo: 'Manutenção Preventiva' },
      { equipId: 'e4', tipo: 'Manutenção Corretiva' },
    ]);
    // 3/4 = 75% → passa os 30%
    expect(result.text).toMatch(/predomínio de Preventiva \(75%\)/);
  });

  it('omite predomínio quando há apenas um tipo (seria redundante)', async () => {
    const { buildPeriodNarrative } = await import('../ui/views/relatorio.js');
    const result = buildPeriodNarrative([
      { equipId: 'e1', tipo: 'Manutenção Preventiva' },
      { equipId: 'e2', tipo: 'Manutenção Preventiva' },
    ]);
    expect(result.text).not.toMatch(/predomínio/i);
  });

  it('omite predomínio quando tipo top < 30%', async () => {
    const { buildPeriodNarrative } = await import('../ui/views/relatorio.js');
    // 5 tipos diferentes, cada um 20% — nenhum domina
    const result = buildPeriodNarrative([
      { equipId: 'e1', tipo: 'Manutenção Preventiva' },
      { equipId: 'e2', tipo: 'Manutenção Corretiva' },
      { equipId: 'e3', tipo: 'Limpeza de Filtros' },
      { equipId: 'e4', tipo: 'Verificação Elétrica' },
      { equipId: 'e5', tipo: 'Inspeção Geral' },
    ]);
    expect(result.text).not.toMatch(/predomínio/i);
  });

  it('conta e inclui corretivas no texto', async () => {
    const { buildPeriodNarrative } = await import('../ui/views/relatorio.js');
    const result = buildPeriodNarrative([
      { equipId: 'e1', tipo: 'Manutenção Preventiva' },
      { equipId: 'e2', tipo: 'Manutenção Corretiva' },
      { equipId: 'e3', tipo: 'Manutenção Corretiva' },
    ]);
    expect(result.corretivas).toBe(2);
    expect(result.text).toMatch(/2 corretivas/);
  });

  it('usa singular "1 corretiva" quando há apenas uma', async () => {
    const { buildPeriodNarrative } = await import('../ui/views/relatorio.js');
    const result = buildPeriodNarrative([
      { equipId: 'e1', tipo: 'Manutenção Preventiva' },
      { equipId: 'e2', tipo: 'Manutenção Corretiva' },
    ]);
    expect(result.text).toMatch(/1 corretiva/);
    expect(result.text).not.toMatch(/1 corretivas/);
  });

  it('ignora equipId ausente sem quebrar', async () => {
    const { buildPeriodNarrative } = await import('../ui/views/relatorio.js');
    const result = buildPeriodNarrative([
      { tipo: 'Manutenção Preventiva' }, // sem equipId
      { equipId: 'e1', tipo: 'Manutenção Preventiva' },
    ]);
    expect(result.total).toBe(2);
    expect(result.equipsUnicos).toBe(1);
  });
});

describe('countCorretivas', () => {
  it('retorna 0 para lista vazia', async () => {
    const { countCorretivas } = await import('../ui/views/relatorio.js');
    expect(countCorretivas([])).toBe(0);
    expect(countCorretivas(null)).toBe(0);
    expect(countCorretivas(undefined)).toBe(0);
  });

  it('conta corretivas case-insensitive', async () => {
    const { countCorretivas } = await import('../ui/views/relatorio.js');
    expect(
      countCorretivas([
        { tipo: 'Manutenção Corretiva' },
        { tipo: 'manutenção corretiva' },
        { tipo: 'CORRETIVA urgente' },
      ]),
    ).toBe(3);
  });

  it('não conta preventivas nem outras categorias', async () => {
    const { countCorretivas } = await import('../ui/views/relatorio.js');
    expect(
      countCorretivas([
        { tipo: 'Manutenção Preventiva' },
        { tipo: 'Limpeza de Filtros' },
        { tipo: 'Inspeção Geral' },
      ]),
    ).toBe(0);
  });

  it('ignora tipo ausente', async () => {
    const { countCorretivas } = await import('../ui/views/relatorio.js');
    expect(countCorretivas([{}, { tipo: null }, { tipo: '' }])).toBe(0);
  });
});

describe('shouldShowCorretivasBanner', () => {
  it('esconde quando count < 2 (mínimo absoluto)', async () => {
    const { shouldShowCorretivasBanner } = await import('../ui/views/relatorio.js');
    expect(shouldShowCorretivasBanner(0, 10)).toBe(false);
    expect(shouldShowCorretivasBanner(1, 10)).toBe(false);
  });

  it('esconde quando total é 0', async () => {
    const { shouldShowCorretivasBanner } = await import('../ui/views/relatorio.js');
    expect(shouldShowCorretivasBanner(2, 0)).toBe(false);
  });

  it('esconde quando razão < 30% (evita ruído em relatório grande)', async () => {
    const { shouldShowCorretivasBanner } = await import('../ui/views/relatorio.js');
    // 3 corretivas em 100 registros = 3% — noise
    expect(shouldShowCorretivasBanner(3, 100)).toBe(false);
  });

  it('mostra quando count ≥ 2 E razão ≥ 30%', async () => {
    const { shouldShowCorretivasBanner } = await import('../ui/views/relatorio.js');
    expect(shouldShowCorretivasBanner(3, 10)).toBe(true); // 30%
    expect(shouldShowCorretivasBanner(2, 2)).toBe(true); // 100%
    expect(shouldShowCorretivasBanner(5, 10)).toBe(true); // 50%
  });
});

describe('getProximasAcoes', () => {
  const hoje = new Date();
  const diasFuturo = (n) => {
    const d = new Date(hoje.getTime() + n * 86400000);
    return d.toISOString().slice(0, 10);
  };

  it('retorna vazio para lista vazia', async () => {
    const { getProximasAcoes } = await import('../ui/views/relatorio.js');
    expect(getProximasAcoes([], [])).toEqual([]);
    expect(getProximasAcoes(null, [])).toEqual([]);
  });

  it('ignora registros sem equipId ou sem proxima', async () => {
    const { getProximasAcoes } = await import('../ui/views/relatorio.js');
    const result = getProximasAcoes(
      [
        { proxima: diasFuturo(5) }, // sem equipId
        { equipId: 'e1' }, // sem proxima
        { equipId: 'e2', proxima: diasFuturo(3) }, // válido
      ],
      [],
    );
    expect(result).toHaveLength(1);
    expect(result[0].equipId).toBe('e2');
  });

  it('inclui registros dentro da janela de 14 dias', async () => {
    const { getProximasAcoes } = await import('../ui/views/relatorio.js');
    const result = getProximasAcoes(
      [
        { equipId: 'e1', proxima: diasFuturo(5) },
        { equipId: 'e2', proxima: diasFuturo(10) },
        { equipId: 'e3', proxima: diasFuturo(20) }, // fora
      ],
      [],
    );
    expect(result).toHaveLength(2);
  });

  it('inclui vencidas (daysUntil negativo) mesmo muito atrasadas', async () => {
    const { getProximasAcoes } = await import('../ui/views/relatorio.js');
    const result = getProximasAcoes(
      [
        { equipId: 'e1', proxima: diasFuturo(-30) }, // muito vencida
        { equipId: 'e2', proxima: diasFuturo(-1) },
      ],
      [],
    );
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.tone === 'danger')).toBe(true);
  });

  it('dedup por equipId: mantém o mais urgente por equipamento', async () => {
    const { getProximasAcoes } = await import('../ui/views/relatorio.js');
    const result = getProximasAcoes(
      [
        { equipId: 'e1', proxima: diasFuturo(10) },
        { equipId: 'e1', proxima: diasFuturo(3) }, // mais urgente
        { equipId: 'e1', proxima: diasFuturo(7) },
      ],
      [],
    );
    expect(result).toHaveLength(1);
    expect(result[0].daysUntil).toBe(3);
  });

  it('ordena por urgência (vencidas primeiro, depois mais próximas)', async () => {
    const { getProximasAcoes } = await import('../ui/views/relatorio.js');
    const result = getProximasAcoes(
      [
        { equipId: 'e1', proxima: diasFuturo(10) },
        { equipId: 'e2', proxima: diasFuturo(-3) },
        { equipId: 'e3', proxima: diasFuturo(2) },
        { equipId: 'e4', proxima: diasFuturo(-7) },
      ],
      [],
    );
    expect(result.map((r) => r.equipId)).toEqual(['e4', 'e2', 'e3', 'e1']);
  });

  it('respeita o limite de itens retornados', async () => {
    const { getProximasAcoes } = await import('../ui/views/relatorio.js');
    const list = Array.from({ length: 10 }, (_, i) => ({
      equipId: `e${i}`,
      proxima: diasFuturo(i),
    }));
    const result = getProximasAcoes(list, [], 3);
    expect(result).toHaveLength(3);
  });

  it('marca tone=danger para vencidas e tone=warn para futuras', async () => {
    const { getProximasAcoes } = await import('../ui/views/relatorio.js');
    const result = getProximasAcoes(
      [
        { equipId: 'e1', proxima: diasFuturo(-1) },
        { equipId: 'e2', proxima: diasFuturo(0) }, // hoje
        { equipId: 'e3', proxima: diasFuturo(5) },
      ],
      [],
    );
    const byEquip = Object.fromEntries(result.map((r) => [r.equipId, r.tone]));
    expect(byEquip.e1).toBe('danger'); // vencida
    expect(byEquip.e2).toBe('warn'); // hoje (0, não-negativo)
    expect(byEquip.e3).toBe('warn'); // futura próxima
  });

  it('usa nome do equipamento quando disponível no index', async () => {
    const { getProximasAcoes } = await import('../ui/views/relatorio.js');
    const result = getProximasAcoes(
      [{ equipId: 'e1', proxima: diasFuturo(3) }],
      [{ id: 'e1', nome: 'Split Sala A', tag: 'TAG-001' }],
    );
    expect(result[0].equipNome).toBe('Split Sala A');
    expect(result[0].equipTag).toBe('TAG-001');
  });

  it('cai para r.equipNome quando equip não está no index', async () => {
    const { getProximasAcoes } = await import('../ui/views/relatorio.js');
    const result = getProximasAcoes(
      [{ equipId: 'e1', equipNome: 'Nome histórico', proxima: diasFuturo(3) }],
      [], // index vazio
    );
    expect(result[0].equipNome).toBe('Nome histórico');
  });
});
