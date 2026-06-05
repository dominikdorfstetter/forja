import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { SaveBarProvider, useRegisterSaveBar, type ChangedField } from '@/store/SaveBarContext';
import GlobalSaveBar from '@/components/layout/GlobalSaveBar';

function Host({
  changeCount,
  changedFields,
  onRevertField,
  onSave = vi.fn(),
  onDiscard = vi.fn(),
}: {
  changeCount?: number;
  changedFields?: ChangedField[];
  onRevertField?: (n: string) => void;
  onSave?: () => void;
  onDiscard?: () => void;
}) {
  useRegisterSaveBar('host', {
    visible: true,
    changeCount,
    changedFields,
    onRevertField,
    onSave,
    onDiscard,
    saveTestId: 'host-save',
    discardTestId: 'host-discard',
  });
  return null;
}

function renderBar(props: Parameters<typeof Host>[0] = {}) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <SaveBarProvider>
      {children}
      <GlobalSaveBar />
    </SaveBarProvider>
  );
  return render(<Host {...props} />, { wrapper });
}

describe('GlobalSaveBar change tracking', () => {
  it('shows a pluralised unsaved-changes count', () => {
    renderBar({ changeCount: 3 });
    expect(screen.getByText('3 unsaved changes')).toBeInTheDocument();
  });

  it('uses the singular form for a single change', () => {
    renderBar({ changeCount: 1 });
    expect(screen.getByText('1 unsaved change')).toBeInTheDocument();
  });

  it('opens a popover listing changed fields and reverts an individual field', async () => {
    const onRevertField = vi.fn();
    renderBar({
      changeCount: 2,
      changedFields: [
        { name: 'title', label: 'Title' },
        { name: 'body', label: 'Body' },
      ],
      onRevertField,
    });

    await userEvent.click(screen.getByTestId('save-bar-changes-toggle'));
    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByText('Body')).toBeInTheDocument();

    await userEvent.click(screen.getByTestId('save-bar-revert-title'));
    expect(onRevertField).toHaveBeenCalledWith('title');
  });

  it('does not render a changes toggle when there are no changedFields', () => {
    renderBar({ changeCount: 2 });
    expect(screen.queryByTestId('save-bar-changes-toggle')).not.toBeInTheDocument();
  });

  it('fires save and discard', async () => {
    const onSave = vi.fn();
    const onDiscard = vi.fn();
    renderBar({ changeCount: 1, onSave, onDiscard });
    await userEvent.click(screen.getByTestId('host-save'));
    await userEvent.click(screen.getByTestId('host-discard'));
    expect(onSave).toHaveBeenCalled();
    expect(onDiscard).toHaveBeenCalled();
  });
});
