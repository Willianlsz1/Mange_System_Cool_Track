vi.mock('../core/state.js', () => ({
  getState: vi.fn(),
}));

import { Alerts } from '../domain/alerts.js';
import { getState } from '../core/state.js';

describe('Alerts.getAll', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-07T12:00:00Z'));
    vi.mocked(getState).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns overdue and upcoming alerts using earliest due date per equipment', () => {
    vi.mocked(getState).mockReturnValue({
      equipamentos: [
        { id: 'eq-1', status: 'ok' },
        { id: 'eq-2', status: 'ok' },
      ],
      registros: [
        { id: 'r-old', equipId: 'eq-1', proxima: '2026-04-05' },
        { id: 'r-new', equipId: 'eq-1', proxima: '2026-04-10' },
        { id: 'r-upcoming', equipId: 'eq-2', proxima: '2026-04-14' },
      ],
    });

    const alerts = Alerts.getAll();

    expect(alerts).toEqual(
      expect.arrayContaining([
        { kind: 'overdue', reg: expect.objectContaining({ id: 'r-old' }) },
        { kind: 'upcoming', reg: expect.objectContaining({ id: 'r-upcoming' }) },
      ]),
    );

    const eq1Alerts = alerts.filter((a) => a.reg?.equipId === 'eq-1');
    expect(eq1Alerts).toHaveLength(1);
  });

  it('ignores invalid or missing proxima dates and includes critical equipment', () => {
    const dangerEq = { id: 'eq-danger', status: 'danger' };

    vi.mocked(getState).mockReturnValue({
      equipamentos: [dangerEq, { id: 'eq-ok', status: 'ok' }],
      registros: [
        { id: 'r-missing', equipId: 'eq-ok' },
        { id: 'r-invalid', equipId: 'eq-ok', proxima: 'not-a-date' },
      ],
    });

    const alerts = Alerts.getAll();

    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toEqual({ kind: 'critical', eq: dangerEq });
  });

  it('includes due-today and due-in-7-days as upcoming edge cases', () => {
    vi.mocked(getState).mockReturnValue({
      equipamentos: [
        { id: 'eq-1', status: 'ok' },
        { id: 'eq-2', status: 'ok' },
        { id: 'eq-3', status: 'ok' },
      ],
      registros: [
        { id: 'today', equipId: 'eq-1', proxima: '2026-04-07' },
        { id: 'in7', equipId: 'eq-2', proxima: '2026-04-14' },
        { id: 'in8', equipId: 'eq-3', proxima: '2026-04-15' },
      ],
    });

    const alerts = Alerts.getAll();
    const upcomingIds = alerts.filter((a) => a.kind === 'upcoming').map((a) => a.reg.id);

    expect(upcomingIds).toEqual(expect.arrayContaining(['today', 'in7']));
    expect(upcomingIds).not.toContain('in8');
  });
});
