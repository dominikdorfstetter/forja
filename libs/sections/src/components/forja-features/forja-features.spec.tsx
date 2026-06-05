import { render, h, describe, it, expect } from '@stencil/vitest';

describe('forja-features', () => {
  it('renders with title', async () => {
    const { root } = await render(<forja-features sectionTitle="Features" />);
    expect(root.querySelector('.forja-features__title')!.textContent).toBe('Features');
    expect(root.querySelector('section')!.getAttribute('aria-label')).toBe('Features');
  });

  it('renders items as a list', async () => {
    const items = [
      { title: 'Fast', text: 'Lightning speed', icon: '⚡' },
      { title: 'Secure', text: 'Bank-level security' },
    ];
    const { root } = await render(<forja-features items={items} />);
    const featureItems = root.querySelectorAll('.forja-features__item');
    expect(featureItems.length).toBe(2);
    expect(featureItems[0].querySelector('.forja-features__icon')).not.toBeNull();
    expect(featureItems[0].querySelector('.forja-features__icon')!.getAttribute('aria-hidden')).toBe('true');
    expect(featureItems[1].querySelector('.forja-features__icon')).toBeNull();
  });

  it('uses fallback slot when no items', async () => {
    const { root } = await render(<forja-features sectionTitle="F" />);
    expect(root.querySelector('ul')).toBeNull();
  });
});
