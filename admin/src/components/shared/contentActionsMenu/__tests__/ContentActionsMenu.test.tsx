import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, userEvent, within } from '@/test/test-utils';
import type { BlogListItem, ContentStatus, ProjectResponse } from '@/types/api';
import BlogActionsMenu from '@/components/blogs/BlogActionsMenu';
import ProjectActionsMenu from '@/components/portfolio/ProjectActionsMenu';

function blog(status: ContentStatus): BlogListItem {
  return { id: 'b-1', status } as BlogListItem;
}

function project(status: ContentStatus): ProjectResponse {
  return { id: 'p-1', status } as ProjectResponse;
}

async function openMenu(testId: string) {
  await userEvent.click(screen.getByTestId(testId));
  return screen.getByRole('menu');
}

function menuLabels(menu: HTMLElement): string[] {
  return within(menu).getAllByRole('menuitem').map((item) => item.textContent?.trim() ?? '');
}

function setupBlog(status: ContentStatus, opts: { canWrite?: boolean; isAdmin?: boolean; cloneDisabled?: boolean } = {}) {
  const handlers = {
    onView: vi.fn(),
    onClone: vi.fn(),
    onPublish: vi.fn(),
    onUnpublish: vi.fn(),
    onDelete: vi.fn(),
    onArchive: vi.fn(),
    onRestore: vi.fn(),
  };
  const item = blog(status);
  renderWithProviders(
    <BlogActionsMenu
      blog={item}
      canWrite={opts.canWrite ?? true}
      isAdmin={opts.isAdmin ?? true}
      cloneDisabled={opts.cloneDisabled}
      {...handlers}
    />,
  );
  return { handlers, item };
}

describe('BlogActionsMenu', () => {
  it('lists Scheduled blog actions in order with Delete last', async () => {
    setupBlog('Scheduled');
    const menu = await openMenu('blog-actions.btn.menu');
    expect(menuLabels(menu)).toEqual([
      'View details',
      'Publish',
      'Unpublish',
      'Clone',
      'Archive',
      'Delete',
    ]);
  });

  it('closes the menu and dispatches the chosen action with the blog', async () => {
    const { handlers, item } = setupBlog('Draft');
    const menu = await openMenu('blog-actions.btn.menu');
    await userEvent.click(within(menu).getByText('Publish'));
    expect(handlers.onPublish).toHaveBeenCalledWith(item);
    expect(screen.getByTestId('blog-actions.btn.menu')).toHaveAttribute('aria-expanded', 'false');
  });

  it('routes Delete to onDelete', async () => {
    const { handlers, item } = setupBlog('Draft');
    await userEvent.click(within(await openMenu('blog-actions.btn.menu')).getByText('Delete'));
    expect(handlers.onDelete).toHaveBeenCalledWith(item);
  });

  it('hides Delete for non-admins', async () => {
    setupBlog('Draft', { isAdmin: false });
    expect(menuLabels(await openMenu('blog-actions.btn.menu'))).not.toContain('Delete');
  });

  it('disables only Clone when cloneDisabled', async () => {
    setupBlog('Draft', { cloneDisabled: true });
    const menu = await openMenu('blog-actions.btn.menu');
    const items = within(menu).getAllByRole('menuitem');
    const clone = items.find((i) => i.textContent?.includes('Clone'));
    expect(clone).toHaveAttribute('aria-disabled', 'true');
    expect(items.filter((i) => i.getAttribute('aria-disabled') === 'true')).toHaveLength(1);
  });
});

describe('ProjectActionsMenu', () => {
  it('offers Edit instead of View and never Clone', async () => {
    renderWithProviders(
      <ProjectActionsMenu
        project={project('Archived')}
        canWrite
        isAdmin
        onEdit={vi.fn()}
        onPublish={vi.fn()}
        onUnpublish={vi.fn()}
        onDelete={vi.fn()}
        onArchive={vi.fn()}
        onRestore={vi.fn()}
      />,
    );
    const menu = await openMenu('project-actions.btn.menu');
    expect(menuLabels(menu)).toEqual(['Edit', 'Restore', 'Delete']);
  });

  it('shows nothing but Delete to a read-only admin', async () => {
    renderWithProviders(
      <ProjectActionsMenu
        project={project('Published')}
        canWrite={false}
        isAdmin
        onEdit={vi.fn()}
        onPublish={vi.fn()}
        onUnpublish={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(menuLabels(await openMenu('project-actions.btn.menu'))).toEqual(['Delete']);
  });
});
