import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/test/test-utils';
import FormDialog from '../FormDialog';

const defaultProps = {
  open: true,
  onClose: vi.fn(),
  title: 'Create entry',
};

describe('FormDialog', () => {
  it('renders title, subtitle and form fields when open', () => {
    renderWithProviders(
      <FormDialog {...defaultProps} subtitle="Fill in the fields below">
        <input aria-label="Name" />
      </FormDialog>,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Create entry')).toBeInTheDocument();
    expect(screen.getByText('Fill in the fields below')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
  });

  it('is not rendered when closed', () => {
    renderWithProviders(
      <FormDialog {...defaultProps} open={false}>
        <div>fields</div>
      </FormDialog>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('submits the form when the user clicks Save', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderWithProviders(
      <FormDialog {...defaultProps} onSubmit={onSubmit}>
        <div>fields</div>
      </FormDialog>,
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('closes via the Cancel button', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(
      <FormDialog {...defaultProps} onClose={onClose}>
        <div>fields</div>
      </FormDialog>,
    );
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('closes via the header close affordance', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(
      <FormDialog {...defaultProps} onClose={onClose}>
        <div>fields</div>
      </FormDialog>,
    );
    await user.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('closes on Escape (MUI Dialog keyboard handling)', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(
      <FormDialog {...defaultProps} onClose={onClose}>
        <div>fields</div>
      </FormDialog>,
    );
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('traps focus inside the dialog while open', () => {
    renderWithProviders(
      <FormDialog {...defaultProps}>
        <input aria-label="Name" />
      </FormDialog>,
    );
    expect(screen.getByRole('dialog')).toContainElement(
      document.activeElement as HTMLElement,
    );
  });

  it('disables both footer actions while loading', () => {
    renderWithProviders(
      <FormDialog
        {...defaultProps}
        onSubmit={vi.fn()}
        loading
        submitTestId="dlg.btn.submit"
        cancelTestId="dlg.btn.cancel"
      >
        <div>fields</div>
      </FormDialog>,
    );
    expect(screen.getByTestId('dlg.btn.submit')).toBeDisabled();
    expect(screen.getByTestId('dlg.btn.cancel')).toBeDisabled();
  });

  it('disables only the submit action when submitDisabled is set', () => {
    renderWithProviders(
      <FormDialog
        {...defaultProps}
        onSubmit={vi.fn()}
        submitDisabled
        submitTestId="dlg.btn.submit"
        cancelTestId="dlg.btn.cancel"
      >
        <div>fields</div>
      </FormDialog>,
    );
    expect(screen.getByTestId('dlg.btn.submit')).toBeDisabled();
    expect(screen.getByTestId('dlg.btn.cancel')).toBeEnabled();
  });

  it('renders custom labels for the footer actions', () => {
    renderWithProviders(
      <FormDialog
        {...defaultProps}
        onSubmit={vi.fn()}
        submitLabel="Create"
        cancelLabel="Dismiss"
      >
        <div>fields</div>
      </FormDialog>,
    );
    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
  });

  it('replaces the default footer with custom actions', () => {
    renderWithProviders(
      <FormDialog {...defaultProps} actions={<button>Custom action</button>}>
        <div>fields</div>
      </FormDialog>,
    );
    expect(screen.getByRole('button', { name: 'Custom action' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
  });
});
