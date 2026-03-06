import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test/test-utils';
import apiService from '@/services/api';
import type { Paginated, Redirect } from '@/types/api';

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
  useAuth: () => ({
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
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  notifySelectedSiteChanged: vi.fn(),
}));

const mockRedirect: Redirect = {
  id: 'r-1',
  site_id: 'site-1',
  source_path: '/old-page',
  destination_path: '/new-page',
  status_code: 301,
  is_active: true,
  created_at: '2025-06-01T00:00:00Z',
  updated_at: '2025-06-01T00:00:00Z',
};

const mockRedirect2: Redirect = {
  id: 'r-2',
  site_id: 'site-1',
  source_path: '/temp',
  destination_path: '/final',
  status_code: 302,
  is_active: false,
  created_at: '2025-07-01T00:00:00Z',
  updated_at: '2025-07-01T00:00:00Z',
};

const mockPaginated: Paginated<Redirect> = {
  data: [mockRedirect, mockRedirect2],
  meta: { page: 1, page_size: 25, total_items: 2, total_pages: 1 },
};

const emptyPaginated: Paginated<Redirect> = {
  data: [],
  meta: { page: 1, page_size: 25, total_items: 0, total_pages: 0 },
};

let RedirectsPage: typeof import('@/pages/Redirects').default;

beforeEach(async () => {
  vi.clearAllMocks();
  const mod = await import('@/pages/Redirects');
  RedirectsPage = mod.default;
});

describe('RedirectsPage', () => {
  it('shows loading state initially', () => {
    vi.mocked(apiService.getRedirects).mockReturnValue(new Promise(() => {}));
    renderWithProviders(<RedirectsPage />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders redirect table after data loads', async () => {
    vi.mocked(apiService.getRedirects).mockResolvedValue(mockPaginated);
    renderWithProviders(<RedirectsPage />);
    await waitFor(() => {
      expect(screen.getByText('/old-page')).toBeInTheDocument();
    });
    expect(screen.getByText('/new-page')).toBeInTheDocument();
    expect(screen.getByText('/temp')).toBeInTheDocument();
  });

  it('shows empty state when no redirects', async () => {
    vi.mocked(apiService.getRedirects).mockResolvedValue(emptyPaginated);
    renderWithProviders(<RedirectsPage />);
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    const statuses = screen.getAllByRole('status');
    expect(statuses.length).toBeGreaterThan(0);
  });
});
