function createSupabaseMock({
  userId = 'user-1',
  uploadReject = false,
  signedUrl = 'https://signed.example/photo.jpg',
} = {}) {
  const upload = uploadReject
    ? vi.fn().mockResolvedValue({ data: null, error: { message: 'upload failed' } })
    : vi.fn().mockResolvedValue({ data: { path: 'ok' }, error: null });
  const createSignedUrl = vi.fn().mockResolvedValue({ data: { signedUrl }, error: null });
  const from = vi.fn(() => ({ upload, createSignedUrl }));

  return {
    client: {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: userId ? { id: userId } : null } }),
      },
      storage: { from },
    },
    upload,
    createSignedUrl,
    from,
  };
}

async function loadPhotoStorage(options = {}) {
  vi.resetModules();
  const supabaseMock = createSupabaseMock(options.supabase);
  vi.doMock('../core/supabase.js', () => ({ supabase: supabaseMock.client }));
  const module = await import('../core/photoStorage.js');
  return { ...module, supabaseMock };
}

const SAMPLE_DATA_URL = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAA==';

describe('photoStorage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('normalizes string and object photo entries', async () => {
    const { normalizePhotoList } = await loadPhotoStorage();

    const list = normalizePhotoList([
      SAMPLE_DATA_URL,
      {
        bucket: 'registro-fotos',
        path: 'user-1/registros/r-1/photo.jpg',
        url: 'https://signed.example/photo.jpg',
      },
      10,
    ]);

    expect(list).toHaveLength(2);
    expect(typeof list[0]).toBe('string');
    expect(list[1]).toMatchObject({
      provider: 'supabase-storage',
      bucket: 'registro-fotos',
      path: 'user-1/registros/r-1/photo.jpg',
    });
  });

  it('uploads data url photos and returns metadata references', async () => {
    const { uploadPendingPhotos, supabaseMock } = await loadPhotoStorage();

    const result = await uploadPendingPhotos([SAMPLE_DATA_URL], { recordId: 'r-1' });

    expect(result.uploadedCount).toBe(1);
    expect(result.failedCount).toBe(0);
    expect(supabaseMock.upload).toHaveBeenCalledTimes(1);
    expect(supabaseMock.createSignedUrl).toHaveBeenCalledTimes(1);
    expect(result.photos[0]).toMatchObject({
      provider: 'supabase-storage',
      bucket: 'registro-fotos',
      path: expect.any(String),
      url: 'https://signed.example/photo.jpg',
    });
  });

  it('keeps inline fallback when upload fails', async () => {
    const { uploadPendingPhotos, supabaseMock } = await loadPhotoStorage({
      supabase: { uploadReject: true },
    });

    const result = await uploadPendingPhotos([SAMPLE_DATA_URL], { recordId: 'r-2' });

    expect(supabaseMock.upload).toHaveBeenCalledTimes(1);
    expect(result.uploadedCount).toBe(0);
    expect(result.failedCount).toBe(1);
    expect(result.photos[0]).toBe(SAMPLE_DATA_URL);
  });

  it('migrates legacy inline photos in registros', async () => {
    const { migrateLegacyPhotosForRegistros, supabaseMock } = await loadPhotoStorage();

    const registros = [
      { id: 'r-1', fotos: [SAMPLE_DATA_URL] },
      {
        id: 'r-2',
        fotos: [
          {
            bucket: 'registro-fotos',
            path: 'user-1/registros/r-2/photo.jpg',
            url: 'https://signed.example/existing.jpg',
          },
        ],
      },
    ];

    const migration = await migrateLegacyPhotosForRegistros(registros, { userId: 'user-1' });

    expect(supabaseMock.upload).toHaveBeenCalledTimes(1);
    expect(migration.migratedCount).toBe(1);
    expect(migration.failedCount).toBe(0);
    expect(migration.registros[0].fotos[0]).toMatchObject({
      provider: 'supabase-storage',
      path: expect.any(String),
    });
    expect(migration.registros[1].fotos[0]).toMatchObject({
      path: 'user-1/registros/r-2/photo.jpg',
    });
  });

  it('refreshes signed url for expired references', async () => {
    const { resolvePhotoDisplayUrl, supabaseMock } = await loadPhotoStorage({
      supabase: { signedUrl: 'https://signed.example/refreshed.jpg' },
    });

    const url = await resolvePhotoDisplayUrl({
      bucket: 'registro-fotos',
      path: 'user-1/registros/r-3/photo.jpg',
      url: 'https://signed.example/expired.jpg',
      urlExpiresAt: '2001-01-01T00:00:00.000Z',
    });

    expect(supabaseMock.createSignedUrl).toHaveBeenCalledTimes(1);
    expect(url).toBe('https://signed.example/refreshed.jpg');
  });
});
