import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '@/test/test-utils';
import LoadingState from '../LoadingState';

describe('LoadingState', () => {
  it('renders spinner with default label', () => {
    renderWithProviders(<LoadingState />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders custom label', () => {
    renderWithProviders(<LoadingState label="Loading tags..." />);
    expect(screen.getByText('Loading tags...')).toBeInTheDocument();
  });
});
