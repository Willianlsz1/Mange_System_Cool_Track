import { describe, expect, it } from 'vitest';
import { emptyStateHtml } from '../ui/components/emptyState.js';

describe('emptyStateHtml security', () => {
  it('escapes CTA fields and only emits safe attributes', () => {
    const html = emptyStateHtml({
      icon: '<svg/onload=alert(1)>',
      title: 'Title',
      description: 'Desc',
      cta: {
        label: '<img src=x onerror=alert(1)>',
        action: 'open-modal" onclick="alert(1)',
        id: 'modal-1" data-x="1',
        tone: 'primary',
      },
    });

    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('data-action="open-modal&quot; onclick=&quot;alert(1)"');
    expect(html).toContain('data-id="modal-1&quot; data-x=&quot;1"');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('onclick=alert(1)');
  });

  it('does not accept raw HTML blocks as CTA input', () => {
    const html = emptyStateHtml({
      icon: '!',
      title: 'Safe',
      cta: '<button onclick="alert(1)">X</button>',
    });

    expect(html).not.toContain('onclick');
    expect(html).not.toContain('<button onclick');
  });
});
