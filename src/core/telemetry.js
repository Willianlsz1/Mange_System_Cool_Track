const TELEMETRY_EVENT = 'cooltrack:telemetry';

export function trackEvent(name, payload = {}) {
  const eventName = String(name || '').trim();
  if (!eventName) return;

  const detail = {
    name: eventName,
    payload: payload && typeof payload === 'object' ? payload : {},
    timestamp: new Date().toISOString(),
  };

  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent(TELEMETRY_EVENT, { detail }));
  }

  if (import.meta.env?.DEV) {
    console.info('[telemetry]', detail);
  }
}

export { TELEMETRY_EVENT };
