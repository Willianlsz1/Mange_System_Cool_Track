import { afterEach, describe, expect, it, vi } from 'vitest';

describe('shell bootstrap', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('mounts the global header outside #app and keeps bootstrap idempotent', async () => {
    document.body.innerHTML = '<div id="app"></div>';

    const { initAppShell } = await import('../ui/shell.js');

    initAppShell();
    initAppShell();

    const header = document.body.querySelector('.app-header');
    const app = document.getElementById('app');

    expect(header).not.toBeNull();
    expect(document.body.firstElementChild).toBe(header);
    expect(app?.querySelector('.app-header')).toBeNull();
    expect(app?.querySelector('#main-content')).not.toBeNull();
    expect(document.body.querySelectorAll('.app-header')).toHaveLength(1);
    expect(document.getElementById('header-help-btn')).not.toBeNull();
    expect(document.getElementById('tour-help-btn')).toBeNull();
    expect(document.body.querySelectorAll('.app-nav .nav-btn')).toHaveLength(6);
    expect(
      document.getElementById('nav-registro')?.querySelector('.nav-btn__icon svg'),
    ).not.toBeNull();
  });

  it('syncs shell metrics into global layout variables', async () => {
    document.body.innerHTML = '<div id="app"></div>';

    const { initAppShell } = await import('../ui/shell.js');

    initAppShell();

    const header = document.body.querySelector('.app-header');
    if (!header) {
      throw new Error('Header not found');
    }

    const nav = document.body.querySelector('.app-nav');
    if (!nav) {
      throw new Error('Bottom nav not found');
    }

    const headerRectSpy = vi.spyOn(header, 'getBoundingClientRect');
    headerRectSpy.mockReturnValue({ height: 142 });

    const navRectSpy = vi.spyOn(nav, 'getBoundingClientRect');
    navRectSpy.mockReturnValue({ height: 76 });

    initAppShell();

    expect(document.documentElement.style.getPropertyValue('--app-header-total-height')).toBe(
      '142px',
    );
    expect(document.documentElement.style.getPropertyValue('--app-header-height')).toBe('142px');
    expect(document.documentElement.style.getPropertyValue('--app-nav-height')).toBe('76px');

    headerRectSpy.mockRestore();
    navRectSpy.mockRestore();
  });
});
