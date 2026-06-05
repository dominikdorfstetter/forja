import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor, userEvent } from '@/test/test-utils';
import type { Site } from '@/types/api';

const mockNavigate = vi.fn();
vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockSetSelectedSiteId = vi.fn();

const testSites: Site[] = [
  { id: 'site-1', name: 'Alpha Blog', slug: 'alpha-blog', timezone: 'UTC', is_active: true, created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z' },
  { id: 'site-2', name: 'Beta Docs', slug: 'beta-docs', timezone: 'US/Eastern', is_active: false, created_at: '2025-02-01T00:00:00Z', updated_at: '2025-02-01T00:00:00Z' },
];

function mockSiteContext(overrides: Record<string, unknown> = {}) {
  vi.doMock('@/store/SiteContext', () => ({
    useSiteContext: () => ({
      selectedSiteId: '',
      setSelectedSiteId: mockSetSelectedSiteId,
      selectedSite: undefined,
      sites: testSites,
      isLoading: false,
      ...overrides,
    }),
    SiteProvider: ({ children }: { children: React.ReactNode }) => children,
  }));
}

function mockAuth(overrides: Record<string, unknown> = {}) {
  vi.doMock('@/store/AuthContext', () => ({
    useAuth: () => ({
      permission: 'Admin' as const,
      loading: false,
      canRead: true,
      canWrite: true,
      isAdmin: true,
      isMaster: false,
      memberships: [
        { site_id: 'site-1', site_name: 'Alpha Blog', site_slug: 'alpha-blog', role: 'owner' },
        { site_id: 'site-2', site_name: 'Beta Docs', site_slug: 'beta-docs', role: 'editor' },
      ],
      isSystemAdmin: false,
      isGuest: false,
      demoMode: false,
      siteId: null,
      logout: vi.fn(),
      refreshAuth: vi.fn(),
      currentSiteRole: null,
      canManageMembers: true,
      canEditAll: true,
      isOwner: false,
      clerkUserId: 'clerk-1',
      userEmail: 'test@example.com',
      userFullName: 'Test User',
      userImageUrl: null,
      getRoleForSite: (siteId: string) => {
        if (siteId === 'site-1') return 'owner';
        if (siteId === 'site-2') return 'editor';
        return null;
      },
      ...overrides,
    }),
    AuthProvider: ({ children }: { children: React.ReactNode }) => children,
    notifySelectedSiteChanged: vi.fn(),
  }));
}

let SitesPage: typeof import('@/pages/Sites').default;

describe('SitesPage (Launcher)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('renders site cards for multi-site users', async () => {
    mockSiteContext();
    mockAuth();
    const mod = await import('@/pages/Sites');
    SitesPage = mod.default;

    renderWithProviders(<SitesPage />);

    await waitFor(() => {
      expect(screen.getByTestId('site-launcher')).toBeInTheDocument();
    });

    expect(screen.getByText('Alpha Blog')).toBeInTheDocument();
    expect(screen.getByText('Beta Docs')).toBeInTheDocument();
    expect(screen.getByText('alpha-blog')).toBeInTheDocument();
    expect(screen.getByText('beta-docs')).toBeInTheDocument();
  });

  it('shows role badge on each card', async () => {
    mockSiteContext();
    mockAuth();
    const mod = await import('@/pages/Sites');
    SitesPage = mod.default;

    renderWithProviders(<SitesPage />);

    await waitFor(() => {
      expect(screen.getByTestId('site-launcher')).toBeInTheDocument();
    });

    const roleBadges = screen.getAllByTestId('site-card-role');
    expect(roleBadges).toHaveLength(2);
    expect(roleBadges[0]).toHaveTextContent('owner');
    expect(roleBadges[1]).toHaveTextContent('editor');
  });

  it('shows create button for admin users', async () => {
    mockSiteContext();
    mockAuth();
    const mod = await import('@/pages/Sites');
    SitesPage = mod.default;

    renderWithProviders(<SitesPage />);

    await waitFor(() => {
      expect(screen.getByTestId('site-launcher-create')).toBeInTheDocument();
    });
  });

  it('shows create button for non-admin authenticated users (Viewer role)', async () => {
    mockSiteContext();
    mockAuth({ isAdmin: false, isGuest: false });
    const mod = await import('@/pages/Sites');
    SitesPage = mod.default;

    renderWithProviders(<SitesPage />);

    await waitFor(() => {
      expect(screen.getByTestId('site-launcher-create')).toBeInTheDocument();
    });
  });

  it('hides create button for guest users', async () => {
    mockSiteContext();
    mockAuth({ isAdmin: false, isGuest: true });
    const mod = await import('@/pages/Sites');
    SitesPage = mod.default;

    renderWithProviders(<SitesPage />);

    await waitFor(() => {
      expect(screen.getByTestId('site-launcher')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('site-launcher-create')).not.toBeInTheDocument();
  });

  it('selects site and navigates to workspace on card click', async () => {
    mockSiteContext();
    mockAuth();
    const mod = await import('@/pages/Sites');
    SitesPage = mod.default;

    renderWithProviders(<SitesPage />);

    await waitFor(() => {
      expect(screen.getByTestId('site-launcher')).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByTestId('site-card-alpha-blog'));

    expect(mockSetSelectedSiteId).toHaveBeenCalledWith('site-1');
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('auto-redirects single-site users', async () => {
    const singleSite = [testSites[0]];
    mockSiteContext({ sites: singleSite });
    mockAuth();
    const mod = await import('@/pages/Sites');
    SitesPage = mod.default;

    renderWithProviders(<SitesPage />);

    await waitFor(() => {
      expect(mockSetSelectedSiteId).toHaveBeenCalledWith('site-1');
      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
    });
  });

  it('auto-redirects site-scoped API key users', async () => {
    mockSiteContext();
    mockAuth({ siteId: 'site-1' });
    const mod = await import('@/pages/Sites');
    SitesPage = mod.default;

    renderWithProviders(<SitesPage />);

    // Site-scoped users are redirected — launcher content must not render
    expect(screen.queryByTestId('site-launcher')).not.toBeInTheDocument();
  });

  it('shows empty state when no sites', async () => {
    mockSiteContext({ sites: [] });
    mockAuth();
    const mod = await import('@/pages/Sites');
    SitesPage = mod.default;

    renderWithProviders(<SitesPage />);

    await waitFor(() => {
      expect(screen.getByText('No sites yet')).toBeInTheDocument();
    });
  });

  it('surfaces a Recently-deleted link even with no active sites, navigating to /sites/deleted', async () => {
    mockSiteContext({ sites: [] });
    mockAuth();
    const mod = await import('@/pages/Sites');
    SitesPage = mod.default;

    renderWithProviders(<SitesPage />);

    const link = await screen.findByTestId('sites.recently-deleted');
    const user = userEvent.setup();
    await user.click(link);

    expect(mockNavigate).toHaveBeenCalledWith('/sites/deleted');
  });

  it('shows demo join prompt when demo mode and no memberships', async () => {
    mockSiteContext();
    mockAuth({ isAdmin: false, isGuest: false, demoMode: true, memberships: [] });
    const mod = await import('@/pages/Sites');
    SitesPage = mod.default;

    renderWithProviders(<SitesPage />);

    await waitFor(() => {
      expect(screen.getByTestId('demo-join-prompt')).toBeInTheDocument();
    });
  });

  it('hides demo join prompt when not in demo mode', async () => {
    mockSiteContext();
    mockAuth({ isAdmin: false, isGuest: false, demoMode: false, memberships: [] });
    const mod = await import('@/pages/Sites');
    SitesPage = mod.default;

    renderWithProviders(<SitesPage />);

    await waitFor(() => {
      expect(screen.getByTestId('site-launcher')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('demo-join-prompt')).not.toBeInTheDocument();
  });

  it('hides demo join prompt when user has memberships', async () => {
    mockSiteContext();
    mockAuth({ isAdmin: true, isGuest: false, demoMode: true });
    const mod = await import('@/pages/Sites');
    SitesPage = mod.default;

    renderWithProviders(<SitesPage />);

    await waitFor(() => {
      expect(screen.getByTestId('site-launcher')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('demo-join-prompt')).not.toBeInTheDocument();
  });
});
