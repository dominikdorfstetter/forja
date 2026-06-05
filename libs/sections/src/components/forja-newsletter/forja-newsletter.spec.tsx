import { render, h, describe, it, expect } from '@stencil/vitest';

describe('forja-newsletter', () => {
  it('renders email field with required', async () => {
    const { root } = await render(<forja-newsletter sectionTitle="Subscribe" />);
    const emailInput = root.querySelector('input[type="email"]')!;
    expect(emailInput).not.toBeNull();
    expect(emailInput.getAttribute('aria-required')).toBe('true');
  });

  it('shows name field when showName is set', async () => {
    const { root } = await render(<forja-newsletter showName />);
    const inputs = root.querySelectorAll('input');
    expect(inputs.length).toBe(2);
    expect(inputs[0].getAttribute('type')).toBe('text');
    expect(inputs[1].getAttribute('type')).toBe('email');
  });

  it('defaults button text to Subscribe', async () => {
    const { root } = await render(<forja-newsletter />);
    expect(root.querySelector('button')!.textContent).toBe('Subscribe');
  });

  it('links labels to inputs', async () => {
    const { root } = await render(<forja-newsletter />);
    const label = root.querySelector('label')!;
    const input = root.querySelector('input')!;
    expect(label.getAttribute('for')).toBe(input.getAttribute('id'));
  });

  it('renders the ALTCHA widget when bot protection is mandatory (#773)', async () => {
    const { root } = await render(
      <forja-newsletter botProtection="mandatory" altchaChallengeUrl="/api/v1/public/forms/news/altcha-challenge" />,
    );
    const widget = root.querySelector('altcha-widget');
    expect(widget).not.toBeNull();
    expect(widget!.getAttribute('challenge')).toBe('/api/v1/public/forms/news/altcha-challenge');
  });

  it('blocks submission until ALTCHA is solved (#773)', async () => {
    const { root, waitForChanges } = await render(<forja-newsletter botProtection="mandatory" />);
    let emitted = 0;
    root.addEventListener('forjaSubmit', () => {
      emitted += 1;
    });
    const form = root.querySelector('form')!;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await waitForChanges();
    expect(emitted).toBe(0);
    expect(root.querySelector('[data-testid="forja-newsletter-altcha-error"]')).not.toBeNull();
  });
});
