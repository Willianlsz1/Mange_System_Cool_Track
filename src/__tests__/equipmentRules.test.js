import {
  getOperationalStatus,
  getPriority,
  getSuggestedAction,
  getActionBucket,
  validateOperationalPayload,
} from '../core/equipmentRules.js';

describe('equipment rules (centralized)', () => {
  it('classifies danger and overdue preventive as critical', () => {
    expect(getOperationalStatus({ status: 'danger' }).code).toBe('critico');
    expect(getOperationalStatus({ status: 'ok', daysToNext: -1 }).code).toBe('critico');
  });

  it('keeps high priority coherent with immediate suggested action', () => {
    const equipamento = { status: 'danger', criticidade: 'alta', daysToNext: 2 };
    const priority = getPriority(equipamento);
    const action = getSuggestedAction(equipamento);

    expect(priority.level).toBe('alta');
    expect(priority.requiresImmediateAction).toBe(true);
    expect(action.requiresImmediateAction).toBe(true);
  });

  it('returns sem_informacao when no operational data exists', () => {
    const status = getOperationalStatus({});
    expect(status.code).toBe('sem_informacao');
    expect(getActionBucket({})).toBe('monitoramento');
  });

  it('validates future dates and invalid statuses', () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    expect(validateOperationalPayload({ data: future, status: 'ok' }).valid).toBe(false);
    expect(validateOperationalPayload({ data: '2026-01-01T10:00', status: 'invalid' }).valid).toBe(
      false,
    );
  });
});
