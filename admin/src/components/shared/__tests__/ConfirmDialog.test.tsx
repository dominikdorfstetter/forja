import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/test/test-utils';
import ConfirmDialog from '../ConfirmDialog';

const defaultProps = {
  open: true,
  title: 'Delete item?',
  message: 'This action cannot be undone.',
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
};

describe('ConfirmDialog', () => {
  it('renders title and message when open', () => {
    renderWithProviders(<ConfirmDialog {...defaultProps} />);
    expect(screen.getByText('Delete item?')).toBeInTheDocument();
    expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument();
  });

  it('calls onConfirm on confirm click', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    renderWithProviders(<ConfirmDialog {...defaultProps} onConfirm={onConfirm} />);
    await user.click(screen.getByTestId('confirm-dialog-confirm'));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('calls onCancel on cancel click', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    renderWithProviders(<ConfirmDialog {...defaultProps} onCancel={onCancel} />);
    await user.click(screen.getByTestId('confirm-dialog-cancel'));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('shows loading state with buttons disabled', () => {
    renderWithProviders(<ConfirmDialog {...defaultProps} loading />);
    const buttons = screen.getAllByRole('button');
    buttons.forEach((b) => {
      expect(b).toBeDisabled();
    });
  });

  it('is not visible when closed', () => {
    renderWithProviders(<ConfirmDialog {...defaultProps} open={false} />);
    expect(screen.queryByText('Delete item?')).not.toBeInTheDocument();
  });
});
