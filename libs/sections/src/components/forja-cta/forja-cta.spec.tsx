import { render, h, describe, it, expect } from '@stencil/vitest';

describe('forja-cta', () => {
  it('renders with title and button', async () => {
    const { root } = await render(
      <forja-cta sectionTitle="Get Started" buttonText="Sign Up" buttonHref="/signup" />,
    );
    expect(root.querySelector('.forja-cta__title')!.textContent).toBe('Get Started');
    expect(root.querySelector('.forja-cta__button')!.textContent).toBe('Sign Up');
    expect(root.querySelector('.forja-cta__button')!.getAttribute('href')).toBe('/signup');
  });

  it('hides button when props missing', async () => {
    const { root } = await render(<forja-cta sectionTitle="CTA" />);
    expect(root.querySelector('.forja-cta__button')).toBeNull();
  });

  it('uses lazy loading for image', async () => {
    const { root } = await render(<forja-cta imageUrl="/cta.jpg" />);
    expect(root.querySelector('.forja-cta__image')!.getAttribute('loading')).toBe('lazy');
  });

  it('uses fallback aria-label', async () => {
    const { root } = await render(<forja-cta />);
    expect(root.querySelector('section')!.getAttribute('aria-label')).toBe('Call to action');
  });
});
