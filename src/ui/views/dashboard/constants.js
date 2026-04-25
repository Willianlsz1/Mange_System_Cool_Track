/**
 * CoolTrack Pro - Dashboard / constants
 * Rótulos e pesos usados pelos módulos de dashboard.
 *
 * Nota: ALERT_SEVERITY_WEIGHT vive em `domain/constants/alerts.js` e é
 * apenas re-exportado aqui para preservar a API pública deste módulo.
 */

export { ALERT_SEVERITY_WEIGHT } from '../../../domain/constants/alerts.js';

export const STATUS_OPERACIONAL = {
  ok: 'OPERANDO NORMALMENTE',
  warn: 'OPERANDO COM RESTRIÇÕES',
  danger: 'FORA DE OPERAÇÃO',
};

export const PRIORIDADE_LABEL = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  critica: 'Crítica',
};

export const RISK_CLASS_LABEL = {
  baixo: 'Baixo risco',
  medio: 'Médio risco',
  alto: 'Alto risco',
};
