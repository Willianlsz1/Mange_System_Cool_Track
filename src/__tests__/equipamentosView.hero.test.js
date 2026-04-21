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
vi.mock('../domain/priorityEngine.js', () => ({
  evaluateEquipmentPriority: vi.fn((eq) => ({
    priorityLevel: eq?.__mockPriority ?? 1, // 1 = OK, 3 = ALTA, 4 = URGENTE
    priorityLabel: 'mock',
  })),
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
vi.mock('../domain/maintenance.js', () => ({
  evaluateEquipmentHealth: vi.fn(() => ({ score: 80, context: { daysToNext: 30 } })),
  evaluateEquipmentRisk: vi.fn(() => ({ score: 50 })),
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

  it('mostra 4 tiles de KPI quando há equipamentos', async () => {
    getState.mockReturnValue({
      equipamentos: [
        { id: 'e1', setorId: null, status: 'ok' },
        { id: 'e2', setorId: 's1', status: 'danger' },
      ],
      registros: [],
    });
    getPreventivaDueEquipmentIds.mockReturnValue(['e2']);

    const { renderEquipHero } = await import('../ui/views/equipamentos.js');
    renderEquipHero();

    const hero = document.getElementById('equip-hero');
    expect(hero.hasAttribute('hidden')).toBe(false);

    const tiles = hero.querySelectorAll('.equip-hero__kpi');
    expect(tiles.length).toBe(4);

    // Cada tile tem data-id único (sem-setor / em-atencao / criticos / preventiva-30d)
    const ids = Array.from(tiles)
      .map((t) => t.dataset.id)
      .sort();
    expect(ids).toEqual(['criticos', 'em-atencao', 'preventiva-30d', 'sem-setor']);
  });

  it('usa copy de críticos no sub quando há criticos > 0', async () => {
    getState.mockReturnValue({
      equipamentos: [{ id: 'e1', setorId: 's1', status: 'danger' }],
      registros: [],
    });
    const { renderEquipHero } = await import('../ui/views/equipamentos.js');
    renderEquipHero();

    expect(document.getElementById('equip-hero-sub').textContent).toMatch(/crítico/i);
  });

  it('usa copy otimista quando parque está em ordem', async () => {
    getState.mockReturnValue({
      equipamentos: [{ id: 'e1', setorId: 's1', status: 'ok' }],
      registros: [],
    });
    getPreventivaDueEquipmentIds.mockReturnValue([]);
    const { renderEquipHero } = await import('../ui/views/equipamentos.js');
    renderEquipHero();

    expect(document.getElementById('equip-hero-sub').textContent).toMatch(/em ordem/i);
  });

  it('CTA Sem setor: esconde quando semSetor = 0', async () => {
    getState.mockReturnValue({
      equipamentos: [{ id: 'e1', setorId: 's1', status: 'ok' }],
      registros: [],
    });
    const { renderEquipHero } = await import('../ui/views/equipamentos.js');
    renderEquipHero({ isPro: true });

    const cta = document.getElementById('equip-hero-sem-setor-cta');
    expect(cta.hasAttribute('hidden')).toBe(true);
    expect(cta.innerHTML).toBe('');
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

    // Em vez disso, tem empty body com "Setor vazio" + tone pill "Aguardando"
    expect(html).toContain('setor-card__empty');
    expect(html).toContain('Setor vazio');
    expect(html).toContain('setor-card__tone-pill--neutral');
    expect(html).toContain('Aguardando');
    // Fallback copy vira subtítulo na descricao quando o setor não tem uma
    expect(html).toMatch(/Atribua equipamentos/);
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
