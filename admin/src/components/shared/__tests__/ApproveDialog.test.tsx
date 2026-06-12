import { describe, it, expect, vi } from 'vitest';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { renderWithProviders, screen, userEvent } from '@/test/test-utils';
import ApproveDialog from '../ApproveDialog';

const defaultProps = {
  open: true,
  onPublishNow: vi.fn(),
  onSchedule: vi.fn(),
  onCancel: vi.fn(),
};

function renderDialog(props: Partial<typeof defaultProps & { loading: boolean }> = {}) {
  return renderWithProviders(
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <ApproveDialog {...defaultProps} {...props} />
    </LocalizationProvider>,
  );
}

describe('ApproveDialog', () => {
  it('explains the approval choice in title and message', () => {
    renderDialog();
    expect(screen.getByText('Approve content')).toBeInTheDocument();
    expect(screen.getByText('Choose how to publish this content.')).toBeInTheDocument();
  });

  it('publishes immediately via "Publish Now"', async () => {
    const user = userEvent.setup();
    const onPublishNow = vi.fn();
    renderDialog({ onPublishNow });
    await user.click(screen.getByTestId('approve-dialog.btn.publish-now'));
    expect(onPublishNow).toHaveBeenCalledOnce();
  });

  it('cancels without publishing', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onPublishNow = vi.fn();
    renderDialog({ onCancel, onPublishNow });
    await user.click(screen.getByTestId('approve-dialog.btn.cancel'));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onPublishNow).not.toHaveBeenCalled();
  });

  it('switching to schedule mode shows the date picker and keeps Confirm disabled until a date is chosen', async () => {
    const user = userEvent.setup();
    const onSchedule = vi.fn();
    renderDialog({ onSchedule });

    await user.click(screen.getByTestId('approve-dialog.btn.schedule'));

    // MUI outlined inputs render the label text twice (label + fieldset legend)
    expect(
      screen.getByText('Select publish date', { selector: 'label' }),
    ).toBeInTheDocument();
    const confirm = screen.getByRole('button', { name: 'Confirm' });
    expect(confirm).toBeDisabled();

    // Publish-now is replaced by the schedule confirmation in this mode
    expect(screen.queryByTestId('approve-dialog.btn.publish-now')).not.toBeInTheDocument();

    await user.click(confirm);
    expect(onSchedule).not.toHaveBeenCalled();
  });

  it('disables every action while loading', () => {
    renderDialog({ loading: true });
    expect(screen.getByTestId('approve-dialog.btn.publish-now')).toBeDisabled();
    expect(screen.getByTestId('approve-dialog.btn.schedule')).toBeDisabled();
    expect(screen.getByTestId('approve-dialog.btn.cancel')).toBeDisabled();
  });

  it('is not rendered when closed', () => {
    renderDialog({ open: false });
    expect(screen.queryByText('Approve content')).not.toBeInTheDocument();
  });
});
