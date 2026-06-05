import { render, h, describe, it, expect } from '@stencil/vitest';

describe('forja-timeline', () => {
  it('renders events as ordered list', async () => {
    const events = [
      { date: '2024-01', title: 'Founded', text: '<p>Started</p>' },
      { title: 'Launch' },
    ];
    const { root } = await render(<forja-timeline sectionTitle="History" events={events} />);
    expect(root.querySelector('ol')).not.toBeNull();
    const items = root.querySelectorAll('.forja-timeline__item');
    expect(items.length).toBe(2);
    expect(items[0].querySelector('time')!.textContent).toBe('2024-01');
    expect(items[1].querySelector('time')).toBeNull();
  });

  it('hides dates when showDates is false', async () => {
    const events = [{ date: '2024', title: 'Event' }];
    const { root } = await render(<forja-timeline showDates={false} events={events} />);
    expect(root.querySelector('time')).toBeNull();
  });

  it('applies layout modifier', async () => {
    const { root } = await render(<forja-timeline layout="horizontal" />);
    expect(root.querySelector('section')!.className).toContain('forja-timeline--horizontal');
  });
});
