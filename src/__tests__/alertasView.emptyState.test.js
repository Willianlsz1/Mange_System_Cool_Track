import { beforeEach, describe, expect, it, vi } from 'vitest';

const getState = vi.fn();
vi.mock('../core/state.js', () => ({ getState }));

const getAll = vi.fn();
const getPreventivaDueEquipmentIds = vi.fn();
vi.mock('../domain/alerts.js', () => ({
  Alerts: { getAll },
  getPreventivaDueEquipmentIds,
}));

vi.mock('../ui/components/skeleton.js', () => ({
  withSkeleton: (_el, _opts, renderFn) => renderFn(),
}));

describe('renderAlertas empty states', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPreventivaDueEquipmentIds.mockReturnValue([]);
    document.body.innerHTML = '<div id="alertas-contextual"></div><div id="lista-alertas"></div>';
  });

  it('shows setup empty state when there are no equipamentos', async () => {
    getState.mockReturnValue({ equipamentos: [] });
    getAll.mockReturnValue([]);

    const { renderAlertas } = await import('../ui/views/alertas.js');
    renderAlertas();

    expect(document.getElementById('lista-alertas')?.textContent).toContain(
      'Cadastre um equipamento para receber alertas',
    );
  });

  it('shows positive empty state when equipamentos exist and no alerts', async () => {
    getState.mockReturnValue({ equipamentos: [{ id: 'eq-1' }] });
    getAll.mockReturnValue([]);

    const { renderAlertas } = await import('../ui/views/alertas.js');
    renderAlertas();

    expect(document.getElementById('lista-alertas')?.textContent).toContain('Tudo em dia!');
  });
});
