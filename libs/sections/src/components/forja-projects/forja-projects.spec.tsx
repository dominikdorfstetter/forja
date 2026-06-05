import { render, h, describe, it, expect } from '@stencil/vitest';

describe('forja-projects', () => {
  it('renders project cards', async () => {
    const items = [
      { title: 'Forja', description: '<p>CMS</p>', href: 'https://forja.dev', tags: ['Rust', 'React'], status: 'Active' },
      { title: 'Other', imageUrl: '/other.jpg' },
    ];
    const { root } = await render(<forja-projects sectionTitle="My Projects" items={items} />);
    const cards = root.querySelectorAll('.forja-projects__card');
    expect(cards.length).toBe(2);
    expect(cards[0].querySelector('.forja-projects__name a')!.textContent).toBe('Forja');
    expect(cards[0].querySelector('.forja-projects__status')!.textContent).toBe('Active');
  });

  it('renders tags on project cards', async () => {
    const items = [{ title: 'P1', tags: ['Go', 'Docker', 'K8s'] }];
    const { root } = await render(<forja-projects items={items} />);
    const tags = root.querySelectorAll('.forja-projects__tag');
    expect(tags.length).toBe(3);
    expect(tags[0].textContent).toBe('Go');
  });

  it('links project title when href is set', async () => {
    const items = [{ title: 'Linked', href: '/project/linked' }];
    const { root } = await render(<forja-projects items={items} />);
    const link = root.querySelector('.forja-projects__link')!;
    expect(link.getAttribute('href')).toBe('/project/linked');
  });

  it('renders plain title when no href', async () => {
    const items = [{ title: 'Plain' }];
    const { root } = await render(<forja-projects items={items} />);
    expect(root.querySelector('.forja-projects__link')).toBeNull();
    expect(root.querySelector('.forja-projects__name')!.textContent).toBe('Plain');
  });

  it('uses lazy loading for images', async () => {
    const items = [{ title: 'P', imageUrl: '/img.jpg' }];
    const { root } = await render(<forja-projects items={items} />);
    expect(root.querySelector('img')!.getAttribute('loading')).toBe('lazy');
  });
});
