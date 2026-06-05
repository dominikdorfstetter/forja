import { render, h, describe, it, expect } from '@stencil/vitest';

describe('forja-stats', () => {
  it('renders stats as definition list', async () => {
    const items = [
      { value: '99.9%', label: 'Uptime' },
      { value: '10k+', label: 'Users' },
    ];
    const { root } = await render(<forja-stats sectionTitle="Numbers" items={items} />);
    expect(root.querySelector('dl')).not.toBeNull();
    const values = root.querySelectorAll('.forja-stats__value');
    const labels = root.querySelectorAll('.forja-stats__label');
    expect(values.length).toBe(2);
    expect(values[0].textContent).toBe('99.9%');
    expect(labels[0].textContent).toBe('Uptime');
  });

  it('applies style modifier', async () => {
    const items = [{ value: '1', label: 'A' }];
    const { root } = await render(<forja-stats statsStyle="cards" items={items} />);
    expect(root.querySelector('section')!.className).toContain('forja-stats--cards');
  });
});
