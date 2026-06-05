import { render, h, describe, it, expect } from '@stencil/vitest';

describe('forja-faq', () => {
  it('renders FAQ items with details/summary', async () => {
    const items = [
      { question: 'What is Forja?', answer: '<p>A CMS</p>' },
      { question: 'Is it free?', answer: 'Yes' },
    ];
    const { root } = await render(<forja-faq sectionTitle="FAQ" items={items} />);
    const details = root.querySelectorAll('details');
    expect(details.length).toBe(2);
    expect(details[0].querySelector('summary')!.textContent).toBe('What is Forja?');
    expect(details[0].querySelector('.forja-faq__answer')!.innerHTML).toContain('<p>A CMS</p>');
  });

  it('sanitizes XSS payloads in the answer innerHTML sink', async () => {
    const items = [
      { question: 'q', answer: '<img src=x onerror="fetch(\'https://evil.example\')"><p>safe</p>' },
    ];
    const { root } = await render(<forja-faq items={items} />);
    const answer = root.querySelector('.forja-faq__answer')!;
    expect(answer.innerHTML).not.toContain('onerror');
    expect(answer.innerHTML).toContain('<p>safe</p>');
  });

  it('uses correct aria-label', async () => {
    const { root } = await render(<forja-faq />);
    expect(root.querySelector('section')!.getAttribute('aria-label')).toBe('Frequently asked questions');
  });
});
