import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/test/test-utils';
import { DangerConfirmDialog } from '../index';

function setup(overrides: Partial<React.ComponentProps<typeof DangerConfirmDialog>> = {}) {
  const onConfirm = vi.fn();
  const onClose = vi.fn();
  const props = {
    open: true,
    title: 'Delete this site',
    body: 'This permanently removes the site.',
    confirmPhrase: 'acme',
    confirmLabel: 'Delete site',
    onConfirm,
    onClose,
    ...overrides,
  };
  const view = renderWithProviders(<DangerConfirmDialog {...props} />);
  return { view, ...props };
}

describe('DangerConfirmDialog', () => {
  it('enables confirm only after the exact phrase is typed, then fires onConfirm once', async () => {
    const user = userEvent.setup();
    const { onConfirm } = setup();

    const confirm = screen.getByTestId('danger-confirm-dialog.confirm');
    expect(confirm).toBeDisabled();

    await user.type(screen.getByTestId('danger-confirm-dialog.input'), 'acme');
    expect(confirm).toBeEnabled();

    await user.click(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('keeps confirm disabled and shows the mismatch helper on wrong input', async () => {
    const user = userEvent.setup();
    const { onConfirm } = setup();

    await user.type(screen.getByTestId('danger-confirm-dialog.input'), 'acm');

    expect(screen.getByTestId('danger-confirm-dialog.confirm')).toBeDisabled();
    expect(
      screen.getByText("The text doesn't match. Type it exactly to continue."),
    ).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('matches case-sensitively but ignores surrounding whitespace', async () => {
    const user = userEvent.setup();
    setup({ confirmPhrase: 'Acme' });
    const input = screen.getByTestId('danger-confirm-dialog.input');
    const confirm = screen.getByTestId('danger-confirm-dialog.confirm');

    await user.type(input, 'acme');
    expect(confirm).toBeDisabled();

    await user.clear(input);
    await user.type(input, '  Acme  ');
    expect(confirm).toBeEnabled();
  });

  it('calls onClose (not onConfirm) when Cancel is clicked', async () => {
    const user = userEvent.setup();
    const { onClose, onConfirm } = setup();

    await user.click(screen.getByTestId('danger-confirm-dialog.cancel'));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('calls onClose (not onConfirm) when Escape is pressed', async () => {
    const user = userEvent.setup();
    const { onClose, onConfirm } = setup();

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('confirms on Enter only once the phrase matches', async () => {
    const user = userEvent.setup();
    const { onConfirm } = setup();
    const input = screen.getByTestId('danger-confirm-dialog.input');

    await user.type(input, 'wrong{Enter}');
    expect(onConfirm).not.toHaveBeenCalled();

    await user.clear(input);
    await user.type(input, 'acme{Enter}');
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('resets the typed value when the dialog is reopened', async () => {
    const user = userEvent.setup();
    const { view } = setup();
    const input = () => screen.getByTestId('danger-confirm-dialog.input');

    await user.type(input(), 'acme');
    expect(screen.getByTestId('danger-confirm-dialog.confirm')).toBeEnabled();

    view.rerender(
      <DangerConfirmDialog
        open={false}
        title="Delete this site"
        body="This permanently removes the site."
        confirmPhrase="acme"
        confirmLabel="Delete site"
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    view.rerender(
      <DangerConfirmDialog
        open
        title="Delete this site"
        body="This permanently removes the site."
        confirmPhrase="acme"
        confirmLabel="Delete site"
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(input()).toHaveValue('');
    expect(screen.getByTestId('danger-confirm-dialog.confirm')).toBeDisabled();
  });

  it('autofocuses the input and wires aria-describedby to the body', () => {
    setup();

    const input = screen.getByTestId('danger-confirm-dialog.input');
    expect(input).toHaveFocus();
    expect(screen.getByTestId('danger-confirm-dialog')).toBeInTheDocument();

    const describedBy = screen.getByRole('dialog').getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy as string)).toHaveTextContent(
      'This permanently removes the site.',
    );
  });

  it('disables the confirm button while loading', () => {
    setup({ loading: true });
    expect(screen.getByTestId('danger-confirm-dialog.confirm')).toBeDisabled();
  });
});
