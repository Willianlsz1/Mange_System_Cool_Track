import { describe, expect, it } from 'vitest';
import { getEquipmentPhotoUrl, getEquipmentVisualMeta } from '../ui/components/equipmentVisual.js';

describe('equipmentVisual helpers', () => {
  it('prioriza primeira foto válida', () => {
    const eq = {
      nome: 'Split Recepção',
      tipo: 'Split Hi-Wall',
      fotos: [{ url: '   ' }, { url: 'https://cdn.exemplo.com/foto.jpg' }],
    };
    expect(getEquipmentPhotoUrl(eq)).toBe('https://cdn.exemplo.com/foto.jpg');
  });

  it('ignora urls inválidas e monta fallback com iniciais profissionais', () => {
    const eq = {
      nome: 'Bomba Água Gelada',
      tipo: 'Chiller',
      fotos: [{ url: 'undefined' }, { url: 'null' }],
    };
    const visual = getEquipmentVisualMeta(eq);
    expect(visual.photoUrl).toBeNull();
    expect(visual.initials).toBe('BÁ');
    expect(typeof visual.tone).toBe('number');
  });
});
