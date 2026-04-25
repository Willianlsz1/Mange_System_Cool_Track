/**
 * CoolTrack Pro - Equipamentos / constants
 *
 * Constantes especificas dos cards/modais de equipamento. Os 3 mapas de
 * status, prioridade e risco vivem em domain/constants/statuses.js
 * (Phase 1 do refactor) e sao apenas re-exportados aqui para preservar
 * a API deste modulo. Nao duplicar localmente.
 *
 * Mantidos locais (sao especificos deste contexto):
 *   - CONDICAO_OBSERVADA: rotulo de condicao visual durante inspecao,
 *     usa chave extra "unknown" que nao existe nos outros mapas.
 *   - STATUS_LABEL: variante curta ("Normal/Atencao/Critico") usada
 *     onde o texto longo de STATUS_OPERACIONAL nao cabe. Identica a
 *     versao em core/utils.js -- Phase 1.1 vai consolidar.
 *   - SETOR_CORES: paleta visual de setores, escopo apenas da view.
 */

export {
  STATUS_OPERACIONAL,
  PRIORIDADE_LABEL,
  RISK_CLASS_LABEL,
} from '../../../domain/constants/statuses.js';

export const CONDICAO_OBSERVADA = {
  ok: 'Sem anormalidades',
  warn: 'Condição fora do padrão',
  danger: 'Intervenção necessária',
  unknown: 'Não avaliado',
};

export const STATUS_LABEL = { ok: 'Normal', warn: 'Atenção', danger: 'Crítico' };

export const SETOR_CORES = ['#00c8e8', '#00c853', '#ffab40', '#ff5252', '#7c4dff', '#448aff'];
