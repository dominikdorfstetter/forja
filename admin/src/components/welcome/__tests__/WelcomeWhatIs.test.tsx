import { describe, expect, it } from 'vitest';
import { renderWithProviders, screen } from '@/test/test-utils';
import WelcomeWhatIs from '../WelcomeWhatIs';

/**
 * Tracer (#808): the lead explainer must let a reader who does not know what a
 * CMS is state what Forja does — so the first paragraph is asserted jargon-free
 * and the section sits behind a labelled landmark with a single h2.
 */
describe('WelcomeWhatIs', () => {
  it('renders an h2 explainer heading inside a labelled region', () => {
    renderWithProviders(<WelcomeWhatIs />);
    const heading = screen.getByRole('heading', { level: 2, name: /what is forja/i });
    expect(heading).toBeInTheDocument();
    // section is a labelled landmark pointing at the heading
    const region = screen.getByRole('region', { name: /what is forja/i });
    expect(region).toContainElement(heading);
  });

  it('opens with a jargon-free first paragraph', () => {
    renderWithProviders(<WelcomeWhatIs />);
    const lead = screen.getByTestId('welcome.whatis.lead');
    const text = lead.textContent ?? '';
    expect(text.length).toBeGreaterThan(20);
    for (const jargon of [/\bCMS\b/i, /\bheadless\b/i, /\bAPI\b/i, /\bbackend\b/i]) {
      expect(text).not.toMatch(jargon);
    }
  });

  it('lists three plain-language points', () => {
    renderWithProviders(<WelcomeWhatIs />);
    expect(screen.getAllByTestId(/welcome\.whatis\.point\d/)).toHaveLength(3);
  });
});
