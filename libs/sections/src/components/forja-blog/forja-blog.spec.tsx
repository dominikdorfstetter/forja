import { render, h, describe, it, expect } from '@stencil/vitest';

describe('forja-blog', () => {
  it('renders blog post cards', async () => {
    const posts = [
      { title: 'Hello World', excerpt: '<p>First post</p>', date: '2024-01-15', author: 'Alice', href: '/blog/hello' },
      { title: 'Second Post', imageUrl: '/cover.jpg', href: '/blog/second' },
    ];
    const { root } = await render(<forja-blog sectionTitle="Latest Posts" posts={posts} />);
    expect(root.querySelector('.forja-blog__title')!.textContent).toBe('Latest Posts');
    const cards = root.querySelectorAll('.forja-blog__card');
    expect(cards.length).toBe(2);
  });

  it('renders date and author metadata', async () => {
    const posts = [{ title: 'Post', date: 'Jan 2024', author: 'Bob', href: '/p' }];
    const { root } = await render(<forja-blog posts={posts} />);
    expect(root.querySelector('time')!.textContent).toBe('Jan 2024');
    expect(root.querySelector('.forja-blog__author')!.textContent).toBe('Bob');
  });

  it('links post title when href is set', async () => {
    const posts = [{ title: 'Linked', href: '/blog/linked' }];
    const { root } = await render(<forja-blog posts={posts} />);
    const link = root.querySelector('.forja-blog__link')!;
    expect(link.getAttribute('href')).toBe('/blog/linked');
    expect(link.textContent).toBe('Linked');
  });

  it('renders CTA button when provided', async () => {
    const { root } = await render(
      <forja-blog buttonText="View All" buttonHref="/blog" />,
    );
    const cta = root.querySelector('.forja-blog__cta')!;
    expect(cta.textContent).toBe('View All');
    expect(cta.getAttribute('href')).toBe('/blog');
  });

  it('uses lazy loading for post images', async () => {
    const posts = [{ title: 'P', imageUrl: '/img.jpg', href: '/p' }];
    const { root } = await render(<forja-blog posts={posts} />);
    expect(root.querySelector('img')!.getAttribute('loading')).toBe('lazy');
  });

  it('uses fallback aria-label', async () => {
    const { root } = await render(<forja-blog />);
    expect(root.querySelector('section')!.getAttribute('aria-label')).toBe('Blog');
  });
});
