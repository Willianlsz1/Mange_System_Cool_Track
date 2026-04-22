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

import { __testables, WhatsAppExport } from '../domain/whatsapp.js';

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

  it('gera mensagem curta e profissional para cliente', () => {
    const text = WhatsAppExport.generateText();

    expect(text).toContain('Olá! Segue o resumo da manutenção');
    expect(text).toContain('equipamento Split Sala 1');
    expect(text).toContain('Serviço: Preventiva.');
    expect(text).toContain('Qualquer dúvida, estou à disposição.');
    expect(text).toContain('Atenciosamente,');
  });

  it('resume múltiplos registros sem listar item a item', () => {
    getStateMock.mockReturnValueOnce({
      registros: [
        {
          id: 'r1',
          equipId: 'eq-1',
          status: 'ok',
          tipo: 'Limpeza de filtros',
          tecnico: 'Ana',
          data: '2026-04-01T10:00',
        },
        {
          id: 'r2',
          equipId: 'eq-1',
          status: 'ok',
          tipo: 'Inspeção geral',
          tecnico: 'Ana',
          data: '2026-04-01T09:00',
        },
      ],
    });

    const text = WhatsAppExport.generateText({ filtEq: 'eq-1' });

    expect(text).toContain('Foram registrados 2 atendimentos no período.');
    expect(text).toContain('Principais serviços: Limpeza de filtros e Inspeção geral.');
    expect(text).not.toContain('\n1. ');
  });

  it('mantem envio por wa.me com texto codificado', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    const ok = WhatsAppExport.send();

    expect(ok).toBe(true);
    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy.mock.calls[0][0]).toContain('https://wa.me/?text=');
  });

  it('classifica tipos conhecidos com fallback', () => {
    expect(__testables.classifyService('Carga de gás refrigerante')).toBe('carga_gas');
    expect(__testables.classifyService('Serviço customizado')).toBe('outros');
  });

  it('prioriza registroId no pós-save e ignora filtros antigos', () => {
    getStateMock.mockReturnValueOnce({
      registros: [
        {
          id: 'r-old',
          equipId: 'eq-1',
          status: 'ok',
          tipo: 'Preventiva',
          tecnico: 'Ana',
          data: '2026-04-01T10:00',
        },
        {
          id: 'r-new',
          equipId: 'eq-2',
          status: 'ok',
          tipo: 'Corretiva',
          tecnico: 'Ana',
          data: '2026-04-02T10:00',
        },
      ],
    });
    findEquipMock.mockImplementation((id) => ({ nome: id === 'eq-2' ? 'Split B' : 'Split A' }));

    const text = WhatsAppExport.generateText({
      registroId: 'r-new',
      // filtro legado divergente da aba relatório
      filtEq: 'eq-1',
    });

    expect(text).toContain('equipamento Split B');
    expect(text).toContain('Serviço: Corretiva.');
  });
});
