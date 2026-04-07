import { STORAGE_KEY } from '../core/utils.js';

function createSupabaseMock({ userId = 'user-1', selectData = {}, failSelectTables = [] } = {}) {
  const upsertByTable = {
    equipamentos: vi.fn().mockResolvedValue({ data: null, error: null }),
    registros: vi.fn().mockResolvedValue({ data: null, error: null }),
    tecnicos: vi.fn().mockResolvedValue({ data: null, error: null }),
  };

  const from = vi.fn((table) => ({
    upsert: upsertByTable[table] ?? vi.fn().mockResolvedValue({ data: null, error: null }),
    select: vi.fn(() => ({
      eq: vi.fn(async () => {
        if (failSelectTables.includes(table)) throw new Error(`select failed: ${table}`);
        return { data: selectData[table] ?? [] };
      }),
    })),
  }));

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: userId ? { id: userId } : null } }),
    },
    from,
    upsertByTable,
  };
}

async function loadStorageModule(options = {}) {
  vi.resetModules();

  const supabaseMock = createSupabaseMock(options.supabase);
  const toastMock = {
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  };

  vi.doMock('../core/supabase.js', () => ({ supabase: supabaseMock }));
  vi.doMock('../core/toast.js', () => ({ Toast: toastMock }));

  const { Storage } = await import('../core/storage.js');
  return { Storage, supabaseMock, toastMock };
}

function sampleState() {
  return {
    equipamentos: [{ id: 'eq-1', nome: 'Split', local: 'UTI', status: 'ok', tag: '', tipo: 'Outro', modelo: '', fluido: '' }],
    registros: [{ id: 'r-1', equipId: 'eq-1', data: '2026-04-07T10:00', tipo: 'Manutenção', status: 'ok', pecas: '', proxima: '2026-04-20', fotos: [], tecnico: '' }],
    tecnicos: ['Ana'],
  };
}

describe('Storage integration (offline-first)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('saves to localStorage immediately and triggers background sync', async () => {
    const { Storage } = await loadStorageModule();
    const syncSpy = vi.spyOn(Storage, '_syncToSupabase').mockResolvedValue(undefined);
    const state = sampleState();

    const ok = Storage.save(state);

    expect(ok).toBe(true);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY))).toEqual(state);
    expect(syncSpy).toHaveBeenCalledWith(state);
  });

  it('normalizes loaded local data to expected schema', async () => {
    const { Storage } = await loadStorageModule();

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        equipamentos: [{ id: 101, nome: 'Chiller', local: 'Bloco A', status: 'invalid' }],
        registros: [{ id: 201, equipId: 101, data: '2026-04-01T08:00', tipo: 'Inspeção', status: 'bad', fotos: [1, 'ok'], assinatura: 'yes' }],
        tecnicos: ['Carlos', 10],
      })
    );

    const loaded = Storage.load(null);

    expect(loaded.equipamentos[0]).toMatchObject({
      id: '101',
      status: 'ok',
      tag: '',
      tipo: 'Outro',
    });
    expect(loaded.registros[0]).toMatchObject({
      id: '201',
      equipId: '101',
      status: 'ok',
      fotos: ['ok'],
      assinatura: true,
    });
    expect(loaded.tecnicos).toEqual(['Carlos']);
  });

  it('runs migration from local cache to Supabase and sets migrated marker', async () => {
    const { Storage, supabaseMock, toastMock } = await loadStorageModule({
      supabase: {
        userId: 'user-77',
        selectData: { equipamentos: [], registros: [], tecnicos: [] },
      },
    });

    const legacy = sampleState();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy));

    await Storage.loadFromSupabase();

    expect(supabaseMock.upsertByTable.equipamentos).toHaveBeenCalled();
    expect(supabaseMock.upsertByTable.registros).toHaveBeenCalled();
    expect(supabaseMock.upsertByTable.tecnicos).toHaveBeenCalled();
    expect(localStorage.getItem('cooltrack-migrated-user-77')).toBe('1');
    expect(toastMock.info).toHaveBeenCalled();
    expect(toastMock.success).toHaveBeenCalled();
  });

  it('warns near storage quota and blocks writes at the 5MB limit', async () => {
    const { Storage, toastMock } = await loadStorageModule();
    const syncSpy = vi.spyOn(Storage, '_syncToSupabase').mockResolvedValue(undefined);

    const warnState = { ...sampleState(), tecnicos: ['x'.repeat(2_100_000)] };
    expect(Storage.save(warnState)).toBe(true);
    expect(toastMock.warning).toHaveBeenCalled();

    const fullState = { ...sampleState(), tecnicos: ['x'.repeat(2_700_000)] };
    expect(Storage.save(fullState)).toBe(false);
    expect(toastMock.error).toHaveBeenCalled();
    expect(syncSpy).toHaveBeenCalledTimes(1);
  });

  it('resolves local/remote conflicts by preferring remote on successful loadFromSupabase', async () => {
    const local = sampleState();
    local.equipamentos[0].nome = 'LOCAL';
    localStorage.setItem(STORAGE_KEY, JSON.stringify(local));

    const remoteEquip = [{ id: 'eq-1', nome: 'REMOTE', local: 'UTI', status: 'warn', tag: '', tipo: 'Outro', modelo: '', fluido: '' }];

    const { Storage } = await loadStorageModule({
      supabase: {
        userId: 'user-1',
        selectData: { equipamentos: remoteEquip, registros: [], tecnicos: [] },
      },
    });

    const result = await Storage.loadFromSupabase();

    expect(result.equipamentos[0].nome).toBe('REMOTE');
    const cached = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(cached.equipamentos[0].nome).toBe('REMOTE');
  });

  it('falls back to local cache when remote read fails', async () => {
    const local = sampleState();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(local));

    const { Storage, toastMock } = await loadStorageModule({
      supabase: {
        userId: 'user-1',
        failSelectTables: ['equipamentos'],
      },
    });

    const result = await Storage.loadFromSupabase();

    expect(result.equipamentos[0].id).toBe('eq-1');
    expect(toastMock.warning).toHaveBeenCalled();
  });

  it('syncs to Supabase in happy path and warns on errors', async () => {
    const { Storage, supabaseMock, toastMock } = await loadStorageModule();
    const state = sampleState();

    await Storage._syncToSupabase(state);
    expect(supabaseMock.upsertByTable.equipamentos).toHaveBeenCalled();
    expect(supabaseMock.upsertByTable.registros).toHaveBeenCalled();
    expect(supabaseMock.upsertByTable.tecnicos).toHaveBeenCalled();

    supabaseMock.upsertByTable.registros.mockRejectedValueOnce(new Error('sync err'));
    await Storage._syncToSupabase(state);
    expect(toastMock.warning).toHaveBeenCalled();
  });
});
