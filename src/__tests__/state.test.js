const emptyState = { equipamentos: [], registros: [], tecnicos: [] };

async function loadStateModule(initial = emptyState) {
  vi.resetModules();
  const saveSpy = vi.fn();

  vi.doMock('../core/storage.js', () => ({
    Storage: {
      load: vi.fn(() => structuredClone(initial)),
      save: saveSpy,
    },
  }));

  const mod = await import('../core/state.js');
  return { ...mod, saveSpy };
}

describe('state module', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('getState/setState update data and persist by default', async () => {
    const { getState, setState, saveSpy } = await loadStateModule(emptyState);

    setState(() => ({
      equipamentos: [{ id: 'e1', nome: 'AC', local: 'Ala', status: 'ok' }],
      registros: [],
      tecnicos: ['Ana'],
    }));

    const state = getState();
    expect(state.equipamentos).toHaveLength(1);
    expect(state.tecnicos).toEqual(['Ana']);
    expect(saveSpy).toHaveBeenCalledTimes(1);
  });

  it('subscribe publishes updates and unsubscribe stops notifications', async () => {
    const { setState, subscribe } = await loadStateModule(emptyState);
    const listener = vi.fn();

    const unsubscribe = subscribe(listener);
    setState((s) => ({ ...s, tecnicos: ['Carlos'] }));
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    setState((s) => ({ ...s, tecnicos: ['Camila'] }));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('supports setState options to skip persist and emit', async () => {
    const { setState, subscribe, saveSpy } = await loadStateModule(emptyState);
    const listener = vi.fn();
    subscribe(listener);

    setState((s) => ({ ...s, tecnicos: ['João'] }), { persist: false, emit: false });

    expect(saveSpy).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
  });

  it('findEquip and regsForEquip locate equipment and records', async () => {
    const initial = {
      equipamentos: [{ id: 'eq-1', nome: 'Split', local: 'UTI', status: 'warn' }],
      registros: [
        {
          id: 'r1',
          equipId: 'eq-1',
          data: '2026-04-01T10:00',
          proxima: '2026-04-15',
          status: 'ok',
        },
        {
          id: 'r2',
          equipId: 'eq-1',
          data: '2026-04-03T10:00',
          proxima: '2026-04-20',
          status: 'warn',
        },
      ],
      tecnicos: [],
    };

    const { findEquip, regsForEquip } = await loadStateModule(initial);

    expect(findEquip('eq-1')?.nome).toBe('Split');
    expect(findEquip('missing')).toBeUndefined();
    expect(regsForEquip('eq-1')).toHaveLength(2);
    expect(regsForEquip('missing')).toEqual([]);
  });

  it('lastRegForEquip returns the newest record by datetime string', async () => {
    const initial = {
      equipamentos: [{ id: 'eq-1', nome: 'Split', local: 'UTI', status: 'ok' }],
      registros: [
        { id: 'r1', equipId: 'eq-1', data: '2026-04-01T08:00', tipo: 'A' },
        { id: 'r2', equipId: 'eq-1', data: '2026-04-03T08:00', tipo: 'B' },
        { id: 'r3', equipId: 'eq-1', data: '2026-04-02T08:00', tipo: 'C' },
      ],
      tecnicos: [],
    };
    const { lastRegForEquip } = await loadStateModule(initial);

    expect(lastRegForEquip('eq-1')?.id).toBe('r2');
    expect(lastRegForEquip('missing')).toBeUndefined();
  });

  it('invalidates registros cache after setState updates', async () => {
    const initial = {
      equipamentos: [{ id: 'eq-1', nome: 'Split', local: 'UTI', status: 'ok' }],
      registros: [{ id: 'r1', equipId: 'eq-1', data: '2026-04-01T08:00', tipo: 'A' }],
      tecnicos: [],
    };
    const { regsForEquip, setState } = await loadStateModule(initial);

    expect(regsForEquip('eq-1')).toHaveLength(1);

    setState(
      (s) => ({
        ...s,
        registros: [
          ...s.registros,
          { id: 'r2', equipId: 'eq-1', data: '2026-04-02T08:00', tipo: 'B' },
        ],
      }),
      { persist: false, emit: false },
    );

    expect(regsForEquip('eq-1')).toHaveLength(2);
  });

  it('getState returns copies to avoid external mutation leaks', async () => {
    const initial = {
      equipamentos: [{ id: 'eq-1', nome: 'Split', local: 'UTI', status: 'ok' }],
      registros: [],
      tecnicos: ['Ana'],
    };
    const { getState } = await loadStateModule(initial);

    const snap = getState();
    snap.equipamentos.push({ id: 'eq-2', nome: 'X', local: 'Y', status: 'ok' });
    snap.tecnicos.push('Carlos');

    const current = getState();
    expect(current.equipamentos).toHaveLength(1);
    expect(current.tecnicos).toEqual(['Ana']);
  });

  it('seedIfEmpty populates initial data only when equipamentos is empty', async () => {
    const { seedIfEmpty, getState } = await loadStateModule(emptyState);

    seedIfEmpty();
    const seeded = getState();
    expect(seeded.equipamentos.length).toBeGreaterThan(0);
    expect(seeded.registros.length).toBeGreaterThan(0);
    expect(seeded.tecnicos.length).toBeGreaterThan(0);

    const firstCount = seeded.equipamentos.length;
    seedIfEmpty();
    expect(getState().equipamentos).toHaveLength(firstCount);
  });
});
