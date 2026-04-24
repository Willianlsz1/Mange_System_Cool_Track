import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock supabase usado internamente pelo módulo; os testes usam client injetado.
vi.mock('../core/supabase.js', () => ({ supabase: { storage: { from: () => ({}) } } }));
vi.mock('../core/errors.js', () => ({
  AppError: class AppError extends Error {
    constructor(msg, code, sev, ctx) {
      super(msg);
      this.code = code;
      this.severity = sev;
      this.ctx = ctx;
    }
  },
  ErrorCodes: {
    SYNC_FAILED: 'SYNC_FAILED',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    NETWORK_ERROR: 'NETWORK_ERROR',
  },
  handleError: vi.fn(),
}));

import {
  canSharePdfFile,
  sharePdfFileNative,
  buildSafeReportFileName,
  buildWhatsAppMessage,
  openWhatsAppWithPdfLink,
  downloadPdfLocally,
  uploadReportPdf,
  shareReportPdf,
} from '../domain/pdf/shareReport.js';

function makePdfBlob() {
  return new Blob(['%PDF-1.4 stub'], { type: 'application/pdf' });
}

function makeStorageMock({
  uploadError = null,
  signedUrl = 'https://storage/fake-url',
  signError = null,
} = {}) {
  const upload = vi.fn().mockResolvedValue({ error: uploadError });
  const createSignedUrl = vi
    .fn()
    .mockResolvedValue({ data: signedUrl ? { signedUrl } : null, error: signError });
  const from = vi.fn(() => ({ upload, createSignedUrl }));
  return {
    storage: { from },
    _upload: upload,
    _createSignedUrl: createSignedUrl,
    _from: from,
  };
}

describe('shareReport — buildSafeReportFileName', () => {
  it('usa registroId quando presente', () => {
    expect(buildSafeReportFileName({ registroId: 'abc-123' })).toBe('relatorio-abc-123.pdf');
  });

  it('sanitiza caracteres perigosos', () => {
    expect(buildSafeReportFileName({ registroId: 'Ana/Maria_2025' })).toBe(
      'relatorio-ana-maria-2025.pdf',
    );
  });

  it('respeita fileName quando vem com .pdf', () => {
    expect(buildSafeReportFileName({ fileName: 'Meu Relatorio.pdf' })).toBe('meu-relatorio.pdf');
  });

  it('usa timestamp quando nenhum dos dois existe', () => {
    const name = buildSafeReportFileName({});
    expect(name).toMatch(/^relatorio-\d+\.pdf$/);
  });
});

describe('shareReport — buildWhatsAppMessage', () => {
  it('inclui o link e o rodapé padrão', () => {
    const msg = buildWhatsAppMessage({ pdfUrl: 'https://x/y.pdf' });
    expect(msg).toContain('https://x/y.pdf');
    expect(msg).toContain('Relatório completo');
    expect(msg).toContain('Qualquer dúvida');
  });

  it('aceita prefix customizado', () => {
    const msg = buildWhatsAppMessage({ pdfUrl: 'https://x/y.pdf', prefix: 'Alô cliente!' });
    expect(msg.startsWith('Alô cliente!')).toBe(true);
  });
});

describe('shareReport — openWhatsAppWithPdfLink', () => {
  beforeEach(() => {
    vi.stubGlobal('open', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('abre wa.me com texto URL-encoded', () => {
    const ok = openWhatsAppWithPdfLink({ pdfUrl: 'https://x/y.pdf' });
    expect(ok).toBe(true);
    expect(window.open).toHaveBeenCalledTimes(1);
    const url = window.open.mock.calls[0][0];
    expect(url).toMatch(/^https:\/\/wa\.me\/\?text=/);
    expect(decodeURIComponent(url)).toContain('https://x/y.pdf');
  });

  it('retorna false quando pdfUrl está vazio', () => {
    expect(openWhatsAppWithPdfLink({})).toBe(false);
    expect(window.open).not.toHaveBeenCalled();
  });
});

describe('shareReport — canSharePdfFile', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('retorna false quando navigator.share não existe', () => {
    // jsdom não tem navigator.share por default
    const prev = globalThis.navigator;
    vi.stubGlobal('navigator', { userAgent: 'node' });
    expect(canSharePdfFile(makePdfBlob())).toBe(false);
    vi.stubGlobal('navigator', prev);
  });

  it('retorna true quando share + canShare({files}) estão disponíveis', () => {
    const prev = globalThis.navigator;
    vi.stubGlobal('navigator', {
      share: vi.fn(),
      canShare: vi.fn(() => true),
      userAgent: 'test',
    });
    expect(canSharePdfFile(makePdfBlob())).toBe(true);
    vi.stubGlobal('navigator', prev);
  });

  it('retorna false se canShare retorna false', () => {
    const prev = globalThis.navigator;
    vi.stubGlobal('navigator', {
      share: vi.fn(),
      canShare: vi.fn(() => false),
      userAgent: 'test',
    });
    expect(canSharePdfFile(makePdfBlob())).toBe(false);
    vi.stubGlobal('navigator', prev);
  });
});

describe('shareReport — sharePdfFileNative', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('retorna ok quando navigator.share resolve', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { share, canShare: vi.fn(() => true), userAgent: 'test' });

    const res = await sharePdfFileNative({
      pdfBlob: makePdfBlob(),
      fileName: 'relatorio.pdf',
      text: 'Olá',
    });
    expect(res.ok).toBe(true);
    expect(res.channel).toBe('web-share');
    expect(share).toHaveBeenCalled();
  });

  it('retorna cancelled ao invés de erro quando o usuário cancela', async () => {
    const abort = new Error('cancelled');
    abort.name = 'AbortError';
    const share = vi.fn().mockRejectedValue(abort);
    vi.stubGlobal('navigator', { share, canShare: vi.fn(() => true), userAgent: 'test' });

    const res = await sharePdfFileNative({
      pdfBlob: makePdfBlob(),
      fileName: 'r.pdf',
      text: '',
    });
    expect(res.ok).toBe(false);
    expect(res.cancelled).toBe(true);
  });

  it('propaga erro real com AppError', async () => {
    const err = new Error('permission denied');
    err.name = 'NotAllowedError';
    const share = vi.fn().mockRejectedValue(err);
    vi.stubGlobal('navigator', { share, canShare: vi.fn(() => true), userAgent: 'test' });

    const res = await sharePdfFileNative({
      pdfBlob: makePdfBlob(),
      fileName: 'r.pdf',
      text: '',
    });
    expect(res.ok).toBe(false);
    expect(res.cancelled).toBeUndefined();
    expect(res.error).toBeTruthy();
  });
});

describe('shareReport — uploadReportPdf', () => {
  it('faz upload e devolve signed url', async () => {
    const supabaseClient = makeStorageMock({ signedUrl: 'https://storage/signed' });
    const result = await uploadReportPdf({
      pdfBlob: makePdfBlob(),
      fileName: 'custom.pdf',
      metadata: { userId: 'user-1', registroId: 'reg-1' },
      supabaseClient,
    });
    expect(result.url).toBe('https://storage/signed');
    expect(result.bucket).toBeTruthy();
    expect(result.path).toMatch(/^user-1\/\d{4}-\d{2}\/custom\.pdf$/);
    expect(supabaseClient._upload).toHaveBeenCalledTimes(1);
    expect(supabaseClient._createSignedUrl).toHaveBeenCalledTimes(1);
  });

  it('propaga erro quando upload falha', async () => {
    const supabaseClient = makeStorageMock({
      uploadError: { message: 'no bucket' },
    });
    await expect(
      uploadReportPdf({
        pdfBlob: makePdfBlob(),
        metadata: { userId: 'user-1' },
        supabaseClient,
      }),
    ).rejects.toThrow(/armazenamento/i);
  });

  it('propaga erro quando signed url falha', async () => {
    const supabaseClient = makeStorageMock({
      signedUrl: null,
      signError: { message: 'no perms' },
    });
    await expect(
      uploadReportPdf({
        pdfBlob: makePdfBlob(),
        metadata: { userId: 'user-1' },
        supabaseClient,
      }),
    ).rejects.toThrow(/link de compartilhamento/i);
  });
});

describe('shareReport — shareReportPdf orchestrator', () => {
  beforeEach(() => {
    vi.stubGlobal('open', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('usa Web Share quando suportado', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { share, canShare: vi.fn(() => true), userAgent: 'test' });

    const supabaseClient = makeStorageMock();
    const res = await shareReportPdf({
      pdfBlob: makePdfBlob(),
      fileName: 'relatorio.pdf',
      metadata: { userId: 'u1', registroId: 'r1' },
      supabaseClient,
    });
    expect(res.ok).toBe(true);
    expect(res.channel).toBe('web-share');
    expect(share).toHaveBeenCalled();
    expect(supabaseClient._upload).not.toHaveBeenCalled();
  });

  it('faz upload + abre wa.me quando Web Share não existe', async () => {
    vi.stubGlobal('navigator', { userAgent: 'test' });
    const supabaseClient = makeStorageMock({ signedUrl: 'https://storage/pdf' });

    const res = await shareReportPdf({
      pdfBlob: makePdfBlob(),
      fileName: 'relatorio.pdf',
      metadata: { userId: 'u1', registroId: 'r1' },
      supabaseClient,
    });
    expect(res.ok).toBe(true);
    expect(res.channel).toBe('wa-link');
    expect(res.pdfUrl).toBe('https://storage/pdf');
    expect(window.open).toHaveBeenCalledTimes(1);
    const url = window.open.mock.calls[0][0];
    expect(url).toContain('wa.me');
    expect(decodeURIComponent(url)).toContain('https://storage/pdf');
  });

  it('cancelled do Web Share NÃO cai pro upload (preserva intent do user)', async () => {
    const abort = Object.assign(new Error('cancel'), { name: 'AbortError' });
    const share = vi.fn().mockRejectedValue(abort);
    vi.stubGlobal('navigator', { share, canShare: vi.fn(() => true), userAgent: 'test' });

    const supabaseClient = makeStorageMock();
    const res = await shareReportPdf({
      pdfBlob: makePdfBlob(),
      fileName: 'r.pdf',
      metadata: { userId: 'u1' },
      supabaseClient,
    });
    expect(res.ok).toBe(false);
    expect(res.cancelled).toBe(true);
    expect(res.channel).toBe('web-share');
    expect(supabaseClient._upload).not.toHaveBeenCalled();
  });

  it('erro real do Web Share cai pro fallback de upload', async () => {
    const err = Object.assign(new Error('permission'), { name: 'NotAllowedError' });
    const share = vi.fn().mockRejectedValue(err);
    vi.stubGlobal('navigator', { share, canShare: vi.fn(() => true), userAgent: 'test' });

    const supabaseClient = makeStorageMock({ signedUrl: 'https://storage/pdf2' });
    const res = await shareReportPdf({
      pdfBlob: makePdfBlob(),
      fileName: 'r.pdf',
      metadata: { userId: 'u1' },
      supabaseClient,
    });
    expect(res.ok).toBe(true);
    expect(res.channel).toBe('wa-link');
    expect(supabaseClient._upload).toHaveBeenCalled();
  });

  it('fallback final: baixa localmente quando upload falha', async () => {
    vi.stubGlobal('navigator', { userAgent: 'test' });
    const supabaseClient = makeStorageMock({ uploadError: { message: 'no bucket' } });

    // downloadPdfLocally cria um <a> e usa URL.createObjectURL. jsdom
    // pode não expor essas APIs, então instalamos como no-op quando faltam.
    const origCreateURL = URL.createObjectURL;
    const origRevokeURL = URL.revokeObjectURL;
    URL.createObjectURL = () => 'blob:fake';
    URL.revokeObjectURL = () => {};
    const clickSpy = vi.fn();
    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      const el = origCreate(tag);
      if (tag === 'a') el.click = clickSpy;
      return el;
    });

    const res = await shareReportPdf({
      pdfBlob: makePdfBlob(),
      fileName: 'r.pdf',
      metadata: { userId: 'u1' },
      supabaseClient,
    });
    expect(res.ok).toBe(true);
    expect(res.channel).toBe('download');
    expect(clickSpy).toHaveBeenCalled();

    // Restaura APIs originais pra não poluir testes seguintes.
    URL.createObjectURL = origCreateURL;
    URL.revokeObjectURL = origRevokeURL;
  });
});

describe('shareReport — downloadPdfLocally', () => {
  it('retorna false com blob nulo', () => {
    expect(downloadPdfLocally({ pdfBlob: null })).toBe(false);
  });
});
