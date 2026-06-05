import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/test-utils';
import UnderwaterBackdrop from '../UnderwaterBackdrop';

/**
 * The underwater backdrop is purely decorative: it must be hidden from
 * assistive tech and never intercept pointer events, so it can sit behind the
 * content without affecting interaction or the accessibility tree.
 */
describe('UnderwaterBackdrop', () => {
  it('renders a decorative, non-interactive layer', () => {
    const { container } = renderWithProviders(<UnderwaterBackdrop />);
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveAttribute('aria-hidden', 'true');
    expect(root).toHaveStyle({ pointerEvents: 'none' });
  });
});
