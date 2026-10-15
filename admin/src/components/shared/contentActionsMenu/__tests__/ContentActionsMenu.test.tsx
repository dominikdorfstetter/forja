import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, userEvent, within } from '@/test/test-utils';
import type { ContentStatus, ProjectResponse } from '@/types/api';
import ProjectActionsMenu from '@/components/portfolio/ProjectActionsMenu';

function project(status: ContentStatus): ProjectResponse {
  return { id: 'p-1', status } as ProjectResponse;
}

async function openMenu() {
  await userEvent.click(screen.getByTestId('project-actions.btn.menu'));
  return screen.getByRole('menu');
}

function menuLabels(menu: HTMLElement): string[] {
  return within(menu).getAllByRole('menuitem').map((item) => item.textContent?.trim() ?? '');
}

function setup(status: ContentStatus, opts: { canWrite?: boolean; isAdmin?: boolean; withArchive?: boolean } = {}) {
  const handlers = {
    onEdit: vi.fn(),
    onPublish: vi.fn(),
    onUnpublish: vi.fn(),
    onDelete: vi.fn(),
    onArchive: opts.withArchive === false ? undefined : vi.fn(),
    onRestore: opts.withArchive === false ? undefined : vi.fn(),
  };
  const item = project(status);
  renderWithProviders(
    <ProjectActionsMenu project={item} canWrite={opts.canWrite ?? true} isAdmin={opts.isAdmin ?? true} {...handlers} />,
  );
  return { handlers, item };
}

describe('ProjectActionsMenu', () => {
  it('lists Scheduled project actions in order with Delete last', async () => {
    setup('Scheduled');
    expect(menuLabels(await openMenu())).toEqual(['Edit', 'Publish', 'Unpublish', 'Archive', 'Delete']);
  });

  it('offers Restore for archived projects', async () => {
    setup('Archived');
    expect(menuLabels(await openMenu())).toEqual(['Edit', 'Restore', 'Delete']);
  });

  it('omits Archive and Restore when no handler is wired', async () => {
    setup('Published', { withArchive: false });
    expect(menuLabels(await openMenu())).toEqual(['Edit', 'Unpublish', 'Delete']);
  });

  it('closes the menu and dispatches the chosen action with the project', async () => {
    const { handlers, item } = setup('Draft');
    await userEvent.click(within(await openMenu()).getByText('Publish'));
    expect(handlers.onPublish).toHaveBeenCalledWith(item);
    expect(screen.getByTestId('project-actions.btn.menu')).toHaveAttribute('aria-expanded', 'false');
  });

  it('routes Delete to onDelete', async () => {
    const { handlers, item } = setup('Draft');
    await userEvent.click(within(await openMenu()).getByText('Delete'));
    expect(handlers.onDelete).toHaveBeenCalledWith(item);
  });

  it('hides Delete for non-admins', async () => {
    setup('Draft', { isAdmin: false });
    expect(menuLabels(await openMenu())).not.toContain('Delete');
  });

  it('shows nothing but Delete to a read-only admin', async () => {
    setup('Published', { canWrite: false });
    expect(menuLabels(await openMenu())).toEqual(['Delete']);
  });
});
