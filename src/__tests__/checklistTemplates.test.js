/**
 * Tests for PMOC Fase 3 checklist templates.
 * Cobre: lookup por tipo, fallback genérico, validação, summary.
 */

import { describe, it, expect } from 'vitest';
import {
  getChecklistTemplate,
  getTemplateByKey,
  buildEmptyChecklist,
  validateChecklist,
  summarizeChecklist,
  listTemplates,
  formatMeasure,
} from '../domain/pmoc/checklistTemplates.js';

describe('checklistTemplates', () => {
  describe('getChecklistTemplate', () => {
    it('retorna template específico para tipos mapeados', () => {
      const tpl = getChecklistTemplate('Split Hi-Wall');
      expect(tpl.tipo_template).toBe('split_hi_wall');
      expect(tpl.items.length).toBeGreaterThan(0);
    });

    it('mapeia GHP para template VRF (mesma topologia)', () => {
      expect(getChecklistTemplate('GHP').tipo_template).toBe('vrf');
    });

    it('mapeia Roof Top para Self Contained', () => {
      expect(getChecklistTemplate('Roof Top').tipo_template).toBe('self_contained');
    });

    it('cai em template generic para tipos não mapeados', () => {
      const tpl = getChecklistTemplate('Câmara Fria');
      expect(tpl.tipo_template).toBe('generic');
    });

    it('cai em template generic para entradas vazias/inválidas', () => {
      expect(getChecklistTemplate(null).tipo_template).toBe('generic');
      expect(getChecklistTemplate(undefined).tipo_template).toBe('generic');
      expect(getChecklistTemplate('').tipo_template).toBe('generic');
    });
  });

  describe('getTemplateByKey', () => {
    it('retorna template por chave', () => {
      const tpl = getTemplateByKey('chiller');
      expect(tpl.tipo_template).toBe('chiller');
      expect(tpl.label).toContain('Chiller');
    });

    it('cai em generic para chaves desconhecidas', () => {
      expect(getTemplateByKey('inexistente').tipo_template).toBe('generic');
    });
  });

  describe('buildEmptyChecklist', () => {
    it('cria checklist vazio com todos os items do template', () => {
      const cl = buildEmptyChecklist('Split Hi-Wall');
      expect(cl.tipo_template).toBe('split_hi_wall');
      expect(cl.version).toBe(1);
      expect(cl.items.length).toBeGreaterThan(0);
      // Todos items começam com status null e obs vazio
      cl.items.forEach((item) => {
        expect(item.status).toBeNull();
        expect(item.obs).toBe('');
        expect(typeof item.id).toBe('string');
      });
    });
  });

  describe('validateChecklist', () => {
    it('retorna empty para checklist null', () => {
      const v = validateChecklist(null);
      expect(v.complete).toBe(false);
      expect(v.reason).toBe('empty');
    });

    it('retorna lista de items obrigatórios pendentes', () => {
      const cl = buildEmptyChecklist('Split Hi-Wall');
      const v = validateChecklist(cl);
      expect(v.complete).toBe(false);
      expect(v.missing.length).toBeGreaterThan(0);
    });

    it('retorna complete=true quando todos obrigatórios marcados', () => {
      const cl = buildEmptyChecklist('Split Hi-Wall');
      // Marca todos os mandatory como ok
      const tpl = getTemplateByKey(cl.tipo_template);
      cl.items.forEach((item) => {
        const tplItem = tpl.items.find((t) => t.id === item.id);
        if (tplItem?.mandatory) item.status = 'ok';
      });
      const v = validateChecklist(cl);
      expect(v.complete).toBe(true);
      expect(v.missing).toEqual([]);
    });
  });

  describe('summarizeChecklist', () => {
    it('conta zero para checklist null/vazio', () => {
      expect(summarizeChecklist(null)).toEqual({ ok: 0, fail: 0, na: 0, pending: 0, total: 0 });
    });

    it('conta corretamente os status', () => {
      const cl = buildEmptyChecklist('Split Hi-Wall');
      cl.items[0].status = 'ok';
      cl.items[1].status = 'fail';
      cl.items[2].status = 'na';
      const s = summarizeChecklist(cl);
      expect(s.ok).toBe(1);
      expect(s.fail).toBe(1);
      expect(s.na).toBe(1);
      expect(s.pending).toBe(cl.items.length - 3);
      expect(s.total).toBe(cl.items.length);
    });
  });

  describe('listTemplates', () => {
    it('retorna pelo menos os 8 templates definidos', () => {
      const all = listTemplates();
      expect(all.length).toBeGreaterThanOrEqual(8);
      const keys = all.map((t) => t.tipo_template);
      expect(keys).toContain('split_hi_wall');
      expect(keys).toContain('vrf');
      expect(keys).toContain('chiller');
      expect(keys).toContain('generic');
    });
  });

  describe('measurable items (PMOC Fase 4)', () => {
    it('templates principais marcam pressão/corrente/tensão como measurable', () => {
      const split = getTemplateByKey('split_hi_wall');
      const pressao = split.items.find((i) => i.id === 'pressao_succao');
      expect(pressao.measurable).toBe(true);
      expect(pressao.unit).toBe('psi');

      const corrente = split.items.find((i) => i.id === 'corrente_compressor');
      expect(corrente.measurable).toBe(true);
      expect(corrente.unit).toBe('A');

      const tensao = split.items.find((i) => i.id === 'tensao_alimentacao');
      expect(tensao.measurable).toBe(true);
      expect(tensao.unit).toBe('V');
    });

    it('chiller tem pressões diferenciais e temperaturas measurable', () => {
      const chiller = getTemplateByKey('chiller');
      const evap = chiller.items.find((i) => i.id === 'pressao_diferencial_evap');
      expect(evap.measurable).toBe(true);
      expect(evap.unit).toBe('kPa');
      const tempSaida = chiller.items.find((i) => i.id === 'temp_agua_gelada_saida');
      expect(tempSaida.measurable).toBe(true);
      expect(tempSaida.unit).toBe('°C');
    });

    it('items não-measurable não têm flag', () => {
      const split = getTemplateByKey('split_hi_wall');
      const filtros = split.items.find((i) => i.id === 'filtros_limpeza');
      expect(filtros.measurable).toBeUndefined();
      expect(filtros.unit).toBeUndefined();
    });

    it('buildEmptyChecklist inclui measure: null pra items measurable', () => {
      const cl = buildEmptyChecklist('Split Hi-Wall');
      const pressao = cl.items.find((i) => i.id === 'pressao_succao');
      expect(pressao.measure).toBeNull();
      const filtros = cl.items.find((i) => i.id === 'filtros_limpeza');
      expect('measure' in filtros).toBe(false);
    });
  });

  describe('formatMeasure', () => {
    it('retorna string vazia para measure null/inválido', () => {
      expect(formatMeasure(null)).toBe('');
      expect(formatMeasure(undefined)).toBe('');
      expect(formatMeasure({ value: null, unit: 'psi' })).toBe('');
      expect(formatMeasure({ value: '', unit: 'psi' })).toBe('');
      expect(formatMeasure({ value: 'abc', unit: 'psi' })).toBe('');
    });

    it('formata inteiro sem decimais', () => {
      expect(formatMeasure({ value: 120, unit: 'psi' })).toBe('120 psi');
      expect(formatMeasure({ value: 220, unit: 'V' })).toBe('220 V');
    });

    it('formata decimal com vírgula pt-BR', () => {
      expect(formatMeasure({ value: 22.5, unit: '°C' })).toBe('22,5 °C');
      expect(formatMeasure({ value: 9.25, unit: 'A' })).toBe('9,25 A');
    });

    it('remove trailing zeros desnecessários', () => {
      expect(formatMeasure({ value: 22.5, unit: '°C' })).toBe('22,5 °C');
      expect(formatMeasure({ value: 22.0, unit: '°C' })).toBe('22 °C');
    });

    it('omite unit quando ausente', () => {
      expect(formatMeasure({ value: 120 })).toBe('120');
      expect(formatMeasure({ value: 22.5, unit: '' })).toBe('22,5');
    });
  });
});
