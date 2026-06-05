import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/test/test-utils';
import EmptyState from '../EmptyState';

describe('EmptyState', () => {
  it('renders title and description', () => {
    renderWithProviders(
      <EmptyState title="No items" description="Add your first item" />,
    );
    expect(screen.getByText('No items')).toBeInTheDocument();
    expect(screen.getByText('Add your first item')).toBeInTheDocument();
  });

  it('renders action button when provided', () => {
    renderWithProviders(
      <EmptyState
        title="No items"
        action={{ label: 'Add item', onClick: () => {} }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Add item' })).toBeInTheDocument();
  });

  it('calls onClick when action clicked', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    renderWithProviders(
      <EmptyState
        title="No items"
        action={{ label: 'Add item', onClick }}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Add item' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('does not render description when not provided', () => {
    renderWithProviders(<EmptyState title="Empty" />);
    expect(screen.getByText('Empty')).toBeInTheDocument();
    expect(screen.queryByText('Add your first item')).not.toBeInTheDocument();
  });
});
