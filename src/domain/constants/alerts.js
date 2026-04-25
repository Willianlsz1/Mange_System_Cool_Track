/**
 * CoolTrack Pro - Alert constants (domain layer)
 *
 * Pesos de severidade usados para ordenar/priorizar alertas.
 * Centralizado aqui para evitar divergência entre `domain/maintenance.js`
 * e os módulos de dashboard.
 */

export const ALERT_SEVERITY_WEIGHT = { danger: 3, warn: 2, info: 1 };
