import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { getNavigationItemLocalizations } from '@/services/navigation';
import { getPage, getPages } from '@/services/pages';
import type { NavigationItem, Locale, PageListItem, Paginated } from '@/types/api';
import NavigationItemWizard from '../NavigationItemWizard';

vi.mock('@/hooks/useSiteContextData', () => ({
  useSiteContextData: () => ({
    modules: { blog: true, pages: true, cv: true, legal: false, documents: false, ai: false },
    context: { modules: { blog: true, pages: true, cv: true, legal: false, documents: false, ai: false } },
  }),
}));

vi.mock('@/store/SiteContext', () => ({
  useSiteContext: () => ({
    selectedSiteId: 'site-1',
    setSelectedSiteId: vi.fn(),
    selectedSite: { id: 'site-1', name: 'Test Site', slug: 'test-site', created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z' },
    sites: [],
    isLoading: false,
  }),
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

const mockLocales: Locale[] = [
  { id: 'loc-en', code: 'en', name: 'English', native_name: 'English', direction: 'Ltr', is_active: true, created_at: '2025-01-01T00:00:00Z', site_count: 1 },
  { id: 'loc-de', code: 'de', name: 'German', native_name: 'Deutsch', direction: 'Ltr', is_active: true, created_at: '2025-01-01T00:00:00Z', site_count: 1 },
];

const mockPages: Paginated<PageListItem> = {
  data: [
    { id: 'page-1', route: '/about', page_type: 'Static', slug: 'about', is_in_navigation: true, status: 'Published', created_at: '2025-01-01T00:00:00Z' },
  ],
  meta: { page: 1, page_size: 20, total_items: 1, total_pages: 1 },
};

const existingItem: NavigationItem = {
  id: 'nav-1',
  menu_id: 'menu-1',
  parent_id: undefined,
  page_id: 'page-1',
  external_url: undefined,
  icon: 'home',
  display_order: 0,
  open_in_new_tab: false,
  title: 'About',
};

const defaultProps = {
  open: true,
  siteId: 'site-1',
  menuId: 'menu-1',
  locales: mockLocales,
  allItems: [] as NavigationItem[],
  maxDepth: 3,
  onSubmit: vi.fn(),
  onClose: vi.fn(),
  loading: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getPages).mockResolvedValue(mockPages);
  vi.mocked(getPage).mockResolvedValue({
    id: 'page-1', content_id: 'c-1', route: '/about', page_type: 'Static', slug: 'about',
    is_in_navigation: true, status: 'Published', created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z',
  });
  vi.mocked(getNavigationItemLocalizations).mockResolvedValue([]);
});

describe('NavigationItemWizard', () => {
  it('renders with 3 wizard steps', () => {
    renderWithProviders(<NavigationItemWizard {...defaultProps} />);
    expect(screen.getByTestId('navigation-wizard.dialog')).toBeInTheDocument();
    expect(screen.getByText(/link target/i)).toBeInTheDocument();
    expect(screen.getByText(/translations/i)).toBeInTheDocument();
    expect(screen.getByText(/options/i)).toBeInTheDocument();
  });

  it('shows link type toggle on step 1', () => {
    renderWithProviders(<NavigationItemWizard {...defaultProps} />);
    expect(screen.getByRole('button', { name: /^internal$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^external$/i })).toBeInTheDocument();
  });

  it('shows page picker when internal link type selected', () => {
    renderWithProviders(<NavigationItemWizard {...defaultProps} />);
    expect(screen.getByTestId('page-picker')).toBeInTheDocument();
  });

  it('shows URL field when external link type selected', async () => {
    const user = userEvent.setup();
    renderWithProviders(<NavigationItemWizard {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: /^external$/i }));
    expect(screen.getByLabelText(/external url/i)).toBeInTheDocument();
  });

  it('disables Next button until a page is selected (step 1)', () => {
    renderWithProviders(<NavigationItemWizard {...defaultProps} />);
    const nextBtn = screen.getByTestId('navigation-wizard.btn.next');
    expect(nextBtn).toBeDisabled();
  });

  it('advances to step 2 after selecting a page', async () => {
    const user = userEvent.setup();
    renderWithProviders(<NavigationItemWizard {...defaultProps} />);

    // Select a page from the picker
    const input = screen.getByTestId('page-picker').querySelector('input')!;
    await user.click(input);
    await waitFor(() => expect(screen.getByText('/about')).toBeInTheDocument());
    await user.click(screen.getByText('/about'));

    // Click Next
    const nextBtn = screen.getByTestId('navigation-wizard.btn.next');
    await waitFor(() => expect(nextBtn).not.toBeDisabled());
    await user.click(nextBtn);

    // Step 2: locale tabs should appear
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /en/i })).toBeInTheDocument();
    });
  });

  it('shows one tab per locale on step 2', async () => {
    const user = userEvent.setup();
    renderWithProviders(<NavigationItemWizard {...defaultProps} />);

    // Select page and advance
    const input = screen.getByTestId('page-picker').querySelector('input')!;
    await user.click(input);
    await waitFor(() => expect(screen.getByText('/about')).toBeInTheDocument());
    await user.click(screen.getByText('/about'));
    const nextBtn = screen.getByTestId('navigation-wizard.btn.next');
    await waitFor(() => expect(nextBtn).not.toBeDisabled());
    await user.click(nextBtn);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /en/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /de/i })).toBeInTheDocument();
    });
  });

  it('hides tab bar when only one locale exists', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <NavigationItemWizard {...defaultProps} locales={[mockLocales[0]]} />,
    );

    const input = screen.getByTestId('page-picker').querySelector('input')!;
    await user.click(input);
    await waitFor(() => expect(screen.getByText('/about')).toBeInTheDocument());
    await user.click(screen.getByText('/about'));
    const nextBtn = screen.getByTestId('navigation-wizard.btn.next');
    await waitFor(() => expect(nextBtn).not.toBeDisabled());
    await user.click(nextBtn);

    // Single locale — no tab bar, just a title field
    await waitFor(() => {
      expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
      expect(screen.getByLabelText(/title \(en\)/i)).toBeInTheDocument();
    });
  });

  it('shows parent picker, icon, and open_in_new_tab on step 3', async () => {
    const user = userEvent.setup();
    renderWithProviders(<NavigationItemWizard {...defaultProps} />);

    // Advance through step 1: select a page
    const input = screen.getByTestId('page-picker').querySelector('input')!;
    await user.click(input);
    await waitFor(() => expect(screen.getByText('/about')).toBeInTheDocument());
    await user.click(screen.getByText('/about'));
    const nextBtn = screen.getByTestId('navigation-wizard.btn.next');
    await waitFor(() => expect(nextBtn).not.toBeDisabled());
    await user.click(nextBtn);

    // Step 2: enter a title so Next is enabled
    await waitFor(() => expect(screen.getByTestId('navigation-wizard.title-input')).toBeInTheDocument());
    const titleInput = screen.getByTestId('navigation-wizard.title-input').querySelector('input')!;
    await user.type(titleInput, 'About Us');

    // Step 2 → 3
    await waitFor(() => expect(screen.getByTestId('navigation-wizard.btn.next')).not.toBeDisabled());
    await user.click(screen.getByTestId('navigation-wizard.btn.next'));

    // Step 3 fields
    await waitFor(() => {
      expect(screen.getByLabelText(/icon/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/open in new tab/i)).toBeInTheDocument();
    });
  });

  it('pre-populates form fields in edit mode', async () => {
    vi.mocked(getNavigationItemLocalizations).mockResolvedValue([
      { id: 'loc-1', navigation_item_id: 'nav-1', locale_id: 'loc-en', title: 'About Us' },
      { id: 'loc-2', navigation_item_id: 'nav-1', locale_id: 'loc-de', title: 'Über uns' },
    ]);

    renderWithProviders(
      <NavigationItemWizard {...defaultProps} item={existingItem} />,
    );

    // Step 1 should show the page picker with pre-selected page
    await waitFor(() => {
      const pickerInput = screen.getByTestId('page-picker').querySelector('input')!;
      expect(pickerInput).toHaveValue('/about');
    });
  });

  it('does not include display_order field', () => {
    renderWithProviders(<NavigationItemWizard {...defaultProps} />);
    expect(screen.queryByLabelText(/display.?order/i)).not.toBeInTheDocument();
  });

  it('shows create title for new items', () => {
    renderWithProviders(<NavigationItemWizard {...defaultProps} />);
    expect(screen.getByText(/add navigation item/i)).toBeInTheDocument();
  });

  it('shows edit title for existing items', () => {
    renderWithProviders(<NavigationItemWizard {...defaultProps} item={existingItem} />);
    expect(screen.getByText(/edit navigation item/i)).toBeInTheDocument();
  });
});
