import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent, waitFor } from '@/test/test-utils';
import { getDeletedSites, restoreSite } from '@/services/sites';
import { useAuth } from '@/store/AuthContext';
import type { Site } from '@/types/api';
import DeletedSitesPage from '../DeletedSitesPage';

const mockNavigate = vi.fn();
vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@/store/AuthContext', () => ({
  useAuth: vi.fn(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const ownerAuth = {
  permission: 'Admin',
  siteId: null,
  loading: false,
  memberships: [],
  isSystemAdmin: false,
  isGuest: false,
  demoMode: false,
  logout: vi.fn(),
  refreshAuth: vi.fn(),
  canRead: true,
  canWrite: true,
  isAdmin: true,
  isMaster: false,
  currentSiteRole: 'owner',
  canManageMembers: true,
  canEditAll: true,
  isOwner: true,
  clerkUserId: 'user_self',
  userEmail: 'me@example.com',
  userFullName: 'Me',
  userImageUrl: null,
  getRoleForSite: () => 'owner',
} as unknown as ReturnType<typeof useAuth>;

function site(over: Partial<Site>): Site {
  return {
    id: 'site-9',
    name: 'Old Blog',
    slug: 'old-blog',
    timezone: 'Europe/Vienna',
    is_active: false,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    deleted_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    ...over,
  } as Site;
}

describe('DeletedSitesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue(ownerAuth);
  });

  it('tracer: owner sees a deleted site, clicks Restore, restoreSite is called, toast shows, row disappears', async () => {
    const user = userEvent.setup();
    vi.mocked(getDeletedSites)
      .mockResolvedValueOnce([site({ id: 'site-9', name: 'Old Blog' })])
      .mockResolvedValue([]);
    vi.mocked(restoreSite).mockResolvedValue(site({ id: 'site-9' }));

    renderWithProviders(<DeletedSitesPage />, { route: '/sites/deleted' });

    expect(await screen.findByText('Old Blog')).toBeInTheDocument();

    await user.click(screen.getByTestId('deleted-sites.restore.site-9'));

    await waitFor(() => expect(restoreSite).toHaveBeenCalledWith('site-9'));
    expect(await screen.findByText(/site restored/i)).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByText('Old Blog')).not.toBeInTheDocument(),
    );
  });

  it('countdown: a site deleted 25 days ago shows 5 days remaining', async () => {
    const deletedAt = new Date(
      Date.now() - 25 * 24 * 60 * 60 * 1000,
    ).toISOString();
    vi.mocked(getDeletedSites).mockResolvedValue([
      site({ id: 'site-9', name: 'Old Blog', deleted_at: deletedAt }),
    ]);

    renderWithProviders(<DeletedSitesPage />, { route: '/sites/deleted' });

    expect(await screen.findByText(/expires in 5 days/i)).toBeInTheDocument();
  });

  it('permission: a non-owner sees the empty state (their deleted sites are filtered out)', async () => {
    vi.mocked(useAuth).mockReturnValue({
      ...ownerAuth,
      isOwner: false,
      getRoleForSite: () => 'editor',
    } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(getDeletedSites).mockResolvedValue([
      site({ id: 'site-9', name: 'Old Blog' }),
    ]);

    renderWithProviders(<DeletedSitesPage />, { route: '/sites/deleted' });

    expect(
      await screen.findByText(/no recently deleted sites/i),
    ).toBeInTheDocument();
    expect(screen.queryByText('Old Blog')).not.toBeInTheDocument();
  });

  it('edge: a 410 surfaces the expired message and shows no success toast', async () => {
    const user = userEvent.setup();
    vi.mocked(getDeletedSites).mockResolvedValue([
      site({ id: 'site-9', name: 'Old Blog' }),
    ]);
    vi.mocked(restoreSite).mockRejectedValue({
      type: 'about:blank',
      title: 'Gone',
      status: 410,
      code: 'SITE_RESTORE_EXPIRED',
    });

    renderWithProviders(<DeletedSitesPage />, { route: '/sites/deleted' });

    await user.click(await screen.findByTestId('deleted-sites.restore.site-9'));

    expect(
      await screen.findByText(/restore window for this site has lapsed/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/site restored/i)).not.toBeInTheDocument();
  });

  it('a11y: the list and the Restore button expose accessible names', async () => {
    vi.mocked(getDeletedSites).mockResolvedValue([
      site({ id: 'site-9', name: 'Old Blog' }),
    ]);

    renderWithProviders(<DeletedSitesPage />, { route: '/sites/deleted' });

    expect(
      await screen.findByRole('list', { name: /recently deleted sites/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /restore old blog/i }),
    ).toBeInTheDocument();
  });
});
