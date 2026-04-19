import { describe, expect, it } from 'vitest';
import {
  sanitizePersistedEquipamento,
  sanitizePersistedRegistro,
  validateEquipamentoPayload,
  validateRegistroPayload,
} from '../core/inputValidation.js';

describe('inputValidation', () => {
  it('normalizes and validates equipamento fields with limits and duplicate tag check', () => {
    const duplicate = validateEquipamentoPayload(
      {
        nome: '  Split Centro  ',
        local: '  Sala 1  ',
        tag: ' ac-01 ',
        modelo: '  Modelo X  ',
      },
      { existingEquipamentos: [{ id: 'eq-1', tag: 'AC-01' }] },
    );

    expect(duplicate.valid).toBe(false);
    expect(duplicate.errors[0]).toContain('TAG');
    expect(duplicate.errorFields[0]).toBe('tag');

    const ok = validateEquipamentoPayload(
      {
        nome: '  Split Centro  ',
        local: '  Sala 1  ',
        tag: ' ac-02 ',
        modelo: '  Modelo X  ',
      },
      { existingEquipamentos: [{ id: 'eq-1', tag: 'AC-01' }] },
    );

    expect(ok.valid).toBe(true);
    expect(ok.value.nome).toBe('Split Centro');
    expect(ok.value.local).toBe('Sala 1');
    expect(ok.value.tag).toBe('AC-02');
    expect(ok.errorFields).toEqual([]);
  });

  it('reports errorFields in order matching errors (for focus-first-invalid flow)', () => {
    const result = validateEquipamentoPayload(
      {
        nome: '', // falha: obrigatório
        local: '', // falha: obrigatório
        tag: 'X'.repeat(50), // falha: excede 40
        modelo: 'ok',
      },
      { existingEquipamentos: [] },
    );

    expect(result.valid).toBe(false);
    expect(result.errorFields[0]).toBe('nome');
    expect(result.errorFields).toContain('local');
    expect(result.errorFields).toContain('tag');
    // errors e errorFields têm o mesmo comprimento e a mesma ordem
    expect(result.errorFields).toHaveLength(result.errors.length);
  });

  it('validates registro payload before save', () => {
    const invalid = validateRegistroPayload(
      {
        equipId: 'eq-2',
        data: '2026-04-10T10:00',
        tipo: 'Preventiva',
        tecnico: 'Ana',
        status: 'ok',
        proxima: '2026-04-01',
      },
      { existingEquipamentos: [{ id: 'eq-1' }] },
    );

    expect(invalid.valid).toBe(false);
    expect(invalid.errors.some((error) => error.includes('Equipamento inválido'))).toBe(true);

    const ok = validateRegistroPayload(
      {
        equipId: 'eq-1',
        data: '2026-04-10T10:00',
        tipo: '  Preventiva  ',
        tecnico: '  Ana  ',
        status: 'ok',
        proxima: '2026-04-15',
        obs: '  Revisao geral  ',
        pecas: '  filtro  ',
      },
      { existingEquipamentos: [{ id: 'eq-1' }] },
    );

    expect(ok.valid).toBe(true);
    expect(ok.value.tipo).toBe('Preventiva');
    expect(ok.value.tecnico).toBe('Ana');
    expect(ok.value.obs).toBe('Revisao geral');
    expect(ok.value.pecas).toBe('filtro');
  });

  it('sanitizes persisted payloads for safe rendering', () => {
    const equipamento = sanitizePersistedEquipamento({
      nome: '  Nome  ',
      local: '  Local  ',
      tag: ' tag-1 ',
      modelo: ' modelo ',
    });
    expect(equipamento).toEqual({
      nome: 'Nome',
      local: 'Local',
      tag: 'TAG-1',
      modelo: 'modelo',
    });

    const registro = sanitizePersistedRegistro(
      {
        equipId: 'eq-1',
        data: '2026-04-10T10:00',
        tipo: 'Teste',
        status: '',
        obs: ' ok ',
        pecas: ' peca ',
      },
      { existingEquipamentos: [{ id: 'eq-1' }] },
    );

    expect(registro.status).toBe('ok');
  });
});
