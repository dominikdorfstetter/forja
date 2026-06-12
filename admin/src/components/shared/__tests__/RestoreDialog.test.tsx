import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/test/test-utils';
import RestoreDialog from '../RestoreDialog';

const defaultProps = {
  open: true,
  title: 'Restore blog post?',
  message: 'The post will return to its previous status.',
  onRestore: vi.fn(),
  onRestoreAsDraft: vi.fn(),
  onCancel: vi.fn(),
};

describe('RestoreDialog', () => {
  it('shows what is being restored', () => {
    renderWithProviders(<RestoreDialog {...defaultProps} />);
    expect(screen.getByText('Restore blog post?')).toBeInTheDocument();
    expect(
      screen.getByText('The post will return to its previous status.'),
    ).toBeInTheDocument();
  });

  it('restores with the original status via "Restore"', async () => {
    const user = userEvent.setup();
    const onRestore = vi.fn();
    renderWithProviders(<RestoreDialog {...defaultProps} onRestore={onRestore} />);
    await user.click(screen.getByTestId('restore-dialog.btn.restore'));
    expect(onRestore).toHaveBeenCalledOnce();
  });

  it('restores as draft via "Restore as Draft"', async () => {
    const user = userEvent.setup();
    const onRestoreAsDraft = vi.fn();
    renderWithProviders(
      <RestoreDialog {...defaultProps} onRestoreAsDraft={onRestoreAsDraft} />,
    );
    await user.click(screen.getByTestId('restore-dialog.btn.restore-draft'));
    expect(onRestoreAsDraft).toHaveBeenCalledOnce();
  });

  it('cancels without restoring', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onRestore = vi.fn();
    renderWithProviders(
      <RestoreDialog {...defaultProps} onCancel={onCancel} onRestore={onRestore} />,
    );
    await user.click(screen.getByTestId('restore-dialog.btn.cancel'));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onRestore).not.toHaveBeenCalled();
  });

  it('disables all actions while a restore is in flight', () => {
    renderWithProviders(<RestoreDialog {...defaultProps} loading />);
    expect(screen.getByTestId('restore-dialog.btn.restore')).toBeDisabled();
    expect(screen.getByTestId('restore-dialog.btn.restore-draft')).toBeDisabled();
    expect(screen.getByTestId('restore-dialog.btn.cancel')).toBeDisabled();
  });

  it('is not rendered when closed', () => {
    renderWithProviders(<RestoreDialog {...defaultProps} open={false} />);
    expect(screen.queryByText('Restore blog post?')).not.toBeInTheDocument();
  });
});
