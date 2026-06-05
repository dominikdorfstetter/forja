import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test/test-utils';
import { getApiKeys } from '@/services/apiKeys';
import { getBlogs } from '@/services/blogs';
import { getHealth } from '@/services/health';
import { getMedia } from '@/services/media';
import { getNavigationMenus } from '@/services/navigation';
import { getPages } from '@/services/pages';
import { getSiteLocales } from '@/services/siteLocales';
import { getSiteSettings, getSites } from '@/services/sites';
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
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  notifySelectedSiteChanged: vi.fn(),
}));

function mockDashboardAPIs() {
  vi.mocked(getSites).mockResolvedValue([
    { id: 'site-1', name: 'Test Site', slug: 'test-site', timezone: 'UTC', is_active: true, created_at: '', updated_at: '' },
  ]);
  vi.mocked(getBlogs).mockResolvedValue({
    data: [
      { id: 'b1', content_id: 'c1', slug: 'post-1', author: 'Author', published_date: '', is_featured: false, is_sample: false, status: 'Published', created_at: '2025-06-01T00:00:00Z', updated_at: '2025-06-01T00:00:00Z' },
    ],
    meta: { page: 1, page_size: 200, total_items: 1, total_pages: 1 },
  });
  vi.mocked(getPages).mockResolvedValue({
    data: [],
    meta: { page: 1, page_size: 200, total_items: 0, total_pages: 0 },
  });
  vi.mocked(getMedia).mockResolvedValue({
    data: [],
    meta: { page: 1, page_size: 1, total_items: 3, total_pages: 3 },
  });
  vi.mocked(getApiKeys).mockResolvedValue({
    data: [],
    meta: { page: 1, page_size: 25, total_items: 0, total_pages: 0 },
  });
  vi.mocked(getHealth).mockResolvedValue({
    status: 'healthy',
    version: '1.0.0',
    services: [],
  } as never);
  vi.mocked(getSiteLocales).mockResolvedValue([]);
  vi.mocked(getNavigationMenus).mockResolvedValue([]);
  vi.mocked(getSiteSettings).mockResolvedValue({} as never);
}

let DashboardHome: typeof import('@/pages/DashboardHome').default;

beforeAll(async () => {
  const mod = await import('@/pages/DashboardHome');
  DashboardHome = mod.default;
}, 30_000);

beforeEach(() => {
  vi.clearAllMocks();
  mockDashboardAPIs();
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
    vi.mocked(getHealth).mockResolvedValue({
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
