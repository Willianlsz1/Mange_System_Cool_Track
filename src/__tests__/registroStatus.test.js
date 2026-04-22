import { reconcileEquipmentStatusesAfterRegistroEdit } from '../domain/registroStatus.js';

describe('reconcileEquipmentStatusesAfterRegistroEdit', () => {
  it('recalcula status dos dois equipamentos quando registro é movido entre equipamentos', () => {
    const equipamentos = [
      { id: 'eq-a', status: 'danger', statusDescricao: 'Crítico' },
      { id: 'eq-b', status: 'ok', statusDescricao: 'Operando normalmente' },
    ];

    const previousRegistro = {
      id: 'reg-1',
      equipId: 'eq-a',
      data: '2026-04-10T10:00',
      status: 'danger',
    };

    const registros = [
      {
        id: 'reg-1',
        equipId: 'eq-b',
        data: '2026-04-20T10:00',
        status: 'warn',
      },
      {
        id: 'reg-old-a',
        equipId: 'eq-a',
        data: '2026-04-05T10:00',
        status: 'ok',
      },
    ];

    const updated = reconcileEquipmentStatusesAfterRegistroEdit({
      equipamentos,
      registros,
      previousRegistro,
      updatedRegistro: registros[0],
    });

    const eqA = updated.find((equip) => equip.id === 'eq-a');
    const eqB = updated.find((equip) => equip.id === 'eq-b');

    expect(eqA.status).toBe('ok');
    expect(eqB.status).toBe('warn');
  });

  it('mantém equipamento intacto quando não há histórico remanescente para recalcular', () => {
    const equipamentos = [{ id: 'eq-a', status: 'warn', statusDescricao: 'Em atenção' }];

    const updated = reconcileEquipmentStatusesAfterRegistroEdit({
      equipamentos,
      registros: [],
      previousRegistro: { id: 'reg-1', equipId: 'eq-a' },
      updatedRegistro: { id: 'reg-1', equipId: 'eq-b', status: 'ok', data: '2026-04-10T10:00' },
    });

    expect(updated[0]).toEqual(equipamentos[0]);
  });
});
