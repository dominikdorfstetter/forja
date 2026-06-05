import { render, h, describe, it, expect } from '@stencil/vitest';

describe('forja-footer', () => {
  it('renders site name and tagline', async () => {
    const { root } = await render(<forja-footer siteName="My Site" />);
    expect(root.querySelector('.forja-footer__brand-link')!.textContent).toBe('My Site');
    expect(root.querySelector('.forja-footer__tagline')!.textContent).toBe('Built with Forja');
  });

  it('renders footer nav links', async () => {
    const items = [
      { title: 'Privacy', href: '/privacy' },
      { title: 'Terms', href: '/terms' },
    ];
    const { root } = await render(<forja-footer items={items} />);
    const links = root.querySelectorAll('.forja-footer__nav-link');
    expect(links.length).toBe(2);
    expect(links[0].getAttribute('href')).toBe('/privacy');
  });

  it('renders social links with icons', async () => {
    const socialLinks = [
      { title: 'GitHub', url: 'https://github.com/test', icon: 'github' },
      { title: 'Twitter', url: 'https://twitter.com/test', icon: 'twitter' },
    ];
    const { root } = await render(<forja-footer socialLinks={socialLinks} />);
    const links = root.querySelectorAll('.forja-footer__social-link');
    expect(links.length).toBe(2);
    expect(links[0].getAttribute('target')).toBe('_blank');
    expect(links[0].querySelector('svg')).not.toBeNull();
  });

  it('renders copyright with current year', async () => {
    const { root } = await render(<forja-footer siteName="Test" />);
    const copyright = root.querySelector('.forja-footer__copyright')!;
    expect(copyright.textContent).toContain(new Date().getFullYear().toString());
    expect(copyright.textContent).toContain('Test');
  });

  it('renders RSS and sitemap links by default', async () => {
    const { root } = await render(<forja-footer />);
    expect(root.querySelector('a[href="/rss.xml"]')).not.toBeNull();
    expect(root.querySelector('a[href="/sitemap.xml"]')).not.toBeNull();
  });

  it('hides RSS and sitemap when disabled', async () => {
    const { root } = await render(<forja-footer showRss={false} showSitemap={false} />);
    expect(root.querySelector('a[href="/rss.xml"]')).toBeNull();
    expect(root.querySelector('a[href="/sitemap.xml"]')).toBeNull();
  });

  it('uses semantic footer element', async () => {
    const { root } = await render(<forja-footer />);
    expect(root.querySelector('footer')).not.toBeNull();
  });
});
