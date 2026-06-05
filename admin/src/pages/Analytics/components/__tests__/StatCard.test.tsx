import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatCard from '../StatCard';

describe('StatCard', () => {
  it('renders label and formatted value', () => {
    render(<StatCard label="Total Views" value={12345} />);

    expect(screen.getByText('Total Views')).toBeInTheDocument();
    expect(screen.getByText('12,345')).toBeInTheDocument();
  });

  it('shows skeleton when loading', () => {
    const { container } = render(
      <StatCard label="Total Views" value={0} loading />,
    );

    expect(screen.getByText('Total Views')).toBeInTheDocument();
    // MUI Skeleton renders a span with the MuiSkeleton class
    expect(
      container.querySelector('.MuiSkeleton-root'),
    ).toBeInTheDocument();
    // The value should not be rendered while loading
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });
});
