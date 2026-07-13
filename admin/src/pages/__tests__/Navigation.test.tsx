import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { getMenuItems, getNavigationMenus } from '@/services/navigation';
import { getPages } from '@/services/pages';
import { getLegalDocuments } from '@/services/legal';
import { getSiteLocales } from '@/services/siteLocales';
import type { NavigationMenu, NavigationItem } from '@/types/api';

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

const mockInactiveMenu: NavigationMenu = {
  id: 'menu-2',
  site_id: 'site-1',
  slug: 'footer',
  max_depth: 2,
  is_active: false,
  item_count: 0,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

const mockItems: NavigationItem[] = [
  { id: 'item-1', menu_id: 'menu-1', page_id: 'page-1', display_order: 0, open_in_new_tab: false, title: 'Home' },
  { id: 'item-2', menu_id: 'menu-1', parent_id: 'item-1', page_id: 'page-2', display_order: 0, open_in_new_tab: false, title: 'About' },
  { id: 'item-3', menu_id: 'menu-1', external_url: 'https://example.com', display_order: 1, open_in_new_tab: true, title: 'External' },
];

let NavigationPage: typeof import('@/pages/Navigation').default;

beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(getSiteLocales).mockResolvedValue([]);
  vi.mocked(getPages).mockResolvedValue({
    data: [
      { id: 'page-1', route: '/home', page_type: 'Static', slug: 'home', is_in_navigation: true, status: 'Published', created_at: '2025-01-01T00:00:00Z' },
      { id: 'page-2', route: '/about', page_type: 'Static', slug: 'about', is_in_navigation: true, status: 'Published', created_at: '2025-01-01T00:00:00Z' },
    ],
    meta: { page: 1, page_size: 200, total_items: 2, total_pages: 1 },
  });
  const mod = await import('@/pages/Navigation');
  NavigationPage = mod.default;
});

describe('NavigationPage', () => {
  it('shows loading state initially', () => {
    vi.mocked(getNavigationMenus).mockReturnValue(new Promise(() => {}));
    renderWithProviders(<NavigationPage />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('shows empty state when no menus exist', async () => {
    vi.mocked(getNavigationMenus).mockResolvedValue([]);
    renderWithProviders(<NavigationPage />);
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    const statuses = screen.getAllByRole('status');
    expect(statuses.length).toBeGreaterThan(0);
  });

  it('renders menu tabs after data loads', async () => {
    vi.mocked(getNavigationMenus).mockResolvedValue([mockMenu]);
    vi.mocked(getMenuItems).mockResolvedValue([]);
    renderWithProviders(<NavigationPage />);
    await waitFor(() => {
      expect(screen.getByText('main-menu')).toBeInTheDocument();
    });
  });

  it('shows empty state when menu has no items', async () => {
    vi.mocked(getNavigationMenus).mockResolvedValue([mockMenu]);
    vi.mocked(getMenuItems).mockResolvedValue([]);
    renderWithProviders(<NavigationPage />);
    await waitFor(() => {
      expect(screen.getByText(/no navigation items yet/i)).toBeInTheDocument();
    });
  });

  it('renders navigation items in table', async () => {
    vi.mocked(getNavigationMenus).mockResolvedValue([mockMenu]);
    vi.mocked(getMenuItems).mockResolvedValue(mockItems);
    renderWithProviders(<NavigationPage />);
    await waitFor(() => {
      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getByText('About')).toBeInTheDocument();
      // "External" appears both as title and chip label — check rows exist
      const rows = screen.getAllByTestId('nav-row');
      expect(rows.length).toBe(3);
    });
  });

  it('shows tree connectors for nested items', async () => {
    vi.mocked(getNavigationMenus).mockResolvedValue([mockMenu]);
    vi.mocked(getMenuItems).mockResolvedValue(mockItems);
    renderWithProviders(<NavigationPage />);
    await waitFor(() => {
      expect(screen.getByText('About')).toBeInTheDocument();
    });
    // Nested item "About" should have a tree connector
    const connectors = screen.getAllByTestId('tree-connector');
    expect(connectors.length).toBeGreaterThan(0);
  });

  it('shows expand/collapse toggle for parent items', async () => {
    vi.mocked(getNavigationMenus).mockResolvedValue([mockMenu]);
    vi.mocked(getMenuItems).mockResolvedValue(mockItems);
    renderWithProviders(<NavigationPage />);
    await waitFor(() => {
      expect(screen.getByText('Home')).toBeInTheDocument();
    });
    // Parent item "Home" should have an expand toggle
    const toggles = screen.getAllByTestId('tree-toggle');
    expect(toggles.length).toBeGreaterThan(0);
  });

  it('collapses children when toggle is clicked', async () => {
    const user = userEvent.setup();
    vi.mocked(getNavigationMenus).mockResolvedValue([mockMenu]);
    vi.mocked(getMenuItems).mockResolvedValue(mockItems);
    renderWithProviders(<NavigationPage />);

    // Wait for items to render (parents auto-expanded)
    await waitFor(() => {
      expect(screen.getByText('About')).toBeInTheDocument();
    });

    // Click toggle to collapse
    const toggle = screen.getAllByTestId('tree-toggle')[0];
    await user.click(toggle);

    // "About" (child of "Home") should no longer be visible
    await waitFor(() => {
      expect(screen.queryByText('About')).not.toBeInTheDocument();
    });
  });

  it('shows link target as page route for internal items', async () => {
    vi.mocked(getNavigationMenus).mockResolvedValue([mockMenu]);
    vi.mocked(getMenuItems).mockResolvedValue(mockItems);
    renderWithProviders(<NavigationPage />);
    await waitFor(() => {
      expect(screen.getByText('Home')).toBeInTheDocument();
    });
    // Internal item should show page route
    const linkTargets = screen.getAllByTestId('link-target');
    expect(linkTargets[0]).toHaveTextContent('/home');
    // External item should show URL
    expect(linkTargets[2]).toHaveTextContent('https://example.com');
  });

  it('shows type chips for internal and external items', async () => {
    vi.mocked(getNavigationMenus).mockResolvedValue([mockMenu]);
    vi.mocked(getMenuItems).mockResolvedValue(mockItems);
    renderWithProviders(<NavigationPage />);
    await waitFor(() => {
      expect(screen.getByText('Home')).toBeInTheDocument();
    });
    const typeChips = screen.getAllByTestId('type-chip');
    expect(typeChips.length).toBe(3);
    // First two items are internal (page_id set), third is external
    expect(typeChips[0]).toHaveTextContent('Internal');
    expect(typeChips[2]).toHaveTextContent('External');
  });

  it('shows locale coverage when locales are configured', async () => {
    vi.mocked(getSiteLocales).mockResolvedValue([
      { site_id: 'site-1', locale_id: 'loc-1', is_default: true, is_active: true, created_at: '2025-01-01T00:00:00Z', code: 'en', name: 'English', direction: 'Ltr' as const },
      { site_id: 'site-1', locale_id: 'loc-2', is_default: false, is_active: true, created_at: '2025-01-01T00:00:00Z', code: 'de', name: 'German', direction: 'Ltr' as const },
    ]);
    const itemsWithLocales: NavigationItem[] = [
      { id: 'item-1', menu_id: 'menu-1', page_id: 'page-1', display_order: 0, open_in_new_tab: false, title: 'Home', locale_count: 2 },
      { id: 'item-2', menu_id: 'menu-1', external_url: 'https://example.com', display_order: 1, open_in_new_tab: false, title: 'Ext', locale_count: 1 },
    ];
    vi.mocked(getNavigationMenus).mockResolvedValue([mockMenu]);
    vi.mocked(getMenuItems).mockResolvedValue(itemsWithLocales);
    renderWithProviders(<NavigationPage />);
    await waitFor(() => {
      expect(screen.getByText('Home')).toBeInTheDocument();
    });
    const localeCells = screen.getAllByTestId('locale-count');
    expect(localeCells.length).toBe(2);
    expect(localeCells[0]).toHaveTextContent('2/2');
    expect(localeCells[1]).toHaveTextContent('1/2');
  });

  it('shows a broken-link indicator for target-less items and keeps them editable', async () => {
    const brokenItems: NavigationItem[] = [
      { id: 'item-1', menu_id: 'menu-1', display_order: 0, open_in_new_tab: false, title: 'Orphan' },
    ];
    vi.mocked(getNavigationMenus).mockResolvedValue([mockMenu]);
    vi.mocked(getMenuItems).mockResolvedValue(brokenItems);
    renderWithProviders(<NavigationPage />);
    await waitFor(() => {
      expect(screen.getByText('Orphan')).toBeInTheDocument();
    });
    expect(screen.getByTestId('broken-link-chip')).toHaveTextContent(/broken link/i);
    expect(screen.getByTestId('edit-nav-item')).toBeInTheDocument();
  });

  it('resolves legal items to /legal/{slug} in the link column with a Legal chip', async () => {
    const legalItems: NavigationItem[] = [
      { id: 'item-1', menu_id: 'menu-1', legal_document_id: 'legal-1', display_order: 0, open_in_new_tab: false, title: 'Privacy' },
    ];
    vi.mocked(getNavigationMenus).mockResolvedValue([mockMenu]);
    vi.mocked(getMenuItems).mockResolvedValue(legalItems);
    vi.mocked(getLegalDocuments).mockResolvedValue({
      data: [{ id: 'legal-1', cookie_name: 'privacy_policy', slug: 'privacy-policy', document_type: 'PrivacyPolicy', status: 'Published', version: 1, created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z' }],
      meta: { page: 1, page_size: 200, total_items: 1, total_pages: 1 },
    });
    renderWithProviders(<NavigationPage />);
    await waitFor(() => {
      expect(screen.getByText('Privacy')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByTestId('link-target')).toHaveTextContent('/legal/privacy-policy');
    });
    expect(screen.getByTestId('type-chip')).toHaveTextContent('Legal');
  });

  it('shows inactive menu with muted styling', async () => {
    vi.mocked(getNavigationMenus).mockResolvedValue([mockMenu, mockInactiveMenu]);
    vi.mocked(getMenuItems).mockResolvedValue([]);
    renderWithProviders(<NavigationPage />);
    await waitFor(() => {
      expect(screen.getByText('footer')).toBeInTheDocument();
      expect(screen.getByText(/\(inactive\)/i)).toBeInTheDocument();
    });
  });
});
