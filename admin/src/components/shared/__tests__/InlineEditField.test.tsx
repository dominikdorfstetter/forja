import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, waitFor, userEvent } from '@/test/test-utils';
import InlineEditField from '../InlineEditField';

describe('InlineEditField', () => {
  it('displays the current value in read mode', () => {
    renderWithProviders(<InlineEditField value="My title" onSave={vi.fn()} />);
    expect(screen.getByText('My title')).toBeInTheDocument();
    expect(screen.queryByTestId('inline-edit.input')).not.toBeInTheDocument();
  });

  it('shows an em dash placeholder for an empty value', () => {
    renderWithProviders(<InlineEditField value="" onSave={vi.fn()} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('clicking the value enters edit mode with the current value focused', async () => {
    const user = userEvent.setup();
    renderWithProviders(<InlineEditField value="My title" onSave={vi.fn()} />);

    await user.click(screen.getByText('My title'));

    const input = screen.getByTestId('inline-edit.input').querySelector('input')!;
    expect(input).toHaveValue('My title');
    expect(input).toHaveFocus();
  });

  it('commits the new value on Enter and leaves edit mode', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(<InlineEditField value="My title" onSave={onSave} />);

    await user.click(screen.getByText('My title'));
    const input = screen.getByTestId('inline-edit.input').querySelector('input')!;
    await user.clear(input);
    await user.type(input, 'New title{Enter}');

    expect(onSave).toHaveBeenCalledWith('New title');
    await waitFor(() => {
      expect(screen.queryByTestId('inline-edit.input')).not.toBeInTheDocument();
    });
  });

  it('commits on blur', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(<InlineEditField value="My title" onSave={onSave} />);

    await user.click(screen.getByText('My title'));
    const input = screen.getByTestId('inline-edit.input').querySelector('input')!;
    await user.clear(input);
    await user.type(input, 'Blurred title');
    await user.tab();

    expect(onSave).toHaveBeenCalledWith('Blurred title');
  });

  it('cancels on Escape without saving and reverts to the original value', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    renderWithProviders(<InlineEditField value="My title" onSave={onSave} />);

    await user.click(screen.getByText('My title'));
    const input = screen.getByTestId('inline-edit.input').querySelector('input')!;
    await user.clear(input);
    await user.type(input, 'Discarded{Escape}');

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('My title')).toBeInTheDocument();
  });

  it('does not call onSave when the value is unchanged', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    renderWithProviders(<InlineEditField value="My title" onSave={onSave} />);

    await user.click(screen.getByText('My title'));
    await user.keyboard('{Enter}');

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.queryByTestId('inline-edit.input')).not.toBeInTheDocument();
  });

  it('stays in edit mode when the save fails', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockRejectedValue(new Error('save failed'));
    renderWithProviders(<InlineEditField value="My title" onSave={onSave} />);

    await user.click(screen.getByText('My title'));
    const input = screen.getByTestId('inline-edit.input').querySelector('input')!;
    await user.clear(input);
    await user.type(input, 'Doomed edit{Enter}');

    expect(onSave).toHaveBeenCalledWith('Doomed edit');
    await waitFor(() => {
      expect(screen.getByTestId('inline-edit.input')).toBeInTheDocument();
    });
  });

  it('cannot be edited when disabled', async () => {
    const user = userEvent.setup();
    renderWithProviders(<InlineEditField value="My title" onSave={vi.fn()} disabled />);

    expect(screen.queryByLabelText('Click to edit')).not.toBeInTheDocument();
    await user.click(screen.getByText('My title'));
    expect(screen.queryByTestId('inline-edit.input')).not.toBeInTheDocument();
  });
});
