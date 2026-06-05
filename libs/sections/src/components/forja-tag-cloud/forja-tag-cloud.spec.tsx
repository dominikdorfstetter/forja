import { render, h, describe, it, expect } from '@stencil/vitest';

describe('forja-tag-cloud', () => {
  it('renders tags as a nav list', async () => {
    const tags = [
      { label: 'TypeScript', href: '/tags/typescript', count: 12 },
      { label: 'Rust', href: '/tags/rust' },
      { label: 'Design' },
    ];
    const { root } = await render(<forja-tag-cloud sectionTitle="Topics" tags={tags} />);
    expect(root.querySelector('nav')).not.toBeNull();
    const items = root.querySelectorAll('.forja-tag-cloud__item');
    expect(items.length).toBe(3);
  });

  it('renders linked tags with href', async () => {
    const tags = [{ label: 'JS', href: '/tags/js' }];
    const { root } = await render(<forja-tag-cloud tags={tags} />);
    const link = root.querySelector('.forja-tag-cloud__tag')!;
    expect(link.tagName).toBe('A');
    expect(link.getAttribute('href')).toBe('/tags/js');
  });

  it('renders unlinked tags as spans', async () => {
    const tags = [{ label: 'Misc' }];
    const { root } = await render(<forja-tag-cloud tags={tags} />);
    const tag = root.querySelector('.forja-tag-cloud__tag')!;
    expect(tag.tagName).toBe('SPAN');
  });

  it('shows count when provided', async () => {
    const tags = [{ label: 'Rust', count: 5 }];
    const { root } = await render(<forja-tag-cloud tags={tags} />);
    const count = root.querySelector('.forja-tag-cloud__count')!;
    expect(count.textContent).toBe('(5)');
    expect(count.getAttribute('aria-label')).toBe('5 items');
  });

  it('hides count when not provided', async () => {
    const tags = [{ label: 'Go' }];
    const { root } = await render(<forja-tag-cloud tags={tags} />);
    expect(root.querySelector('.forja-tag-cloud__count')).toBeNull();
  });
});
