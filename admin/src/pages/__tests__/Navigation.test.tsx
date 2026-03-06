import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test/test-utils';
import apiService from '@/services/api';
import type { NavigationMenu } from '@/types/api';

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

const mockMenu: NavigationMenu = {
  id: 'menu-1',
  site_id: 'site-1',
  slug: 'main-menu',
  max_depth: 3,
  is_active: true,
  item_count: 2,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

let NavigationPage: typeof import('@/pages/Navigation').default;

beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(apiService.getSiteLocales).mockResolvedValue([]);
  const mod = await import('@/pages/Navigation');
  NavigationPage = mod.default;
});

describe('NavigationPage', () => {
  it('shows loading state initially', () => {
    vi.mocked(apiService.getNavigationMenus).mockReturnValue(new Promise(() => {}));
    renderWithProviders(<NavigationPage />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('shows empty state when no menus exist', async () => {
    vi.mocked(apiService.getNavigationMenus).mockResolvedValue([]);
    renderWithProviders(<NavigationPage />);
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    const statuses = screen.getAllByRole('status');
    expect(statuses.length).toBeGreaterThan(0);
  });

  it('renders menu tabs after data loads', async () => {
    vi.mocked(apiService.getNavigationMenus).mockResolvedValue([mockMenu]);
    vi.mocked(apiService.getMenuItems).mockResolvedValue([]);
    renderWithProviders(<NavigationPage />);
    await waitFor(() => {
      expect(screen.getByText('main-menu')).toBeInTheDocument();
    });
  });
});
