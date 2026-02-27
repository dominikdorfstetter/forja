import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor, userEvent } from '@/test/test-utils';
import apiService from '@/services/api';
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
    vi.mocked(apiService.getTags).mockResolvedValue(paginatedTags);
    vi.mocked(apiService.getCategories).mockResolvedValue(paginatedCategories);
    renderWithProviders(<TaxonomyPage />);
    await waitFor(() => {
      expect(screen.getByText('javascript')).toBeInTheDocument();
    });
    expect(screen.getByText('typescript')).toBeInTheDocument();
    expect(screen.getByText('tutorials')).toBeInTheDocument();
    expect(screen.getByText('news')).toBeInTheDocument();
  });

  it('shows empty state per section when no data', async () => {
    vi.mocked(apiService.getTags).mockResolvedValue(emptyTags);
    vi.mocked(apiService.getCategories).mockResolvedValue(emptyCategories);
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
    vi.mocked(apiService.getTags).mockResolvedValue(paginatedTags);
    vi.mocked(apiService.getCategories).mockResolvedValue(paginatedCategories);
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
    vi.mocked(apiService.getTags).mockResolvedValue(paginatedTags);
    vi.mocked(apiService.getCategories).mockResolvedValue(paginatedCategories);
    renderWithProviders(<TaxonomyPage />);
    await waitFor(() => {
      expect(screen.getByText('javascript')).toBeInTheDocument();
    });
    const user = userEvent.setup();
    // Find the add tag button (contains AddIcon and tag-related text)
    const allButtons = screen.getAllByRole('button');
    const addTagBtn = allButtons.find(
      (b) => b.textContent?.toLowerCase().includes('tag') && b.querySelector('[data-testid="AddIcon"]'),
    );
    expect(addTagBtn).toBeDefined();
    await user.click(addTagBtn!);
    await waitFor(() => {
      // Tag form dialog should appear
      const dialogs = screen.getAllByRole('dialog');
      expect(dialogs.length).toBeGreaterThan(0);
    });
  });

  it('opens category form dialog on add click', async () => {
    vi.mocked(apiService.getTags).mockResolvedValue(paginatedTags);
    vi.mocked(apiService.getCategories).mockResolvedValue(paginatedCategories);
    renderWithProviders(<TaxonomyPage />);
    await waitFor(() => {
      expect(screen.getByText('tutorials')).toBeInTheDocument();
    });
    const user = userEvent.setup();
    const allButtons = screen.getAllByRole('button');
    const addCatBtn = allButtons.find(
      (b) => b.textContent?.toLowerCase().includes('categor') && b.querySelector('[data-testid="AddIcon"]'),
    );
    expect(addCatBtn).toBeDefined();
    await user.click(addCatBtn!);
    await waitFor(() => {
      const dialogs = screen.getAllByRole('dialog');
      expect(dialogs.length).toBeGreaterThan(0);
    });
  });

  it('shows edit and delete buttons for tag rows', async () => {
    vi.mocked(apiService.getTags).mockResolvedValue(paginatedTags);
    vi.mocked(apiService.getCategories).mockResolvedValue(paginatedCategories);
    renderWithProviders(<TaxonomyPage />);
    await waitFor(() => {
      expect(screen.getByText('javascript')).toBeInTheDocument();
    });
    // Edit buttons
    const editButtons = screen.getAllByRole('button').filter(
      (b) => b.querySelector('[data-testid="EditIcon"]'),
    );
    expect(editButtons.length).toBeGreaterThanOrEqual(2); // at least 2 tags

    // Delete buttons
    const deleteButtons = screen.getAllByRole('button').filter(
      (b) => b.querySelector('[data-testid="DeleteIcon"]'),
    );
    expect(deleteButtons.length).toBeGreaterThanOrEqual(2);
  });

  it('hides edit/delete buttons when canWrite=false and isAdmin=false', async () => {
    mockAuth.canWrite = false;
    mockAuth.isAdmin = false;
    vi.mocked(apiService.getTags).mockResolvedValue(paginatedTags);
    vi.mocked(apiService.getCategories).mockResolvedValue(paginatedCategories);
    renderWithProviders(<TaxonomyPage />);
    await waitFor(() => {
      expect(screen.getByText('javascript')).toBeInTheDocument();
    });
    const editButtons = screen.getAllByRole('button').filter(
      (b) => b.querySelector('[data-testid="EditIcon"]'),
    );
    expect(editButtons).toHaveLength(0);
    const deleteButtons = screen.getAllByRole('button').filter(
      (b) => b.querySelector('[data-testid="DeleteIcon"]'),
    );
    expect(deleteButtons).toHaveLength(0);
  });
});
