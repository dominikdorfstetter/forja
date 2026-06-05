import { render, h, describe, it, expect } from '@stencil/vitest';

describe('forja-nav', () => {
  it('renders site name as brand link', async () => {
    const { root } = await render(<forja-nav siteName="My Site" />);
    const brand = root.querySelector('.forja-nav__brand')!;
    expect(brand.textContent).toBe('My Site');
    expect(brand.getAttribute('href')).toBe('/');
  });

  it('renders navigation items', async () => {
    const items = [
      { title: 'Home', href: '/' },
      { title: 'Blog', href: '/blog' },
      { title: 'External', href: 'https://example.com', openInNewTab: true },
    ];
    const { root } = await render(<forja-nav items={items} />);
    const links = root.querySelectorAll('.forja-nav__link');
    expect(links.length).toBe(3);
    expect(links[2].getAttribute('target')).toBe('_blank');
    expect(links[2].getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('renders dropdown for items with children', async () => {
    const items = [
      { title: 'Products', href: '#', children: [
        { title: 'CMS', href: '/cms' },
        { title: 'Blog', href: '/blog' },
      ]},
    ];
    const { root } = await render(<forja-nav items={items} />);
    expect(root.querySelector('.forja-nav__dropdown')).not.toBeNull();
    const dropdownItems = root.querySelectorAll('.forja-nav__dropdown-item');
    expect(dropdownItems.length).toBe(2);
  });

  it('renders theme toggle button by default', async () => {
    const { root } = await render(<forja-nav siteName="S" />);
    expect(root.querySelector('.forja-nav__theme-toggle')).not.toBeNull();
  });

  it('hides theme toggle when disabled', async () => {
    const { root } = await render(<forja-nav showThemeToggle={false} />);
    expect(root.querySelector('.forja-nav__theme-toggle')).toBeNull();
  });

  it('renders locale switcher when multiple locales', async () => {
    const locales = [
      { code: 'en', name: 'English' },
      { code: 'de', name: 'Deutsch' },
    ];
    const { root } = await render(<forja-nav locales={locales} currentLocale="en" />);
    expect(root.querySelector('.forja-nav__locale-toggle')).not.toBeNull();
  });

  it('hides locale switcher with single locale', async () => {
    const locales = [{ code: 'en', name: 'English' }];
    const { root } = await render(<forja-nav locales={locales} />);
    expect(root.querySelector('.forja-nav__locale-toggle')).toBeNull();
  });

  it('uses semantic nav element with aria-label', async () => {
    const { root } = await render(<forja-nav />);
    const nav = root.querySelector('nav')!;
    expect(nav.getAttribute('aria-label')).toBe('Main navigation');
  });
});
