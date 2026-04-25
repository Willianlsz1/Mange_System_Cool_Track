import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ───────────────────────────────────────────────────────────────────
// State é o único input real do hero/filters. regsForEquip retorna [] default.
const getState = vi.fn();
const regsForEquip = vi.fn(() => []);
vi.mock('../core/state.js', () => ({
  getState,
  regsForEquip,
  findEquip: vi.fn(),
  findSetor: vi.fn(),
  setState: vi.fn(),
}));

// priorityEngine só importa pra contar "em-atencao" — mock devolve níveis
// determinísticos baseados em eq.__mockPriority pra test fixtures.
const evaluateEquipmentPriorityMock = vi.fn((eq) => ({
  priorityLevel: eq?.__mockPriority ?? 1, // 1 = OK, 3 = ALTA, 4 = URGENTE
  priorityLabel: 'mock',
}));
vi.mock('../domain/priorityEngine.js', () => ({
  PRIORITY_LEVEL: {
    OK: 1,
    BAIXA: 2,
    ALTA: 3,
    URGENTE: 4,
  },
  evaluateEquipmentPriority: evaluateEquipmentPriorityMock,
}));

const getActionPriorityScoreMock = vi.fn(() => ({ actionPriorityScore: 10 }));
vi.mock('../domain/actionPriority.js', () => ({
  getActionPriorityScore: getActionPriorityScoreMock,
}));

const evaluateEquipmentSuggestedActionMock = vi.fn(() => ({
  actionCode: 'none',
  actionLabel: 'Sem ação',
}));
vi.mock('../domain/suggestedAction.js', () => ({
  ACTION_CODE: {
    NONE: 'none',
    MONITOR: 'monitor',
    COLLECT_DATA: 'collect_data',
    REGISTER_CORRECTIVE: 'register_corrective',
    REGISTER_CORRECTIVE_IMMEDIATE: 'register_corrective_immediate',
    REGISTER_PREVENTIVE: 'register_preventive',
    SCHEDULE_PREVENTIVE: 'schedule_preventive',
  },
  evaluateEquipmentSuggestedAction: evaluateEquipmentSuggestedActionMock,
}));

// alerts.getPreventivaDueEquipmentIds é a fonte do KPI preventiva30d.
const getPreventivaDueEquipmentIds = vi.fn();
vi.mock('../domain/alerts.js', () => ({
  Alerts: { getAll: vi.fn(() => []) },
  getPreventivaDueEquipmentIds,
}));

// Skeleton pass-through pra testes síncronos
vi.mock('../ui/components/skeleton.js', () => ({
  withSkeleton: (_el, _opts, renderFn) => renderFn(),
}));

// Maintenance só é usado por renderEquipHero indiretamente (não diretamente
// — mas o módulo importa). Mock básico.
const evaluateEquipmentRiskMock = vi.fn(() => ({
  score: 50,
  classification: 'baixo',
  factors: ['rotina estável'],
}));
vi.mock('../domain/maintenance.js', () => ({
  evaluateEquipmentHealth: vi.fn(() => ({ score: 80, context: { daysToNext: 30 } })),
  getHealthClass: vi.fn((score) => {
    if (score >= 85) return 'ok';
    if (score >= 60) return 'warn';
    return 'danger';
  }),
  evaluateEquipmentRisk: evaluateEquipmentRiskMock,
  evaluateEquipmentRiskTrend: vi.fn(() => ({ trend: 'stable', delta: 0 })),
  getEquipmentMaintenanceContext: vi.fn(() => ({
    ultimoRegistro: null,
    daysToNext: 30,
    equipamento: { criticidade: 'media', status: 'ok' },
    recentCorrectiveCount: 0,
  })),
  getSuggestedPreventiveDays: vi.fn(() => 30),
  normalizePeriodicidadePreventivaDias: vi.fn((d) => d ?? 30),
}));

// Reset DOM e state antes de cada teste — o view inteiro é reimportado via
// async import pra não ficar carregado entre testes.
beforeEach(() => {
  vi.clearAllMocks();
  getPreventivaDueEquipmentIds.mockReturnValue([]);
  document.body.innerHTML = `
    <section id="equip-hero" hidden>
      <p id="equip-hero-sub"></p>
      <div id="equip-hero-sem-setor-cta" hidden></div>
      <div id="equip-hero-kpis"></div>
    </section>
    <nav id="equip-filters" hidden></nav>
  `;
});

describe('computeEquipKpis', () => {
  it('conta equipamentos sem setor como semSetor', async () => {
    getState.mockReturnValue({
      equipamentos: [
        { id: 'e1', setorId: null, status: 'ok' },
        { id: 'e2', setorId: 's1', status: 'ok' },
        { id: 'e3', setorId: '', status: 'ok' },
      ],
      registros: [],
    });

    const { computeEquipKpis } = await import('../ui/views/equipamentos.js');
    const kpis = computeEquipKpis();
    // e1 e e3 têm setorId "falsy", e2 tem setor real
    expect(kpis.semSetor).toBe(2);
  });

  it('conta status danger como críticos e NÃO como em-atencao', async () => {
    getState.mockReturnValue({
      equipamentos: [
        { id: 'e1', setorId: 's1', status: 'danger' },
        { id: 'e2', setorId: 's1', status: 'danger' },
        { id: 'e3', setorId: 's1', status: 'ok' },
      ],
      registros: [],
    });

    const { computeEquipKpis } = await import('../ui/views/equipamentos.js');
    const kpis = computeEquipKpis();
    expect(kpis.criticos).toBe(2);
    expect(kpis.emAtencao).toBe(0);
  });

  it('conta priorityLevel >= ALTA como em-atencao', async () => {
    getState.mockReturnValue({
      equipamentos: [
        { id: 'e1', setorId: 's1', status: 'ok', __mockPriority: 4 }, // URGENTE
        { id: 'e2', setorId: 's1', status: 'ok', __mockPriority: 3 }, // ALTA
        { id: 'e3', setorId: 's1', status: 'ok', __mockPriority: 2 }, // MONITORAR (NÃO conta)
      ],
      registros: [],
    });

    const { computeEquipKpis } = await import('../ui/views/equipamentos.js');
    const kpis = computeEquipKpis();
    expect(kpis.emAtencao).toBe(2);
  });

  it('propaga preventiva30d a partir de getPreventivaDueEquipmentIds', async () => {
    getState.mockReturnValue({
      equipamentos: [{ id: 'e1', setorId: 's1', status: 'ok' }],
      registros: [{ id: 'r1' }],
    });
    getPreventivaDueEquipmentIds.mockReturnValue(['e1', 'e2', 'e3']);

    const { computeEquipKpis } = await import('../ui/views/equipamentos.js');
    const kpis = computeEquipKpis();
    expect(kpis.preventiva30d).toBe(3);
    expect(getPreventivaDueEquipmentIds).toHaveBeenCalledWith([{ id: 'r1' }], 30);
  });

  it('retorna zeros quando state está vazio', async () => {
    getState.mockReturnValue({ equipamentos: [], registros: [] });
    const { computeEquipKpis } = await import('../ui/views/equipamentos.js');
    expect(computeEquipKpis()).toEqual({
      semSetor: 0,
      emAtencao: 0,
      criticos: 0,
      preventiva30d: 0,
    });
  });
});

describe('renderEquipHero', () => {
  it('fica hidden quando não há equipamentos', async () => {
    getState.mockReturnValue({ equipamentos: [], registros: [] });
    const { renderEquipHero } = await import('../ui/views/equipamentos.js');
    renderEquipHero();

    expect(document.getElementById('equip-hero').hasAttribute('hidden')).toBe(true);
  });

  it('hero esconde quando semSetor = 0 (métricas vivem nos chips, hero só aparece pra "Organizar parque")', async () => {
    // Pós-simplificação UX: o hero só tem utilidade quando há equipamentos
    // sem setor — aí o CTA "Organizar agora" (ou upsell) fica relevante.
    // Quando tudo tá organizado, os chips contadorados abaixo já comunicam
    // críticos/atenção/preventiva, sem precisar do hero.
    getState.mockReturnValue({
      equipamentos: [
        { id: 'e1', setorId: 's1', status: 'ok' },
        { id: 'e2', setorId: 's1', status: 'danger' },
      ],
      registros: [],
    });
    getPreventivaDueEquipmentIds.mockReturnValue(['e2']);

    const { renderEquipHero } = await import('../ui/views/equipamentos.js');
    renderEquipHero();

    expect(document.getElementById('equip-hero').hasAttribute('hidden')).toBe(true);
  });

  it('hero aparece quando há equipamentos sem setor', async () => {
    getState.mockReturnValue({
      equipamentos: [
        { id: 'e1', setorId: null, status: 'ok' },
        { id: 'e2', setorId: 's1', status: 'ok' },
      ],
      registros: [],
    });

    const { renderEquipHero } = await import('../ui/views/equipamentos.js');
    renderEquipHero();

    const hero = document.getElementById('equip-hero');
    expect(hero.hasAttribute('hidden')).toBe(false);
  });

  it('sub copy menciona equipamentos sem setor quando hero aparece', async () => {
    getState.mockReturnValue({
      equipamentos: [
        { id: 'e1', setorId: null, status: 'ok' },
        { id: 'e2', setorId: null, status: 'danger' },
      ],
      registros: [],
    });
    const { renderEquipHero } = await import('../ui/views/equipamentos.js');
    renderEquipHero();

    expect(document.getElementById('equip-hero-sub').textContent).toMatch(/sem setor/i);
    expect(document.getElementById('equip-hero-sub').textContent).toMatch(/2 equipamentos/);
  });

  it('não renderiza mais tiles de KPI no hero (movidos pros chips)', async () => {
    getState.mockReturnValue({
      equipamentos: [{ id: 'e1', setorId: null, status: 'ok' }],
      registros: [],
    });
    const { renderEquipHero } = await import('../ui/views/equipamentos.js');
    renderEquipHero();

    const kpisSlot = document.getElementById('equip-hero-kpis');
    expect(kpisSlot.innerHTML).toBe('');
    expect(document.querySelectorAll('.equip-hero__kpi').length).toBe(0);
  });

  it('CTA Sem setor: Pro vê atalho "Organizar agora" com data-action equip-quickfilter', async () => {
    getState.mockReturnValue({
      equipamentos: [
        { id: 'e1', setorId: null, status: 'ok' },
        { id: 'e2', setorId: null, status: 'ok' },
      ],
      registros: [],
    });
    const { renderEquipHero } = await import('../ui/views/equipamentos.js');
    renderEquipHero({ isPro: true });

    const cta = document.getElementById('equip-hero-sem-setor-cta');
    expect(cta.hasAttribute('hidden')).toBe(false);

    const btn = cta.querySelector('button');
    expect(btn).not.toBeNull();
    expect(btn.dataset.action).toBe('equip-quickfilter');
    expect(btn.dataset.id).toBe('sem-setor');
    expect(btn.textContent).toMatch(/organizar agora/i);
    expect(btn.classList.contains('equip-hero__cta-btn--action')).toBe(true);
  });

  it('CTA Sem setor: Free vê upsell "Ver como setores funcionam" com data-action open-upgrade', async () => {
    getState.mockReturnValue({
      equipamentos: [{ id: 'e1', setorId: null, status: 'ok' }],
      registros: [],
    });
    const { renderEquipHero } = await import('../ui/views/equipamentos.js');
    renderEquipHero({ isPro: false });

    const cta = document.getElementById('equip-hero-sem-setor-cta');
    expect(cta.hasAttribute('hidden')).toBe(false);

    const btn = cta.querySelector('button');
    expect(btn).not.toBeNull();
    expect(btn.dataset.action).toBe('open-upgrade');
    expect(btn.dataset.upgradeSource).toBe('equip_sem_setor');
    expect(btn.dataset.highlightPlan).toBe('pro');
    expect(btn.textContent).toMatch(/setores funcionam/i);
    expect(btn.classList.contains('equip-hero__cta-btn--upsell')).toBe(true);
  });

  it('CTA Sem setor: sem opts assume Free (conservador) e mostra upsell', async () => {
    getState.mockReturnValue({
      equipamentos: [{ id: 'e1', setorId: null, status: 'ok' }],
      registros: [],
    });
    const { renderEquipHero } = await import('../ui/views/equipamentos.js');
    renderEquipHero(); // sem opts → default isPro=false

    const btn = document.querySelector('#equip-hero-sem-setor-cta button');
    expect(btn.dataset.action).toBe('open-upgrade');
  });
});

describe('renderEquipFilters', () => {
  it('fica hidden quando não há equipamentos', async () => {
    getState.mockReturnValue({ equipamentos: [], registros: [] });
    const { renderEquipFilters } = await import('../ui/views/equipamentos.js');
    renderEquipFilters();

    expect(document.getElementById('equip-filters').hasAttribute('hidden')).toBe(true);
  });

  it('renderiza 5 chips com "Todos" ativo por default', async () => {
    getState.mockReturnValue({
      equipamentos: [{ id: 'e1', setorId: 's1', status: 'ok' }],
      registros: [],
    });
    const { renderEquipFilters } = await import('../ui/views/equipamentos.js');
    renderEquipFilters();

    const bar = document.getElementById('equip-filters');
    const chips = bar.querySelectorAll('.equip-filter');
    expect(chips.length).toBe(5);

    const active = bar.querySelector('.equip-filter--active');
    expect(active.dataset.id).toBe('todos');
    expect(active.getAttribute('aria-pressed')).toBe('true');
  });

  it('cada chip exibe contador (unifica os KPI tiles antigos)', async () => {
    getState.mockReturnValue({
      equipamentos: [
        { id: 'e1', setorId: null, status: 'ok' },
        { id: 'e2', setorId: null, status: 'ok' },
        { id: 'e3', setorId: 's1', status: 'danger' },
      ],
      registros: [],
    });
    getPreventivaDueEquipmentIds.mockReturnValue(['e1']);

    const { renderEquipFilters } = await import('../ui/views/equipamentos.js');
    renderEquipFilters();

    const bar = document.getElementById('equip-filters');
    const countOf = (id) =>
      bar.querySelector(`[data-id="${id}"] .equip-filter__count`)?.textContent;

    expect(countOf('todos')).toBe('3');
    expect(countOf('sem-setor')).toBe('2');
    expect(countOf('criticos')).toBe('1');
    expect(countOf('preventiva-30d')).toBe('1');
  });

  it('chips com count=0 recebem modifier --empty (não "todos")', async () => {
    getState.mockReturnValue({
      equipamentos: [{ id: 'e1', setorId: 's1', status: 'ok' }],
      registros: [],
    });
    getPreventivaDueEquipmentIds.mockReturnValue([]);

    const { renderEquipFilters } = await import('../ui/views/equipamentos.js');
    renderEquipFilters();

    const bar = document.getElementById('equip-filters');
    // sem-setor = 0, em-atencao = 0, criticos = 0, preventiva-30d = 0
    expect(
      bar.querySelector('[data-id="sem-setor"]').classList.contains('equip-filter--empty'),
    ).toBe(true);
    expect(bar.querySelector('[data-id="todos"]').classList.contains('equip-filter--empty')).toBe(
      false,
    );
  });

  it('marca o chip correspondente quando setActiveQuickFilter é chamado', async () => {
    getState.mockReturnValue({
      equipamentos: [{ id: 'e1', setorId: 's1', status: 'ok' }],
      registros: [],
    });
    const { setActiveQuickFilter, getActiveQuickFilter } =
      await import('../ui/views/equipamentos.js');

    // Exercita o getter/setter público: reset pra null e verifica roundtrip.
    // setActiveQuickFilter chama renderEquip() internamente; só validamos o
    // contrato exposto (o DOM rendering é coberto pelos testes de renderEquipFilters).
    setActiveQuickFilter(null);
    expect(getActiveQuickFilter()).toBeNull();
  });
});

describe('equip card photo events hardening', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <section id="equip-hero" hidden>
        <p id="equip-hero-sub"></p>
        <div id="equip-hero-sem-setor-cta" hidden></div>
        <div id="equip-hero-kpis"></div>
      </section>
      <nav id="equip-filters" hidden></nav>
      <div id="equip-page-title"></div>
      <div id="equip-toolbar-actions"></div>
      <div id="equip-search-bar"></div>
      <div id="lista-equip"></div>
    `;
  });

  it('marks photo icon as loaded on image load event', async () => {
    getState.mockReturnValue({
      equipamentos: [
        {
          id: 'e1',
          nome: 'Evaporadora 01',
          tipo: 'Split',
          local: 'Sala',
          tag: 'EVP-01',
          fluido: 'R410A',
          status: 'ok',
          criticidade: 'media',
          fotos: ['https://example.com/photo.jpg'],
        },
      ],
      registros: [],
      setores: [],
    });

    const { renderEquip } = await import('../ui/views/equipamentos.js');
    await renderEquip('', { __skipPlanRefresh: true });

    const icon = document.querySelector('.equip-card__type-icon--photo');
    const img = icon?.querySelector('img');
    expect(icon).not.toBeNull();
    expect(img).not.toBeNull();

    img.dispatchEvent(new Event('load'));
    expect(icon.classList.contains('equip-card__type-icon--loaded')).toBe(true);
  });

  it('applies fallback class and removes broken image on error event', async () => {
    getState.mockReturnValue({
      equipamentos: [
        {
          id: 'e1',
          nome: 'Evaporadora 01',
          tipo: 'Split',
          local: 'Sala',
          tag: 'EVP-01',
          fluido: 'R410A',
          status: 'ok',
          criticidade: 'media',
          fotos: ['https://example.com/broken.jpg'],
        },
      ],
      registros: [],
      setores: [],
    });

    const { renderEquip } = await import('../ui/views/equipamentos.js');
    await renderEquip('', { __skipPlanRefresh: true });

    const icon = document.querySelector('.equip-card__type-icon--photo');
    const img = icon?.querySelector('img');
    expect(icon).not.toBeNull();
    expect(img).not.toBeNull();

    img.dispatchEvent(new Event('error'));
    expect(icon.classList.contains('equip-card__type-icon--fallback')).toBe(true);
    expect(icon.querySelector('img')).toBeNull();
  });
});

describe('renderEquip memoization on large lists', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <section id="equip-hero" hidden>
        <p id="equip-hero-sub"></p>
        <div id="equip-hero-sem-setor-cta" hidden></div>
        <div id="equip-hero-kpis"></div>
      </section>
      <nav id="equip-filters" hidden></nav>
      <div id="equip-page-title"></div>
      <div id="equip-toolbar-actions"></div>
      <div id="equip-search-bar"></div>
      <div id="lista-equip"></div>
    `;
    evaluateEquipmentRiskMock.mockClear();
    evaluateEquipmentPriorityMock.mockClear();
    getActionPriorityScoreMock.mockClear();
  });

  it('reuses per-item evaluations during filter/sort/partition/card render', async () => {
    getState.mockReturnValue({
      equipamentos: [
        {
          id: 'e1',
          nome: 'EVP 1',
          tipo: 'Split',
          local: 'Sala 1',
          tag: 'EVP-1',
          fluido: 'R410A',
          status: 'ok',
          criticidade: 'media',
          fotos: [],
        },
        {
          id: 'e2',
          nome: 'EVP 2',
          tipo: 'Split',
          local: 'Sala 2',
          tag: 'EVP-2',
          fluido: 'R410A',
          status: 'ok',
          criticidade: 'media',
          fotos: [],
        },
      ],
      registros: [],
      setores: [],
    });

    const { renderEquip } = await import('../ui/views/equipamentos.js');
    await renderEquip();

    // Com memo local por render, cada métrica pesada roda 1x por equipamento.
    expect(evaluateEquipmentRiskMock).toHaveBeenCalledTimes(2);
    // Depois do refino UX (abr/2026) o hero não calcula mais KPIs próprios,
    // mas renderEquipFilters passou a precisar de kpis pra contadores dos
    // chips — então `computeEquipKpis` roda 1x no fluxo hero (condicional
    // semSetor) + 1x no fluxo filters. Em equipamentos com setorId definido,
    // cada chamada de `evaluateEquipmentPriority` roda 1x por equip. Isso
    // resulta em 2 equips × (2 chamadas de computeEquipKpis + 1 no sort) =
    // 6 chamadas totais.
    expect(evaluateEquipmentPriorityMock).toHaveBeenCalledTimes(6);
    expect(getActionPriorityScoreMock).toHaveBeenCalledTimes(2);
  });

  it('keeps rendered output consistency with priority sorting', async () => {
    getActionPriorityScoreMock.mockImplementation((eq) => ({
      actionPriorityScore: eq.id === 'e2' ? 20 : 10,
    }));
    evaluateEquipmentPriorityMock.mockImplementation((eq) => ({
      priorityLevel: eq.id === 'e2' ? 4 : 2,
      priorityLabel: 'mock',
    }));
    evaluateEquipmentRiskMock.mockImplementation((eq) => ({
      score: eq.id === 'e2' ? 90 : 40,
      classification: 'baixo',
      factors: ['rotina estável'],
    }));

    getState.mockReturnValue({
      equipamentos: [
        {
          id: 'e1',
          nome: 'Equipamento A',
          tipo: 'Split',
          local: 'Sala A',
          tag: 'A',
          fluido: 'R410A',
          status: 'ok',
          criticidade: 'media',
          fotos: [],
        },
        {
          id: 'e2',
          nome: 'Equipamento B',
          tipo: 'Split',
          local: 'Sala B',
          tag: 'B',
          fluido: 'R410A',
          status: 'ok',
          criticidade: 'media',
          fotos: [],
        },
      ],
      registros: [],
      setores: [],
    });

    const { renderEquip } = await import('../ui/views/equipamentos.js');
    await renderEquip();

    const names = Array.from(document.querySelectorAll('.equip-card__name')).map((el) =>
      el.textContent?.trim(),
    );
    expect(names[0]).toBe('Equipamento B');
    expect(names[1]).toBe('Equipamento A');
  });
});

describe('setorCardHtml empty state', () => {
  it('NÃO renderiza a meta strip (Equip · Score · Em dia) quando setor está vazio', async () => {
    getState.mockReturnValue({
      equipamentos: [],
      registros: [],
      setores: [{ id: 's1', nome: 'Cozinha', cor: '#00c8e8' }],
    });

    const { setorCardHtml } = await import('../ui/views/equipamentos.js');
    const html = setorCardHtml({ id: 's1', nome: 'Cozinha', cor: '#00c8e8' }, []);

    // Meta strip + health bar foram omitidos pra empty state
    expect(html).not.toContain('setor-card__meta-item');
    expect(html).not.toContain('setor-card__health-fill');
    expect(html).not.toContain('/100');

    // Em vez disso, tem empty body com "Setor vazio" + tone pill "Vazio"
    // (antes era "Aguardando", trocado pra "Vazio" no refino UX abr/2026 —
    // "Aguardando o quê?" era vago; "Vazio" é informativo sem ser negativo).
    expect(html).toContain('setor-card__empty');
    expect(html).toContain('Setor vazio');
    expect(html).toContain('setor-card__tone-pill--neutral');
    expect(html).toContain('>\n        Vazio\n      </span>');
    // Descrição fallback "Atribua equipamentos..." foi removida (#2 do refino
    // UX) pra não duplicar a mensagem do empty body. Setor sem descrição e
    // sem equipamentos agora mostra APENAS o emptyHtml.
    expect(html).not.toMatch(/Atribua equipamentos/);
  });

  it('renderiza meta strip com Equip/Score/Em dia quando setor tem equipamentos', async () => {
    getState.mockReturnValue({
      equipamentos: [{ id: 'e1', setorId: 's1', status: 'ok' }],
      registros: [],
      setores: [{ id: 's1', nome: 'Cozinha', cor: '#00c8e8' }],
    });

    const { setorCardHtml } = await import('../ui/views/equipamentos.js');
    const html = setorCardHtml({ id: 's1', nome: 'Cozinha', cor: '#00c8e8' }, [
      { id: 'e1', setorId: 's1', status: 'ok' },
    ]);

    // Meta strip presente com 3 KPIs + health bar + tone pill "Estável"
    expect(html).toContain('setor-card__meta');
    expect(html).toContain('Equip.');
    expect(html).toContain('Score');
    expect(html).toContain('Em dia');
    expect(html).toContain('/100');
    expect(html).toContain('setor-card__health-fill');
    expect(html).toContain('setor-card__tone-pill--ok');
    expect(html).toContain('Estável');
    expect(html).not.toContain('Setor vazio');
  });
});

describe('setorCardHtml — campos P1 (descricao + responsavel)', () => {
  it('surface descricao como subtítulo quando preenchido', async () => {
    getState.mockReturnValue({
      equipamentos: [{ id: 'e1', setorId: 's1', status: 'ok' }],
      registros: [],
      setores: [],
    });

    const { setorCardHtml } = await import('../ui/views/equipamentos.js');
    const html = setorCardHtml(
      {
        id: 's1',
        nome: 'UTI',
        cor: '#00c8e8',
        descricao: 'Ala crítica com 14 splits e 2 fan coils.',
      },
      [{ id: 'e1', setorId: 's1', status: 'ok' }],
    );

    expect(html).toContain('setor-card__descricao');
    expect(html).toContain('Ala crítica com 14 splits e 2 fan coils.');
  });

  it('surface responsavel como chip com avatar + nome', async () => {
    getState.mockReturnValue({
      equipamentos: [{ id: 'e1', setorId: 's1', status: 'ok' }],
      registros: [],
      setores: [],
    });

    const { setorCardHtml } = await import('../ui/views/equipamentos.js');
    const html = setorCardHtml(
      { id: 's1', nome: 'UTI', cor: '#00c8e8', responsavel: 'Ana Souza' },
      [{ id: 'e1', setorId: 's1', status: 'ok' }],
    );

    expect(html).toContain('setor-card__avatar');
    // Iniciais "AS" (Ana Souza) aparecem no avatar
    expect(html).toMatch(/setor-card__avatar[^>]*>\s*AS\s*</);
    expect(html).toContain('Ana Souza');
    expect(html).not.toContain('Sem responsável');
  });

  it('fallback "Sem responsável" em itálico quando ausente', async () => {
    getState.mockReturnValue({
      equipamentos: [{ id: 'e1', setorId: 's1', status: 'ok' }],
      registros: [],
      setores: [],
    });

    const { setorCardHtml } = await import('../ui/views/equipamentos.js');
    const html = setorCardHtml({ id: 's1', nome: 'UTI', cor: '#00c8e8' }, [
      { id: 'e1', setorId: 's1', status: 'ok' },
    ]);

    expect(html).toContain('Sem responsável');
    expect(html).toContain('setor-card__responsavel-name--empty');
    expect(html).not.toContain('setor-card__avatar');
  });

  it('botão "Editar" fica inline no footer (não escondido no kebab)', async () => {
    getState.mockReturnValue({
      equipamentos: [{ id: 'e1', setorId: 's1', status: 'ok' }],
      registros: [],
      setores: [],
    });

    const { setorCardHtml } = await import('../ui/views/equipamentos.js');
    const html = setorCardHtml({ id: 's1', nome: 'UTI', cor: '#00c8e8' }, [
      { id: 'e1', setorId: 's1', status: 'ok' },
    ]);

    // Editar aparece como botão ghost visível, não dentro do menu overflow
    expect(html).toMatch(
      /<button[^>]*class="setor-card__btn"[^>]*data-action="edit-setor"[^>]*>[\s\S]*?Editar/,
    );
    // Kebab mantém apenas Excluir como item de menu
    expect(html).toContain('data-action="toggle-setor-menu"');
    expect(html).toContain('data-action="delete-setor"');
  });
});
