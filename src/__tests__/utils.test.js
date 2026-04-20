import { Utils } from '../core/utils.js';

describe('Utils', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('formats valid dates and handles invalid values', () => {
    expect(Utils.formatDate('2026-04-07')).toBe('07/04/2026');
    expect(Utils.formatDate('')).toBe('—');
    expect(Utils.formatDate('invalid')).toBe('—');
  });

  // Regressão: o PDF passava registro.data (datetime completo) para
  // formatDate, que fazia split('-') cru e produzia '19T21:24:04/04/2026'.
  // Na coluna 'Último' do autoTable isso quebrava em duas linhas.
  it('formats datetime ISO strings to date-only output', () => {
    expect(Utils.formatDate('2026-04-19T21:24:04')).toBe('19/04/2026');
    expect(Utils.formatDate('2026-04-19T21:24:04.000Z')).toBe('19/04/2026');
    expect(Utils.formatDate('2026-04-19T21:24')).toBe('19/04/2026');
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

  it('generates unique ids and truncates strings predictably', () => {
    const id1 = Utils.uid();
    const id2 = Utils.uid();

    expect(id1).toMatch(/^[a-z0-9]+$/);
    expect(id2).toMatch(/^[a-z0-9]+$/);
    expect(id1).not.toBe(id2);

    expect(Utils.truncate('abcdef', 3)).toBe('abc...');
    expect(Utils.truncate('abc', 3)).toBe('abc');
    expect(Utils.truncate('', 10)).toBe('');
  });

  it('handles datetime helpers and day diffs around today', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-07T12:34:00Z'));

    const now = Utils.nowDatetime();
    const sameAsNow = Utils.datetimeOffset(0);
    expect(now).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(sameAsNow).toBe(now);

    const today = Utils.dateOffset(0);
    const tomorrow = Utils.dateOffset(1);
    const yesterday = Utils.dateOffset(-1);
    expect(Utils.daysDiff(today)).toBe(0);
    expect(Utils.daysDiff(tomorrow)).toBe(1);
    expect(Utils.daysDiff(yesterday)).toBe(-1);
  });
});
