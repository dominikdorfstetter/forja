import { render, h, describe, it, expect } from '@stencil/vitest';

describe('forja-pricing', () => {
  it('renders pricing tiers', async () => {
    const tiers = [
      { name: 'Free', price: '$0', features: ['1 site'], buttonText: 'Start', buttonHref: '/free' },
      { name: 'Pro', price: '$19', period: '/month', highlighted: true, features: ['10 sites', 'Priority support'] },
    ];
    const { root } = await render(<forja-pricing sectionTitle="Plans" tiers={tiers} />);
    const tierEls = root.querySelectorAll('.forja-pricing__tier');
    expect(tierEls.length).toBe(2);
    expect(tierEls[0].querySelector('.forja-pricing__tier-name')!.textContent).toBe('Free');
    expect(tierEls[0].querySelector('.forja-pricing__amount')!.textContent).toBe('$0');
    expect(tierEls[0].querySelector('.forja-pricing__cta')!.textContent).toBe('Start');
  });

  it('applies highlighted modifier', async () => {
    const tiers = [{ name: 'Pro', price: '$19', highlighted: true }];
    const { root } = await render(<forja-pricing tiers={tiers} />);
    expect(root.querySelector('.forja-pricing__tier--highlighted')).not.toBeNull();
  });

  it('renders features as list items', async () => {
    const tiers = [{ name: 'A', price: '$1', features: ['X', 'Y', 'Z'] }];
    const { root } = await render(<forja-pricing tiers={tiers} />);
    const features = root.querySelectorAll('.forja-pricing__feature');
    expect(features.length).toBe(3);
  });
});
