import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ───────────────────────────────────────────────────────────────────
// trackEvent + goTo são o que a gate chama e o que os asserts olham —
// espelhamos com vi.fn pra inspecionar as chamadas.
const trackEvent = vi.fn();
const goTo = vi.fn();
vi.mock('../core/telemetry.js', () => ({
  trackEvent,
  TELEMETRY_EVENT: 'cooltrack:telemetry',
}));
vi.mock('../core/router.js', () => ({
  goTo,
}));

// EquipmentPhotos.clear é chamado no caminho Free (defense in depth contra
// fotos "fantasma" após downgrade). Queremos confirmar sem executar o real.
const photosClear = vi.fn();
vi.mock('../ui/components/equipmentPhotos.js', () => ({
  EquipmentPhotos: {
    clear: photosClear,
    setExisting: vi.fn(),
    pending: [],
    existing: [],
    getAll: vi.fn(() => []),
  },
  MAX_EQUIP_PHOTOS: 3,
}));

// Mocks derivados do padrão de equipamentosView.hero.test.js — o módulo
// equipamentos.js é grande e arrasta dashboard/state/etc pro bundle de
// teste. Mockamos os heavy imports com stubs no-op.
vi.mock('../core/state.js', () => ({
  getState: vi.fn(() => ({ equipamentos: [], registros: [], setores: [] })),
  regsForEquip: vi.fn(() => []),
  findEquip: vi.fn(),
  findSetor: vi.fn(),
  setState: vi.fn(),
}));

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

// DOM minimal: só os 3 IDs que applyEquipPhotosGate toca + o CTA interno.
// Isto espelha o que modals.js renderiza. Qualquer drift no markup quebra
// este teste — que é exatamente o efeito desejado.
function mountPhotosDom() {
  document.body.innerHTML = `
    <section id="eq-fotos-wrapper" style="display:none">
      <div class="equip-photo-block" id="equip-photo-block">
        <div id="equip-photo-drop-zone"></div>
        <div class="equip-photo-locked" id="equip-photo-locked" hidden>
          <button type="button" class="equip-photo-locked__cta"
            data-action="photos-upsell-cta">
            Desbloquear com Plus →
          </button>
        </div>
      </div>
    </section>
  `;
}

beforeEach(() => {
  vi.clearAllMocks();
  mountPhotosDom();
});

describe('applyEquipPhotosGate — Plus+/Pro (acesso liberado)', () => {
  it('remove a classe locked do block e esconde o upsell', async () => {
    const { applyEquipPhotosGate } = await import('../ui/views/equipamentos.js');
    applyEquipPhotosGate(true);

    const block = document.getElementById('equip-photo-block');
    const locked = document.getElementById('equip-photo-locked');
    expect(block.classList.contains('equip-photo-block--locked')).toBe(false);
    expect(locked.hasAttribute('hidden')).toBe(true);
  });

  it('mantém o wrapper visível (style.display é limpado)', async () => {
    const { applyEquipPhotosGate } = await import('../ui/views/equipamentos.js');
    applyEquipPhotosGate(true);

    const wrapper = document.getElementById('eq-fotos-wrapper');
    // `style.display = ''` remove o inline style; no jsdom isso vira string vazia
    expect(wrapper.style.display).toBe('');
  });

  it('NÃO dispara telemetria de upsell', async () => {
    const { applyEquipPhotosGate } = await import('../ui/views/equipamentos.js');
    applyEquipPhotosGate(true);

    expect(trackEvent).not.toHaveBeenCalled();
  });
});

describe('applyEquipPhotosGate — Free (upsell visível)', () => {
  it('aplica a classe locked no block e mostra o upsell', async () => {
    const { applyEquipPhotosGate } = await import('../ui/views/equipamentos.js');
    applyEquipPhotosGate(false);

    const block = document.getElementById('equip-photo-block');
    const locked = document.getElementById('equip-photo-locked');
    expect(block.classList.contains('equip-photo-block--locked')).toBe(true);
    expect(locked.hasAttribute('hidden')).toBe(false);
  });

  it('chama EquipmentPhotos.clear pra defesa em profundidade após downgrade', async () => {
    const { applyEquipPhotosGate } = await import('../ui/views/equipamentos.js');
    applyEquipPhotosGate(false);

    expect(photosClear).toHaveBeenCalledTimes(1);
  });

  it('dispara photo_upsell_shown exatamente uma vez por abertura do modal', async () => {
    const { applyEquipPhotosGate } = await import('../ui/views/equipamentos.js');

    // Primeira abertura: dispara
    applyEquipPhotosGate(false);
    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith('photo_upsell_shown', { source: 'equip_modal' });

    // Re-render no mesmo ciclo (ex.: outro refresh de gate) não deve disparar
    // de novo — evita inflação de métricas. O flag vive no wrapper.dataset.
    applyEquipPhotosGate(false);
    expect(trackEvent).toHaveBeenCalledTimes(1);
  });

  it('re-dispara photo_upsell_shown quando o flag do wrapper é limpo', async () => {
    // Navigation handler limpa wrapper.dataset.upsellShown em cada open-modal.
    // Simulamos isso aqui: após clear, a próxima chamada deve re-disparar.
    const { applyEquipPhotosGate } = await import('../ui/views/equipamentos.js');

    applyEquipPhotosGate(false);
    expect(trackEvent).toHaveBeenCalledTimes(1);

    const wrapper = document.getElementById('eq-fotos-wrapper');
    delete wrapper.dataset.upsellShown;

    applyEquipPhotosGate(false);
    expect(trackEvent).toHaveBeenCalledTimes(2);
  });

  it('clique no CTA dispara photo_upsell_clicked e navega pro pricing', async () => {
    const { applyEquipPhotosGate } = await import('../ui/views/equipamentos.js');
    applyEquipPhotosGate(false);

    const cta = document.querySelector('#equip-photo-locked [data-action="photos-upsell-cta"]');
    expect(cta).not.toBeNull();
    cta.click();

    expect(trackEvent).toHaveBeenCalledWith('photo_upsell_clicked', { source: 'equip_modal' });
    expect(goTo).toHaveBeenCalledWith('pricing', {
      highlightPlan: 'plus',
      reason: 'photos_upsell',
    });
  });

  it('não stacka listeners no CTA se applyEquipPhotosGate rodar múltiplas vezes', async () => {
    const { applyEquipPhotosGate } = await import('../ui/views/equipamentos.js');

    applyEquipPhotosGate(false);
    applyEquipPhotosGate(false);
    applyEquipPhotosGate(false);

    const cta = document.querySelector('#equip-photo-locked [data-action="photos-upsell-cta"]');
    cta.click();

    // Se tivesse stack de 3 listeners, photo_upsell_clicked teria sido
    // chamado 3 vezes. O dataset.upsellBound idempotente garante uma só.
    const clickCalls = trackEvent.mock.calls.filter(
      ([eventName]) => eventName === 'photo_upsell_clicked',
    );
    expect(clickCalls.length).toBe(1);
  });
});

describe('applyEquipPhotosGate — transições de plano', () => {
  it('Plus → Free: adiciona locked e limpa photos', async () => {
    const { applyEquipPhotosGate } = await import('../ui/views/equipamentos.js');

    // Começa Plus
    applyEquipPhotosGate(true);
    const block = document.getElementById('equip-photo-block');
    expect(block.classList.contains('equip-photo-block--locked')).toBe(false);
    expect(photosClear).not.toHaveBeenCalled();

    // Downgrade pra Free
    applyEquipPhotosGate(false);
    expect(block.classList.contains('equip-photo-block--locked')).toBe(true);
    expect(photosClear).toHaveBeenCalledTimes(1);
  });

  it('Free → Plus: remove locked e esconde upsell', async () => {
    const { applyEquipPhotosGate } = await import('../ui/views/equipamentos.js');

    // Começa Free
    applyEquipPhotosGate(false);
    const block = document.getElementById('equip-photo-block');
    const locked = document.getElementById('equip-photo-locked');
    expect(block.classList.contains('equip-photo-block--locked')).toBe(true);
    expect(locked.hasAttribute('hidden')).toBe(false);

    // Upgrade pra Plus — dropzone volta ao normal
    applyEquipPhotosGate(true);
    expect(block.classList.contains('equip-photo-block--locked')).toBe(false);
    expect(locked.hasAttribute('hidden')).toBe(true);
  });
});

describe('applyEquipPhotosGate — guards', () => {
  it('não quebra quando o wrapper não está no DOM', async () => {
    document.body.innerHTML = ''; // remove tudo
    const { applyEquipPhotosGate } = await import('../ui/views/equipamentos.js');

    // Não deve lançar — a função faz early-return se o wrapper não existe.
    expect(() => applyEquipPhotosGate(false)).not.toThrow();
    expect(trackEvent).not.toHaveBeenCalled();
  });
});
