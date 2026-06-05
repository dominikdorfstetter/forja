import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor, userEvent } from '@/test/test-utils';
import { cloneBlog, getBlogs } from '@/services/blogs';
import { getContentTemplates } from '@/services/contentTemplates';
import { getSiteLocales } from '@/services/siteLocales';
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

vi.mock('@/store/AuthContext', () => ({
  useAuth: () => mockAuth,
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  notifySelectedSiteChanged: vi.fn(),
}));

const mockBlog: BlogListItem = {
  id: 'blog-1',
  content_id: 'content-1',
  slug: 'hello-world',
  author: 'Test Author',
  published_date: '2025-06-15',
  is_featured: true,
  is_sample: false,
  status: 'Published',
  created_at: '2025-06-01T00:00:00Z',
  updated_at: '2025-06-01T00:00:00Z',
};

const mockBlog2: BlogListItem = {
  id: 'blog-2',
  content_id: 'content-2',
  slug: 'second-post',
  author: 'Another Author',
  published_date: '2025-07-01',
  is_featured: false,
  is_sample: false,
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

beforeAll(async () => {
  const mod = await import('@/pages/Blogs');
  BlogsPage = mod.default;
}, 30_000);

beforeEach(() => {
  vi.clearAllMocks();
  // Reset auth defaults
  mockAuth.canWrite = true;
  mockAuth.isAdmin = true;
  // Default mock for supporting queries
  vi.mocked(getSiteLocales).mockResolvedValue([]);
  vi.mocked(getContentTemplates).mockResolvedValue({ data: [], meta: { page: 1, page_size: 100, total_items: 0, total_pages: 0 } });
});

describe('BlogsPage', () => {
  it('shows loading state initially', () => {
    vi.mocked(getBlogs).mockReturnValue(new Promise(() => {})); // never resolves
    renderWithProviders(<BlogsPage />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders blog table rows after data loads', async () => {
    vi.mocked(getBlogs).mockResolvedValue(mockPaginatedBlogs);
    renderWithProviders(<BlogsPage />);
    await waitFor(() => {
      expect(screen.getByText('hello-world')).toBeInTheDocument();
    });
    expect(screen.getByText('second-post')).toBeInTheDocument();
    expect(screen.getByText('Test Author')).toBeInTheDocument();
    expect(screen.getByText('Another Author')).toBeInTheDocument();
  });

  it('shows empty state when no blogs', async () => {
    vi.mocked(getBlogs).mockResolvedValue(emptyPaginated);
    renderWithProviders(<BlogsPage />);
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    const statuses = screen.getAllByRole('status');
    expect(statuses.length).toBeGreaterThan(0);
  });

  it('opens create dialog on add click', async () => {
    vi.mocked(getBlogs).mockResolvedValue(emptyPaginated);
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
    vi.mocked(getBlogs).mockResolvedValue(mockPaginatedBlogs);
    renderWithProviders(<BlogsPage />);
    await waitFor(() => {
      expect(screen.getByText('hello-world')).toBeInTheDocument();
    });
    // Each row should have a MoreVertIcon (3-dot menu) button
    const menuButtons = screen.getAllByTestId('blog-actions.btn.menu');
    expect(menuButtons.length).toBeGreaterThanOrEqual(2);
  });

  it('opens action menu and shows view details, delete options', async () => {
    vi.mocked(getBlogs).mockResolvedValue(mockPaginatedBlogs);
    renderWithProviders(<BlogsPage />);
    await waitFor(() => {
      expect(screen.getByText('hello-world')).toBeInTheDocument();
    });
    const user = userEvent.setup();
    const menuButtons = screen.getAllByTestId('blog-actions.btn.menu');
    await user.click(menuButtons[0]);
    // Menu should open with View details, Clone, Delete options (no Edit).
    // Menu items include a Material Symbols icon ligature in their text
    // content alongside the label, so assert on a substring match.
    const menu = await screen.findByRole('menu');
    const menuTexts = Array.from(menu.querySelectorAll('[role="menuitem"]')).map(
      (item) => item.textContent || '',
    );
    expect(menuTexts.some((t) => t.includes('View details'))).toBe(true);
    expect(menuTexts.some((t) => t === 'Edit' || t.endsWith(' Edit'))).toBe(false);
    expect(menuTexts.some((t) => t.includes('Delete'))).toBe(true);
  });

  it('opens delete confirm dialog via action menu', async () => {
    vi.mocked(getBlogs).mockResolvedValue(mockPaginatedBlogs);
    renderWithProviders(<BlogsPage />);
    await waitFor(() => {
      expect(screen.getByText('hello-world')).toBeInTheDocument();
    });
    const user = userEvent.setup();
    const menuButtons = screen.getAllByTestId('blog-actions.btn.menu');
    await user.click(menuButtons[0]);
    const menu = await screen.findByRole('menu');
    // Click Delete in the menu (find within menu to avoid BulkActionToolbar's Delete).
    // Menu items include an icon ligature before the label — match the label span.
    const deleteItem = Array.from(menu.querySelectorAll('[role="menuitem"]')).find(
      (item) => (item.textContent || '').includes('Delete'),
    )!;
    await user.click(deleteItem);
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  it('hides clone and delete in action menu when canWrite=false and isAdmin=false', async () => {
    mockAuth.canWrite = false;
    mockAuth.isAdmin = false;
    vi.mocked(getBlogs).mockResolvedValue(mockPaginatedBlogs);
    renderWithProviders(<BlogsPage />);
    await waitFor(() => {
      expect(screen.getByText('hello-world')).toBeInTheDocument();
    });
    const user = userEvent.setup();
    const menuButtons = screen.getAllByTestId('blog-actions.btn.menu');
    await user.click(menuButtons[0]);
    await waitFor(() => {
      expect(screen.getByRole('menu')).toBeInTheDocument();
    });
    // View details should still be visible as a menu item label
    const menu = screen.getByRole('menu');
    const itemTexts = Array.from(menu.querySelectorAll('[role="menuitem"]')).map(
      (item) => item.textContent || '',
    );
    expect(itemTexts.some((t) => t.includes('View details'))).toBe(true);
    // Clone, Delete should not appear in the menu
    expect(itemTexts.some((t) => t.includes('Clone'))).toBe(false);
    expect(itemTexts.some((t) => t.includes('Delete'))).toBe(false);
  });

  it('calls cloneBlog via action menu', async () => {
    vi.mocked(getBlogs).mockResolvedValue(mockPaginatedBlogs);
    vi.mocked(cloneBlog).mockResolvedValue({
      id: 'blog-3',
      content_id: 'c-3',
      slug: 'hello-world-copy',
      author: 'Test Author',
      published_date: '2025-06-15',
      is_featured: false,
      is_sample: false,
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
    const menuButtons = screen.getAllByTestId('blog-actions.btn.menu');
    await user.click(menuButtons[0]);
    await waitFor(() => {
      expect(screen.getByRole('menu')).toBeInTheDocument();
    });
    const menu = screen.getByRole('menu');
    const cloneItem = Array.from(menu.querySelectorAll('[role="menuitem"]')).find(
      (item) => (item.textContent || '').includes('Clone'),
    )!;
    await user.click(cloneItem);
    expect(cloneBlog).toHaveBeenCalledWith('blog-1');
  });

  it('shows error alert when API fails', async () => {
    vi.mocked(getBlogs).mockRejectedValue(new Error('Network error'));
    renderWithProviders(<BlogsPage />);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });
});
