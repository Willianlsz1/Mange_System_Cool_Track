const TELEMETRY_EVENT = 'cooltrack:telemetry';

export function trackEvent(name, payload = {}) {
  const eventName = String(name || '').trim();
  if (!eventName) return;
  const data = payload && typeof payload === 'object' ? payload : {};

  const detail = {
    name: eventName,
    payload: data,
    timestamp: new Date().toISOString(),
  };

  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    if (!Array.isArray(window.__cooltrackEvents)) {
      window.__cooltrackEvents = [];
    }
    window.__cooltrackEvents.push(detail);
    window.dispatchEvent(new CustomEvent(TELEMETRY_EVENT, { detail }));
  }

  if (import.meta.env?.DEV) {
    console.log('[CoolTrack Telemetry]', eventName, data);
  }
}

export { TELEMETRY_EVENT };
