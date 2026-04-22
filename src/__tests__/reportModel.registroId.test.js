import { filterRegistrosForReport } from '../domain/pdf/reportModel.js';

describe('filterRegistrosForReport - registroId precedence', () => {
  it('prioriza registroId e ignora filtros antigos da aba relatório', () => {
    const registros = [
      { id: 'r-old-1', equipId: 'eq-1', data: '2026-04-10T10:00' },
      { id: 'r-old-2', equipId: 'eq-1', data: '2026-04-11T10:00' },
      { id: 'r-new', equipId: 'eq-2', data: '2026-04-12T10:00' },
    ];

    const filtered = filterRegistrosForReport(registros, {
      registroId: 'r-new',
      // simulando contexto antigo da aba relatório
      filtEq: 'eq-1',
      de: '2026-04-01',
      ate: '2026-04-30',
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('r-new');
  });

  it('retorna somente o registro alvo quando registroId e filtros são coerentes', () => {
    const registros = [
      { id: 'r-old-1', equipId: 'eq-1', data: '2026-04-10T10:00' },
      { id: 'r-new', equipId: 'eq-2', data: '2026-04-12T10:00' },
    ];

    const filtered = filterRegistrosForReport(registros, {
      registroId: 'r-new',
      filtEq: 'eq-2',
      de: '2026-04-01',
      ate: '2026-04-30',
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('r-new');
  });
});
