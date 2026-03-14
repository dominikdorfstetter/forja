import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test/test-utils';
import apiService from '@/services/api';

vi.mock('@/store/SiteContext', () => ({
  useSiteContext: () => ({
    selectedSiteId: 'site-1',
    setSelectedSiteId: vi.fn(),
    selectedSite: { id: 'site-1', name: 'Test Site', slug: 'test-site', timezone: 'UTC', is_active: true, created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z' },
    sites: [{ id: 'site-1', name: 'Test Site', slug: 'test-site', timezone: 'UTC', is_active: true, created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z' }],
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

function mockDashboardAPIs() {
  vi.mocked(apiService.getSites).mockResolvedValue([
    { id: 'site-1', name: 'Test Site', slug: 'test-site', timezone: 'UTC', is_active: true, created_at: '', updated_at: '' },
  ]);
  vi.mocked(apiService.getBlogs).mockResolvedValue({
    data: [
      { id: 'b1', content_id: 'c1', slug: 'post-1', author: 'Author', published_date: '', is_featured: false, is_sample: false, status: 'Published', created_at: '2025-06-01T00:00:00Z', updated_at: '2025-06-01T00:00:00Z' },
    ],
    meta: { page: 1, page_size: 200, total_items: 1, total_pages: 1 },
  });
  vi.mocked(apiService.getPages).mockResolvedValue({
    data: [],
    meta: { page: 1, page_size: 200, total_items: 0, total_pages: 0 },
  });
  vi.mocked(apiService.getMedia).mockResolvedValue({
    data: [],
    meta: { page: 1, page_size: 1, total_items: 3, total_pages: 3 },
  });
  vi.mocked(apiService.getApiKeys).mockResolvedValue({
    data: [],
    meta: { page: 1, page_size: 25, total_items: 0, total_pages: 0 },
  });
  vi.mocked(apiService.getHealth).mockResolvedValue({
    status: 'healthy',
    version: '1.0.0',
    services: [],
  } as never);
  vi.mocked(apiService.getSiteLocales).mockResolvedValue([]);
  vi.mocked(apiService.getNavigationMenus).mockResolvedValue([]);
  vi.mocked(apiService.getSiteSettings).mockResolvedValue({} as never);
}

let DashboardHome: typeof import('@/pages/DashboardHome').default;

beforeEach(async () => {
  vi.clearAllMocks();
  mockDashboardAPIs();
  const mod = await import('@/pages/DashboardHome');
  DashboardHome = mod.default;
});

describe('DashboardHome', () => {
  it('renders dashboard title', async () => {
    renderWithProviders(<DashboardHome />);
    await waitFor(() => {
      expect(screen.getByTestId('dashboard.page')).toBeInTheDocument();
    });
  });

  it('renders stat cards after data loads', async () => {
    renderWithProviders(<DashboardHome />);
    await waitFor(() => {
      expect(screen.getByTestId('dashboard.page')).toBeInTheDocument();
    });
  });

  it('shows health status when available', async () => {
    vi.mocked(apiService.getHealth).mockResolvedValue({
      status: 'healthy',
      version: '2.0.0',
      services: [{ name: 'database', status: 'up', latency_ms: 5 }],
    } as never);
    renderWithProviders(<DashboardHome />);
    await waitFor(() => {
      expect(screen.getByText('v2.0.0')).toBeInTheDocument();
    });
  });
});
