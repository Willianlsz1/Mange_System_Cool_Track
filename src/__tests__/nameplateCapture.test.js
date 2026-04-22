import { describe, expect, it } from 'vitest';

import { __testables } from '../ui/components/nameplateCapture.js';

describe('nameplateCapture helpers', () => {
  it('classifica erro de baixa legibilidade com mensagem orientativa', () => {
    const result = __testables.classifyNotIdentified('Imagem escura com reflexo');
    expect(result.stage).toBe('Etiqueta difícil de ler');
    expect(result.subtitle).toContain('difícil de ler');
  });

  it('classifica erro de dados insuficientes', () => {
    const result = __testables.classifyNotIdentified('Dados insuficientes para extrair campos');
    expect(result.stage).toBe('Dados insuficientes na etiqueta');
  });

  it('marca campo ausente como não identificado', () => {
    expect(__testables.resolveReviewStatus('fluido', null)).toEqual({
      text: 'Não identificado',
      className: 'nameplate-scan__review-value--missing',
    });
  });

  it('marca marca/modelo incompleto como revisar', () => {
    expect(__testables.resolveReviewStatus('marcaModelo', 'LG')).toEqual({
      text: 'LG (revisar)',
      className: 'nameplate-scan__review-value--warn',
    });
  });

  it('marca valor preenchido como encontrado', () => {
    expect(__testables.resolveReviewStatus('tensao', 220)).toEqual({
      text: 'Encontrado',
      className: 'nameplate-scan__review-value--ok',
    });
  });
});
