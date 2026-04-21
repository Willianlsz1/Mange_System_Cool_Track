import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ───────────────────────────────────────────────────────────────────
// V4: editor dedicado de fotos aberto do detail view (modal-eq-photos).
// Testes cobrem applyEquipPhotosEditorGate, openEquipPhotosEditor e
// saveEquipPhotos. Mesmo pattern do equipPhotosGate.test.js (o módulo
// equipamentos.js é grande; precisamos mockar deps pesadas).

const trackEvent = vi.fn();
const goTo = vi.fn();
vi.mock('../core/telemetry.js', () => ({
  trackEvent,
  TELEMETRY_EVENT: 'cooltrack:telemetry',
}));
vi.mock('../core/router.js', () => ({
  goTo,
}));

// EquipmentPhotos: stub completo com todos os métodos que a view chama.
const photosClear = vi.fn();
const photosSetExisting = vi.fn();
const photosConfigure = vi.fn();
const photosResetTargets = vi.fn();
const photosGetAll = vi.fn(() => []);
const photosState = { pending: [], existing: [] };
vi.mock('../ui/components/equipmentPhotos.js', () => ({
  EquipmentPhotos: {
    clear: photosClear,
    setExisting: photosSetExisting,
    configure: photosConfigure,
    resetTargets: photosResetTargets,
    getAll: photosGetAll,
    get pending() {
      return photosState.pending;
    },
    get existing() {
      return photosState.existing;
    },
  },
  MAX_EQUIP_PHOTOS: 3,
}));

// Toast — só queremos garantir que não crasha.
const toastSuccess = vi.fn();
const toastWarning = vi.fn();
const toastError = vi.fn();
vi.mock('../core/toast.js', () => ({
  Toast: {
    success: toastSuccess,
    warning: toastWarning,
    error: toastError,
    info: vi.fn(),
  },
}));

// state.js — findEquip retorna um equipamento fake; setState é spy.
const findEquip = vi.fn();
const setState = vi.fn();
const getState = vi.fn(() => ({ equipamentos: [], registros: [], setores: [] }));
vi.mock('../core/state.js', () => ({
  getState,
  findEquip,
  findSetor: vi.fn(),
  setState,
  regsForEquip: vi.fn(() => []),
}));

// planCache — controlado por teste via mockReturnValue.
const isCachedPlanPlusOrHigher = vi.fn(() => true);
vi.mock('../core/plans/planCache.js', () => ({
  isCachedPlanPlusOrHigher,
}));

// photoStorage: uploadPendingPhotos retorna estrutura esperada.
const uploadPendingPhotos = vi.fn(async (photos) => ({
  photos,
  uploadedCount: photos.length,
  failedCount: 0,
}));
vi.mock('../core/photoStorage.js', () => ({
  uploadPendingPhotos,
  normalizePhotoList: vi.fn((list) =>
    Array.isArray(list) ? list.filter((p) => p && (p.url || p.path || p.dataUrl)) : [],
  ),
  resolvePhotoDisplayUrl: vi.fn((p) => p?.url || ''),
}));

// Modal dinâmico — open/close são spies.
const modalOpen = vi.fn();
const modalClose = vi.fn();
vi.mock('../core/modal.js', () => ({
  Modal: { open: modalOpen, close: modalClose },
  CustomConfirm: { show: vi.fn(async () => true) },
}));

// monetization + subscriptionPlans (import dinâmico no recheck async).
vi.mock('../core/plans/monetization.js', () => ({
  fetchMyProfileBilling: vi.fn(async () => ({ profile: null })),
}));
// subscriptionPlans é importado transitivamente por upgradeNudge/dashboard,
// então precisamos expor também as constantes (senão importOriginal é o caminho).
vi.mock('../core/plans/subscriptionPlans.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    hasPlusAccess: vi.fn(() => true),
  };
});

// equipDetail — viewEquip é chamado no fim do saveEquipPhotos pra re-render.
const viewEquipMock = vi.fn(async () => {});
vi.mock('../ui/views/equipamentos/equipDetail.js', () => ({
  viewEquip: viewEquipMock,
}));

// Heavies: priorityEngine, alerts, skeleton, maintenance — stubs no-op.
vi.mock('../domain/priorityEngine.js', () => ({
  evaluateEquipmentPriority: vi.fn(() => ({ priorityLevel: 1, priorityLabel: 'mock' })),
}));
vi.mock('../domain/alerts.js', () => ({
  Alerts: { getAll: vi.fn(() => []) },
  getPreventivaDueEquipmentIds: vi.fn(() => []),
}));
vi.mock('../ui/components/skeleton.js', () => ({
  withSkeleton: (_el, _opts, renderFn) => renderFn(),
}));
vi.mock('../domain/maintenance.js', () => ({
  evaluateEquipmentHealth: vi.fn(() => ({ score: 80, context: { daysToNext: 30 } })),
  evaluateEquipmentRisk: vi.fn(() => ({ score: 50 })),
  evaluateEquipmentRiskTrend: vi.fn(() => ({ trend: 'stable', delta: 0 })),
  getEquipmentMaintenanceContext: vi.fn(() => ({
    ultimoRegistro: null,
    daysToNext: 30,
    equipamento: { criticidade: 'media', status: 'ok' },
    recentCorrectiveCount: 0,
  })),
  getSuggestedPreventiveDays: vi.fn(() => 30),
  normalizePeriodicidadePreventivaDias: vi.fn((d) => d ?? 30),
}));

// DOM minimal: só os IDs que o editor toca. Espelha modal-eq-photos.
function mountEditorDom() {
  document.body.innerHTML = `
    <div id="modal-eq-photos">
      <div class="equip-photo-block" id="eq-photos-block">
        <div id="eq-photos-drop-zone"></div>
        <div id="eq-photos-preview"></div>
        <p id="eq-photos-drop-text"></p>
        <div class="equip-photo-locked" id="eq-photos-locked" hidden>
          <button type="button" class="equip-photo-locked__cta"
            data-action="eq-photos-upsell-cta">
            Desbloquear com Plus →
          </button>
        </div>
      </div>
    </div>
  `;
}

beforeEach(() => {
  vi.clearAllMocks();
  photosState.pending = [];
  photosState.existing = [];
  isCachedPlanPlusOrHigher.mockReturnValue(true);
  getState.mockReturnValue({ equipamentos: [], registros: [], setores: [] });
  mountEditorDom();
});

// ── applyEquipPhotosEditorGate ──────────────────────────────────────────────

describe('applyEquipPhotosEditorGate — Plus+/Pro (acesso liberado)', () => {
  it('remove a classe locked do block e esconde o upsell', async () => {
    const { applyEquipPhotosEditorGate } = await import('../ui/views/equipamentos.js');
    applyEquipPhotosEditorGate(true);

    const block = document.getElementById('eq-photos-block');
    const locked = document.getElementById('eq-photos-locked');
    expect(block.classList.contains('equip-photo-block--locked')).toBe(false);
    expect(locked.hasAttribute('hidden')).toBe(true);
  });

  it('não chama EquipmentPhotos.clear no caminho Plus+', async () => {
    const { applyEquipPhotosEditorGate } = await import('../ui/views/equipamentos.js');
    applyEquipPhotosEditorGate(true);

    expect(photosClear).not.toHaveBeenCalled();
  });
});

describe('applyEquipPhotosEditorGate — Free (bloqueado / defense-in-depth)', () => {
  it('aplica a classe locked e mostra o upsell', async () => {
    const { applyEquipPhotosEditorGate } = await import('../ui/views/equipamentos.js');
    applyEquipPhotosEditorGate(false);

    const block = document.getElementById('eq-photos-block');
    const locked = document.getElementById('eq-photos-locked');
    expect(block.classList.contains('equip-photo-block--locked')).toBe(true);
    expect(locked.hasAttribute('hidden')).toBe(false);
  });

  it('chama EquipmentPhotos.clear (defense-in-depth contra dataURLs fantasma)', async () => {
    const { applyEquipPhotosEditorGate } = await import('../ui/views/equipamentos.js');
    applyEquipPhotosEditorGate(false);

    expect(photosClear).toHaveBeenCalledTimes(1);
  });

  it('clique no CTA dispara telemetria, fecha modal e navega pro pricing', async () => {
    const { applyEquipPhotosEditorGate } = await import('../ui/views/equipamentos.js');
    applyEquipPhotosEditorGate(false);

    const cta = document.querySelector('#eq-photos-locked [data-action="eq-photos-upsell-cta"]');
    expect(cta).not.toBeNull();
    cta.click();

    // Handler do click é async e faz `await import('../../core/modal.js')` ANTES
    // de chamar Modal.close e goTo. Um setTimeout(0) garante que o event loop
    // terminou o import dinâmico + o restante do handler.
    await new Promise((r) => setTimeout(r, 0));

    expect(trackEvent).toHaveBeenCalledWith('photo_upsell_clicked', { source: 'equip_detail' });
    expect(modalClose).toHaveBeenCalledWith('modal-eq-photos');
    expect(goTo).toHaveBeenCalledWith('pricing', {
      highlightPlan: 'plus',
      reason: 'photos_upsell',
    });
  });

  it('não stacka listeners mesmo com múltiplas aplicações do gate', async () => {
    const { applyEquipPhotosEditorGate } = await import('../ui/views/equipamentos.js');

    applyEquipPhotosEditorGate(false);
    applyEquipPhotosEditorGate(false);
    applyEquipPhotosEditorGate(false);

    const cta = document.querySelector('#eq-photos-locked [data-action="eq-photos-upsell-cta"]');
    cta.click();
    await new Promise((r) => setTimeout(r, 0));

    const clickCalls = trackEvent.mock.calls.filter(([name]) => name === 'photo_upsell_clicked');
    expect(clickCalls.length).toBe(1);
  });
});

describe('applyEquipPhotosEditorGate — guards', () => {
  it('não quebra quando o block não existe no DOM', async () => {
    document.body.innerHTML = '';
    const { applyEquipPhotosEditorGate } = await import('../ui/views/equipamentos.js');

    expect(() => applyEquipPhotosEditorGate(false)).not.toThrow();
    expect(() => applyEquipPhotosEditorGate(true)).not.toThrow();
  });
});

// ── openEquipPhotosEditor ───────────────────────────────────────────────────

describe('openEquipPhotosEditor — fluxo feliz Plus+', () => {
  it('configura o EquipmentPhotos com os IDs do novo modal', async () => {
    findEquip.mockReturnValue({
      id: 'eq-1',
      nome: 'Freezer',
      fotos: [{ url: 'https://x/a.jpg' }],
    });
    const { openEquipPhotosEditor } = await import('../ui/views/equipamentos.js');

    await openEquipPhotosEditor('eq-1');

    expect(photosConfigure).toHaveBeenCalledTimes(1);
    const configArg = photosConfigure.mock.calls[0][0];
    expect(configArg).toMatchObject({
      previewId: 'eq-photos-preview',
      dropTextId: 'eq-photos-drop-text',
      dropZoneId: 'eq-photos-drop-zone',
    });
  });

  it('carrega fotos existentes via setExisting', async () => {
    const fotos = [{ url: 'https://x/a.jpg' }, { url: 'https://x/b.jpg' }];
    findEquip.mockReturnValue({ id: 'eq-1', fotos });
    const { openEquipPhotosEditor } = await import('../ui/views/equipamentos.js');

    await openEquipPhotosEditor('eq-1');

    expect(photosSetExisting).toHaveBeenCalledTimes(1);
    const arg = photosSetExisting.mock.calls[0][0];
    // normalizePhotoList mock preserva itens com url/path
    expect(arg.length).toBe(2);
  });

  it('abre o modal-eq-photos', async () => {
    findEquip.mockReturnValue({ id: 'eq-1', fotos: [] });
    const { openEquipPhotosEditor } = await import('../ui/views/equipamentos.js');

    await openEquipPhotosEditor('eq-1');

    expect(modalOpen).toHaveBeenCalledWith('modal-eq-photos');
  });

  it('aplica o gate sync inicial com o estado do cache', async () => {
    isCachedPlanPlusOrHigher.mockReturnValue(true);
    findEquip.mockReturnValue({ id: 'eq-1', fotos: [] });
    const { openEquipPhotosEditor } = await import('../ui/views/equipamentos.js');

    await openEquipPhotosEditor('eq-1');

    // Gate Plus+: block sem locked, upsell hidden
    const block = document.getElementById('eq-photos-block');
    expect(block.classList.contains('equip-photo-block--locked')).toBe(false);
  });

  it('memoriza o equipId em edição (getEditingPhotosEquipId retorna o id)', async () => {
    findEquip.mockReturnValue({ id: 'eq-42', fotos: [] });
    const { openEquipPhotosEditor, getEditingPhotosEquipId } =
      await import('../ui/views/equipamentos.js');

    await openEquipPhotosEditor('eq-42');

    expect(getEditingPhotosEquipId()).toBe('eq-42');
  });
});

describe('openEquipPhotosEditor — guards', () => {
  it('aborta com toast quando o equipamento não existe', async () => {
    findEquip.mockReturnValue(null);
    const { openEquipPhotosEditor } = await import('../ui/views/equipamentos.js');

    await openEquipPhotosEditor('nope');

    expect(toastError).toHaveBeenCalled();
    expect(modalOpen).not.toHaveBeenCalled();
    expect(photosConfigure).not.toHaveBeenCalled();
  });
});

// ── saveEquipPhotos ─────────────────────────────────────────────────────────

describe('saveEquipPhotos — Plus+ (upload + update narrow)', () => {
  it('faz upload das pending, atualiza só o campo fotos via setState e dispara telemetria', async () => {
    const fotosUploaded = [{ url: 'https://x/a.jpg', path: 'a' }];
    photosGetAll.mockReturnValueOnce([{ dataUrl: 'data:image/jpeg;base64,xxx' }]);
    uploadPendingPhotos.mockResolvedValueOnce({
      photos: fotosUploaded,
      uploadedCount: 1,
      failedCount: 0,
    });
    findEquip.mockReturnValue({ id: 'eq-1', fotos: [] });

    const { openEquipPhotosEditor, saveEquipPhotos } = await import('../ui/views/equipamentos.js');
    await openEquipPhotosEditor('eq-1');

    const ok = await saveEquipPhotos();

    expect(ok).toBe(true);
    expect(uploadPendingPhotos).toHaveBeenCalledTimes(1);
    expect(setState).toHaveBeenCalledTimes(1);

    // setState recebe uma função (update narrow). Invoca com prev fake e
    // verifica que só mexe em equipamentos[*].fotos.
    const updater = setState.mock.calls[0][0];
    const prev = {
      equipamentos: [{ id: 'eq-1', nome: 'Freezer', fotos: [] }],
      registros: [{ id: 'r1' }],
      setores: [{ id: 's1' }],
    };
    const next = updater(prev);
    expect(next.equipamentos[0].fotos).toEqual(fotosUploaded);
    expect(next.equipamentos[0].nome).toBe('Freezer'); // preserva outros campos
    expect(next.registros).toBe(prev.registros); // outras coleções intactas
    expect(next.setores).toBe(prev.setores);

    expect(trackEvent).toHaveBeenCalledWith('equip_photos_saved', {
      equipId: 'eq-1',
      count: 1,
      source: 'equip_detail',
    });
  });

  it('fecha o modal e reseta targets depois de salvar', async () => {
    photosGetAll.mockReturnValue([]);
    uploadPendingPhotos.mockResolvedValue({ photos: [], uploadedCount: 0, failedCount: 0 });
    findEquip.mockReturnValue({ id: 'eq-1', fotos: [] });

    const { openEquipPhotosEditor, saveEquipPhotos } = await import('../ui/views/equipamentos.js');
    await openEquipPhotosEditor('eq-1');

    modalClose.mockClear();
    photosResetTargets.mockClear();

    await saveEquipPhotos();

    expect(modalClose).toHaveBeenCalledWith('modal-eq-photos');
    expect(photosResetTargets).toHaveBeenCalledTimes(1);
    // Re-render do detail view é chamado via viewEquip do próprio módulo
    // (não de equipDetail.js). O importante aqui é que o fluxo de save
    // completa sem throw — a verificação do avatar atualizado é
    // responsabilidade do teste do viewEquip, não deste.
  });

  it('limpa _editingPhotosEquipId após salvar', async () => {
    photosGetAll.mockReturnValue([]);
    uploadPendingPhotos.mockResolvedValue({ photos: [], uploadedCount: 0, failedCount: 0 });
    findEquip.mockReturnValue({ id: 'eq-1', fotos: [] });

    const { openEquipPhotosEditor, saveEquipPhotos, getEditingPhotosEquipId } =
      await import('../ui/views/equipamentos.js');
    await openEquipPhotosEditor('eq-1');
    expect(getEditingPhotosEquipId()).toBe('eq-1');

    await saveEquipPhotos();
    expect(getEditingPhotosEquipId()).toBe(null);
  });
});

describe('saveEquipPhotos — Free (gate runtime bloqueia upload)', () => {
  it('descarta pending e dispara telemetria photo_upload_blocked_non_plus', async () => {
    isCachedPlanPlusOrHigher.mockReturnValue(false);
    photosState.pending = [{ dataUrl: 'data:image/jpeg;base64,xxx' }];
    photosState.existing = [{ url: 'https://x/keep.jpg' }];
    findEquip.mockReturnValue({ id: 'eq-1', fotos: [{ url: 'https://x/keep.jpg' }] });

    const { openEquipPhotosEditor, saveEquipPhotos } = await import('../ui/views/equipamentos.js');
    await openEquipPhotosEditor('eq-1');

    // Depois que openEquipPhotosEditor aplicou o gate Free, restauramos
    // o flag pra simular o runtime gate do saveEquipPhotos.
    isCachedPlanPlusOrHigher.mockReturnValue(false);

    await saveEquipPhotos();

    expect(uploadPendingPhotos).not.toHaveBeenCalled();
    expect(trackEvent).toHaveBeenCalledWith('photo_upload_blocked_non_plus', {
      equipId: 'eq-1',
      pendingCount: 1,
      source: 'equip_detail',
    });
    // As existing permanecem (normalizePhotoList filtra itens válidos).
    const updater = setState.mock.calls[0][0];
    const next = updater({ equipamentos: [{ id: 'eq-1', fotos: [] }] });
    expect(next.equipamentos[0].fotos.length).toBe(1);
  });
});

describe('saveEquipPhotos — guards', () => {
  it('aborta quando não há equipamento em edição', async () => {
    const { saveEquipPhotos } = await import('../ui/views/equipamentos.js');

    const ok = await saveEquipPhotos();

    expect(ok).toBe(false);
    expect(toastError).toHaveBeenCalled();
    expect(uploadPendingPhotos).not.toHaveBeenCalled();
    expect(setState).not.toHaveBeenCalled();
  });

  it('aborta quando o equipamento foi deletado entre abrir e salvar', async () => {
    findEquip.mockReturnValueOnce({ id: 'eq-1', fotos: [] }); // open
    findEquip.mockReturnValueOnce(null); // save

    const { openEquipPhotosEditor, saveEquipPhotos } = await import('../ui/views/equipamentos.js');
    await openEquipPhotosEditor('eq-1');

    const ok = await saveEquipPhotos();

    expect(ok).toBe(false);
    expect(toastError).toHaveBeenCalled();
    expect(setState).not.toHaveBeenCalled();
  });
});

// ── clearEquipPhotosEditingState ────────────────────────────────────────────

describe('clearEquipPhotosEditingState', () => {
  it('limpa o equipId em edição e reseta o componente', async () => {
    findEquip.mockReturnValue({ id: 'eq-1', fotos: [] });
    const { openEquipPhotosEditor, clearEquipPhotosEditingState, getEditingPhotosEquipId } =
      await import('../ui/views/equipamentos.js');

    await openEquipPhotosEditor('eq-1');
    expect(getEditingPhotosEquipId()).toBe('eq-1');

    clearEquipPhotosEditingState();
    expect(getEditingPhotosEquipId()).toBe(null);
    expect(photosClear).toHaveBeenCalled();
    expect(photosResetTargets).toHaveBeenCalled();
  });

  it('não quebra se nunca houve edição', async () => {
    const { clearEquipPhotosEditingState } = await import('../ui/views/equipamentos.js');
    expect(() => clearEquipPhotosEditingState()).not.toThrow();
  });
});
