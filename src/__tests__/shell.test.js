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
  });

  it('syncs the total header height into the global layout variables', async () => {
    document.body.innerHTML = '<div id="app"></div>';

    const { initAppShell } = await import('../ui/shell.js');

    initAppShell();

    const header = document.body.querySelector('.app-header');
    if (!header) {
      throw new Error('Header not found');
    }

    const getBoundingClientRect = vi.spyOn(header, 'getBoundingClientRect');
    getBoundingClientRect.mockReturnValue({ height: 142 });

    initAppShell();

    expect(document.documentElement.style.getPropertyValue('--app-header-total-height')).toBe(
      '142px',
    );
    expect(document.documentElement.style.getPropertyValue('--app-header-height')).toBe('142px');
    getBoundingClientRect.mockRestore();
  });
});
