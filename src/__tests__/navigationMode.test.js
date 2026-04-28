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
    expect(document.body.textContent).toContain('Modo organiza a interface');
    expect(document.body.textContent).toContain('Plano libera recursos');
    expect(document.body.textContent).toMatch(/T.cnico aut.nomo/);
    expect(document.body.textContent).toContain('Empresa');
  });

  it('bloqueia escolha de empresa para Free sem persistir modo empresa', () => {
    localStorage.setItem('cooltrack-cached-plan', 'free');
    ensureNavigationModePreference();

    document.querySelector('[data-nav-mode="empresa"]')?.click();

    expect(localStorage.getItem(NAV_MODE_KEY)).not.toBe(NAV_MODE_EMPRESA);
    expect(document.getElementById('navigation-mode-overlay')).toBeTruthy();
    expect(document.body.textContent).toContain('Clientes');
    expect(document.body.textContent).toContain('Ver planos');
    expect(document.body.textContent).toMatch(/Continuar como t.cnico/);
  });

  it('bloqueia escolha de empresa para Plus sem persistir modo empresa', () => {
    localStorage.setItem('cooltrack-cached-plan', 'plus');
    ensureNavigationModePreference();

    document.querySelector('[data-nav-mode="empresa"]')?.click();

    expect(localStorage.getItem(NAV_MODE_KEY)).not.toBe(NAV_MODE_EMPRESA);
    expect(document.body.textContent).toContain('Clientes');
  });

  it('permite modo empresa para Pro sem mostrar paywall', () => {
    localStorage.setItem('cooltrack-cached-plan', 'pro');
    ensureNavigationModePreference();

    document.querySelector('[data-nav-mode="empresa"]')?.click();

    expect(localStorage.getItem(NAV_MODE_KEY)).toBe(NAV_MODE_EMPRESA);
    expect(document.getElementById('navigation-mode-overlay')).toBeNull();
    expect(document.body.textContent).not.toContain('Ver planos');
  });

  it('continua como tecnico quando Free cancela o fluxo empresa', () => {
    localStorage.setItem('cooltrack-cached-plan', 'free');
    ensureNavigationModePreference();
    document.querySelector('[data-nav-mode="empresa"]')?.click();

    document.querySelector('[data-nav-mode-action="continue-rapido"]')?.click();

    expect(localStorage.getItem(NAV_MODE_KEY)).toBe(NAV_MODE_RAPIDO);
    expect(document.getElementById('navigation-mode-overlay')).toBeNull();
  });
});
