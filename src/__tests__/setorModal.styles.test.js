import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('setor modal styles', () => {
  it('hides inline error when [hidden] is present', () => {
    const css = readFileSync('src/assets/styles/components/_setor-modal.css', 'utf-8');
    expect(css).toMatch(/\.setor-modal__error\[hidden\]\s*\{\s*display:\s*none;/);
  });

  it('prevents long text overflow in key modal labels', () => {
    const css = readFileSync('src/assets/styles/components/_setor-modal.css', 'utf-8');
    expect(css).toMatch(/\.setor-modal__optional-summary[\s\S]*overflow-wrap:\s*anywhere;/);
    expect(css).toMatch(/\.setor-modal__preview-cta-text[\s\S]*overflow-wrap:\s*anywhere;/);
  });
});
