/**
 * CoolTrack Pro - Dashboard / constants
 *
 * Re-exporta constantes canônicas do domain. Antes da consolidação (Phase 1
 * do refactor), STATUS_OPERACIONAL, PRIORIDADE_LABEL e RISK_CLASS_LABEL
 * viviam duplicados aqui e em equipamentos/constants.js. Source of truth
 * agora é `domain/constants/statuses.js`.
 *
 * ALERT_SEVERITY_WEIGHT continua em `domain/constants/alerts.js`, re-exportado
 * aqui para preservar a API pública deste módulo.
 */

export { ALERT_SEVERITY_WEIGHT } from '../../../domain/constants/alerts.js';

export {
  STATUS_OPERACIONAL,
  PRIORIDADE_LABEL,
  RISK_CLASS_LABEL,
} from '../../../domain/constants/statuses.js';
