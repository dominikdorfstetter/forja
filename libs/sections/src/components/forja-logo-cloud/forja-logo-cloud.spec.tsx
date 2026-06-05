import { render, h, describe, it, expect } from '@stencil/vitest';

describe('forja-logo-cloud', () => {
  it('renders logos as list items', async () => {
    const logos = [
      { imageUrl: '/a.png', alt: 'Acme', href: 'https://acme.com' },
      { imageUrl: '/b.png', alt: 'Globex' },
    ];
    const { root } = await render(<forja-logo-cloud sectionTitle="Partners" logos={logos} />);
    const items = root.querySelectorAll('.forja-logo-cloud__item');
    expect(items.length).toBe(2);
    expect(items[0].querySelector('a')!.getAttribute('target')).toBe('_blank');
    expect(items[0].querySelector('a')!.getAttribute('rel')).toBe('noopener');
    expect(items[1].querySelector('a')).toBeNull();
  });

  it('applies grayscale modifier', async () => {
    const { root } = await render(<forja-logo-cloud grayscale />);
    expect(root.querySelector('section')!.className).toContain('forja-logo-cloud--grayscale');
  });
});
