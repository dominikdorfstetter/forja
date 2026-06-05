import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import WelcomeSurface from '../WelcomeSurface';

describe('WelcomeSurface', () => {
  it('renders children inside the scoped welcome-surface', () => {
    render(
      <WelcomeSurface>
        <p>brand content</p>
      </WelcomeSurface>,
    );
    const child = screen.getByText('brand content');
    expect(child).toBeInTheDocument();
    expect(child.closest('.welcome-surface')).not.toBeNull();
  });

  it('exposes the surface as a labelled landmark for screen readers', () => {
    render(
      <WelcomeSurface aria-label="Forja">
        <p>x</p>
      </WelcomeSurface>,
    );
    expect(screen.getByRole('main', { name: 'Forja' })).toBeInTheDocument();
  });
});
