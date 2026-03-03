import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor, userEvent } from '@/test/test-utils';
import apiService from '@/services/api';
import type { Paginated, PageListItem } from '@/types/api';

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

const mockPage1: PageListItem = {
  id: 'page-1',
  route: '/about',
  page_type: 'Static',
  slug: 'about',
  is_in_navigation: true,
  status: 'Published',
  created_at: '2025-06-01T00:00:00Z',
};

const mockPage2: PageListItem = {
  id: 'page-2',
  route: '/contact',
  page_type: 'Contact',
  slug: 'contact',
  is_in_navigation: false,
  status: 'Draft',
  created_at: '2025-07-01T00:00:00Z',
};

const mockPaginatedPages: Paginated<PageListItem> = {
  data: [mockPage1, mockPage2],
  meta: { page: 1, page_size: 25, total_items: 2, total_pages: 1 },
};

const emptyPaginated: Paginated<PageListItem> = {
  data: [],
  meta: { page: 1, page_size: 25, total_items: 0, total_pages: 0 },
};

let PagesPage: typeof import('@/pages/Pages').default;

beforeEach(async () => {
  vi.clearAllMocks();
  mockAuth.canWrite = true;
  mockAuth.isAdmin = true;
  const mod = await import('@/pages/Pages');
  PagesPage = mod.default;
});

describe('PagesPage', () => {
  it('shows loading state initially', () => {
    vi.mocked(apiService.getPages).mockReturnValue(new Promise(() => {}));
    renderWithProviders(<PagesPage />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders page table rows after data loads', async () => {
    vi.mocked(apiService.getPages).mockResolvedValue(mockPaginatedPages);
    renderWithProviders(<PagesPage />);
    await waitFor(() => {
      expect(screen.getByText('/about')).toBeInTheDocument();
    });
    expect(screen.getByText('/contact')).toBeInTheDocument();
  });

  it('shows empty state when no pages', async () => {
    vi.mocked(apiService.getPages).mockResolvedValue(emptyPaginated);
    renderWithProviders(<PagesPage />);
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    const statuses = screen.getAllByRole('status');
    expect(statuses.length).toBeGreaterThan(0);
  });

  it('opens create dialog on add click', async () => {
    vi.mocked(apiService.getPages).mockResolvedValue(emptyPaginated);
    renderWithProviders(<PagesPage />);
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    const user = userEvent.setup();
    const addButtons = screen.getAllByRole('button');
    const addButton = addButtons.find(
      (b) => b.textContent?.includes('page') || b.textContent?.includes('Page') || b.textContent?.includes('Create'),
    );
    expect(addButton).toBeDefined();
    await user.click(addButton!);
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  it('shows view, edit, and delete action buttons per row', async () => {
    vi.mocked(apiService.getPages).mockResolvedValue(mockPaginatedPages);
    renderWithProviders(<PagesPage />);
    await waitFor(() => {
      expect(screen.getByText('/about')).toBeInTheDocument();
    });
    const viewButtons = screen.getAllByRole('button').filter(
      (b) => b.querySelector('[data-testid="VisibilityIcon"]'),
    );
    expect(viewButtons.length).toBeGreaterThanOrEqual(2);

    const editButtons = screen.getAllByRole('button').filter(
      (b) => b.querySelector('[data-testid="EditIcon"]'),
    );
    expect(editButtons.length).toBeGreaterThanOrEqual(2);

    const deleteButtons = screen.getAllByRole('button').filter(
      (b) => b.querySelector('[data-testid="DeleteIcon"]'),
    );
    expect(deleteButtons.length).toBeGreaterThanOrEqual(2);
  });

  it('opens delete confirm dialog on delete icon click', async () => {
    vi.mocked(apiService.getPages).mockResolvedValue(mockPaginatedPages);
    renderWithProviders(<PagesPage />);
    await waitFor(() => {
      expect(screen.getByText('/about')).toBeInTheDocument();
    });
    const user = userEvent.setup();
    const deleteButtons = screen.getAllByRole('button').filter(
      (b) => b.querySelector('[data-testid="DeleteIcon"]'),
    );
    expect(deleteButtons.length).toBeGreaterThan(0);
    await user.click(deleteButtons[0]);
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  it('hides edit and delete buttons when canWrite=false and isAdmin=false', async () => {
    mockAuth.canWrite = false;
    mockAuth.isAdmin = false;
    vi.mocked(apiService.getPages).mockResolvedValue(mockPaginatedPages);
    renderWithProviders(<PagesPage />);
    await waitFor(() => {
      expect(screen.getByText('/about')).toBeInTheDocument();
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

  it('displays page type chips correctly', async () => {
    vi.mocked(apiService.getPages).mockResolvedValue(mockPaginatedPages);
    renderWithProviders(<PagesPage />);
    await waitFor(() => {
      expect(screen.getByText('Static')).toBeInTheDocument();
    });
    expect(screen.getByText('Contact')).toBeInTheDocument();
  });

  it('shows error alert when API fails', async () => {
    vi.mocked(apiService.getPages).mockRejectedValue(new Error('Network error'));
    renderWithProviders(<PagesPage />);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });
});
