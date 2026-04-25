/**
 * CoolTrack Pro - Domain / Status constants (canonical)
 *
 * Source of truth para os 3 conjuntos de chaves de status usados em todo
 * o sistema. Antes desta consolidacao, STATUS_OPERACIONAL, PRIORIDADE_LABEL
 * e RISK_CLASS_LABEL viviam duplicados em ate 3 lugares (dashboard/constants,
 * equipamentos/constants, e tambem inline em ui/views/dashboard.js).
 *
 * Regra: NAO criar variantes locais destes 3 maps. Se o contexto pede um
 * label diferente (ex: REL_STATUS_LABEL em relatorio.js usa "Concluido" em
 * vez de "OPERANDO NORMALMENTE"), declarar uma constante claramente nomeada
 * no proprio modulo, com comentario explicando o porque da divergencia.
 *
 * Os arrays *_KEYS existem para validacao runtime e iteracao. Use-os no
 * lugar de listar chaves a mao.
 */

// ── Status operacional do equipamento (3 niveis) ─────────────────────
export const STATUS_KEYS = Object.freeze(['ok', 'warn', 'danger']);

export const STATUS_OPERACIONAL = Object.freeze({
  ok: 'OPERANDO NORMALMENTE',
  warn: 'OPERANDO COM RESTRIÇÕES',
  danger: 'FORA DE OPERAÇÃO',
});

// ── Prioridade / criticidade (4 niveis) ──────────────────────────────
export const PRIORIDADE_KEYS = Object.freeze(['baixa', 'media', 'alta', 'critica']);

export const PRIORIDADE_LABEL = Object.freeze({
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  critica: 'Crítica',
});

// ── Classificacao de risco (3 niveis) ────────────────────────────────
export const RISK_CLASS_KEYS = Object.freeze(['baixo', 'medio', 'alto']);

export const RISK_CLASS_LABEL = Object.freeze({
  baixo: 'Baixo risco',
  medio: 'Médio risco',
  alto: 'Alto risco',
});
