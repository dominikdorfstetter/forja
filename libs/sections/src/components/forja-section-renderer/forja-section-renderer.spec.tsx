import { render, h, describe, it, expect } from '@stencil/vitest';

describe('forja-section-renderer', () => {
  it('dispatches Hero section type to forja-hero', async () => {
    const { root } = await render(
      <forja-section-renderer sectionType="Hero" sectionTitle="Hi" />,
    );
    expect(root.querySelector('forja-hero')).not.toBeNull();
  });

  it('renders fallback for unknown section type', async () => {
    const { root } = await render(
      <forja-section-renderer sectionType="Unknown" sectionTitle="X" />,
    );
    expect(root.querySelector('.forja-custom')).not.toBeNull();
    expect(root.querySelector('.forja-custom__title')!.textContent).toBe('X');
  });

  it('renders fallback for Custom section type', async () => {
    const { root } = await render(
      <forja-section-renderer sectionType="Custom" sectionTitle="My Section" />,
    );
    expect(root.querySelector('.forja-custom')).not.toBeNull();
  });
});
