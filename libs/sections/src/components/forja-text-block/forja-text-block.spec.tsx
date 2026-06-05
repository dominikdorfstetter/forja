import { render, h, describe, it, expect } from '@stencil/vitest';

describe('forja-text-block', () => {
  it('renders with title and text', async () => {
    const { root } = await render(<forja-text-block sectionTitle="About" text="<p>Hello</p>" />);
    expect(root.querySelector('.forja-text__title')!.textContent).toBe('About');
    expect(root.querySelector('.forja-text__content')!.innerHTML).toContain('<p>Hello</p>');
  });

  it('applies width and alignment modifiers', async () => {
    const { root } = await render(<forja-text-block width="narrow" alignment="center" />);
    const section = root.querySelector('section')!;
    expect(section.className).toContain('forja-text--narrow');
    expect(section.className).toContain('forja-text--center');
  });

  it('defaults to width=default and alignment=left', async () => {
    const { root } = await render(<forja-text-block />);
    const section = root.querySelector('section')!;
    expect(section.className).toContain('forja-text--default');
    expect(section.className).toContain('forja-text--left');
  });
});
