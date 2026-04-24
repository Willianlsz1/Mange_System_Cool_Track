import { describe, it, expect, beforeEach, vi } from 'vitest';

// Cada teste monta seu próprio mock chain pro supabase.from().update().eq().eq()
// retornar o cenário desejado (success/error).
function makeUpdateChain(finalResult) {
  const chain = {
    update: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue(finalResult),
      })),
    })),
  };
  return chain;
}

const supabaseMock = {
  auth: {
    getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-abc' } } }),
  },
  from: vi.fn(() => makeUpdateChain({ data: null, error: null })),
  storage: {
    from: vi.fn(() => ({
      upload: vi.fn().mockResolvedValue({ data: { path: 'mock' }, error: null }),
    })),
  },
};

vi.mock('../core/supabase.js', () => ({ supabase: supabaseMock }));

vi.mock('../core/photoStorage.js', () => ({
  dataUrlToBlob: vi.fn(async () => ({ type: 'image/png', size: 100 })),
  createSignedUrl: vi.fn(async (bucket, path) => ({
    url: `https://mock/${bucket}/${path}`,
    expiresAt: new Date(Date.now() + 86400 * 1000).toISOString(),
  })),
}));

const { flushPendingSignatures, enqueuePendingSignature, listPendingSignatures } =
  await import('../core/signatureStorage.js');

const VALID_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

describe('flushPendingSignatures', () => {
  beforeEach(() => {
    localStorage.clear();
    supabaseMock.auth.getUser.mockClear();
    supabaseMock.from.mockClear();
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-abc' } } });
  });

  it('retorna zero quando queue vazia', async () => {
    const out = await flushPendingSignatures();
    expect(out).toEqual({ processed: 0, failed: 0, skipped: 0 });
    expect(supabaseMock.from).not.toHaveBeenCalled();
  });

  it('processa 3 entries da queue e esvazia', async () => {
    enqueuePendingSignature('r1', VALID_DATA_URL);
    enqueuePendingSignature('r2', VALID_DATA_URL);
    enqueuePendingSignature('r3', VALID_DATA_URL);

    const out = await flushPendingSignatures();
    expect(out.processed).toBe(3);
    expect(out.failed).toBe(0);
    expect(listPendingSignatures()).toHaveLength(0);
    expect(supabaseMock.from).toHaveBeenCalledTimes(3);
    expect(supabaseMock.from).toHaveBeenCalledWith('registros');
  });

  it('sem userId: marca todas como skipped e mantém queue', async () => {
    enqueuePendingSignature('r1', VALID_DATA_URL);
    enqueuePendingSignature('r2', VALID_DATA_URL);
    supabaseMock.auth.getUser.mockResolvedValueOnce({ data: { user: null } });

    const out = await flushPendingSignatures();
    expect(out).toEqual({ processed: 0, failed: 0, skipped: 2 });
    expect(listPendingSignatures()).toHaveLength(2);
    expect(supabaseMock.from).not.toHaveBeenCalled();
  });

  it('update falha: mantém entry na queue pra próxima rodada', async () => {
    enqueuePendingSignature('r1', VALID_DATA_URL);
    supabaseMock.from.mockReturnValueOnce(
      makeUpdateChain({ data: null, error: { message: 'registro not found' } }),
    );

    const out = await flushPendingSignatures();
    expect(out.processed).toBe(0);
    expect(out.failed).toBe(1);
    expect(listPendingSignatures()).toHaveLength(1);
  });

  it('falha de upload: conta como failed e preserva queue', async () => {
    enqueuePendingSignature('r1', VALID_DATA_URL);

    // Força erro no upload via storage mock
    supabaseMock.storage.from.mockReturnValueOnce({
      upload: vi.fn().mockResolvedValue({ data: null, error: { message: 'storage 500' } }),
    });

    const out = await flushPendingSignatures();
    expect(out.failed).toBe(1);
    expect(listPendingSignatures()).toHaveLength(1);
  });

  it('mix: algumas sucesso, outras falha — remove só as OK', async () => {
    enqueuePendingSignature('r1', VALID_DATA_URL);
    enqueuePendingSignature('r2', VALID_DATA_URL);
    enqueuePendingSignature('r3', VALID_DATA_URL);

    // r2 falha no update; r1 e r3 sucesso
    let callIdx = 0;
    supabaseMock.from.mockImplementation(() => {
      callIdx += 1;
      if (callIdx === 2) {
        return makeUpdateChain({ data: null, error: { message: 'conflict' } });
      }
      return makeUpdateChain({ data: null, error: null });
    });

    const out = await flushPendingSignatures();
    expect(out.processed).toBe(2);
    expect(out.failed).toBe(1);
    expect(listPendingSignatures()).toHaveLength(1);
    expect(listPendingSignatures()[0].registroId).toBe('r2');
  });
});
