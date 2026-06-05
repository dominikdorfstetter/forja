import { render, h, describe, it, expect } from '@stencil/vitest';

describe('forja-legal', () => {
  it('renders title and body', async () => {
    const { root } = await render(
      <forja-legal sectionTitle="Privacy Policy" body="<h2>Data Collection</h2><p>We collect...</p>" />,
    );
    expect(root.querySelector('.forja-legal__title')!.textContent).toBe('Privacy Policy');
    expect(root.querySelector('.forja-legal__body')!.innerHTML).toContain('<h2>Data Collection</h2>');
  });

  it('renders document type badge', async () => {
    const { root } = await render(
      <forja-legal sectionTitle="TOS" documentType="TermsOfService" />,
    );
    expect(root.querySelector('.forja-legal__type')!.textContent).toBe('Terms of Service');
  });

  it('renders version number', async () => {
    const { root } = await render(
      <forja-legal sectionTitle="Policy" version={3} />,
    );
    expect(root.querySelector('.forja-legal__version')!.textContent).toBe('Version 3');
  });

  it('renders effective date when provided', async () => {
    const { root } = await render(
      <forja-legal sectionTitle="Policy" effectiveDate="2024-06-01" showDates />,
    );
    const time = root.querySelector('.forja-legal__date')!;
    expect(time.textContent).toContain('Effective');
    expect(time.getAttribute('datetime')).toBe('2024-06-01');
  });

  it('falls back to updatedAt when no effectiveDate', async () => {
    const { root } = await render(
      <forja-legal sectionTitle="Policy" updatedAt="2024-03-15" showDates />,
    );
    const time = root.querySelector('.forja-legal__date')!;
    expect(time.textContent).toContain('Updated');
  });

  it('renders intro when showIntro is true (default)', async () => {
    const { root } = await render(
      <forja-legal sectionTitle="Policy" intro="<p>Summary of changes</p>" />,
    );
    const intro = root.querySelector('.forja-legal__intro')!;
    expect(intro).not.toBeNull();
    expect(intro.innerHTML).toContain('Summary of changes');
  });

  it('hides intro when showIntro is false', async () => {
    const { root } = await render(
      <forja-legal sectionTitle="Policy" intro="<p>Hidden</p>" showIntro={false} />,
    );
    expect(root.querySelector('.forja-legal__intro')).toBeNull();
  });

  it('hides metadata when all toggles are false', async () => {
    const { root } = await render(
      <forja-legal
        sectionTitle="Policy"
        documentType="PrivacyPolicy"
        version={2}
        updatedAt="2024-01-01"
        showDocumentType={false}
        showVersion={false}
        showDates={false}
      />,
    );
    expect(root.querySelector('.forja-legal__meta')).toBeNull();
  });

  it('uses article element for semantic document structure', async () => {
    const { root } = await render(<forja-legal sectionTitle="Imprint" />);
    expect(root.querySelector('article')).not.toBeNull();
    expect(root.querySelector('header')).not.toBeNull();
  });

  it('uses fallback aria-label', async () => {
    const { root } = await render(<forja-legal />);
    expect(root.querySelector('article')!.getAttribute('aria-label')).toBe('Legal document');
  });
});
