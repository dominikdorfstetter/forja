import { render, h, describe, it, expect } from '@stencil/vitest';

describe('forja-hero', () => {
  it('renders with title', async () => {
    const { root } = await render(<forja-hero sectionTitle="Hello" />);
    expect(root.querySelector('.forja-hero__title')!.textContent).toBe('Hello');
    expect(root.querySelector('section')!.getAttribute('aria-label')).toBe('Hello');
  });

  it('renders all props', async () => {
    const { root } = await render(
      <forja-hero
        sectionTitle="Hero"
        text="<p>Body</p>"
        imageUrl="/hero.jpg"
        imageAlt="Alt"
        buttonText="CTA"
        buttonHref="/go"
      />,
    );
    expect(root.querySelector('.forja-hero__title')!.textContent).toBe('Hero');
    expect(root.querySelector('.forja-hero__text')!.innerHTML).toContain('<p>Body</p>');
    expect(root.querySelector('.forja-hero__image')!.getAttribute('src')).toBe('/hero.jpg');
    expect(root.querySelector('.forja-hero__image')!.getAttribute('alt')).toBe('Alt');
    expect(root.querySelector('.forja-hero__cta')!.textContent).toBe('CTA');
    expect(root.querySelector('.forja-hero__cta')!.getAttribute('href')).toBe('/go');
  });

  it('renders minimal (title only)', async () => {
    const { root } = await render(<forja-hero sectionTitle="Solo" />);
    expect(root.querySelector('.forja-hero__title')).not.toBeNull();
    expect(root.querySelector('.forja-hero__image')).toBeNull();
    expect(root.querySelector('.forja-hero__text')).toBeNull();
    expect(root.querySelector('.forja-hero__cta')).toBeNull();
  });

  it('uses fallback aria-label when no title', async () => {
    const { root } = await render(<forja-hero />);
    expect(root.querySelector('section')!.getAttribute('aria-label')).toBe('Hero');
  });

  it('applies modifier classes', async () => {
    const { root } = await render(<forja-hero fullWidth gradient />);
    const section = root.querySelector('section')!;
    expect(section.className).toContain('forja-hero--full-width');
    expect(section.className).toContain('forja-hero--gradient');
  });
});
