const VALID_STATUS = new Set(['ok', 'warn', 'danger']);
import { SETOR_NOME_MAX } from './setorRules.js';

export const EQUIPMENT_FIELD_LIMITS = Object.freeze({
  nome: 120,
  local: 160,
  tag: 40,
  modelo: 120,
});

export const REGISTRO_FIELD_LIMITS = Object.freeze({
  tipo: 120,
  obs: 2000,
  pecas: 800,
  tecnico: 120,
  // Dados do cliente — opcionais. Vão para a capa do PDF (bloco CLIENTE/LOCAL)
  // e para a página de assinatura (nome + documento).
  clienteNome: 200,
  clienteDocumento: 30,
  localAtendimento: 300,
  clienteContato: 120,
});

function normalizeInlineText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeMultilineText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/\r\n?/g, '\n')
    .replace(/[^\S\n]+/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim();
}

function validateTextField({ name, value, required = false, maxLength, multiline = false }) {
  const normalized = multiline ? normalizeMultilineText(value) : normalizeInlineText(value);

  if (required && !normalized) {
    return { value: normalized, error: `Campo obrigatório: ${name}.` };
  }

  if (normalized.length > maxLength) {
    return {
      value: normalized,
      error: `${name} excede o limite de ${maxLength} caracteres.`,
    };
  }

  return { value: normalized, error: null };
}

function parseCost(value, fieldName) {
  const normalized = String(value ?? '').trim();
  if (!normalized) return { value: 0, error: null };

  const parsed = Number.parseFloat(normalized.replace(',', '.'));
  if (!Number.isFinite(parsed) || parsed < 0) {
    return { value: 0, error: `${fieldName} inválido.` };
  }

  return { value: parsed, error: null };
}

function normalizeTag(value) {
  return normalizeInlineText(value).toUpperCase();
}

function hasDuplicateTag(tag, existingEquipamentos = [], editingId = null) {
  if (!tag) return false;

  return existingEquipamentos.some((equipamento) => {
    if (!equipamento || typeof equipamento !== 'object') return false;
    if (editingId && String(equipamento.id || '') === String(editingId)) return false;
    return normalizeTag(equipamento.tag) === tag;
  });
}

export function validateEquipamentoPayload(
  payload,
  { existingEquipamentos = [], editingId = null } = {},
) {
  const errors = [];
  // Paralelo a `errors` — cada índice mapeia o nome do campo (nome/local/modelo/tag)
  // que produziu o erro. Usado pelo equipCrud pra focar o input correspondente
  // e marcar aria-invalid após validação falhar.
  const errorFields = [];
  const pushError = (field, message) => {
    errors.push(message);
    errorFields.push(field);
  };

  const nome = validateTextField({
    name: 'Nome',
    value: payload?.nome,
    required: true,
    maxLength: EQUIPMENT_FIELD_LIMITS.nome,
  });
  const local = validateTextField({
    name: 'Local',
    value: payload?.local,
    required: true,
    maxLength: EQUIPMENT_FIELD_LIMITS.local,
  });
  const modelo = validateTextField({
    name: 'Modelo',
    value: payload?.modelo,
    required: false,
    maxLength: EQUIPMENT_FIELD_LIMITS.modelo,
  });

  if (nome.error) pushError('nome', nome.error);
  if (local.error) pushError('local', local.error);
  if (modelo.error) pushError('modelo', modelo.error);

  const tag = normalizeTag(payload?.tag);
  if (tag.length > EQUIPMENT_FIELD_LIMITS.tag) {
    pushError('tag', `TAG excede o limite de ${EQUIPMENT_FIELD_LIMITS.tag} caracteres.`);
  }
  if (hasDuplicateTag(tag, existingEquipamentos, editingId)) {
    pushError('tag', 'Já existe equipamento com esta TAG.');
  }

  return {
    valid: errors.length === 0,
    errors,
    errorFields,
    value: {
      nome: nome.value,
      local: local.value,
      tag,
      modelo: modelo.value,
    },
  };
}

export function validateRegistroPayload(
  payload,
  { existingEquipamentos = [], requireTecnico = true, allowMissingStatus = false } = {},
) {
  const errors = [];
  const equipamentoIds = new Set(existingEquipamentos.map((equipamento) => String(equipamento.id)));

  const equipId = String(payload?.equipId || '').trim();
  const data = String(payload?.data || '').trim();
  const proxima = String(payload?.proxima || '').trim();
  const status = VALID_STATUS.has(payload?.status)
    ? payload.status
    : allowMissingStatus
      ? 'ok'
      : '';

  const tipo = validateTextField({
    name: 'Tipo de serviço',
    value: payload?.tipo,
    required: true,
    maxLength: REGISTRO_FIELD_LIMITS.tipo,
  });
  const tecnico = validateTextField({
    name: 'Técnico responsável',
    value: payload?.tecnico,
    required: requireTecnico,
    maxLength: REGISTRO_FIELD_LIMITS.tecnico,
  });
  const obs = validateTextField({
    name: 'Observações',
    value: payload?.obs,
    required: false,
    maxLength: REGISTRO_FIELD_LIMITS.obs,
    multiline: true,
  });
  const pecas = validateTextField({
    name: 'Peças e materiais',
    value: payload?.pecas,
    required: false,
    maxLength: REGISTRO_FIELD_LIMITS.pecas,
    multiline: true,
  });

  // Campos opcionais do cliente (capa do PDF + página de assinatura)
  const clienteNome = validateTextField({
    name: 'Nome do cliente',
    value: payload?.clienteNome,
    required: false,
    maxLength: REGISTRO_FIELD_LIMITS.clienteNome,
  });
  const clienteDocumento = validateTextField({
    name: 'Documento do cliente',
    value: payload?.clienteDocumento,
    required: false,
    maxLength: REGISTRO_FIELD_LIMITS.clienteDocumento,
  });
  const localAtendimento = validateTextField({
    name: 'Local do atendimento',
    value: payload?.localAtendimento,
    required: false,
    maxLength: REGISTRO_FIELD_LIMITS.localAtendimento,
  });
  const clienteContato = validateTextField({
    name: 'Contato do cliente',
    value: payload?.clienteContato,
    required: false,
    maxLength: REGISTRO_FIELD_LIMITS.clienteContato,
  });

  if (clienteNome.error) errors.push(clienteNome.error);
  if (clienteDocumento.error) errors.push(clienteDocumento.error);
  if (localAtendimento.error) errors.push(localAtendimento.error);
  if (clienteContato.error) errors.push(clienteContato.error);

  if (!equipId) errors.push('Campo obrigatório: Equipamento.');
  if (equipId && !equipamentoIds.has(equipId))
    errors.push('Equipamento inválido para este registro.');
  if (!data) errors.push('Campo obrigatório: Data.');
  if (!status) errors.push('Status informado não é permitido.');
  if (tipo.error) errors.push(tipo.error);
  if (tecnico.error) errors.push(tecnico.error);
  if (obs.error) errors.push(obs.error);
  if (pecas.error) errors.push(pecas.error);

  if (data) {
    const parsedData = new Date(data);
    if (Number.isNaN(parsedData.getTime())) {
      errors.push('Data inválida.');
    }
  }

  if (proxima && data && proxima < data.slice(0, 10)) {
    errors.push('Próxima manutenção não pode ser anterior ao serviço.');
  }

  const custoPecas = parseCost(payload?.custoPecas, 'Custo de peças');
  const custoMaoObra = parseCost(payload?.custoMaoObra, 'Custo de mão de obra');
  if (custoPecas.error) errors.push(custoPecas.error);
  if (custoMaoObra.error) errors.push(custoMaoObra.error);

  return {
    valid: errors.length === 0,
    errors,
    value: {
      equipId,
      data,
      proxima,
      status,
      tipo: tipo.value,
      tecnico: tecnico.value,
      obs: obs.value,
      pecas: pecas.value,
      custoPecas: custoPecas.value,
      custoMaoObra: custoMaoObra.value,
      clienteNome: clienteNome.value,
      clienteDocumento: clienteDocumento.value,
      localAtendimento: localAtendimento.value,
      clienteContato: clienteContato.value,
    },
  };
}

export function sanitizePersistedEquipamento(payload) {
  const result = validateEquipamentoPayload(payload, { existingEquipamentos: [] });
  if (!result.valid) return null;

  return {
    nome: result.value.nome,
    local: result.value.local,
    tag: result.value.tag,
    modelo: result.value.modelo,
  };
}

const SETOR_DESCRICAO_MAX = 240;
const SETOR_RESPONSAVEL_MAX = 120;
const SETOR_COR_REGEX = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/**
 * Normaliza e valida um setor (feature Pro). Retorna `null` se inválido.
 * Campos:
 *   - id (obrigatório)
 *   - nome (obrigatório, até 80 chars)
 *   - cor (hex opcional, default #00c8e8)
 *   - descricao (opcional, até 240 chars — front limita em ~120)
 *   - responsavel (opcional, até 120 chars — texto livre, NÃO é FK)
 */
export function sanitizePersistedSetor(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const id = String(payload.id || '').trim();
  if (!id) return null;

  const nome = normalizeInlineText(payload.nome);
  if (!nome || nome.length > SETOR_NOME_MAX) return null;

  const corRaw = String(payload.cor || '').trim();
  const cor = SETOR_COR_REGEX.test(corRaw) ? corRaw : '#00c8e8';

  const descricaoRaw = normalizeMultilineText(payload.descricao);
  const descricao = descricaoRaw ? descricaoRaw.slice(0, SETOR_DESCRICAO_MAX) : '';

  const responsavelRaw = normalizeInlineText(payload.responsavel);
  const responsavel = responsavelRaw ? responsavelRaw.slice(0, SETOR_RESPONSAVEL_MAX) : '';

  return { id, nome, cor, descricao, responsavel };
}

export function sanitizePersistedRegistro(payload, { existingEquipamentos = [] } = {}) {
  const result = validateRegistroPayload(payload, {
    existingEquipamentos,
    requireTecnico: false,
    allowMissingStatus: true,
  });
  if (!result.valid) return null;
  return result.value;
}

export const InputValidation = {
  normalizeInlineText,
  normalizeMultilineText,
};
