import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor, within, userEvent } from '@/test/test-utils';
import { getClerkUsers } from '@/services/clerkUsers';
import { getSiteMembers } from '@/services/members';
import type { SiteMembership, SiteRole } from '@/types/api';

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
  currentSiteRole: 'admin' as SiteRole,
  canManageMembers: true,
  canEditAll: true,
  isOwner: false,
  clerkUserId: 'clerk-1',
  userEmail: 'test@example.com',
  userFullName: 'Test User',
  userImageUrl: null,
  getRoleForSite: () => 'admin' as SiteRole,
};

vi.mock('@/store/AuthContext', () => ({
  useAuth: () => mockAuth,
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  notifySelectedSiteChanged: vi.fn(),
}));

const mockMember: SiteMembership = {
  id: 'm-1',
  site_id: 'site-1',
  clerk_user_id: 'clerk-user-2',
  role: 'editor',
  name: 'Jane Doe',
  email: 'jane@example.com',
  image_url: undefined,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

const mockOwner: SiteMembership = {
  id: 'm-2',
  site_id: 'site-1',
  clerk_user_id: 'clerk-1',
  role: 'owner',
  name: 'Test User',
  email: 'test@example.com',
  image_url: undefined,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

let MembersPage: typeof import('@/pages/Members').default;

beforeEach(async () => {
  vi.clearAllMocks();
  mockAuth.canManageMembers = true;
  mockAuth.isOwner = false;
  const mod = await import('@/pages/Members');
  MembersPage = mod.default;
});

describe('MembersPage', () => {
  it('shows loading state initially', () => {
    vi.mocked(getSiteMembers).mockReturnValue(new Promise(() => {}));
    renderWithProviders(<MembersPage />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders member table after data loads', async () => {
    vi.mocked(getSiteMembers).mockResolvedValue([mockOwner, mockMember]);
    renderWithProviders(<MembersPage />);
    await waitFor(() => {
      expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    });
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
  });

  it('shows empty state when no members', async () => {
    vi.mocked(getSiteMembers).mockResolvedValue([]);
    renderWithProviders(<MembersPage />);
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    const statuses = screen.getAllByRole('status');
    expect(statuses.length).toBeGreaterThan(0);
  });

  it('shows error state on API failure', async () => {
    vi.mocked(getSiteMembers).mockRejectedValue(new Error('Network error'));
    renderWithProviders(<MembersPage />);
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    const statuses = screen.getAllByRole('status');
    expect(statuses.length).toBeGreaterThan(0);
  });

  describe('role dropdown permissions', () => {
    it('shows Admin role in inline dropdown when user is owner', async () => {
      const user = userEvent.setup();
      mockAuth.isOwner = true;
      mockAuth.currentSiteRole = 'owner' as const;
      vi.mocked(getSiteMembers).mockResolvedValue([mockOwner, mockMember]);
      renderWithProviders(<MembersPage />);

      await waitFor(() => {
        expect(screen.getByText('Jane Doe')).toBeInTheDocument();
      });

      // Open the role selector dropdown for the non-owner member
      const roleSelector = screen.getByTestId('role-selector');
      const selectTrigger = within(roleSelector).getByRole('combobox');
      await user.click(selectTrigger);

      const listbox = screen.getByRole('listbox');
      expect(within(listbox).getByText('Admin')).toBeInTheDocument();
      expect(within(listbox).getByText('Owner')).toBeInTheDocument();
    });

    it('hides Admin and Owner roles from non-owner admin in inline dropdown', async () => {
      const user = userEvent.setup();
      mockAuth.isOwner = false;
      mockAuth.currentSiteRole = 'admin' as const;
      vi.mocked(getSiteMembers).mockResolvedValue([mockOwner, mockMember]);
      renderWithProviders(<MembersPage />);

      await waitFor(() => {
        expect(screen.getByText('Jane Doe')).toBeInTheDocument();
      });

      const roleSelector = screen.getByTestId('role-selector');
      const selectTrigger = within(roleSelector).getByRole('combobox');
      await user.click(selectTrigger);

      const listbox = screen.getByRole('listbox');
      expect(within(listbox).queryByText('Admin')).not.toBeInTheDocument();
      expect(within(listbox).queryByText('Owner')).not.toBeInTheDocument();
      expect(within(listbox).getByText('Editor')).toBeInTheDocument();
    });

    it('shows transfer ownership option for owner on non-owner members', async () => {
      mockAuth.isOwner = true;
      mockAuth.currentSiteRole = 'owner' as const;
      vi.mocked(getSiteMembers).mockResolvedValue([mockOwner, mockMember]);
      renderWithProviders(<MembersPage />);

      await waitFor(() => {
        expect(screen.getByText('Jane Doe')).toBeInTheDocument();
      });

      // Transfer ownership lives inside the row-action menu now. Open the
      // menu and assert the menu item surfaces for non-owner rows.
      const user = userEvent.setup();
      const actionButtons = screen.getAllByTestId('member-actions.btn.menu');
      await user.click(actionButtons[0]);
      const menu = await screen.findByRole('menu');
      const itemTexts = Array.from(menu.querySelectorAll('[role="menuitem"]')).map(
        (el) => el.textContent || '',
      );
      expect(itemTexts.some((t) => t.includes('Transfer'))).toBe(true);
    });

    it('hides transfer ownership option for non-owner admin', async () => {
      mockAuth.isOwner = false;
      mockAuth.currentSiteRole = 'admin' as const;
      vi.mocked(getSiteMembers).mockResolvedValue([mockOwner, mockMember]);
      renderWithProviders(<MembersPage />);

      await waitFor(() => {
        expect(screen.getByText('Jane Doe')).toBeInTheDocument();
      });

      // For non-owners, the row-action menu must not contain "Transfer".
      const user = userEvent.setup();
      const actionButtons = screen.getAllByTestId('member-actions.btn.menu');
      await user.click(actionButtons[0]);
      const menu = await screen.findByRole('menu');
      const itemTexts = Array.from(menu.querySelectorAll('[role="menuitem"]')).map(
        (el) => el.textContent || '',
      );
      expect(itemTexts.some((t) => t.includes('Transfer'))).toBe(false);
    });

    it('Add Member dialog hides Admin role from non-owner', async () => {
      const user = userEvent.setup();
      mockAuth.isOwner = false;
      mockAuth.currentSiteRole = 'admin' as const;
      vi.mocked(getSiteMembers).mockResolvedValue([mockOwner, mockMember]);
      vi.mocked(getClerkUsers).mockResolvedValue({ data: [], total_count: 0 });
      renderWithProviders(<MembersPage />);

      await waitFor(() => {
        expect(screen.getByText('Jane Doe')).toBeInTheDocument();
      });

      // Open the Add Member dialog
      await user.click(screen.getByTestId('add-member'));

      // Find the role dropdown in the dialog and open it
      const dialog = screen.getByRole('dialog');
      const roleSelects = within(dialog).getAllByRole('combobox');
      // The second combobox is the role selector (first is the search field)
      const roleSelect = roleSelects[roleSelects.length - 1];
      await user.click(roleSelect);

      const listbox = screen.getByRole('listbox');
      expect(within(listbox).queryByText('Admin')).not.toBeInTheDocument();
      expect(within(listbox).queryByText('Owner')).not.toBeInTheDocument();
      expect(within(listbox).getByText('Editor')).toBeInTheDocument();
    });

    it('Add Member dialog shows Admin role to owner', async () => {
      const user = userEvent.setup();
      mockAuth.isOwner = true;
      mockAuth.currentSiteRole = 'owner' as const;
      vi.mocked(getSiteMembers).mockResolvedValue([mockOwner, mockMember]);
      vi.mocked(getClerkUsers).mockResolvedValue({ data: [], total_count: 0 });
      renderWithProviders(<MembersPage />);

      await waitFor(() => {
        expect(screen.getByText('Jane Doe')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('add-member'));

      const dialog = screen.getByRole('dialog');
      const roleSelects = within(dialog).getAllByRole('combobox');
      const roleSelect = roleSelects[roleSelects.length - 1];
      await user.click(roleSelect);

      const listbox = screen.getByRole('listbox');
      expect(within(listbox).getByText('Admin')).toBeInTheDocument();
      // Owner should never appear in Add dialog (use transfer instead)
      expect(within(listbox).queryByText('Owner')).not.toBeInTheDocument();
    });
  });
});
