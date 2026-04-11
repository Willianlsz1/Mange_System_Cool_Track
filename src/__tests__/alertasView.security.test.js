import { beforeEach, describe, expect, it, vi } from 'vitest';

async function loadAlertasView({
  state = { equipamentos: [{ id: 'eq-1' }], registros: [] },
  alerts = [],
} = {}) {
  vi.resetModules();

  const getState = vi.fn(() => state);
  const getAll = vi.fn(() => alerts);
  const getPreventivaDueEquipmentIds = vi.fn(() => []);

  vi.doMock('../core/state.js', () => ({ getState }));
  vi.doMock('../domain/alerts.js', () => ({
    Alerts: { getAll },
    getPreventivaDueEquipmentIds,
  }));
  vi.doMock('../ui/components/skeleton.js', () => ({
    withSkeleton: (_el, _opts, renderFn) => renderFn(),
  }));

  const module = await import('../ui/views/alertas.js');
  return { ...module, mocks: { getState, getAll, getPreventivaDueEquipmentIds } };
}

describe('alertas view security', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '<div id="alertas-contextual"></div><div id="lista-alertas"></div>';
  });

  it('escapes dynamic alert content before writing with innerHTML', async () => {
    const { renderAlertas } = await loadAlertasView({
      alerts: [
        {
          severity: 'danger',
          icon: '<img src=x onerror=alert(1)>',
          title: '<script>alert(1)</script>',
          subtitle: 'Sub <b>unsafe</b>',
          equipmentName: '<svg onload=alert(1)>',
          recommendedAction: 'inspect',
          eq: { id: 'eq-1', nome: '<iframe src=javascript:alert(1)>' },
        },
      ],
    });

    renderAlertas();

    const html = document.getElementById('lista-alertas').innerHTML;
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('Sub &lt;b&gt;unsafe&lt;/b&gt;');
    expect(html).toContain('&lt;iframe src=javascript:alert(1)&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
  });
});
