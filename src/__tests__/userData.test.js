import { describe, it, expect, beforeEach, vi } from 'vitest';

const supabaseMock = {
  auth: {
    refreshSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'new-token' } } }),
    getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
  },
};

vi.mock('../core/supabase.js', () => ({ supabase: supabaseMock }));
vi.mock('../core/errors.js', () => ({
  AppError: class AppError extends Error {
    constructor(message, code, severity, context) {
      super(message);
      this.code = code;
      this.severity = severity;
      this.context = context;
    }
  },
  ErrorCodes: {
    AUTH_FAILED: 'AUTH_FAILED',
    NETWORK_ERROR: 'NETWORK_ERROR',
    SYNC_FAILED: 'SYNC_FAILED',
  },
  handleError: vi.fn(),
}));

// Stub import.meta.env antes de importar SUT
vi.stubEnv('VITE_SUPABASE_URL', 'https://mock.supabase.co');
vi.stubEnv('VITE_SUPABASE_KEY', 'anon-key');

const { exportUserData, deleteUserAccount } = await import('../features/userData.js');

describe('userData — exportUserData', () => {
  beforeEach(() => {
    supabaseMock.auth.refreshSession.mockClear();
    supabaseMock.auth.refreshSession.mockResolvedValue({
      data: { session: { access_token: 'new-token' } },
    });
  });

  it('chama export e dispara download quando sucesso', async () => {
    const mockBlob = new Blob(['{"ok":true}'], { type: 'application/json' });
    const mockHeaders = new Headers({
      'Content-Disposition': 'attachment; filename="cooltrack-export-user-abc-timestamp.json"',
    });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: mockHeaders,
      blob: async () => mockBlob,
    });

    // Stub URL.createObjectURL (jsdom não implementa)
    global.URL.createObjectURL = vi.fn(() => 'blob://mock');
    global.URL.revokeObjectURL = vi.fn();

    const result = await exportUserData();
    expect(result.ok).toBe(true);
    expect(result.filename).toBe('cooltrack-export-user-abc-timestamp.json');
    expect(fetch).toHaveBeenCalledWith(
      'https://mock.supabase.co/functions/v1/export-user-data',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer new-token',
          apikey: 'anon-key',
        }),
      }),
    );
  });

  it('retorna { ok: false } quando fetch 500', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      headers: new Headers(),
      json: async () => ({ code: 'INTERNAL_ERROR', message: 'Boom' }),
    });

    const result = await exportUserData();
    expect(result.ok).toBe(false);
    expect(result.message).toBe('Boom');
  });

  it('retorna { ok: false } quando sem token', async () => {
    supabaseMock.auth.refreshSession.mockResolvedValueOnce({ data: { session: null } });
    supabaseMock.auth.getSession.mockResolvedValueOnce({ data: { session: null } });

    const result = await exportUserData();
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/login/i);
  });

  it('fallback pro token cacheado se refresh falhar mas token válido', async () => {
    supabaseMock.auth.refreshSession.mockRejectedValueOnce(new Error('network'));
    // Token com exp futuro: criamos um payload válido base64
    const fakeExp = Math.floor(Date.now() / 1000) + 3600;
    const payload = btoa(JSON.stringify({ exp: fakeExp }));
    const fakeToken = `header.${payload}.sig`;
    supabaseMock.auth.getSession.mockResolvedValueOnce({
      data: { session: { access_token: fakeToken } },
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      blob: async () => new Blob(['{}']),
    });
    global.URL.createObjectURL = vi.fn(() => 'blob://mock');
    global.URL.revokeObjectURL = vi.fn();

    const result = await exportUserData();
    expect(result.ok).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: `Bearer ${fakeToken}` }),
      }),
    );
  });
});

describe('userData — deleteUserAccount', () => {
  beforeEach(() => {
    supabaseMock.auth.refreshSession.mockClear();
    supabaseMock.auth.signOut.mockClear();
    supabaseMock.auth.refreshSession.mockResolvedValue({
      data: { session: { access_token: 'new-token' } },
    });
  });

  it('chama delete e faz signOut no sucesso', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({ ok: true, userId: 'user-abc' }),
    });

    const result = await deleteUserAccount();
    expect(result.ok).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      'https://mock.supabase.co/functions/v1/delete-user-account',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(supabaseMock.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('não chama signOut quando fetch falha', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      headers: new Headers(),
      json: async () => ({
        code: 'TABLE_DELETE_FAILED',
        step: 'registros',
        message: 'FK violation',
      }),
    });

    const result = await deleteUserAccount();
    expect(result.ok).toBe(false);
    expect(result.message).toBe('FK violation');
    expect(supabaseMock.auth.signOut).not.toHaveBeenCalled();
  });

  it('retorna ok:false quando sem sessão', async () => {
    supabaseMock.auth.refreshSession.mockResolvedValueOnce({ data: { session: null } });
    supabaseMock.auth.getSession.mockResolvedValueOnce({ data: { session: null } });

    const result = await deleteUserAccount();
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/login/i);
  });
});
