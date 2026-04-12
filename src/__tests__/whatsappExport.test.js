const getStateMock = vi.fn();
const findEquipMock = vi.fn();
const profileGetMock = vi.fn();

vi.mock('../core/state.js', () => ({
  getState: () => getStateMock(),
  findEquip: (...args) => findEquipMock(...args),
}));

vi.mock('../features/profile.js', () => ({
  Profile: {
    get: () => profileGetMock(),
  },
}));

import { WhatsAppExport } from '../domain/whatsapp.js';

describe('WhatsAppExport', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    getStateMock.mockReturnValue({
      registros: [
        {
          id: 'r1',
          equipId: 'eq-1',
          status: 'ok',
          tipo: 'Preventiva',
          tecnico: 'Ana',
          data: '2026-04-01T10:00',
        },
      ],
    });
    findEquipMock.mockReturnValue({ nome: 'Split Sala 1', tag: 'AC-01' });
    profileGetMock.mockReturnValue({ nome: 'Carlos', empresa: 'Frio Sul' });
  });

  it('inclui footer viral ao gerar texto', () => {
    const text = WhatsAppExport.generateText();

    expect(text).toContain('---');
    expect(text).toContain('Relatório gerado por CoolTrack Pro');
    expect(text).toContain('Gestão de manutenção para técnicos HVAC');
    expect(text).toContain('cooltrackpro.com.br');
  });

  it('mantem envio por wa.me com texto codificado', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    const ok = WhatsAppExport.send();

    expect(ok).toBe(true);
    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy.mock.calls[0][0]).toContain('https://wa.me/?text=');
  });
});
