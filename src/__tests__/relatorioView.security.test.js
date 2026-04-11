import { beforeEach, describe, expect, it, vi } from 'vitest';

async function loadRelatorioView({ state = { registros: [] }, equipamento = null } = {}) {
  vi.resetModules();

  const getState = vi.fn(() => state);
  const findEquip = vi.fn(() => equipamento);

  vi.doMock('../core/state.js', () => ({
    getState,
    findEquip,
  }));
  vi.doMock('../ui/components/skeleton.js', () => ({
    withSkeleton: (_el, _opts, renderFn) => renderFn(),
  }));
  vi.doMock('../domain/maintenance.js', () => ({
    CRITICIDADE_LABEL: { media: 'Media' },
    PRIORIDADE_OPERACIONAL_LABEL: { normal: 'Normal' },
  }));

  const module = await import('../ui/views/relatorio.js');
  return { ...module, mocks: { getState, findEquip } };
}

describe('relatorio view security', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = `
      <select id="rel-equip"><option value="" selected>Todos</option></select>
      <input id="rel-de" value="" />
      <input id="rel-ate" value="" />
      <div id="relatorio-corpo"></div>
    `;
  });

  it('escapes dynamic registro and equipamento fields', async () => {
    const { renderRelatorio } = await loadRelatorioView({
      state: {
        registros: [
          {
            id: 'r-1',
            equipId: 'eq-1',
            data: '2026-04-07T10:00',
            tipo: '<img src=x onerror=alert(1)>',
            obs: '<script>alert(1)</script>',
            tecnico: '<b>tecnico</b>',
            pecas: '<svg onload=alert(1)>',
            status: 'ok',
            custoPecas: 10,
            custoMaoObra: 5,
          },
        ],
      },
      equipamento: {
        id: 'eq-1',
        nome: '<iframe src=javascript:alert(1)>',
        tag: '<tag>',
        local: '<local>',
        fluido: '<fluido>',
        criticidade: 'media',
        prioridadeOperacional: 'normal',
        periodicidadePreventivaDias: 30,
      },
    });

    renderRelatorio();

    const html = document.getElementById('relatorio-corpo').innerHTML;
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('&lt;iframe src=javascript:alert(1)&gt;');
    expect(html).toContain('&lt;b&gt;tecnico&lt;/b&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
  });
});
