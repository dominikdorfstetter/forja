import { render, h, describe, it, expect } from '@stencil/vitest';

describe('forja-gallery', () => {
  it('renders items as figures', async () => {
    const items = [
      { imageUrl: '/a.jpg', alt: 'A', caption: 'Photo A' },
      { imageUrl: '/b.jpg' },
    ];
    const { root } = await render(<forja-gallery sectionTitle="Photos" items={items} />);
    const figures = root.querySelectorAll('figure');
    expect(figures.length).toBe(2);
    expect(figures[0].querySelector('img')!.getAttribute('src')).toBe('/a.jpg');
    expect(figures[0].querySelector('figcaption')!.textContent).toBe('Photo A');
    expect(figures[1].querySelector('figcaption')).toBeNull();
  });

  it('uses lazy loading for images', async () => {
    const items = [{ imageUrl: '/a.jpg', alt: 'A' }];
    const { root } = await render(<forja-gallery items={items} />);
    expect(root.querySelector('img')!.getAttribute('loading')).toBe('lazy');
  });

  it('renders empty state with slot', async () => {
    const { root } = await render(<forja-gallery sectionTitle="Empty" />);
    expect(root.querySelector('figure')).toBeNull();
  });
});
