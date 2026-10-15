import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, userEvent, within } from '@/test/test-utils';
import type { CvEntryResponse } from '@/types/api';
import CvEntryActionsMenu from '../CvEntryActionsMenu';

const entry = { id: 'cv-1', company: 'Acme' } as CvEntryResponse;

function setup({ canWrite = true, isAdmin = true } = {}) {
  const onEdit = vi.fn();
  const onDelete = vi.fn();
  renderWithProviders(<CvEntryActionsMenu entry={entry} canWrite={canWrite} isAdmin={isAdmin} onEdit={onEdit} onDelete={onDelete} />);
  return { onEdit, onDelete };
}

async function openMenu() {
  await userEvent.click(screen.getByTestId('cv-entry-actions.btn.menu'));
  return screen.getByRole('menu');
}

describe('CvEntryActionsMenu', () => {
  it('offers edit to writers and delete to admins, and hands the entry to each', async () => {
    const { onEdit, onDelete } = setup();

    await userEvent.click(within(await openMenu()).getByRole('menuitem', { name: 'Edit' }));
    expect(onEdit).toHaveBeenCalledWith(entry);

    await userEvent.click(within(await openMenu()).getByRole('menuitem', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledWith(entry);
  });

  it('hides edit from read-only users and delete from non-admins', async () => {
    setup({ canWrite: false, isAdmin: false });

    expect(within(await openMenu()).queryAllByRole('menuitem')).toHaveLength(0);
  });
});
