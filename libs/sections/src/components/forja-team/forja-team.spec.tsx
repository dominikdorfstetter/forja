import { render, h, describe, it, expect } from '@stencil/vitest';

describe('forja-team', () => {
  it('renders team members', async () => {
    const members = [
      { name: 'Alice', role: 'CTO', bio: 'Builder', imageUrl: '/alice.jpg' },
      { name: 'Bob' },
    ];
    const { root } = await render(<forja-team sectionTitle="Our Team" members={members} />);
    const memberEls = root.querySelectorAll('.forja-team__member');
    expect(memberEls.length).toBe(2);
    expect(memberEls[0].querySelector('.forja-team__name')!.textContent).toBe('Alice');
    expect(memberEls[0].querySelector('.forja-team__role')!.textContent).toBe('CTO');
    expect(memberEls[0].querySelector('.forja-team__image')!.getAttribute('alt')).toBe('Alice');
  });

  it('respects showRole and showBio flags', async () => {
    const members = [{ name: 'Alice', role: 'CTO', bio: 'Builder' }];
    const { root } = await render(<forja-team showRole={false} showBio={false} members={members} />);
    expect(root.querySelector('.forja-team__role')).toBeNull();
    expect(root.querySelector('.forja-team__bio')).toBeNull();
  });
});
