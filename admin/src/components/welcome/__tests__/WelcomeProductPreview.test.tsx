import { describe, expect, it } from 'vitest';
import { renderWithProviders, screen, within } from '@/test/test-utils';
import WelcomeProductPreview from '../WelcomeProductPreview';

/**
 * Showcase (#806 slot): two real, framed product screenshots — the dashboard
 * workbench and the content editor, layered — must render as accessibly-named
 * images inside a labelled region, each served as a WebP with a PNG fallback so
 * the marketing surface stays light.
 */
describe('WelcomeProductPreview', () => {
  it('renders an h2 showcase heading inside a labelled region', () => {
    renderWithProviders(<WelcomeProductPreview />);
    const heading = screen.getByRole('heading', { level: 2, name: /see forja in action/i });
    const region = screen.getByRole('region', { name: /see forja in action/i });
    expect(region).toContainElement(heading);
  });

  it('shows both product screenshots as accessibly-named images', () => {
    renderWithProviders(<WelcomeProductPreview />);

    const dashboard = screen.getByTestId('welcome.showcase.dashboard');
    const editor = screen.getByTestId('welcome.showcase.editor');

    expect(within(dashboard).getByRole('img', { name: /forja dashboard/i })).toBeInTheDocument();
    expect(within(editor).getByRole('img', { name: /forja content editor/i })).toBeInTheDocument();
  });

  it('serves each screenshot as WebP with a PNG fallback (no layout shift)', () => {
    renderWithProviders(<WelcomeProductPreview />);

    const images = screen.getAllByRole('img');
    expect(images).toHaveLength(2);

    for (const img of images) {
      // intrinsic dimensions set → browser reserves space, avoiding CLS
      expect(img).toHaveAttribute('width', '1600');
      expect(img).toHaveAttribute('height', '1000');
      expect(img).toHaveAttribute('loading', 'lazy');
      expect(img.getAttribute('src')).toMatch(/\.png$/);

      const webpSource = img.closest('picture')?.querySelector('source[type="image/webp"]');
      expect(webpSource?.getAttribute('srcset')).toMatch(/\.webp$/);
    }
  });
});
