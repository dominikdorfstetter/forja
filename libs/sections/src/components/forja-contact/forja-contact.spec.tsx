import { render, h, describe, it, expect } from '@stencil/vitest';

describe('forja-contact', () => {
  it('renders form with fields', async () => {
    const fields = [
      { name: 'email', label: 'Email', type: 'email' as const, required: true },
      { name: 'message', label: 'Message', type: 'textarea' as const },
    ];
    const { root } = await render(<forja-contact sectionTitle="Contact Us" fields={fields} />);
    const form = root.querySelector('form')!;
    expect(form).not.toBeNull();

    const inputs = form.querySelectorAll('input');
    const textareas = form.querySelectorAll('textarea');
    expect(inputs.length).toBe(1);
    expect(textareas.length).toBe(1);
    expect(inputs[0].getAttribute('type')).toBe('email');
    expect(inputs[0].getAttribute('aria-required')).toBe('true');
  });

  it('renders required field indicator', async () => {
    const fields = [{ name: 'name', label: 'Name', type: 'text' as const, required: true }];
    const { root } = await render(<forja-contact fields={fields} />);
    const label = root.querySelector('label')!;
    expect(label.textContent).toContain('*');
    expect(label.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  it('links labels to inputs via id', async () => {
    const fields = [{ name: 'email', label: 'Email', type: 'email' as const }];
    const { root } = await render(<forja-contact fields={fields} />);
    const label = root.querySelector('label')!;
    const input = root.querySelector('input')!;
    expect(label.getAttribute('for')).toBe(input.getAttribute('id'));
  });

  const fields = [{ name: 'email', label: 'Email', type: 'email' as const, required: true }];

  it('renders the ALTCHA widget only when bot protection is mandatory (#773)', async () => {
    const { root } = await render(
      <forja-contact
        fields={fields}
        botProtection="mandatory"
        altchaChallengeUrl="/api/v1/public/forms/contact/altcha-challenge"
      />,
    );
    const widget = root.querySelector('altcha-widget');
    expect(widget).not.toBeNull();
    expect(widget!.getAttribute('name')).toBe('altcha');
    expect(widget!.getAttribute('challenge')).toBe(
      '/api/v1/public/forms/contact/altcha-challenge',
    );
  });

  it('renders no widget for a non-mandatory form', async () => {
    const { root } = await render(<forja-contact fields={fields} />);
    expect(root.querySelector('altcha-widget')).toBeNull();
  });

  it('blocks submission of a mandatory form until ALTCHA is solved (#773)', async () => {
    const { root, waitForChanges } = await render(
      <forja-contact fields={fields} botProtection="mandatory" />,
    );
    let emitted = 0;
    root.addEventListener('forjaSubmit', () => {
      emitted += 1;
    });

    const form = root.querySelector('form')!;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await waitForChanges();

    expect(emitted).toBe(0);
    expect(root.querySelector('[data-testid="forja-contact-altcha-error"]')).not.toBeNull();
  });
});
