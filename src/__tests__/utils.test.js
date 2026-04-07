import { Utils } from '../core/utils.js';

describe('Utils', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('formats valid dates and handles invalid values', () => {
    expect(Utils.formatDate('2026-04-07')).toBe('07/04/2026');
    expect(Utils.formatDate('')).toBe('—');
    expect(Utils.formatDate('invalid')).toBe('—');
  });

  it('escapes HTML and attribute special characters', () => {
    const raw = `<div class="x">Tom & Jerry's</div>`;
    expect(Utils.escapeHtml(raw)).toBe(
      '&lt;div class=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/div&gt;',
    );
    expect(Utils.escapeAttr(raw)).toBe(
      '&lt;div class=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/div&gt;',
    );
  });

  it('works with DOM helpers getEl/getVal/setVal/clearVals', () => {
    document.body.innerHTML = `
      <input id="name" value="Alice" />
      <input id="city" value="Recife" />
    `;

    expect(Utils.getEl('name')).toBeInstanceOf(HTMLElement);
    expect(Utils.getVal('name')).toBe('Alice');

    Utils.setVal('name', 'Bob');
    expect(Utils.getVal('name')).toBe('Bob');

    Utils.clearVals('name', 'city');
    expect(Utils.getVal('name')).toBe('');
    expect(Utils.getVal('city')).toBe('');
    expect(Utils.getVal('missing')).toBe('');
  });

  it('calculates localStorage byte usage and formats byte labels', () => {
    localStorage.setItem('a', '12');
    localStorage.setItem('b', '1234');

    expect(Utils.getStorageBytes()).toBe(12);
    expect(Utils.formatBytes(512)).toBe('512 B');
    expect(Utils.formatBytes(2048)).toBe('2.0 KB');
    expect(Utils.formatBytes(3 * 1024 * 1024)).toBe('3.00 MB');
  });

  it('returns 0 storage bytes when localStorage access fails', () => {
    const keysSpy = vi.spyOn(Object, 'keys').mockImplementationOnce(() => {
      throw new Error('blocked');
    });

    expect(Utils.getStorageBytes()).toBe(0);
    expect(keysSpy).toHaveBeenCalled();
  });
});
