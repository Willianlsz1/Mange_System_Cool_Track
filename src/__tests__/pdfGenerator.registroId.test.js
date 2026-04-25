import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  state: { registros: [], equipamentos: [] },
  save: vi.fn(),
  output: vi.fn(() => new Blob(['pdf'], { type: 'application/pdf' })),
  drawCover: vi.fn(),
  drawServices: vi.fn(async () => {}),
  drawSignaturePages: vi.fn(),
  stampFooterTotals: vi.fn(),
  drawWatermarkAllPages: vi.fn(),
  resolveSignatureForRecord: vi.fn(async () => null),
}));

vi.mock('jspdf', () => ({
  jsPDF: vi.fn(() => ({
    internal: {
      pageSize: {
        getWidth: () => 210,
        getHeight: () => 297,
      },
    },
    addPage: vi.fn(),
    output: mocks.output,
    save: mocks.save,
  })),
}));

vi.mock('../core/state.js', () => ({
  getState: () => mocks.state,
}));

vi.mock('../features/profile.js', () => ({
  Profile: { get: () => ({ empresa: 'Acme HVAC' }) },
}));

vi.mock('../ui/components/signature.js', () => ({
  resolveSignatureForRecord: mocks.resolveSignatureForRecord,
}));

vi.mock('../domain/pdf/primitives.js', () => ({
  drawWatermarkAllPages: mocks.drawWatermarkAllPages,
}));

vi.mock('../domain/pdf/sections/cover.js', () => ({
  drawCover: mocks.drawCover,
}));

vi.mock('../domain/pdf/sections/footer.js', () => ({
  stampFooterTotals: mocks.stampFooterTotals,
}));

vi.mock('../domain/pdf/sections/services.js', () => ({
  drawServices: mocks.drawServices,
}));

vi.mock('../domain/pdf/sections/signatures.js', () => ({
  drawSignaturePages: mocks.drawSignaturePages,
}));

describe('PDFGenerator - registroId filter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mocks.state.registros = [
      { id: 'r-old', equipId: 'eq-1', data: '2026-04-10T10:00' },
      { id: 'r-target', equipId: 'eq-2', data: '2026-04-12T10:00' },
    ];
    mocks.state.equipamentos = [{ id: 'eq-1' }, { id: 'eq-2' }];
  });

  it('prioriza registroId ao gerar PDF em vez de reutilizar filtros antigos', async () => {
    const { PDFGenerator } = await import('../domain/pdf.js');

    const result = await PDFGenerator.generateMaintenanceReport(
      {
        registroId: 'r-target',
        filtEq: 'eq-1',
        de: '2026-04-01',
        ate: '2026-04-30',
        asBlob: true,
      },
      { planCode: 'pro' },
    );

    expect(result).toEqual({
      fileName: expect.stringMatching(/^CoolTrack_Acme_HVAC_\d{4}-\d{2}-\d{2}\.pdf$/),
      blob: expect.any(Blob),
    });
    expect(mocks.drawServices).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      [expect.objectContaining({ id: 'r-target' })],
      mocks.state.equipamentos,
      expect.any(Object),
      null,
      expect.any(Object),
    );
    expect(mocks.drawServices.mock.calls[0][4]).toHaveLength(1);
  });
});
