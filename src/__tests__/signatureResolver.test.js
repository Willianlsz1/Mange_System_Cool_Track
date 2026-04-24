import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mocks — definidos antes de import dinâmico do SUT pra que os `vi.mock`
// sejam aplicados.
const supabaseMock = {
  auth: {
    getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-abc' } } }),
  },
  from: vi.fn(() => ({
    update: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      })),
    })),
  })),
};

const uploadSpy = vi.fn();
const getSignedUrlSpy = vi.fn();

vi.mock('../core/supabase.js', () => ({ supabase: supabaseMock }));
vi.mock('../core/toast.js', () => ({ Toast: { warning: vi.fn(), info: vi.fn() } }));
vi.mock('../core/signatureStorage.js', () => ({
  uploadSignatureDataUrl: uploadSpy,
  getSignatureSignedUrl: getSignedUrlSpy,
  normalizeSignatureEntry: (v) => {
    if (!v) return null;
    if (typeof v === 'string') {
      if (v.startsWith('data:image/')) return { version: 1, legacy: true, dataUrl: v };
      return null;
    }
    if (typeof v === 'object' && v.path) {
      return {
        version: 1,
        provider: 'supabase-storage',
        bucket: v.bucket || 'registro-fotos',
        path: v.path,
        url: v.url,
      };
    }
    return null;
  },
  enqueuePendingSignature: vi.fn(),
}));

const { resolveSignatureForRecord } =
  await import('../ui/components/signature/signature-storage.js');

const VALID_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

function flushMicrotasks() {
  return new Promise((r) => setTimeout(r, 10));
}

describe('signature-storage — resolveSignatureForRecord', () => {
  beforeEach(() => {
    localStorage.clear();
    uploadSpy.mockReset();
    getSignedUrlSpy.mockReset();
    supabaseMock.auth.getUser.mockClear();
    supabaseMock.from.mockClear();
  });

  it('retorna dataUrl inline legacy diretamente', async () => {
    const registro = { id: 'r1', assinatura: VALID_DATA_URL };
    const out = await resolveSignatureForRecord(registro);
    expect(out).toBe(VALID_DATA_URL);
    expect(uploadSpy).not.toHaveBeenCalled();
  });

  it('retorna null quando registro não tem assinatura nem localStorage', async () => {
    const registro = { id: 'r1', assinatura: null };
    const out = await resolveSignatureForRecord(registro);
    expect(out).toBeNull();
  });

  it('fallback pro localStorage quando registro.assinatura é boolean true', async () => {
    localStorage.setItem('cooltrack-sig-r1', VALID_DATA_URL);
    const registro = { id: 'r1', assinatura: true };
    const out = await resolveSignatureForRecord(registro);
    expect(out).toBe(VALID_DATA_URL);
  });

  it('dispara migração on-demand quando dataUrl só-local + assinatura boolean', async () => {
    localStorage.setItem('cooltrack-sig-r1', VALID_DATA_URL);
    uploadSpy.mockResolvedValue({
      version: 1,
      provider: 'supabase-storage',
      bucket: 'registro-fotos',
      path: 'user-abc/registros/r1/assinatura.png',
      url: 'https://mock/signed',
    });

    const registro = { id: 'r1', assinatura: true };
    await resolveSignatureForRecord(registro);

    // Migração é fire-and-forget — espera microtasks
    await flushMicrotasks();

    expect(uploadSpy).toHaveBeenCalledTimes(1);
    expect(uploadSpy).toHaveBeenCalledWith(VALID_DATA_URL, {
      userId: 'user-abc',
      recordId: 'r1',
    });
    expect(supabaseMock.from).toHaveBeenCalledWith('registros');
  });

  it('NÃO migra se registro já tem reference remoto', async () => {
    localStorage.setItem('cooltrack-sig-r1', VALID_DATA_URL);
    getSignedUrlSpy.mockResolvedValue({ url: 'https://mock/signed', expiresAt: '2099-01-01' });

    // fetch retorna sucesso — resolve retorna dataUrl do Storage
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob([new Uint8Array([1, 2])], { type: 'image/png' }),
    });
    // FileReader mock
    global.FileReader = class {
      readAsDataURL() {
        this.result = VALID_DATA_URL;
        setTimeout(() => this.onload?.(), 0);
      }
    };

    const registro = {
      id: 'r1',
      assinatura: {
        path: 'user-abc/registros/r1/assinatura.png',
        bucket: 'registro-fotos',
      },
    };
    await resolveSignatureForRecord(registro);
    await flushMicrotasks();

    expect(uploadSpy).not.toHaveBeenCalled();
  });

  it('dedup: 2 calls paralelos pro mesmo registro fazem 1 migração só', async () => {
    localStorage.setItem('cooltrack-sig-r1', VALID_DATA_URL);
    uploadSpy.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                version: 1,
                provider: 'supabase-storage',
                bucket: 'registro-fotos',
                path: 'user-abc/registros/r1/assinatura.png',
              }),
            20,
          ),
        ),
    );

    const registro = { id: 'r1', assinatura: true };
    await Promise.all([
      resolveSignatureForRecord(registro),
      resolveSignatureForRecord(registro),
      resolveSignatureForRecord(registro),
    ]);
    await flushMicrotasks();
    await flushMicrotasks();

    expect(uploadSpy).toHaveBeenCalledTimes(1);
  });

  it('sem userId: não tenta migrar', async () => {
    localStorage.setItem('cooltrack-sig-r1', VALID_DATA_URL);
    supabaseMock.auth.getUser.mockResolvedValueOnce({ data: { user: null } });

    const registro = { id: 'r1', assinatura: true };
    await resolveSignatureForRecord(registro);
    await flushMicrotasks();

    expect(uploadSpy).not.toHaveBeenCalled();
  });
});
