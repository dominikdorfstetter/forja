import { render, h, describe, it, expect } from '@stencil/vitest';

describe('forja-testimonials', () => {
  it('renders testimonials as blockquotes', async () => {
    const items = [
      { quote: 'Great product', author: 'Jane', role: 'CEO', avatarUrl: '/jane.jpg' },
      { quote: 'Love it', author: 'John' },
    ];
    const { root } = await render(<forja-testimonials sectionTitle="Reviews" items={items} />);
    const quotes = root.querySelectorAll('blockquote');
    expect(quotes.length).toBe(2);
    expect(quotes[0].querySelector('.forja-testimonials__quote')!.textContent).toBe('Great product');
    expect(quotes[0].querySelector('.forja-testimonials__name')!.textContent).toBe('Jane');
    expect(quotes[0].querySelector('.forja-testimonials__role')!.textContent).toBe('CEO');
    expect(quotes[0].querySelector('.forja-testimonials__avatar')).not.toBeNull();
    expect(quotes[1].querySelector('.forja-testimonials__role')).toBeNull();
    expect(quotes[1].querySelector('.forja-testimonials__avatar')).toBeNull();
  });

  it('avatar images are decorative (empty alt)', async () => {
    const items = [{ quote: 'Hi', author: 'A', avatarUrl: '/a.jpg' }];
    const { root } = await render(<forja-testimonials items={items} />);
    expect(root.querySelector('.forja-testimonials__avatar')!.getAttribute('alt')).toBe('');
  });
});
