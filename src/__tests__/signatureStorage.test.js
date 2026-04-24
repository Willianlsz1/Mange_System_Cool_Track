import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock do supabase + photoStorage helpers antes de importar o módulo testado.
vi.mock('../core/supabase.js', () => ({
  supabase: {
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ data: { path: 'mock' }, error: null }),
      })),
    },
  },
}));

vi.mock('../core/photoStorage.js', () => ({
  dataUrlToBlob: vi.fn(async (dataUrl) => {
    // Mini implementação só pra retornar um Blob-like com size estimada.
    const base64 = dataUrl.split(',')[1] || '';
    return {
      type: 'image/png',
      size: Math.floor(base64.length * 0.75),
    };
  }),
  createSignedUrl: vi.fn(async (bucket, path) => ({
    url: `https://mock.supabase.co/${bucket}/${path}?token=abc`,
    expiresAt: new Date(Date.now() + 86400 * 1000).toISOString(),
  })),
}));

const {
  uploadSignatureDataUrl,
  getSignatureSignedUrl,
  normalizeSignatureEntry,
  enqueuePendingSignature,
  listPendingSignatures,
  clearPendingSignature,
  getPendingQueueSize,
} = await import('../core/signatureStorage.js');

const VALID_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

describe('signatureStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('uploadSignatureDataUrl', () => {
    it('retorna reference object com path determinístico', async () => {
      const ref = await uploadSignatureDataUrl(VALID_DATA_URL, {
        userId: 'user-abc',
        recordId: 'reg-123',
      });
      expect(ref.provider).toBe('supabase-storage');
      expect(ref.path).toBe('user-abc/registros/reg-123/assinatura.png');
      expect(ref.bucket).toBe('registro-fotos');
      expect(ref.url).toContain('token=');
      expect(ref.mimeType).toBe('image/png');
      expect(ref.version).toBe(1);
      expect(ref.uploadedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('sanitiza caracteres inseguros em userId e recordId', async () => {
      const ref = await uploadSignatureDataUrl(VALID_DATA_URL, {
        userId: 'user/../hack',
        recordId: 'reg?id=1',
      });
      expect(ref.path).toBe('user____hack/registros/reg_id_1/assinatura.png');
    });

    it('rejeita data URL inválido', async () => {
      await expect(
        uploadSignatureDataUrl('not-a-data-url', { userId: 'u', recordId: 'r' }),
      ).rejects.toThrow(/assinatura inválida/i);
    });

    it('rejeita se faltar userId ou recordId', async () => {
      await expect(
        uploadSignatureDataUrl(VALID_DATA_URL, { userId: '', recordId: 'r' }),
      ).rejects.toThrow(/requer userId e recordId/i);
      await expect(
        uploadSignatureDataUrl(VALID_DATA_URL, { userId: 'u', recordId: '' }),
      ).rejects.toThrow(/requer userId e recordId/i);
    });
  });

  describe('normalizeSignatureEntry', () => {
    it('retorna null para valores vazios', () => {
      expect(normalizeSignatureEntry(null)).toBeNull();
      expect(normalizeSignatureEntry(undefined)).toBeNull();
      expect(normalizeSignatureEntry('')).toBeNull();
      expect(normalizeSignatureEntry('   ')).toBeNull();
    });

    it('reconhece data URL legacy como { legacy: true }', () => {
      const out = normalizeSignatureEntry(VALID_DATA_URL);
      expect(out).toEqual({
        version: 1,
        legacy: true,
        dataUrl: VALID_DATA_URL,
      });
    });

    it('reconhece reference object completo', () => {
      const input = {
        version: 1,
        provider: 'supabase-storage',
        bucket: 'registro-fotos',
        path: 'u/registros/r/assinatura.png',
        url: 'https://x.co/signed',
        urlExpiresAt: '2026-01-01T00:00:00Z',
        mimeType: 'image/png',
        size: 1234,
        uploadedAt: '2026-01-01T00:00:00Z',
      };
      expect(normalizeSignatureEntry(input)).toEqual(input);
    });

    it('reconhece JSON string com reference object (coluna text)', () => {
      const obj = {
        path: 'u/registros/r/assinatura.png',
        bucket: 'registro-fotos',
      };
      const serialized = JSON.stringify(obj);
      const out = normalizeSignatureEntry(serialized);
      expect(out?.path).toBe('u/registros/r/assinatura.png');
      expect(out?.bucket).toBe('registro-fotos');
      expect(out?.provider).toBe('supabase-storage');
    });

    it('ignora objeto sem path nem dataUrl', () => {
      expect(normalizeSignatureEntry({ foo: 'bar' })).toBeNull();
    });

    it('aplica bucket default quando omitido', () => {
      const out = normalizeSignatureEntry({ path: 'u/registros/r/assinatura.png' });
      expect(out?.bucket).toBe('registro-fotos');
    });

    it('rejeita dataUrl legacy com MIME não-imagem', () => {
      expect(normalizeSignatureEntry('data:text/plain;base64,aGVsbG8=')).toBeNull();
    });
  });

  describe('getSignatureSignedUrl', () => {
    it('retorna null para legacy dataUrl', async () => {
      const legacy = { version: 1, legacy: true, dataUrl: VALID_DATA_URL };
      expect(await getSignatureSignedUrl(legacy)).toBeNull();
    });

    it('retorna null para null', async () => {
      expect(await getSignatureSignedUrl(null)).toBeNull();
    });

    it('gera signed URL para reference válido', async () => {
      const ref = {
        bucket: 'registro-fotos',
        path: 'u/registros/r/assinatura.png',
      };
      const out = await getSignatureSignedUrl(ref);
      expect(out?.url).toContain('token=');
      expect(out?.expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('pending queue', () => {
    it('enqueue adiciona entry e retorna tamanho', () => {
      const size = enqueuePendingSignature('reg-1', VALID_DATA_URL);
      expect(size).toBe(1);
      expect(getPendingQueueSize()).toBe(1);
    });

    it('enqueue substitui entry duplicada pelo mesmo registroId', () => {
      enqueuePendingSignature('reg-1', VALID_DATA_URL);
      enqueuePendingSignature('reg-1', VALID_DATA_URL);
      enqueuePendingSignature('reg-1', VALID_DATA_URL);
      expect(getPendingQueueSize()).toBe(1);
    });

    it('enqueue ignora dataUrl inválido', () => {
      expect(enqueuePendingSignature('reg-1', 'garbage')).toBe(0);
      expect(enqueuePendingSignature('reg-1', '')).toBe(0);
      expect(enqueuePendingSignature('', VALID_DATA_URL)).toBe(0);
    });

    it('listPendingSignatures retorna entries válidos', () => {
      enqueuePendingSignature('reg-1', VALID_DATA_URL);
      enqueuePendingSignature('reg-2', VALID_DATA_URL);
      const list = listPendingSignatures();
      expect(list).toHaveLength(2);
      expect(list.map((e) => e.registroId).sort()).toEqual(['reg-1', 'reg-2']);
    });

    it('clearPendingSignature remove entry específica', () => {
      enqueuePendingSignature('reg-1', VALID_DATA_URL);
      enqueuePendingSignature('reg-2', VALID_DATA_URL);
      clearPendingSignature('reg-1');
      const list = listPendingSignatures();
      expect(list).toHaveLength(1);
      expect(list[0].registroId).toBe('reg-2');
    });

    it('respeita limite de 50 entries (FIFO trim)', () => {
      for (let i = 0; i < 60; i += 1) {
        enqueuePendingSignature(`reg-${i}`, VALID_DATA_URL);
      }
      expect(getPendingQueueSize()).toBe(50);
      // As mais novas ficam (10 a 59).
      const list = listPendingSignatures();
      expect(list[0].registroId).toBe('reg-10');
      expect(list[49].registroId).toBe('reg-59');
    });

    it('tolera localStorage com JSON inválido', () => {
      localStorage.setItem('cooltrack-sig-pending-upload', 'not-json');
      expect(getPendingQueueSize()).toBe(0);
      expect(listPendingSignatures()).toEqual([]);
    });
  });
});
