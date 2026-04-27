import { beforeEach, describe, expect, it } from 'vitest';

import {
  NAV_LAYOUT_BY_MODE,
  NAV_MODE_EMPRESA,
  NAV_MODE_KEY,
  NAV_MODE_RAPIDO,
  ensureNavigationModePreference,
  getNavigationLayout,
  getNavigationMode,
  hasNavigationModePreference,
  setNavigationMode,
} from '../ui/shell/navigationMode.js';

describe('navigationMode', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '';
  });

  it('usa rapido como fallback quando não há preferência', () => {
    expect(getNavigationMode()).toBe(NAV_MODE_RAPIDO);
    expect(hasNavigationModePreference()).toBe(false);
  });

  it('persiste preferência válida', () => {
    const mode = setNavigationMode(NAV_MODE_EMPRESA, { emit: false });
    expect(mode).toBe(NAV_MODE_EMPRESA);
    expect(localStorage.getItem(NAV_MODE_KEY)).toBe(NAV_MODE_EMPRESA);
    expect(getNavigationMode()).toBe(NAV_MODE_EMPRESA);
    expect(hasNavigationModePreference()).toBe(true);
  });

  it('normaliza valor inválido para rapido', () => {
    localStorage.setItem(NAV_MODE_KEY, 'foo');
    expect(getNavigationMode()).toBe(NAV_MODE_RAPIDO);
  });

  it('retorna layout centralizado por modo', () => {
    expect(getNavigationLayout(NAV_MODE_RAPIDO)).toEqual(NAV_LAYOUT_BY_MODE[NAV_MODE_RAPIDO]);
    expect(getNavigationLayout(NAV_MODE_EMPRESA)).toEqual(NAV_LAYOUT_BY_MODE[NAV_MODE_EMPRESA]);
  });

  it('abre prompt na primeira execução', () => {
    const mode = ensureNavigationModePreference();
    expect(mode).toBe(NAV_MODE_RAPIDO);
    expect(document.getElementById('navigation-mode-overlay')).toBeTruthy();
  });
});
