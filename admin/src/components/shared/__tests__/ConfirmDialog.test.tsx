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
    // The confirm button has the "contained" variant — find by role
    const buttons = screen.getAllByRole('button');
    const confirmButton = buttons.find((b) => b.classList.contains('MuiButton-contained'));
    expect(confirmButton).toBeDefined();
    await user.click(confirmButton!);
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('calls onCancel on cancel click', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    renderWithProviders(<ConfirmDialog {...defaultProps} onCancel={onCancel} />);
    const buttons = screen.getAllByRole('button');
    const cancelButton = buttons.find((b) => !b.classList.contains('MuiButton-contained'));
    expect(cancelButton).toBeDefined();
    await user.click(cancelButton!);
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
