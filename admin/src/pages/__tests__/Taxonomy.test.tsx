import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor, userEvent } from '@/test/test-utils';
import { getCategories, getTags } from '@/services/taxonomy';
import type { Paginated, Tag, Category } from '@/types/api';

// Mock store hooks
const mockAuth = {
  permission: 'Admin' as const,
  loading: false,
  canRead: true,
  canWrite: true,
  isAdmin: true,
  isMaster: false,
  memberships: [],
  isSystemAdmin: false,
  isGuest: false,
  siteId: null,
  logout: vi.fn(),
  refreshAuth: vi.fn(),
  currentSiteRole: 'admin' as const,
  canManageMembers: true,
  canEditAll: true,
  isOwner: false,
  clerkUserId: 'clerk-1',
  userEmail: 'test@example.com',
  userFullName: 'Test User',
  userImageUrl: null,
  getRoleForSite: () => 'admin' as const,
};

vi.mock('@/store/SiteContext', () => ({
  useSiteContext: () => ({
    selectedSiteId: 'site-1',
    setSelectedSiteId: vi.fn(),
    selectedSite: { id: 'site-1', name: 'Test Site', slug: 'test-site', created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z' },
    sites: [{ id: 'site-1', name: 'Test Site', slug: 'test-site', created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z' }],
    isLoading: false,
  }),
  SiteProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/store/AuthContext', () => ({
  useAuth: () => mockAuth,
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  notifySelectedSiteChanged: vi.fn(),
}));

const mockTags: Tag[] = [
  { id: 'tag-1', slug: 'javascript', is_global: false, created_at: '2025-01-01T00:00:00Z' },
  { id: 'tag-2', slug: 'typescript', is_global: true, created_at: '2025-01-02T00:00:00Z' },
];

const mockCategories: Category[] = [
  { id: 'cat-1', slug: 'tutorials', is_global: false, created_at: '2025-01-01T00:00:00Z' },
  { id: 'cat-2', slug: 'news', is_global: true, parent_id: 'cat-1', created_at: '2025-01-02T00:00:00Z' },
];

const paginatedTags: Paginated<Tag> = {
  data: mockTags,
  meta: { page: 1, page_size: 25, total_items: 2, total_pages: 1 },
};

const paginatedCategories: Paginated<Category> = {
  data: mockCategories,
  meta: { page: 1, page_size: 25, total_items: 2, total_pages: 1 },
};

const emptyTags: Paginated<Tag> = {
  data: [],
  meta: { page: 1, page_size: 25, total_items: 0, total_pages: 0 },
};

const emptyCategories: Paginated<Category> = {
  data: [],
  meta: { page: 1, page_size: 25, total_items: 0, total_pages: 0 },
};

let TaxonomyPage: typeof import('@/pages/Taxonomy').default;

beforeEach(async () => {
  vi.clearAllMocks();
  // Reset auth to defaults
  mockAuth.canWrite = true;
  mockAuth.isAdmin = true;
  const mod = await import('@/pages/Taxonomy');
  TaxonomyPage = mod.default;
});

describe('TaxonomyPage', () => {
  it('renders tags and categories sections', async () => {
    vi.mocked(getTags).mockResolvedValue(paginatedTags);
    vi.mocked(getCategories).mockResolvedValue(paginatedCategories);
    renderWithProviders(<TaxonomyPage />);
    await waitFor(() => {
      expect(screen.getByText('javascript')).toBeInTheDocument();
    });
    expect(screen.getByText('typescript')).toBeInTheDocument();
    expect(screen.getByText('tutorials')).toBeInTheDocument();
    expect(screen.getByText('news')).toBeInTheDocument();
  });

  it('shows empty state per section when no data', async () => {
    vi.mocked(getTags).mockResolvedValue(emptyTags);
    vi.mocked(getCategories).mockResolvedValue(emptyCategories);
    renderWithProviders(<TaxonomyPage />);
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    // Should render empty state status containers
    const statusElements = screen.getAllByRole('status');
    expect(statusElements.length).toBeGreaterThanOrEqual(2);
  });

  it('hides add buttons when canWrite=false', async () => {
    mockAuth.canWrite = false;
    mockAuth.isAdmin = false;
    vi.mocked(getTags).mockResolvedValue(paginatedTags);
    vi.mocked(getCategories).mockResolvedValue(paginatedCategories);
    renderWithProviders(<TaxonomyPage />);
    await waitFor(() => {
      expect(screen.getByText('javascript')).toBeInTheDocument();
    });
    // The "Add tag" and "Add category" buttons should not be present
    const buttons = screen.getAllByRole('button');
    const addButtons = buttons.filter((b) =>
      b.textContent?.toLowerCase().includes('add'),
    );
    expect(addButtons).toHaveLength(0);
  });

  it('opens tag form dialog on add click', async () => {
    vi.mocked(getTags).mockResolvedValue(paginatedTags);
    vi.mocked(getCategories).mockResolvedValue(paginatedCategories);
    renderWithProviders(<TaxonomyPage />);
    await waitFor(() => {
      expect(screen.getByText('javascript')).toBeInTheDocument();
    });
    const user = userEvent.setup();
    await user.click(screen.getByTestId('create-tag'));
    await waitFor(() => {
      const dialogs = screen.getAllByRole('dialog');
      expect(dialogs.length).toBeGreaterThan(0);
    });
  });

  it('opens category form dialog on add click', async () => {
    vi.mocked(getTags).mockResolvedValue(paginatedTags);
    vi.mocked(getCategories).mockResolvedValue(paginatedCategories);
    renderWithProviders(<TaxonomyPage />);
    await waitFor(() => {
      expect(screen.getByText('tutorials')).toBeInTheDocument();
    });
    const user = userEvent.setup();
    await user.click(screen.getByTestId('create-category'));
    await waitFor(() => {
      const dialogs = screen.getAllByRole('dialog');
      expect(dialogs.length).toBeGreaterThan(0);
    });
  });

  it('shows row-action menus for tag rows', async () => {
    vi.mocked(getTags).mockResolvedValue(paginatedTags);
    vi.mocked(getCategories).mockResolvedValue(paginatedCategories);
    renderWithProviders(<TaxonomyPage />);
    await waitFor(() => {
      expect(screen.getByText('javascript')).toBeInTheDocument();
    });
    // Row actions live inside a single menu trigger per row.
    const tagActionTriggers = screen.getAllByTestId('tag-actions.btn.menu');
    expect(tagActionTriggers.length).toBeGreaterThanOrEqual(2);

    // Open the first tag row's menu and verify Edit + Delete items are present.
    const user = userEvent.setup();
    await user.click(tagActionTriggers[0]);
    const menu = await screen.findByRole('menu');
    const itemTexts = Array.from(menu.querySelectorAll('[role="menuitem"]')).map(
      (el) => el.textContent || '',
    );
    expect(itemTexts.some((x) => x.toLowerCase().includes('edit'))).toBe(true);
    expect(itemTexts.some((x) => x.toLowerCase().includes('delete'))).toBe(true);
  });

  it('hides row-action menu when canWrite=false and isAdmin=false', async () => {
    mockAuth.canWrite = false;
    mockAuth.isAdmin = false;
    vi.mocked(getTags).mockResolvedValue(paginatedTags);
    vi.mocked(getCategories).mockResolvedValue(paginatedCategories);
    renderWithProviders(<TaxonomyPage />);
    await waitFor(() => {
      expect(screen.getByText('javascript')).toBeInTheDocument();
    });
    expect(screen.queryAllByTestId('tag-actions.btn.menu')).toHaveLength(0);
    expect(screen.queryAllByTestId('category-actions.btn.menu')).toHaveLength(0);
  });
});
