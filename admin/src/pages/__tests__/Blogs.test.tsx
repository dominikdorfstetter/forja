import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor, userEvent } from '@/test/test-utils';
import apiService from '@/services/api';
import type { Paginated, BlogListItem } from '@/types/api';

// Mock store hooks to use our test providers
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

vi.mock('@/store/AuthContext', () => ({
  useAuth: () => mockAuth,
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  notifySelectedSiteChanged: vi.fn(),
}));

const mockBlog: BlogListItem = {
  id: 'blog-1',
  slug: 'hello-world',
  author: 'Test Author',
  published_date: '2025-06-15',
  is_featured: true,
  status: 'Published',
  created_at: '2025-06-01T00:00:00Z',
  updated_at: '2025-06-01T00:00:00Z',
};

const mockBlog2: BlogListItem = {
  id: 'blog-2',
  slug: 'second-post',
  author: 'Another Author',
  published_date: '2025-07-01',
  is_featured: false,
  status: 'Draft',
  created_at: '2025-07-01T00:00:00Z',
  updated_at: '2025-07-01T00:00:00Z',
};

const mockPaginatedBlogs: Paginated<BlogListItem> = {
  data: [mockBlog, mockBlog2],
  meta: { page: 1, page_size: 25, total_items: 2, total_pages: 1 },
};

const emptyPaginated: Paginated<BlogListItem> = {
  data: [],
  meta: { page: 1, page_size: 25, total_items: 0, total_pages: 0 },
};

let BlogsPage: typeof import('@/pages/Blogs').default;

beforeEach(async () => {
  vi.clearAllMocks();
  // Reset auth defaults
  mockAuth.canWrite = true;
  mockAuth.isAdmin = true;
  // Default mock for supporting queries
  vi.mocked(apiService.getSiteLocales).mockResolvedValue([]);
  vi.mocked(apiService.getContentTemplates).mockResolvedValue({ data: [], meta: { page: 1, page_size: 100, total_items: 0, total_pages: 0 } });
  const mod = await import('@/pages/Blogs');
  BlogsPage = mod.default;
});

describe('BlogsPage', () => {
  it('shows loading state initially', () => {
    vi.mocked(apiService.getBlogs).mockReturnValue(new Promise(() => {})); // never resolves
    renderWithProviders(<BlogsPage />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders blog table rows after data loads', async () => {
    vi.mocked(apiService.getBlogs).mockResolvedValue(mockPaginatedBlogs);
    renderWithProviders(<BlogsPage />);
    await waitFor(() => {
      expect(screen.getByText('hello-world')).toBeInTheDocument();
    });
    expect(screen.getByText('second-post')).toBeInTheDocument();
    expect(screen.getByText('Test Author')).toBeInTheDocument();
    expect(screen.getByText('Another Author')).toBeInTheDocument();
  });

  it('shows empty state when no blogs', async () => {
    vi.mocked(apiService.getBlogs).mockResolvedValue(emptyPaginated);
    renderWithProviders(<BlogsPage />);
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    const statuses = screen.getAllByRole('status');
    expect(statuses.length).toBeGreaterThan(0);
  });

  it('opens create dialog on add click', async () => {
    vi.mocked(apiService.getBlogs).mockResolvedValue(emptyPaginated);
    renderWithProviders(<BlogsPage />);
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    const user = userEvent.setup();
    // Find the create button in the empty state or page header
    const addButtons = screen.getAllByRole('button');
    const addButton = addButtons.find(
      (b) => b.textContent?.includes('blog') || b.textContent?.includes('Blog') || b.textContent?.includes('Create'),
    );
    expect(addButton).toBeDefined();
    await user.click(addButton!);
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  it('shows 3-dot action menu buttons per row', async () => {
    vi.mocked(apiService.getBlogs).mockResolvedValue(mockPaginatedBlogs);
    renderWithProviders(<BlogsPage />);
    await waitFor(() => {
      expect(screen.getByText('hello-world')).toBeInTheDocument();
    });
    // Each row should have a MoreVertIcon (3-dot menu) button
    const menuButtons = screen.getAllByRole('button').filter(
      (b) => b.querySelector('[data-testid="MoreVertIcon"]'),
    );
    expect(menuButtons.length).toBeGreaterThanOrEqual(2);
  });

  it('opens action menu and shows view details, delete options', async () => {
    vi.mocked(apiService.getBlogs).mockResolvedValue(mockPaginatedBlogs);
    renderWithProviders(<BlogsPage />);
    await waitFor(() => {
      expect(screen.getByText('hello-world')).toBeInTheDocument();
    });
    const user = userEvent.setup();
    const menuButtons = screen.getAllByRole('button').filter(
      (b) => b.querySelector('[data-testid="MoreVertIcon"]'),
    );
    await user.click(menuButtons[0]);
    // Menu should open with View details, Clone, Delete options (no Edit)
    const menu = await screen.findByRole('menu');
    const menuItems = menu.querySelectorAll('[role="menuitem"]');
    const menuTexts = Array.from(menuItems).map((item) => item.textContent);
    expect(menuTexts).toContain('View details');
    expect(menuTexts).not.toContain('Edit');
    expect(menuTexts).toContain('Delete');
  });

  it('opens delete confirm dialog via action menu', async () => {
    vi.mocked(apiService.getBlogs).mockResolvedValue(mockPaginatedBlogs);
    renderWithProviders(<BlogsPage />);
    await waitFor(() => {
      expect(screen.getByText('hello-world')).toBeInTheDocument();
    });
    const user = userEvent.setup();
    const menuButtons = screen.getAllByRole('button').filter(
      (b) => b.querySelector('[data-testid="MoreVertIcon"]'),
    );
    await user.click(menuButtons[0]);
    const menu = await screen.findByRole('menu');
    // Click Delete in the menu (find within menu to avoid BulkActionToolbar's Delete)
    const deleteItem = Array.from(menu.querySelectorAll('[role="menuitem"]')).find(
      (item) => item.textContent === 'Delete',
    )!;
    await user.click(deleteItem);
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  it('hides clone and delete in action menu when canWrite=false and isAdmin=false', async () => {
    mockAuth.canWrite = false;
    mockAuth.isAdmin = false;
    vi.mocked(apiService.getBlogs).mockResolvedValue(mockPaginatedBlogs);
    renderWithProviders(<BlogsPage />);
    await waitFor(() => {
      expect(screen.getByText('hello-world')).toBeInTheDocument();
    });
    const user = userEvent.setup();
    const menuButtons = screen.getAllByRole('button').filter(
      (b) => b.querySelector('[data-testid="MoreVertIcon"]'),
    );
    await user.click(menuButtons[0]);
    await waitFor(() => {
      expect(screen.getByRole('menu')).toBeInTheDocument();
    });
    // View details should still be visible
    expect(screen.getByText('View details')).toBeInTheDocument();
    // Clone, Delete should not be visible
    expect(screen.queryByText('Clone')).not.toBeInTheDocument();
    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
  });

  it('calls cloneBlog via action menu', async () => {
    vi.mocked(apiService.getBlogs).mockResolvedValue(mockPaginatedBlogs);
    vi.mocked(apiService.cloneBlog).mockResolvedValue({
      id: 'blog-3',
      content_id: 'c-3',
      slug: 'hello-world-copy',
      author: 'Test Author',
      published_date: '2025-06-15',
      is_featured: false,
      allow_comments: false,
      status: 'Draft',
      created_at: '2025-06-01T00:00:00Z',
      updated_at: '2025-06-01T00:00:00Z',
    });
    renderWithProviders(<BlogsPage />);
    await waitFor(() => {
      expect(screen.getByText('hello-world')).toBeInTheDocument();
    });
    const user = userEvent.setup();
    const menuButtons = screen.getAllByRole('button').filter(
      (b) => b.querySelector('[data-testid="MoreVertIcon"]'),
    );
    await user.click(menuButtons[0]);
    await waitFor(() => {
      expect(screen.getByRole('menu')).toBeInTheDocument();
    });
    const cloneItem = screen.getByText('Clone').closest('[role="menuitem"]')!;
    await user.click(cloneItem);
    expect(apiService.cloneBlog).toHaveBeenCalledWith('blog-1');
  });

  it('shows error alert when API fails', async () => {
    vi.mocked(apiService.getBlogs).mockRejectedValue(new Error('Network error'));
    renderWithProviders(<BlogsPage />);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });
});
