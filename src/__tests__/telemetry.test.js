import { TELEMETRY_EVENT, trackEvent } from '../core/telemetry.js';

describe('telemetry', () => {
  beforeEach(() => {
    window.__cooltrackEvents = [];
  });

  it('acumula eventos no buffer global e despacha evento local', () => {
    const listener = vi.fn();
    window.addEventListener(TELEMETRY_EVENT, listener);

    trackEvent('evt_a', { a: 1 });

    expect(window.__cooltrackEvents).toHaveLength(1);
    expect(window.__cooltrackEvents[0].name).toBe('evt_a');
    expect(window.__cooltrackEvents[0].payload).toEqual({ a: 1 });
    expect(listener).toHaveBeenCalledTimes(1);

    window.removeEventListener(TELEMETRY_EVENT, listener);
  });
});
