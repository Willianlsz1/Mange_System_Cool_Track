import { queueEvent } from './telemetrySink.js';

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

  // Enfileira pro sink externo — try/catch pra garantir que telemetria nunca
  // quebra o app. No-op se initTelemetrySink() ainda não foi chamado.
  try {
    queueEvent(detail);
  } catch (err) {
    if (import.meta.env?.DEV) {
      console.warn('[telemetry] queueEvent falhou (silenciado):', err);
    }
  }

  if (import.meta.env?.DEV) {
    console.log('[CoolTrack Telemetry]', eventName, data);
  }
}

export { TELEMETRY_EVENT };
