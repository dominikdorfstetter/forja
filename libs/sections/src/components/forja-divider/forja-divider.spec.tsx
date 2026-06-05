import { render, h, describe, it, expect } from '@stencil/vitest';

describe('forja-divider', () => {
  it('renders as hr by default', async () => {
    const { root } = await render(<forja-divider />);
    expect(root.querySelector('hr')).not.toBeNull();
    expect(root.querySelector('hr')!.className).toContain('forja-divider--line');
  });

  it('renders labeled divider with role=separator', async () => {
    const { root } = await render(<forja-divider label="Section Break" />);
    const div = root.querySelector('[role="separator"]')!;
    expect(div).not.toBeNull();
    expect(div.getAttribute('aria-label')).toBe('Section Break');
    expect(div.querySelector('.forja-divider__label')!.textContent).toBe('Section Break');
  });

  it('applies style modifier', async () => {
    const { root } = await render(<forja-divider dividerStyle="dashed" />);
    expect(root.querySelector('hr')!.className).toContain('forja-divider--dashed');
  });
});
