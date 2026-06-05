import { describe, expect, it } from 'vitest';
import { renderWithProviders, screen } from '@/test/test-utils';
import WelcomeCapabilities from '../WelcomeCapabilities';

/**
 * Tracer (#810): the capability grid tells an honest v1.8.0 story, compliance
 * first. We assert shipped features are named (RoPA, Collections), that the
 * compliance group leads, and that no vaporware language sneaks in.
 */
describe('WelcomeCapabilities', () => {
  it('names shipped v1.8.0 capabilities (RoPA, Collections)', () => {
    renderWithProviders(<WelcomeCapabilities />);
    expect(screen.getByText(/RoPA/)).toBeInTheDocument();
    expect(screen.getByText(/Collections/)).toBeInTheDocument();
  });

  it('leads with the compliance group', () => {
    renderWithProviders(<WelcomeCapabilities />);
    const groupHeadings = screen.getAllByRole('heading', { level: 3 });
    expect(groupHeadings[0]).toHaveTextContent(/compliance/i);
  });

  it('advertises no unshipped vaporware', () => {
    const { container } = renderWithProviders(<WelcomeCapabilities />);
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/coming soon|beta|roadmap|planned/i);
  });

  it('hides decorative icons from assistive tech', () => {
    const { container } = renderWithProviders(<WelcomeCapabilities />);
    // every svg icon is decorative — the card text is the accessible name
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThan(0);
    svgs.forEach((svg) => expect(svg).toHaveAttribute('aria-hidden'));
  });
});
