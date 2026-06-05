import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/test-utils';
import { getTrash, restoreTrashItem } from '@/services/sites';
import TrashPage from '../TrashPage';

vi.mock('@/store/SiteContext', () => ({
  useSiteContext: () => ({ selectedSiteId: 'site-1' }),
  SiteProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/store/AuthContext', () => ({
  useAuth: () => ({
    isAdmin: true,
    isMaster: false,
    canWrite: true,
    canRead: true,
    permission: 'Admin',
  }),
}));

const mockTrashData = {
  items: [
    {
      id: 'content-1',
      entity_type: 'blog',
      title: 'Deleted Blog Post',
      slug: 'deleted-blog',
      deleted_at: '2026-03-20T10:00:00Z',
      site_id: 'site-1',
    },
    {
      id: 'content-2',
      entity_type: 'page',
      title: 'Deleted Page',
      slug: 'deleted-page',
      deleted_at: '2026-03-15T10:00:00Z',
      site_id: 'site-1',
    },
  ],
  total: 2,
};

const mockTrashDataWithNewTypes = {
  items: [
    {
      id: 'content-1',
      entity_type: 'blog',
      title: 'Deleted Blog Post',
      slug: 'deleted-blog',
      deleted_at: '2026-03-20T10:00:00Z',
      site_id: 'site-1',
    },
    {
      id: 'legal-1',
      entity_type: 'legal',
      title: 'Privacy Policy',
      slug: 'privacy-policy',
      deleted_at: '2026-03-19T10:00:00Z',
      site_id: 'site-1',
    },
    {
      id: 'social-1',
      entity_type: 'social',
      title: 'GitHub',
      slug: 'https://github.com/example',
      deleted_at: '2026-03-18T10:00:00Z',
      site_id: 'site-1',
    },
    {
      id: 'menu-1',
      entity_type: 'menu',
      title: 'Primary Menu',
      slug: 'primary',
      deleted_at: '2026-03-17T10:00:00Z',
      site_id: 'site-1',
    },
    {
      id: 'menu-item-1',
      entity_type: 'menu_item',
      title: 'About',
      slug: null,
      deleted_at: '2026-03-16T10:00:00Z',
      site_id: 'site-1',
    },
    {
      id: 'project-content-1',
      entity_type: 'project',
      title: 'My Flagship Project',
      slug: 'flagship',
      deleted_at: '2026-03-15T10:00:00Z',
      site_id: 'site-1',
    },
    {
      id: 'cv-content-1',
      entity_type: 'cv_entry',
      title: 'Acme Corp',
      slug: null,
      deleted_at: '2026-03-14T10:00:00Z',
      site_id: 'site-1',
    },
    {
      id: 'skill-1',
      entity_type: 'skill',
      title: 'Rust',
      slug: 'rust',
      deleted_at: '2026-03-13T10:00:00Z',
      site_id: 'site-1',
    },
  ],
  total: 8,
};

describe('TrashPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getTrash).mockResolvedValue(mockTrashData);
  });

  it('renders trash items', async () => {
    renderWithProviders(<TrashPage />);

    expect(await screen.findByText('Deleted Blog Post')).toBeInTheDocument();
    expect(await screen.findByText('Deleted Page')).toBeInTheDocument();
  });

  it('shows entity type chips', async () => {
    renderWithProviders(<TrashPage />);

    expect(await screen.findByText('Blog')).toBeInTheDocument();
    expect(await screen.findByText('Page')).toBeInTheDocument();
  });

  it('shows empty state when no items', async () => {
    vi.mocked(getTrash).mockResolvedValue({ items: [], total: 0 });

    renderWithProviders(<TrashPage />);

    expect(await screen.findByText('Trash is empty')).toBeInTheDocument();
  });

  it('calls restore API via the row ActionMenu', async () => {
    vi.mocked(restoreTrashItem).mockResolvedValue(undefined);
    const user = userEvent.setup();

    renderWithProviders(<TrashPage />);

    // Row actions live inside an ActionMenu — open the first row's menu
    // and click the Restore item.
    const triggers = await screen.findAllByTestId(/^trash\.actions\./);
    await user.click(triggers[0]);
    const menu = await screen.findByRole('menu');
    const restoreItem = Array.from(menu.querySelectorAll('[role="menuitem"]')).find(
      (el) => (el.textContent || '').toLowerCase().includes('restore'),
    )!;
    await user.click(restoreItem);

    expect(restoreTrashItem).toHaveBeenCalledWith('content-1', 'blog');
  });

  it('shows confirm dialog for permanent delete via the row ActionMenu', async () => {
    const user = userEvent.setup();

    renderWithProviders(<TrashPage />);

    const triggers = await screen.findAllByTestId(/^trash\.actions\./);
    await user.click(triggers[0]);
    const menu = await screen.findByRole('menu');
    const deleteItem = Array.from(menu.querySelectorAll('[role="menuitem"]')).find(
      (el) => (el.textContent || '').toLowerCase().includes('delete'),
    )!;
    await user.click(deleteItem);

    expect(await screen.findByText('This cannot be undone. Are you sure?')).toBeInTheDocument();
  });

  it('shows delete all button for admins', async () => {
    renderWithProviders(<TrashPage />);

    expect(await screen.findByTestId('trash.delete-all')).toBeInTheDocument();
  });

  it('renders legal document type', async () => {
    vi.mocked(getTrash).mockResolvedValue(mockTrashDataWithNewTypes);
    renderWithProviders(<TrashPage />);
    expect(await screen.findByText('Privacy Policy')).toBeInTheDocument();
    expect(await screen.findByText('Legal Document')).toBeInTheDocument();
  });

  it('renders social link type', async () => {
    vi.mocked(getTrash).mockResolvedValue(mockTrashDataWithNewTypes);
    renderWithProviders(<TrashPage />);
    expect(await screen.findByText('GitHub')).toBeInTheDocument();
    expect(await screen.findByText('Social Link')).toBeInTheDocument();
  });

  it('renders navigation menu type', async () => {
    vi.mocked(getTrash).mockResolvedValue(mockTrashDataWithNewTypes);
    renderWithProviders(<TrashPage />);
    expect(await screen.findByText('Primary Menu')).toBeInTheDocument();
    expect(await screen.findByText('Navigation Menu')).toBeInTheDocument();
  });

  it('renders menu item type', async () => {
    vi.mocked(getTrash).mockResolvedValue(mockTrashDataWithNewTypes);
    renderWithProviders(<TrashPage />);
    expect(await screen.findByText('About')).toBeInTheDocument();
    expect(await screen.findByText('Menu Item')).toBeInTheDocument();
  });

  it('renders portfolio project type', async () => {
    vi.mocked(getTrash).mockResolvedValue(mockTrashDataWithNewTypes);
    renderWithProviders(<TrashPage />);
    expect(await screen.findByText('My Flagship Project')).toBeInTheDocument();
    expect(await screen.findByText('Project')).toBeInTheDocument();
  });

  it('renders cv entry type', async () => {
    vi.mocked(getTrash).mockResolvedValue(mockTrashDataWithNewTypes);
    renderWithProviders(<TrashPage />);
    expect(await screen.findByText('Acme Corp')).toBeInTheDocument();
    expect(await screen.findByText('CV Entry')).toBeInTheDocument();
  });

  it('renders skill type', async () => {
    vi.mocked(getTrash).mockResolvedValue(mockTrashDataWithNewTypes);
    renderWithProviders(<TrashPage />);
    expect(await screen.findByText('Rust')).toBeInTheDocument();
    expect(await screen.findByText('Skill')).toBeInTheDocument();
  });

  it('restores a skill with its own-table entity type passed through', async () => {
    vi.mocked(getTrash).mockResolvedValue(mockTrashDataWithNewTypes);
    vi.mocked(restoreTrashItem).mockResolvedValue(undefined);
    const user = userEvent.setup();

    renderWithProviders(<TrashPage />);

    const trigger = await screen.findByTestId('trash.actions.skill-1');
    await user.click(trigger);
    const menu = await screen.findByRole('menu');
    const restoreItem = Array.from(menu.querySelectorAll('[role="menuitem"]')).find(
      (el) => (el.textContent || '').toLowerCase().includes('restore'),
    )!;
    await user.click(restoreItem);

    expect(restoreTrashItem).toHaveBeenCalledWith('skill-1', 'skill');
  });

  it('calls restore with correct entity type for new types', async () => {
    vi.mocked(getTrash).mockResolvedValue(mockTrashDataWithNewTypes);
    vi.mocked(restoreTrashItem).mockResolvedValue(undefined);
    const user = userEvent.setup();

    renderWithProviders(<TrashPage />);

    // Open the legal-1 row's ActionMenu and click Restore.
    const trigger = await screen.findByTestId('trash.actions.legal-1');
    await user.click(trigger);
    const menu = await screen.findByRole('menu');
    const restoreItem = Array.from(menu.querySelectorAll('[role="menuitem"]')).find(
      (el) => (el.textContent || '').toLowerCase().includes('restore'),
    )!;
    await user.click(restoreItem);

    expect(restoreTrashItem).toHaveBeenCalledWith('legal-1', 'legal');
  });

  it('requests the first page with the default page size', async () => {
    renderWithProviders(<TrashPage />);

    await screen.findByText('Deleted Blog Post');
    expect(getTrash).toHaveBeenCalledWith('site-1', 1, 10);
  });

  it('paginates: clicking next refetches with the next page number', async () => {
    // total (25) exceeds the page size (10), so a next page exists.
    vi.mocked(getTrash).mockResolvedValue({ items: mockTrashData.items, total: 25 });
    const user = userEvent.setup();

    renderWithProviders(<TrashPage />);

    await screen.findByText('Deleted Blog Post');
    expect(getTrash).toHaveBeenCalledWith('site-1', 1, 10);

    await user.click(screen.getByLabelText('Next page'));

    await waitFor(() => expect(getTrash).toHaveBeenCalledWith('site-1', 2, 10));
  });

  it('shows batch actions when rows selected via the table header checkbox', async () => {
    const user = userEvent.setup();

    renderWithProviders(<TrashPage />);

    // DataTableV2's header checkbox selects all rows. It's the first
    // checkbox rendered inside the first (header) role=row.
    await screen.findByTestId('trash.table');
    const headerRow = screen.getAllByRole('row')[0];
    const headerCheckbox = headerRow.querySelector('input[type="checkbox"]') as HTMLInputElement;
    await user.click(headerCheckbox);

    expect(await screen.findByTestId('trash.batch-restore')).toBeInTheDocument();
    expect(await screen.findByTestId('trash.batch-delete')).toBeInTheDocument();
  });
});
